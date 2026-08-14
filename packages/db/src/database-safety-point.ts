import crypto from "crypto";
import fs from "fs";
import path from "path";

import Database from "./adapter";

export const DATABASE_SAFETY_POINT_FORMAT_VERSION = 1;

const MANIFEST_FILE_NAME = "manifest.json";
const COPY_BUFFER_BYTES = 1024 * 1024;
const DEFAULT_MAX_COUNT = 5;
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const DATABASE_BUSY_TIMEOUT_MS = 5_000;
const DATABASE_IMAGE_NAME = "database.sqlite";
const CAPACITY_HEADROOM_BYTES = 16 * 1024 * 1024;

export type DatabaseSafetyPointReason =
  | "integrity-repair"
  | "pre-migration"
  | "pre-recovery"
  | "pre-upgrade"
  | "legacy-pre-0.5.3";

export interface DatabaseSafetyPointFile {
  name: string;
  sourceSuffix: "";
  sizeBytes: number;
  sha256: string;
}

export interface DatabaseSafetyPointManifest {
  formatVersion: number;
  kind: "database-safety-point";
  state: "complete";
  id: string;
  reason: DatabaseSafetyPointReason;
  createdAt: string;
  sourceDatabase: string;
  files: DatabaseSafetyPointFile[];
  totalBytes: number;
}

export interface DatabaseSafetyPoint {
  id: string;
  directoryPath: string;
  manifest: DatabaseSafetyPointManifest;
}

export interface DatabaseSafetyPointRetention {
  maxCount?: number;
  maxAgeMs?: number;
  maxBytes?: number;
}

function assertPositiveLimit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`${name} must be a positive finite number`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

function safeDirectoryExists(
  activeRoot: string,
  directoryPath: string,
): boolean {
  const root = path.resolve(activeRoot);
  const target = path.resolve(directoryPath);
  const relativePath = path.relative(root, target);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Database safety point path escapes its root: ${target}`);
  }

  let currentPath = root;
  for (const segment of ["", ...relativePath.split(path.sep).filter(Boolean)]) {
    if (segment) currentPath = path.join(currentPath, segment);
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(currentPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Refusing symbolic link in database safety point path: ${currentPath}`,
      );
    }
    if (!stats.isDirectory()) {
      throw new Error(
        `Database safety point path is not a directory: ${currentPath}`,
      );
    }
  }
  return true;
}

function resolveActiveRoot(dbPath: string): string {
  const databaseDirectory = path.dirname(path.resolve(dbPath));
  return path.basename(databaseDirectory) === "data"
    ? path.dirname(databaseDirectory)
    : databaseDirectory;
}

export function getDatabaseSafetyPointRoot(dbPath: string): string {
  return path.join(resolveActiveRoot(dbPath), "backups", "safety-points");
}

function hashFileSync(filePath: string): string {
  const digest = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(COPY_BUFFER_BYTES);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        digest.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest("hex");
}

function assertRegularSource(filePath: string): fs.Stats {
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(
      `Database safety point source is not a regular file: ${filePath}`,
    );
  }
  return stats;
}

function defaultAvailableBytes(targetPath: string): number {
  const stats = fs.statfsSync(targetPath);
  return stats.bavail * stats.bsize;
}

function assertSafetyPointCapacity(
  activeRoot: string,
  sourceBytes: number,
  getAvailableBytes: (targetPath: string) => number,
): void {
  const requiredBytes = sourceBytes + CAPACITY_HEADROOM_BYTES;
  const availableBytes = getAvailableBytes(activeRoot);
  if (
    !Number.isFinite(availableBytes) ||
    availableBytes < 0 ||
    availableBytes < requiredBytes
  ) {
    throw new Error(
      `Insufficient space for database safety point: required=${requiredBytes}, available=${availableBytes}`,
    );
  }
}

function quoteSqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function databaseImageIsHealthy(probe: Database.Database): boolean {
  const rows = probe.pragma("quick_check");
  return Boolean(
    Array.isArray(rows) &&
    rows.length === 1 &&
    rows[0] &&
    typeof rows[0] === "object" &&
    (rows[0] as Record<string, unknown>).quick_check === "ok",
  );
}

function verifyDatabaseImage(
  filePath: string,
  options: { repairIndexes?: boolean } = {},
): fs.Stats {
  assertRegularSource(filePath);
  const probe = new Database(filePath);
  let repairedIndexes = false;
  try {
    if (!databaseImageIsHealthy(probe) && options.repairIndexes) {
      probe.exec("REINDEX");
      repairedIndexes = true;
    }
    if (!databaseImageIsHealthy(probe)) {
      throw new Error(`Database safety point verification failed: ${filePath}`);
    }
  } finally {
    probe.close();
  }
  if (repairedIndexes) flushFile(filePath);
  return assertRegularSource(filePath);
}

function flushFile(filePath: string): void {
  const descriptor = fs.openSync(filePath, "r+");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function flushDirectory(directoryPath: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch {
    // Directory fsync is unavailable on some supported platforms.
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

export function createConsistentDatabaseImage(
  dbPath: string,
  targetPath: string,
): DatabaseSafetyPointFile {
  assertRegularSource(dbPath);
  if (fs.existsSync(targetPath)) {
    throw new Error(`Database image destination already exists: ${targetPath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  try {
    const source = new Database(dbPath);
    try {
      source.pragma(`busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
      source.exec(`VACUUM INTO ${quoteSqliteString(targetPath)}`);
    } finally {
      source.close();
    }
    fs.chmodSync(targetPath, 0o600);
    flushFile(targetPath);
    const snapshotStats = verifyDatabaseImage(targetPath, {
      repairIndexes: true,
    });
    return {
      name: path.basename(targetPath),
      sourceSuffix: "",
      sizeBytes: snapshotStats.size,
      sha256: hashFileSync(targetPath),
    };
  } catch (error) {
    for (const suffix of ["", "-journal", "-shm", "-wal"]) {
      fs.rmSync(`${targetPath}${suffix}`, { force: true });
    }
    throw error;
  }
}

function createSafetyPointDatabaseImage(
  dbPath: string,
  stagingPath: string,
): DatabaseSafetyPointFile[] {
  const file = createConsistentDatabaseImage(
    dbPath,
    path.join(stagingPath, DATABASE_IMAGE_NAME),
  );
  return [{ ...file, name: DATABASE_IMAGE_NAME }];
}

function writeManifest(
  directoryPath: string,
  manifest: DatabaseSafetyPointManifest,
): void {
  const manifestPath = path.join(directoryPath, MANIFEST_FILE_NAME);
  const descriptor = fs.openSync(manifestPath, "wx", 0o600);
  try {
    fs.writeFileSync(
      descriptor,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseManifest(
  directoryPath: string,
): DatabaseSafetyPointManifest | null {
  try {
    const manifestPath = path.join(directoryPath, MANIFEST_FILE_NAME);
    const manifestStats = fs.lstatSync(manifestPath);
    if (manifestStats.isSymbolicLink() || !manifestStats.isFile()) return null;
    const value: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      !isRecord(value) ||
      value.formatVersion !== DATABASE_SAFETY_POINT_FORMAT_VERSION ||
      value.kind !== "database-safety-point" ||
      value.state !== "complete" ||
      typeof value.id !== "string" ||
      value.id !== path.basename(directoryPath) ||
      ![
        "integrity-repair",
        "pre-migration",
        "pre-recovery",
        "pre-upgrade",
        "legacy-pre-0.5.3",
      ].includes(String(value.reason)) ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.sourceDatabase !== "string" ||
      value.sourceDatabase.length === 0 ||
      path.posix.isAbsolute(value.sourceDatabase) ||
      value.sourceDatabase.split("/").includes("..") ||
      !Array.isArray(value.files) ||
      value.files.length !== 1 ||
      !Number.isSafeInteger(value.totalBytes) ||
      Number(value.totalBytes) < 0
    ) {
      return null;
    }
    const file = value.files[0];
    if (
      !isRecord(file) ||
      file.name !== DATABASE_IMAGE_NAME ||
      file.sourceSuffix !== "" ||
      !Number.isSafeInteger(file.sizeBytes) ||
      Number(file.sizeBytes) < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      value.totalBytes !== file.sizeBytes
    ) {
      return null;
    }
    const imagePath = path.join(directoryPath, DATABASE_IMAGE_NAME);
    const imageStats = fs.lstatSync(imagePath);
    if (
      imageStats.isSymbolicLink() ||
      !imageStats.isFile() ||
      imageStats.size !== file.sizeBytes ||
      hashFileSync(imagePath) !== file.sha256
    ) {
      return null;
    }
    verifyDatabaseImage(imagePath);
    return value as unknown as DatabaseSafetyPointManifest;
  } catch {
    return null;
  }
}

export function listDatabaseSafetyPoints(
  dbPath: string,
): DatabaseSafetyPoint[] {
  const root = getDatabaseSafetyPointRoot(dbPath);
  if (!safeDirectoryExists(resolveActiveRoot(dbPath), root)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        !entry.name.startsWith("."),
    )
    .flatMap((entry) => {
      const directoryPath = path.join(root, entry.name);
      const manifest = parseManifest(directoryPath);
      if (!manifest || manifest.id !== entry.name) {
        return [];
      }
      return [{ id: entry.name, directoryPath, manifest }];
    })
    .sort((left, right) =>
      right.manifest.createdAt.localeCompare(left.manifest.createdAt),
    );
}

export function pruneDatabaseSafetyPoints(
  dbPath: string,
  retention: DatabaseSafetyPointRetention = {},
  protectedIds: ReadonlySet<string> = new Set(),
  now = Date.now(),
): string[] {
  const maxCount = retention.maxCount ?? DEFAULT_MAX_COUNT;
  const maxAgeMs = retention.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const maxBytes = retention.maxBytes ?? DEFAULT_MAX_BYTES;
  assertPositiveInteger(maxCount, "maxCount");
  assertPositiveLimit(maxAgeMs, "maxAgeMs");
  assertPositiveLimit(maxBytes, "maxBytes");

  const removed: string[] = [];
  const points = listDatabaseSafetyPoints(dbPath);
  const protectedPoints = points.filter((point) => protectedIds.has(point.id));
  let keptCount = protectedPoints.length;
  let keptBytes = protectedPoints.reduce(
    (total, point) => total + point.manifest.totalBytes,
    0,
  );
  for (const point of points) {
    const createdAt = Date.parse(point.manifest.createdAt);
    const isProtected = protectedIds.has(point.id);
    if (isProtected) continue;
    const withinAge = Number.isFinite(createdAt) && now - createdAt <= maxAgeMs;
    const withinCount = keptCount < maxCount;
    const withinBytes = keptBytes + point.manifest.totalBytes <= maxBytes;
    if (withinAge && withinCount && withinBytes) {
      keptCount += 1;
      keptBytes += point.manifest.totalBytes;
      continue;
    }
    fs.rmSync(point.directoryPath, { recursive: true, force: true });
    removed.push(point.id);
  }
  return removed;
}

function sourceDatabaseRelativePath(dbPath: string): string {
  const root = resolveActiveRoot(dbPath);
  const relativePath = path.relative(root, path.resolve(dbPath));
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Database path is outside its managed root: ${dbPath}`);
  }
  return relativePath.split(path.sep).join("/");
}

export function createDatabaseSafetyPoint(
  dbPath: string,
  reason: DatabaseSafetyPointReason,
  options: {
    now?: Date;
    retention?: DatabaseSafetyPointRetention;
    getAvailableBytes?: (targetPath: string) => number;
  } = {},
): DatabaseSafetyPoint {
  const resolvedDbPath = path.resolve(dbPath);
  const sourceStats = assertRegularSource(resolvedDbPath);
  const activeRoot = resolveActiveRoot(resolvedDbPath);
  const root = getDatabaseSafetyPointRoot(resolvedDbPath);
  const createdAt = options.now ?? new Date();
  const timestamp = createdAt.toISOString().replace(/[:.]/g, "-");
  const id = `${reason}-${timestamp}-${crypto.randomUUID().slice(0, 8)}`;
  const stagingPath = path.join(root, `.staging-${id}`);
  const directoryPath = path.join(root, id);

  assertSafetyPointCapacity(
    activeRoot,
    sourceStats.size,
    options.getAvailableBytes ?? defaultAvailableBytes,
  );
  safeDirectoryExists(activeRoot, root);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  safeDirectoryExists(activeRoot, root);
  fs.mkdirSync(stagingPath, { mode: 0o700 });
  try {
    const files = createSafetyPointDatabaseImage(resolvedDbPath, stagingPath);
    const manifest: DatabaseSafetyPointManifest = {
      formatVersion: DATABASE_SAFETY_POINT_FORMAT_VERSION,
      kind: "database-safety-point",
      state: "complete",
      id,
      reason,
      createdAt: createdAt.toISOString(),
      sourceDatabase: sourceDatabaseRelativePath(resolvedDbPath),
      files,
      totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    };
    writeManifest(stagingPath, manifest);
    fs.renameSync(stagingPath, directoryPath);
    flushDirectory(root);
    pruneDatabaseSafetyPoints(
      resolvedDbPath,
      options.retention,
      new Set([id]),
      createdAt.getTime(),
    );
    return { id, directoryPath, manifest };
  } catch (error) {
    fs.rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }
}
