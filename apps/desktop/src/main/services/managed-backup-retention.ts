import fs from "fs";
import path from "path";

import { listRecoveryArtifacts, pruneRecoveryArtifacts } from "@prompthub/core";
import {
  listDatabaseSafetyPoints,
  pruneDatabaseSafetyPoints,
} from "@prompthub/db";

import { getDataLayoutMigrationMarkerPath } from "./data-layout-migration";
import {
  deleteUpgradeBackup,
  listUpgradeBackupRetentionEntries,
} from "./upgrade-backup";

const MIN_MANAGED_BACKUP_BUDGET_BYTES = 512 * 1024 * 1024;
const ACTIVE_STORAGE_BUDGET_MULTIPLIER = 3;
const DEFAULT_MAX_ENTRIES = 8;
const DEFAULT_MAX_OPTIONAL_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SCAN_ENTRIES = 100_000;
const MAX_ACTIVE_SCAN_DEPTH = 32;
const MAX_LAYOUT_MARKER_BYTES = 64 * 1024;
const TRANSIENT_DATABASE_ENTRY_PATTERNS = [
  /^prompthub\.db\.backup-/u,
  /^prompthub\.db\.pre-/u,
  /^prompthub\.db\.corrupt-/u,
];

type BackupFamily = "upgrade" | "recovery" | "database";

interface ManagedPoint {
  family: BackupFamily;
  id: string;
  createdAt: string;
  sizeBytes: number;
  pinned: boolean;
}

export interface ManagedBackupRetentionOptions {
  now?: Date;
  maxManagedBytes?: number;
  maxEntries?: number;
  maxOptionalAgeMs?: number;
  maxActiveScanEntries?: number;
  maxActiveScanDepth?: number;
  dryRun?: boolean;
}

export interface ManagedBackupRetentionResult {
  activeBytes: number;
  budgetBytes: number;
  beforeBytes: number;
  afterBytes: number;
  kept: Record<BackupFamily, string[]>;
  removed: Record<BackupFamily, string[]>;
  errors: string[];
}

export type ManagedBackupRetentionStartupEvent =
  ManagedBackupRetentionResult & {
    event: "startup:managed_backup_retention";
    [key: string]: unknown;
  };

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function measureActiveStorage(
  rootPath: string,
  maxEntries: number,
  maxDepth: number,
): number {
  let entries = 0;
  let totalBytes = 0;
  const dataPath = path.join(rootPath, "data");
  const visit = (targetPath: string, depth: number): void => {
    if (depth > maxDepth) {
      throw new Error(`Active storage exceeds depth limit: ${targetPath}`);
    }
    entries += 1;
    if (entries > maxEntries) {
      throw new Error("Active storage exceeds entry limit");
    }
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(targetPath)) {
        visit(path.join(targetPath, entry), depth + 1);
      }
    } else if (
      stats.isFile() &&
      !(
        path.dirname(targetPath) === dataPath &&
        TRANSIENT_DATABASE_ENTRY_PATTERNS.some((pattern) =>
          pattern.test(path.basename(targetPath)),
        )
      )
    ) {
      totalBytes += stats.size;
    }
  };

  for (const entry of ["data", "config", "secrets"]) {
    const targetPath = path.join(rootPath, entry);
    if (fs.existsSync(targetPath)) visit(targetPath, 1);
  }
  return totalBytes;
}

function resolveDatabasePath(rootPath: string): string | null {
  for (const candidate of [
    path.join(rootPath, "data", "prompthub.db"),
    path.join(rootPath, "prompthub.db"),
  ]) {
    try {
      const stats = fs.lstatSync(candidate);
      if (!stats.isSymbolicLink() && stats.isFile()) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

function readIncompleteLayoutBackupId(rootPath: string): string | null {
  const markerPath = getDataLayoutMigrationMarkerPath(rootPath);
  try {
    const stats = fs.lstatSync(markerPath);
    if (
      stats.isSymbolicLink() ||
      !stats.isFile() ||
      stats.size > MAX_LAYOUT_MARKER_BYTES
    ) {
      return null;
    }
    const value = JSON.parse(fs.readFileSync(markerPath, "utf8")) as {
      backupId?: unknown;
      failedEntries?: unknown;
    };
    return Array.isArray(value.failedEntries) &&
      value.failedEntries.length > 0 &&
      typeof value.backupId === "string" &&
      value.backupId.length > 0
      ? value.backupId
      : null;
  } catch {
    return null;
  }
}

function emptyFamilies(): Record<BackupFamily, string[]> {
  return { upgrade: [], recovery: [], database: [] };
}

function pointTime(point: ManagedPoint): number {
  const parsed = Date.parse(point.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumPoints(points: ManagedPoint[]): number {
  return points.reduce((total, point) => total + point.sizeBytes, 0);
}

function sumSelectedPoints(
  points: ManagedPoint[],
  selected: Record<BackupFamily, string[]>,
): number {
  const selectedKeys = new Set(
    (Object.entries(selected) as Array<[BackupFamily, string[]]>).flatMap(
      ([family, ids]) => ids.map((id) => `${family}:${id}`),
    ),
  );
  return sumPoints(
    points.filter((point) => selectedKeys.has(`${point.family}:${point.id}`)),
  );
}

interface ManagedInventory {
  points: ManagedPoint[];
  databasePath: string | null;
  activeBytes: number;
}

interface RetentionPlan {
  nowMs: number;
  budgetBytes: number;
  keptPoints: ManagedPoint[];
  kept: Record<BackupFamily, string[]>;
  removed: Record<BackupFamily, string[]>;
}

async function loadManagedInventory(
  rootPath: string,
  options: ManagedBackupRetentionOptions,
): Promise<ManagedInventory> {
  const upgrades = await listUpgradeBackupRetentionEntries(rootPath);
  const recovery = listRecoveryArtifacts(rootPath);
  const databasePath = resolveDatabasePath(rootPath);
  const database = databasePath ? listDatabaseSafetyPoints(databasePath) : [];
  return {
    activeBytes: measureActiveStorage(
      rootPath,
      positiveSafeInteger(
        options.maxActiveScanEntries ?? MAX_ACTIVE_SCAN_ENTRIES,
        "maxActiveScanEntries",
      ),
      positiveSafeInteger(
        options.maxActiveScanDepth ?? MAX_ACTIVE_SCAN_DEPTH,
        "maxActiveScanDepth",
      ),
    ),
    databasePath,
    points: [
      ...upgrades.map((point) => ({
        family: "upgrade" as const,
        id: point.backupId,
        createdAt: point.manifest.createdAt,
        sizeBytes: point.retentionBytes,
        pinned: false,
      })),
      ...recovery.map((point) => ({
        family: "recovery" as const,
        id: point.id,
        createdAt: point.createdAt,
        sizeBytes: point.totalBytes,
        pinned: Boolean(point.pinnedReason),
      })),
      ...database.map((point) => ({
        family: "database" as const,
        id: point.id,
        createdAt: point.manifest.createdAt,
        sizeBytes: point.manifest.totalBytes,
        pinned: false,
      })),
    ],
  };
}

function calculateBudget(activeBytes: number, override?: number): number {
  const derived = Math.max(
    MIN_MANAGED_BACKUP_BUDGET_BYTES,
    Math.min(
      Number.MAX_SAFE_INTEGER,
      activeBytes * ACTIVE_STORAGE_BUDGET_MULTIPLIER,
    ),
  );
  return positiveSafeInteger(override ?? derived, "maxManagedBytes");
}

function initialProtectedKeys(
  points: ManagedPoint[],
  rootPath: string,
): Set<string> {
  const keys = new Set<string>();
  const keyFor = (point: ManagedPoint) => `${point.family}:${point.id}`;
  for (const family of ["upgrade", "recovery", "database"] as const) {
    const newest = points
      .filter((point) => point.family === family)
      .reduce<ManagedPoint | null>(
        (current, point) =>
          !current || pointTime(point) > pointTime(current) ? point : current,
        null,
      );
    if (newest) keys.add(keyFor(newest));
  }
  for (const point of points) {
    if (point.pinned) keys.add(keyFor(point));
  }
  const layoutBackupId = readIncompleteLayoutBackupId(rootPath);
  const layoutPoint = points.find(
    (point) => point.family === "upgrade" && point.id === layoutBackupId,
  );
  if (layoutPoint) keys.add(keyFor(layoutPoint));
  return keys;
}

function buildRetentionPlan(
  inventory: ManagedInventory,
  rootPath: string,
  options: ManagedBackupRetentionOptions,
): RetentionPlan {
  const nowMs = (options.now ?? new Date()).getTime();
  const maxEntries = positiveSafeInteger(
    options.maxEntries ?? DEFAULT_MAX_ENTRIES,
    "maxEntries",
  );
  const maxAgeMs = positiveSafeInteger(
    options.maxOptionalAgeMs ?? DEFAULT_MAX_OPTIONAL_AGE_MS,
    "maxOptionalAgeMs",
  );
  const budgetBytes = calculateBudget(
    inventory.activeBytes,
    options.maxManagedBytes,
  );
  const keyFor = (point: ManagedPoint) => `${point.family}:${point.id}`;
  const keys = initialProtectedKeys(inventory.points, rootPath);
  const keptPoints = inventory.points.filter((point) =>
    keys.has(keyFor(point)),
  );
  let keptBytes = sumPoints(keptPoints);
  const optional = inventory.points
    .filter((point) => !keys.has(keyFor(point)))
    .sort((left, right) => pointTime(right) - pointTime(left));
  for (const point of optional) {
    if (
      nowMs - pointTime(point) <= maxAgeMs &&
      keptPoints.length < maxEntries &&
      keptBytes + point.sizeBytes <= budgetBytes
    ) {
      keys.add(keyFor(point));
      keptPoints.push(point);
      keptBytes += point.sizeBytes;
    }
  }
  const kept = emptyFamilies();
  const removed = emptyFamilies();
  for (const point of inventory.points) {
    (keys.has(keyFor(point)) ? kept : removed)[point.family].push(point.id);
  }
  return { nowMs, budgetBytes, keptPoints, kept, removed };
}

function keptBytesFor(plan: RetentionPlan, family: BackupFamily): number {
  return Math.max(
    1,
    sumPoints(plan.keptPoints.filter((point) => point.family === family)),
  );
}

async function pruneUpgradeFamily(
  rootPath: string,
  plan: RetentionPlan,
): Promise<void> {
  for (const backupId of plan.removed.upgrade) {
    await deleteUpgradeBackup(rootPath, backupId);
  }
}

function pruneRecoveryFamily(rootPath: string, plan: RetentionPlan): void {
  if (plan.kept.recovery.length + plan.removed.recovery.length === 0) return;
  pruneRecoveryArtifacts(
    rootPath,
    {
      maxCount: Math.max(1, plan.kept.recovery.length),
      maxAgeMs: Number.MAX_SAFE_INTEGER,
      maxBytes: keptBytesFor(plan, "recovery"),
      removeInvalid: false,
    },
    new Set(plan.kept.recovery),
    plan.nowMs,
  );
}

function pruneDatabaseFamily(
  databasePath: string | null,
  plan: RetentionPlan,
): void {
  if (
    !databasePath ||
    plan.kept.database.length + plan.removed.database.length === 0
  ) {
    return;
  }
  pruneDatabaseSafetyPoints(
    databasePath,
    {
      maxCount: Math.max(1, plan.kept.database.length),
      maxAgeMs: Number.MAX_SAFE_INTEGER,
      maxBytes: keptBytesFor(plan, "database"),
    },
    new Set(plan.kept.database),
    plan.nowMs,
  );
}

async function applyRetentionPlan(
  rootPath: string,
  inventory: ManagedInventory,
  plan: RetentionPlan,
): Promise<string[]> {
  const errors: string[] = [];
  const attempt = async (
    family: BackupFamily,
    action: () => void | Promise<void>,
  ): Promise<void> => {
    try {
      await action();
    } catch (error) {
      errors.push(
        `${family}: ${error instanceof Error ? error.message : String(error)}`,
      );
      plan.kept[family] = inventory.points
        .filter((point) => point.family === family)
        .map((point) => point.id);
      plan.removed[family] = [];
    }
  };
  await attempt("upgrade", () => pruneUpgradeFamily(rootPath, plan));
  await attempt("recovery", () => pruneRecoveryFamily(rootPath, plan));
  await attempt("database", () =>
    pruneDatabaseFamily(inventory.databasePath, plan),
  );
  return errors;
}

export async function runManagedBackupRetention(
  userDataPath: string,
  options: ManagedBackupRetentionOptions = {},
): Promise<ManagedBackupRetentionResult> {
  const rootPath = path.resolve(userDataPath);
  const inventory = await loadManagedInventory(rootPath, options);
  const plan = buildRetentionPlan(inventory, rootPath, options);
  const errors = options.dryRun
    ? []
    : await applyRetentionPlan(rootPath, inventory, plan);
  return {
    activeBytes: inventory.activeBytes,
    budgetBytes: plan.budgetBytes,
    beforeBytes: sumPoints(inventory.points),
    afterBytes: sumSelectedPoints(inventory.points, plan.kept),
    kept: plan.kept,
    removed: plan.removed,
    errors,
  };
}

export async function runManagedBackupRetentionAtStartup(
  userDataPath: string,
  report: (event: ManagedBackupRetentionStartupEvent) => void,
  triggered = true,
  options: ManagedBackupRetentionOptions = {},
): Promise<ManagedBackupRetentionResult | null> {
  if (!triggered) return null;
  try {
    const result = await runManagedBackupRetention(userDataPath, options);
    report({ event: "startup:managed_backup_retention", ...result });
    return result;
  } catch (error) {
    console.warn("[startup] managed backup retention failed:", error);
    return null;
  }
}
