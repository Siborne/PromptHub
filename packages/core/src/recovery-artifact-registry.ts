import fs from "fs";
import path from "path";

import { assertStoragePathComponentsSafe } from "./runtime-storage-context";

const DEFAULT_MAX_COUNT = 10;
const DEFAULT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_SCAN_ENTRIES = 200_000;
const MAX_SCAN_DEPTH = 40;
const SUPPORTED_KINDS = new Set([
  "storage-restore-recovery-artifact",
  "storage-root-recovery-artifact",
]);

export interface RecoveryArtifactRecord {
  id: string;
  operationId: string;
  artifactType: string;
  directoryPath: string;
  sourceRoot: string;
  targetRoot?: string;
  createdAt: string;
  validatedAt: string;
  pinnedReason?: string;
  payloadBytes: number;
  totalBytes: number;
}

export interface RecoveryArtifactRetention {
  maxCount?: number;
  maxAgeMs?: number;
  maxBytes?: number;
  removeInvalid?: boolean;
}

export interface RecoveryArtifactScanLimits {
  maxEntries?: number;
  maxDepth?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function assertPositiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return value;
}

export function getRecoveryArtifactRoot(activeRoot: string): string {
  return path.join(path.resolve(activeRoot), "backups", "recovery");
}

function measureTree(
  rootPath: string,
  limits: { maxEntries: number; maxDepth: number },
): { payloadBytes: number; totalBytes: number } {
  let entries = 0;
  let payloadBytes = 0;
  let totalBytes = 0;
  const visit = (targetPath: string, depth: number): void => {
    if (depth > limits.maxDepth)
      throw new Error("Recovery artifact exceeds depth limit");
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink())
      throw new Error("Recovery artifact contains symbolic link");
    entries += 1;
    if (entries > limits.maxEntries)
      throw new Error("Recovery artifact exceeds entry limit");
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        visit(path.join(targetPath, entry.name), depth + 1);
      }
      return;
    }
    if (!stats.isFile())
      throw new Error("Recovery artifact contains special file");
    totalBytes += stats.size;
    if (path.basename(targetPath) !== "manifest.json")
      payloadBytes += stats.size;
  };
  visit(rootPath, 0);
  return { payloadBytes, totalBytes };
}

function parseArtifact(
  directoryPath: string,
  limits: { maxEntries: number; maxDepth: number },
): RecoveryArtifactRecord | null {
  try {
    const manifestPath = path.join(directoryPath, "manifest.json");
    const stats = fs.lstatSync(manifestPath);
    if (stats.isSymbolicLink() || !stats.isFile()) return null;
    const value: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      !isRecord(value) ||
      value.formatVersion !== 1 ||
      !SUPPORTED_KINDS.has(String(value.kind)) ||
      value.state !== "complete" ||
      typeof value.id !== "string" ||
      value.id !== path.basename(directoryPath) ||
      !/^[a-zA-Z0-9._-]{1,128}$/.test(value.id) ||
      typeof value.operationId !== "string" ||
      typeof value.artifactType !== "string" ||
      typeof value.sourceRoot !== "string" ||
      (value.targetRoot !== undefined &&
        typeof value.targetRoot !== "string") ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.validatedAt !== "string" ||
      !Number.isFinite(Date.parse(value.validatedAt)) ||
      (value.pinnedReason !== undefined &&
        typeof value.pinnedReason !== "string")
    ) {
      return null;
    }
    const size = measureTree(directoryPath, limits);
    return {
      id: value.id,
      operationId: value.operationId,
      artifactType: value.artifactType,
      directoryPath,
      sourceRoot: value.sourceRoot,
      ...(typeof value.targetRoot === "string"
        ? { targetRoot: value.targetRoot }
        : {}),
      createdAt: value.createdAt,
      validatedAt: value.validatedAt,
      ...(typeof value.pinnedReason === "string"
        ? { pinnedReason: value.pinnedReason }
        : {}),
      ...size,
    };
  } catch {
    return null;
  }
}

interface RecoveryArtifactRegistryScan {
  artifacts: RecoveryArtifactRecord[];
  invalid: Array<{ id: string; directoryPath: string }>;
}

function scanRecoveryArtifactRegistry(
  activeRoot: string,
  limits: RecoveryArtifactScanLimits = {},
): RecoveryArtifactRegistryScan {
  const resolvedLimits = {
    maxEntries: assertPositiveInteger(
      limits.maxEntries ?? MAX_SCAN_ENTRIES,
      "maxEntries",
    ),
    maxDepth: assertPositiveInteger(
      limits.maxDepth ?? MAX_SCAN_DEPTH,
      "maxDepth",
    ),
  };
  const registryRoot = getRecoveryArtifactRoot(activeRoot);
  try {
    assertStoragePathComponentsSafe(activeRoot, registryRoot);
    const registryStats = fs.lstatSync(registryRoot);
    if (registryStats.isSymbolicLink() || !registryStats.isDirectory()) {
      return { artifacts: [], invalid: [] };
    }
    const artifacts: RecoveryArtifactRecord[] = [];
    const invalid: Array<{ id: string; directoryPath: string }> = [];
    for (const entry of fs.readdirSync(registryRoot, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        entry.name === "journals" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }
      const directoryPath = path.join(registryRoot, entry.name);
      const artifact = parseArtifact(directoryPath, resolvedLimits);
      if (artifact) artifacts.push(artifact);
      else invalid.push({ id: entry.name, directoryPath });
    }
    artifacts.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    return { artifacts, invalid };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { artifacts: [], invalid: [] };
    }
    return { artifacts: [], invalid: [] };
  }
}

export function listRecoveryArtifacts(
  activeRoot: string,
  limits: RecoveryArtifactScanLimits = {},
): RecoveryArtifactRecord[] {
  return scanRecoveryArtifactRegistry(activeRoot, limits).artifacts;
}

export function pruneRecoveryArtifacts(
  activeRoot: string,
  retention: RecoveryArtifactRetention = {},
  protectedIds: ReadonlySet<string> = new Set(),
  now = Date.now(),
): string[] {
  const maxCount = assertPositiveInteger(
    retention.maxCount ?? DEFAULT_MAX_COUNT,
    "maxCount",
  );
  const maxAgeMs = assertPositiveNumber(
    retention.maxAgeMs ?? DEFAULT_MAX_AGE_MS,
    "maxAgeMs",
  );
  const maxBytes = assertPositiveNumber(
    retention.maxBytes ?? DEFAULT_MAX_BYTES,
    "maxBytes",
  );
  const scan = scanRecoveryArtifactRegistry(activeRoot);
  const artifacts = scan.artifacts;
  const protectedArtifacts = artifacts.filter(
    (artifact) =>
      protectedIds.has(artifact.id) || Boolean(artifact.pinnedReason),
  );
  const kept = new Set(protectedArtifacts.map((artifact) => artifact.id));
  let keptCount = protectedArtifacts.length;
  let keptBytes = protectedArtifacts.reduce(
    (total, artifact) => total + artifact.totalBytes,
    0,
  );
  const removed: string[] = [];

  if (retention.removeInvalid !== false) {
    for (const invalid of scan.invalid) {
      if (protectedIds.has(invalid.id)) continue;
      const stats = fs.lstatSync(invalid.directoryPath);
      if (stats.isSymbolicLink() || !stats.isDirectory()) continue;
      fs.rmSync(invalid.directoryPath, { recursive: true, force: true });
      removed.push(invalid.id);
    }
  }

  for (const artifact of artifacts) {
    if (kept.has(artifact.id)) continue;
    const tooOld = now - Date.parse(artifact.createdAt) > maxAgeMs;
    const exceedsCount = keptCount >= maxCount;
    const exceedsBytes = keptBytes + artifact.totalBytes > maxBytes;
    if (tooOld || exceedsCount || exceedsBytes) {
      fs.rmSync(artifact.directoryPath, { recursive: true, force: true });
      removed.push(artifact.id);
      continue;
    }
    kept.add(artifact.id);
    keptCount += 1;
    keptBytes += artifact.totalBytes;
  }
  return removed;
}
