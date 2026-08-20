import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const OWNED_TEMPORARY_DATABASE_MAX_BASENAME_LENGTH = 64;
export const OWNED_TEMPORARY_DATABASE_MAX_LABEL_LENGTH = 23;

const LABEL_PATTERN = /^[a-z][a-z0-9-]*$/u;
const DATABASE_SIDECARS = ["", "-journal", "-shm", "-wal"] as const;

function assertTemporaryDatabaseLabel(label: string): void {
  if (
    typeof label !== "string" ||
    !LABEL_PATTERN.test(label) ||
    label.length > OWNED_TEMPORARY_DATABASE_MAX_LABEL_LENGTH
  ) {
    throw new Error(
      `Owned temporary database label is unsafe or too long: ${label}`,
    );
  }
}

export function createOwnedTemporaryDatabasePath(
  parentPath: string,
  label: string,
): string {
  assertTemporaryDatabaseLabel(label);
  const fileName = `.${label}-${crypto.randomUUID()}.db`;
  if (fileName.length > OWNED_TEMPORARY_DATABASE_MAX_BASENAME_LENGTH) {
    throw new Error("Owned temporary database basename exceeds its limit");
  }
  return path.join(parentPath, fileName);
}

function removeOwnedLock(lockPath: string): void {
  try {
    const stats = fs.lstatSync(lockPath);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      fs.rmSync(lockPath, { force: true });
      return;
    }
    fs.rmSync(lockPath, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function cleanupOwnedTemporaryDatabase(databasePath: string): void {
  for (const suffix of DATABASE_SIDECARS) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
  removeOwnedLock(`${databasePath}.lock`);
}
