import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  copyStorageInventory,
  createStorageInventory,
} from "@prompthub/core";
import { createConsistentDatabaseImage } from "@prompthub/db";

/**
 * Upgrade backup service
 *
 * Creates, lists, restores, and deletes "pre-upgrade" snapshots of the entire
 * userData directory so users can recover after a botched upgrade (see #94).
 *
 * Layout (v0.5.4+):
 *   <userData>/backups/safety-points/upgrades/
 *       v<fromVersion>-<timestamp>/
 *           backup-manifest.json
 *           prompthub.db
 *           skills/...
 *           workspace/...
 *           ...
 *       .legacy-migrated                (marker, see migrateLegacyUpgradeBackups)
 *
 * Legacy layout (v0.5.3, to be migrated once and removed):
 *   <userData>/../PromptHub-upgrade-backups/
 *       v<version>-<timestamp>/
 *           backup-manifest.json        (schemaVersion implicit, `version` field)
 *           ...
 */

/** Managed upgrade safety points live below the shared safety-point class. */
const UPGRADE_BACKUP_ROOT_SEGMENTS = [
  "backups",
  "safety-points",
  "upgrades",
] as const;

export const RUNTIME_CACHE_ENTRIES = new Set([
  "Cache",
  "Code Cache",
  "GPUCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "blob_storage",
  "Shared Dictionary",
  "SharedStorage",
  "Network Persistent State",
  "TransportSecurity",
  "Trust Tokens",
  "Trust Tokens-journal",
  "SingletonCookie",
  "SingletonLock",
  "SingletonSocket",
]);

/** Legacy backup root name (sibling of userData). Kept for one-time migration. */
const LEGACY_UPGRADE_BACKUP_ROOT_NAME = "PromptHub-upgrade-backups";

/** Marker file written into the new root once legacy migration has run. */
const LEGACY_MIGRATION_MARKER = ".legacy-migrated";

const MANIFEST_FILE_NAME = "backup-manifest.json";
export const MAX_UPGRADE_BACKUP_SNAPSHOTS = 5;

const MANIFEST_KIND = "prompthub-upgrade-backup";
const MANIFEST_SCHEMA_VERSION = 3;
const DEFAULT_MAX_UPGRADE_BACKUP_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_UPGRADE_BACKUP_BYTES = 10 * 1024 * 1024 * 1024;
const UPGRADE_BACKUP_CAPACITY_HEADROOM_BYTES = 64 * 1024 * 1024;

const TRANSIENT_DATABASE_ENTRY_PATTERNS = [
  /^prompthub\.db\.lock$/i,
  /^prompthub\.db\.backup-.*$/i,
  /^prompthub\.db\.pre-.*$/i,
  /^prompthub\.db\.corrupt-.*$/i,
  /^prompthub\.db-(wal|shm|journal)$/i,
];

export interface UpgradeBackupManifest {
  kind: typeof MANIFEST_KIND;
  schemaVersion: number;
  createdAt: string;
  /** Version the data was written by (i.e. the version being replaced). */
  fromVersion: string;
  /**
   * Version the user is upgrading TO. Optional because the snapshot may be
   * created before the new binary has ever run (install-time trigger), in
   * which case only `fromVersion` is known.
   */
  toVersion?: string;
  sourcePath: string;
  copiedItems: string[];
  platform: string;
  /** Absolute path this backup was migrated from, if applicable. */
  legacyMigratedFrom?: string;
  runIdentity?: string;
  inventoryDigest?: string;
  totalBytes?: number;
  databaseSafetyPointId?: string;
  databaseCaptureMode?: "consistent-image" | "raw-recovery-evidence";
  databaseImageSha256?: string;
  databaseRawEvidenceSha256?: string;
  secretPolicy?: "encrypted-device-bound-only";
}

export interface UpgradeBackupSnapshot {
  /** Absolute path of the snapshot directory. */
  backupPath: string;
  /** Directory name only (stable within the managed upgrade safety-point root). */
  backupId: string;
  manifest: UpgradeBackupManifest;
}

export interface UpgradeBackupEntry {
  backupPath: string;
  backupId: string;
  manifest: UpgradeBackupManifest;
  /** Total size of the snapshot on disk, in bytes. */
  sizeBytes: number;
}

export interface CreateUpgradeDataSnapshotOptions {
  /** Version of the data being backed up (required). */
  fromVersion: string;
  /** Version being upgraded to, if known. */
  toVersion?: string;
  /** Skip automatic retention pruning for flows that need explicit protection. */
  skipRetentionPrune?: boolean;
  /** Persist an empty manifest so a failed restore can roll back to no data. */
  allowEmpty?: boolean;
  /** Test seam for capacity failures; production uses statfs on the backup root. */
  getAvailableBytes?: (targetPath: string) => number;
}

interface PruneUpgradeBackupOptions {
  maxSnapshots?: number;
  maxAgeMs?: number;
  maxBytes?: number;
  protectedBackupIds?: string[];
}

export interface MigrateLegacyResult {
  migrated: number;
  skipped: number;
  legacyRoot: string;
  alreadyDone: boolean;
}

// ── Path helpers ─────────────────────────────────────────────────────────────

function formatTimestampForPath(timestamp: string): string {
  return timestamp.replace(/[:.]/g, "-");
}

function sanitizeVersion(version: string): string {
  return version.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function getUpgradeBackupRoot(userDataPath: string): string {
  return path.join(path.resolve(userDataPath), ...UPGRADE_BACKUP_ROOT_SEGMENTS);
}

function getPreviousInRootUpgradeBackupRoot(userDataPath: string): string {
  return path.join(path.resolve(userDataPath), "backups");
}

export function getLegacyUpgradeBackupRoot(userDataPath: string): string {
  return path.join(
    path.dirname(path.resolve(userDataPath)),
    LEGACY_UPGRADE_BACKUP_ROOT_NAME,
  );
}

// ── Filesystem utilities ─────────────────────────────────────────────────────

async function directorySize(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(entryPath);
    } else if (entry.isFile()) {
      const stat = await fs.promises.stat(entryPath);
      total += stat.size;
    }
  }
  return total;
}

function isValidBackupId(backupId: string): boolean {
  // Prevent path traversal / absolute paths / hidden system entries.
  if (!backupId || backupId.trim().length === 0) return false;
  if (backupId.includes("/") || backupId.includes("\\")) return false;
  if (backupId === "." || backupId === "..") return false;
  if (backupId.startsWith(".")) return false;
  return true;
}

function isTransientDatabaseEntry(entryName: string): boolean {
  return TRANSIENT_DATABASE_ENTRY_PATTERNS.some((pattern) => pattern.test(entryName));
}

function shouldCopySnapshotPath(sourcePath: string): boolean {
  if (isTransientDatabaseEntry(path.basename(sourcePath))) {
    return false;
  }

  const stats = fs.lstatSync(sourcePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`Cannot copy upgrade backup path from symbolic link: ${sourcePath}`);
  }

  return true;
}

function defaultAvailableBytes(targetPath: string): number {
  let candidate = path.resolve(targetPath);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return 0;
    candidate = parent;
  }
  const stats = fs.statfsSync(candidate, { bigint: true });
  const available = stats.bavail * stats.bsize;
  return available > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(available);
}

function hasSqliteHeader(filePath: string): boolean {
  const descriptor = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    return (
      bytesRead === header.length &&
      header.equals(Buffer.from("SQLite format 3\0", "binary"))
    );
  } finally {
    fs.closeSync(descriptor);
  }
}

function copyRawDatabaseEvidence(
  sourcePath: string,
  targetPath: string,
): { sizeBytes: number; sha256: string } {
  const sourceStats = fs.lstatSync(sourcePath);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error(`Legacy database evidence is not a regular file: ${sourcePath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(targetPath, 0o600);
  const descriptor = fs.openSync(targetPath, "r");
  const digest = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let sizeBytes = 0;
  try {
    fs.fsyncSync(descriptor);
    for (;;) {
      const bytesRead = fs.readSync(
        descriptor,
        buffer,
        0,
        buffer.length,
        sizeBytes,
      );
      if (bytesRead === 0) break;
      digest.update(buffer.subarray(0, bytesRead));
      sizeBytes += bytesRead;
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return {
    sizeBytes,
    sha256: digest.digest("hex"),
  };
}

function inferDetachedLayoutEpoch(rootPath: string): 0 | 1 {
  const canonicalDataPath = path.join(rootPath, "data");
  try {
    const stats = fs.lstatSync(canonicalDataPath);
    return !stats.isSymbolicLink() &&
      stats.isDirectory() &&
      fs.readdirSync(canonicalDataPath).length > 0
      ? 1
      : 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

function parseManifest(raw: unknown): UpgradeBackupManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== MANIFEST_KIND) return null;

  // v0.5.3 legacy manifests used `version` instead of `fromVersion`.
  const fromVersion =
    typeof obj.fromVersion === "string"
      ? obj.fromVersion
      : typeof obj.version === "string"
        ? obj.version
        : null;
  if (!fromVersion) return null;

  if (typeof obj.createdAt !== "string") return null;
  if (typeof obj.sourcePath !== "string") return null;
  if (!Array.isArray(obj.copiedItems)) return null;
  const copiedItems = obj.copiedItems.filter(
    (item): item is string => typeof item === "string",
  );
  if (copiedItems.length !== obj.copiedItems.length) return null;

  const schemaVersion =
    typeof obj.schemaVersion === "number" ? obj.schemaVersion : 1;

  return {
    kind: MANIFEST_KIND,
    schemaVersion,
    createdAt: obj.createdAt,
    fromVersion,
    toVersion:
      typeof obj.toVersion === "string" && obj.toVersion.length > 0
        ? obj.toVersion
        : undefined,
    sourcePath: obj.sourcePath,
    copiedItems,
    platform: typeof obj.platform === "string" ? obj.platform : "unknown",
    legacyMigratedFrom:
      typeof obj.legacyMigratedFrom === "string"
        ? obj.legacyMigratedFrom
        : undefined,
    runIdentity:
      typeof obj.runIdentity === "string" ? obj.runIdentity : undefined,
    inventoryDigest:
      typeof obj.inventoryDigest === "string"
        ? obj.inventoryDigest
        : undefined,
    totalBytes:
      typeof obj.totalBytes === "number" && Number.isSafeInteger(obj.totalBytes)
        ? obj.totalBytes
        : undefined,
    databaseSafetyPointId:
      typeof obj.databaseSafetyPointId === "string"
        ? obj.databaseSafetyPointId
        : undefined,
    databaseCaptureMode:
      obj.databaseCaptureMode === "consistent-image" ||
      obj.databaseCaptureMode === "raw-recovery-evidence"
        ? obj.databaseCaptureMode
        : undefined,
    databaseImageSha256:
      typeof obj.databaseImageSha256 === "string" &&
      /^[a-f0-9]{64}$/u.test(obj.databaseImageSha256)
        ? obj.databaseImageSha256
        : undefined,
    databaseRawEvidenceSha256:
      typeof obj.databaseRawEvidenceSha256 === "string" &&
      /^[a-f0-9]{64}$/u.test(obj.databaseRawEvidenceSha256)
        ? obj.databaseRawEvidenceSha256
        : undefined,
    secretPolicy:
      obj.secretPolicy === "encrypted-device-bound-only"
        ? obj.secretPolicy
        : undefined,
  };
}

async function readManifest(
  backupPath: string,
): Promise<UpgradeBackupManifest | null> {
  const manifestPath = path.join(backupPath, MANIFEST_FILE_NAME);
  try {
    const raw = await fs.promises.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parseManifest(parsed);
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Copy durable user data into the managed upgrade safety-point root.
 * and write a manifest describing what was copied.
 *
 * Never silently overwrites: if a directory with the same name already exists
 * the operation fails rather than merging content.
 */
export async function createUpgradeDataSnapshot(
  userDataPath: string,
  options: CreateUpgradeDataSnapshotOptions,
): Promise<UpgradeBackupSnapshot> {
  if (!userDataPath || userDataPath.trim().length === 0) {
    throw new Error("Cannot create upgrade backup without a user data path");
  }
  if (!options.fromVersion || options.fromVersion.trim().length === 0) {
    throw new Error("Cannot create upgrade backup without fromVersion");
  }

  const resolvedUserDataPath = path.resolve(userDataPath);
  if (!fs.existsSync(resolvedUserDataPath)) {
    throw new Error(
      `Cannot create upgrade backup because the user data path does not exist: ${resolvedUserDataPath}`,
    );
  }

  const createdAt = new Date().toISOString();
  const runIdentity = crypto.randomUUID();
  const backupRoot = getUpgradeBackupRoot(resolvedUserDataPath);
  const backupId = `v${sanitizeVersion(options.fromVersion)}-${formatTimestampForPath(createdAt)}`;
  const backupPath = path.join(backupRoot, backupId);
  const stagingPath = path.join(backupRoot, `.stage-${backupId}-${runIdentity}`);
  if (fs.existsSync(backupPath) || fs.existsSync(stagingPath)) {
    throw new Error(`Upgrade backup already exists: ${backupId}`);
  }
  const canonicalDatabase = path.join(
    resolvedUserDataPath,
    "data",
    "prompthub.db",
  );
  const legacyDatabase = path.join(resolvedUserDataPath, "prompthub.db");
  const databasePath = fs.existsSync(canonicalDatabase)
    ? canonicalDatabase
    : fs.existsSync(legacyDatabase)
      ? legacyDatabase
      : null;
  const detachedLayoutEpoch = inferDetachedLayoutEpoch(resolvedUserDataPath);
  const databaseRelativePath =
    detachedLayoutEpoch === 1 ? "data/prompthub.db" : "prompthub.db";

  let manifest: UpgradeBackupManifest;
  try {
    const inventory = createStorageInventory(resolvedUserDataPath, {
      detachedLayoutEpoch,
      includeSecrets: true,
      excludeRelativePaths: databasePath ? [databaseRelativePath] : [],
    });
    if (inventory.files.length === 0 && !databasePath && !options.allowEmpty) {
      throw new Error(
        `Cannot create upgrade backup because the user data path is empty: ${resolvedUserDataPath}`,
      );
    }
    const databaseSourceBytes = databasePath
      ? fs.lstatSync(databasePath).size
      : 0;
    const requiredBytes =
      inventory.totalBytes +
      databaseSourceBytes +
      UPGRADE_BACKUP_CAPACITY_HEADROOM_BYTES;
    const availableBytes = (
      options.getAvailableBytes ?? defaultAvailableBytes
    )(backupRoot);
    if (availableBytes < requiredBytes) {
      throw new Error(
        `Insufficient space for upgrade backup: required=${requiredBytes}, available=${availableBytes}`,
      );
    }
    copyStorageInventory(inventory, stagingPath);
    let databaseCaptureMode:
      | "consistent-image"
      | "raw-recovery-evidence"
      | undefined;
    let databaseImageSha256: string | undefined;
    let databaseRawEvidenceSha256: string | undefined;
    let databaseBytes = 0;
    if (databasePath) {
      const targetDatabase = path.join(
        stagingPath,
        ...databaseRelativePath.split("/"),
      );
      if (hasSqliteHeader(databasePath)) {
        const image = createConsistentDatabaseImage(databasePath, targetDatabase);
        databaseBytes = image.sizeBytes;
        databaseImageSha256 = image.sha256;
        databaseCaptureMode = "consistent-image";
      } else {
        const evidence = copyRawDatabaseEvidence(databasePath, targetDatabase);
        databaseBytes = evidence.sizeBytes;
        databaseRawEvidenceSha256 = evidence.sha256;
        databaseCaptureMode = "raw-recovery-evidence";
      }
    }
    const copiedItems = Array.from(
      new Set([
        ...inventory.files.map((entry) => entry.relativePath.split("/")[0]),
        ...(databasePath ? [databaseRelativePath.split("/")[0]] : []),
      ]),
    ).sort();

    manifest = {
      kind: MANIFEST_KIND,
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      createdAt,
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
      sourcePath: resolvedUserDataPath,
      copiedItems,
      platform: process.platform,
      runIdentity,
      inventoryDigest: inventory.digest,
      totalBytes: inventory.totalBytes + databaseBytes,
      ...(databaseCaptureMode ? { databaseCaptureMode } : {}),
      ...(databaseImageSha256 ? { databaseImageSha256 } : {}),
      ...(databaseRawEvidenceSha256
        ? { databaseRawEvidenceSha256 }
        : {}),
      secretPolicy: "encrypted-device-bound-only",
    };

    await fs.promises.writeFile(
      path.join(stagingPath, MANIFEST_FILE_NAME),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    await fs.promises.mkdir(backupRoot, { recursive: true });
    await fs.promises.rename(stagingPath, backupPath);
  } catch (error) {
    await fs.promises.rm(stagingPath, { recursive: true, force: true });
    throw error;
  }

  if (!options.skipRetentionPrune) {
    try {
      await pruneUpgradeBackups(resolvedUserDataPath, {
        maxSnapshots: MAX_UPGRADE_BACKUP_SNAPSHOTS,
        protectedBackupIds: [backupId],
      });
    } catch (error) {
      console.warn("[upgrade-backup] Failed to prune old snapshots:", error);
    }
  }

  return { backupPath, backupId, manifest };
}

export async function pruneUpgradeBackups(
  userDataPath: string,
  options: PruneUpgradeBackupOptions = {},
): Promise<void> {
  const maxSnapshots = options.maxSnapshots ?? MAX_UPGRADE_BACKUP_SNAPSHOTS;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_UPGRADE_BACKUP_AGE_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPGRADE_BACKUP_BYTES;
  const protectedBackupIds = new Set(options.protectedBackupIds ?? []);

  if (maxSnapshots < 1) {
    throw new Error(`maxSnapshots must be at least 1, got ${maxSnapshots}`);
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 1) {
    throw new Error(`maxAgeMs must be positive, got ${maxAgeMs}`);
  }
  if (!Number.isFinite(maxBytes) || maxBytes < 1) {
    throw new Error(`maxBytes must be positive, got ${maxBytes}`);
  }

  const backups = await listUpgradeBackups(userDataPath);
  const keptBackupIds = new Set<string>(
    backups
      .filter((backup) => protectedBackupIds.has(backup.backupId))
      .map((backup) => backup.backupId),
  );
  let keptBytes = backups
    .filter((backup) => keptBackupIds.has(backup.backupId))
    .reduce((total, backup) => total + backup.sizeBytes, 0);

  for (const backup of backups) {
    if (keptBackupIds.has(backup.backupId)) continue;
    const tooOld = Date.now() - Date.parse(backup.manifest.createdAt) > maxAgeMs;
    if (
      !tooOld &&
      keptBackupIds.size < maxSnapshots &&
      keptBytes + backup.sizeBytes <= maxBytes
    ) {
      keptBackupIds.add(backup.backupId);
      keptBytes += backup.sizeBytes;
      continue;
    }

    await deleteUpgradeBackup(userDataPath, backup.backupId);
  }
}

/**
 * List all valid managed upgrade safety points, newest first.
 * Directories without a readable manifest are ignored silently.
 */
export async function listUpgradeBackups(
  userDataPath: string,
): Promise<UpgradeBackupEntry[]> {
  const root = getUpgradeBackupRoot(userDataPath);
  if (!fs.existsSync(root)) return [];

  const dirEntries = await fs.promises.readdir(root, { withFileTypes: true });
  const results: UpgradeBackupEntry[] = [];

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    if (!isValidBackupId(entry.name)) continue;

    const backupPath = path.join(root, entry.name);
    const manifest = await readManifest(backupPath);
    if (!manifest) continue;

    let sizeBytes = 0;
    try {
      sizeBytes = await directorySize(backupPath);
    } catch {
      sizeBytes = 0;
    }

    results.push({
      backupPath,
      backupId: entry.name,
      manifest,
      sizeBytes,
    });
  }

  results.sort((a, b) =>
    b.manifest.createdAt.localeCompare(a.manifest.createdAt),
  );
  return results;
}

/**
 * Delete a single upgrade backup by id. The id must be the directory name as
 * returned by {@link listUpgradeBackups}; arbitrary paths are rejected.
 */
export async function deleteUpgradeBackup(
  userDataPath: string,
  backupId: string,
): Promise<void> {
  if (!isValidBackupId(backupId)) {
    throw new Error(`Invalid upgrade backup id: ${backupId}`);
  }
  const root = getUpgradeBackupRoot(userDataPath);
  const backupPath = path.join(root, backupId);

  // Defence in depth: ensure the resolved path is still inside the root.
  const resolved = path.resolve(backupPath);
  const resolvedRoot = path.resolve(root);
  if (
    resolved !== path.join(resolvedRoot, backupId) ||
    !resolved.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error(`Refusing to delete backup outside root: ${resolved}`);
  }

  if (!fs.existsSync(backupPath)) return;

  // Require a valid manifest so we don't delete an unrelated directory that
  // someone may have dropped into the managed upgrade safety-point root.
  const manifest = await readManifest(backupPath);
  if (!manifest) {
    throw new Error(
      `Refusing to delete '${backupId}': not a valid upgrade backup (missing manifest)`,
    );
  }

  await fs.promises.rm(backupPath, { recursive: true, force: true });
}

/**
 * Look up a single upgrade backup by id, returning its manifest and absolute
 * path. Returns null if the id is invalid or the backup is missing/corrupt.
 */
export async function getUpgradeBackup(
  userDataPath: string,
  backupId: string,
): Promise<UpgradeBackupEntry | null> {
  if (!isValidBackupId(backupId)) return null;
  const root = getUpgradeBackupRoot(userDataPath);
  const backupPath = path.join(root, backupId);
  if (!fs.existsSync(backupPath)) return null;

  const manifest = await readManifest(backupPath);
  if (!manifest) return null;

  let sizeBytes = 0;
  try {
    sizeBytes = await directorySize(backupPath);
  } catch {
    sizeBytes = 0;
  }

  return { backupPath, backupId, manifest, sizeBytes };
}

/**
 * One-time migration: move snapshots from both historical roots into the
 * managed upgrade safety-point directory. Failed copies remain retryable.
 */
export async function migrateLegacyUpgradeBackups(
  userDataPath: string,
): Promise<MigrateLegacyResult> {
  const resolvedUserDataPath = path.resolve(userDataPath);
  const legacyRoot = getLegacyUpgradeBackupRoot(resolvedUserDataPath);
  const newRoot = getUpgradeBackupRoot(resolvedUserDataPath);
  const markerPath = path.join(newRoot, LEGACY_MIGRATION_MARKER);

  // If the marker is already present, we've run before.
  if (fs.existsSync(markerPath)) {
    return { migrated: 0, skipped: 0, legacyRoot, alreadyDone: true };
  }

  await fs.promises.mkdir(newRoot, { recursive: true });

  let migrated = 0;
  let skipped = 0;
  let failed = false;
  const sourceRoots = [
    getPreviousInRootUpgradeBackupRoot(resolvedUserDataPath),
    legacyRoot,
  ];
  for (const sourceRoot of sourceRoots) {
    if (!fs.existsSync(sourceRoot)) continue;
    const entries = await fs.promises.readdir(sourceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (
        sourceRoot === getPreviousInRootUpgradeBackupRoot(resolvedUserDataPath) &&
        entry.name === "safety-points"
      ) {
        continue;
      }
      if (!entry.isDirectory() || !isValidBackupId(entry.name)) {
        skipped += 1;
        continue;
      }
      const sourceBackupPath = path.join(sourceRoot, entry.name);
      if (path.resolve(sourceBackupPath) === path.resolve(path.dirname(newRoot))) {
        skipped += 1;
        continue;
      }
      const manifest = await readManifest(sourceBackupPath);
      if (!manifest) {
        skipped += 1;
        continue;
      }
      const destinationBackupPath = path.join(newRoot, entry.name);
      if (fs.existsSync(destinationBackupPath)) {
        skipped += 1;
        continue;
      }
      try {
        await fs.promises.cp(sourceBackupPath, destinationBackupPath, {
          recursive: true,
          preserveTimestamps: true,
          errorOnExist: true,
          force: false,
          filter: shouldCopySnapshotPath,
        });
        await fs.promises.writeFile(
          path.join(destinationBackupPath, MANIFEST_FILE_NAME),
          JSON.stringify(
            {
              ...manifest,
              schemaVersion: MANIFEST_SCHEMA_VERSION,
              legacyMigratedFrom: sourceBackupPath,
            } satisfies UpgradeBackupManifest,
            null,
            2,
          ),
          "utf8",
        );
        await fs.promises.rm(sourceBackupPath, {
          recursive: true,
          force: true,
        });
        migrated += 1;
      } catch (error) {
        console.warn(
          `[upgrade-backup] Failed to migrate '${entry.name}' from legacy root:`,
          error,
        );
        await fs.promises.rm(destinationBackupPath, {
          recursive: true,
          force: true,
        });
        skipped += 1;
        failed = true;
      }
    }
    if (sourceRoot === legacyRoot) {
      try {
        if ((await fs.promises.readdir(sourceRoot)).length === 0) {
          await fs.promises.rm(sourceRoot, { recursive: true, force: true });
        }
      } catch {
        // A retained legacy root remains available for the next retry.
      }
    }
  }
  if (!failed) {
    await fs.promises.writeFile(markerPath, new Date().toISOString(), "utf8");
  }

  return { migrated, skipped, legacyRoot, alreadyDone: false };
}
