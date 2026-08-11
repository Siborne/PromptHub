import crypto from "crypto";
import fs from "fs";

import { CURRENT_DATABASE_SCHEMA_VERSION } from "./database-migration-state";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_INTERVAL_MS = 50;

interface DatabaseMigrationIntentRecord {
  kind: "prompthub-database-migration-intent";
  version: 1;
  pid: number;
  token: string;
  createdAt: string;
  targetSchemaVersion: number;
}

export interface DatabaseMigrationIntentOptions {
  pid?: number;
  token?: string;
  timeoutMs?: number;
  retryIntervalMs?: number;
  targetSchemaVersion?: number;
  isProcessAlive?: (pid: number) => boolean;
  now?: () => number;
  sleep?: (milliseconds: number) => void;
}

export interface DatabaseMigrationIntent {
  intentPath: string;
  token: string;
  release: () => void;
}

export class DatabaseMigrationBusyError extends Error {
  readonly code = "DATABASE_MIGRATION_BUSY";

  constructor(message = "Database migration is already in progress") {
    super(message);
    this.name = "DatabaseMigrationBusyError";
  }
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function defaultSleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function readIntent(intentPath: string): DatabaseMigrationIntentRecord | null {
  try {
    const stat = fs.lstatSync(intentPath);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const parsed = JSON.parse(
      fs.readFileSync(intentPath, "utf8"),
    ) as Partial<DatabaseMigrationIntentRecord>;
    if (
      parsed.kind !== "prompthub-database-migration-intent" ||
      parsed.version !== 1 ||
      !Number.isInteger(parsed.pid) ||
      Number(parsed.pid) <= 0 ||
      typeof parsed.token !== "string" ||
      !/^[a-f0-9]{32}$/.test(parsed.token) ||
      typeof parsed.createdAt !== "string" ||
      !Number.isInteger(parsed.targetSchemaVersion) ||
      Number(parsed.targetSchemaVersion) < 0
    ) {
      return null;
    }
    return parsed as DatabaseMigrationIntentRecord;
  } catch {
    return null;
  }
}

function publishIntent(
  intentPath: string,
  record: DatabaseMigrationIntentRecord,
): boolean {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(intentPath, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(record), "utf8");
    fs.fsyncSync(descriptor);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function recoverStaleIntent(
  intentPath: string,
  stale: DatabaseMigrationIntentRecord,
  token: string,
): void {
  const quarantinePath = `${intentPath}.stale-${token}`;
  try {
    fs.renameSync(intentPath, quarantinePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const quarantined = readIntent(quarantinePath);
  if (quarantined?.token !== stale.token) {
    throw new DatabaseMigrationBusyError(
      "Database migration intent changed during stale-owner recovery",
    );
  }
  fs.rmSync(quarantinePath, { force: true });
}

function releaseOwnedIntent(intentPath: string, token: string): void {
  const current = readIntent(intentPath);
  if (current?.token === token) fs.rmSync(intentPath, { force: true });
}

export function acquireDatabaseMigrationIntent(
  dbPath: string,
  options: DatabaseMigrationIntentOptions = {},
): DatabaseMigrationIntent {
  const intentPath = `${dbPath}.migration-intent.json`;
  const pid = options.pid ?? process.pid;
  const token = options.token ?? crypto.randomBytes(16).toString("hex");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryIntervalMs =
    options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  if (!Number.isInteger(pid) || pid <= 0 || !/^[a-f0-9]{32}$/.test(token)) {
    throw new Error("Invalid database migration intent owner");
  }
  if (timeoutMs < 0 || retryIntervalMs <= 0) {
    throw new Error("Invalid database migration intent timing");
  }

  const deadline = now() + timeoutMs;
  const record: DatabaseMigrationIntentRecord = {
    kind: "prompthub-database-migration-intent",
    version: 1,
    pid,
    token,
    createdAt: new Date(now()).toISOString(),
    targetSchemaVersion:
      options.targetSchemaVersion ?? CURRENT_DATABASE_SCHEMA_VERSION,
  };
  while (true) {
    if (publishIntent(intentPath, record)) {
      return {
        intentPath,
        token,
        release: () => releaseOwnedIntent(intentPath, token),
      };
    }
    const existing = readIntent(intentPath);
    if (!existing) {
      throw new DatabaseMigrationBusyError(
        "Database migration intent is malformed or unsafe",
      );
    }
    if (!isProcessAlive(existing.pid)) {
      recoverStaleIntent(intentPath, existing, token);
      continue;
    }
    const remainingMs = deadline - now();
    if (remainingMs <= 0) throw new DatabaseMigrationBusyError();
    sleep(Math.min(retryIntervalMs, remainingMs));
  }
}
