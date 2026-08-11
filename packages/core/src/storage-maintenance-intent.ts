import crypto from "crypto";
import fs from "fs";
import path from "path";

interface StorageMaintenanceRecord {
  kind: "prompthub-storage-maintenance";
  version: 1;
  operationId: string;
  operationKind: string;
  pid: number;
  token: string;
  createdAt: string;
}

export interface StorageMaintenanceIntent {
  intentPath: string;
  release: () => void;
}

export class StorageMaintenanceBusyError extends Error {
  readonly code = "STORAGE_MAINTENANCE_BUSY";

  constructor(
    message = "PromptHub storage maintenance is already in progress",
  ) {
    super(message);
    this.name = "StorageMaintenanceBusyError";
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

export function getStorageMaintenanceIntentPath(activeRoot: string): string {
  return path.join(
    path.resolve(activeRoot),
    "backups",
    "recovery",
    "journals",
    "storage-maintenance.json",
  );
}

function readRecord(intentPath: string): StorageMaintenanceRecord | null {
  try {
    const stats = fs.lstatSync(intentPath);
    if (!stats.isFile() || stats.isSymbolicLink()) return null;
    const value = JSON.parse(
      fs.readFileSync(intentPath, "utf8"),
    ) as Partial<StorageMaintenanceRecord>;
    if (
      value.kind !== "prompthub-storage-maintenance" ||
      value.version !== 1 ||
      typeof value.operationId !== "string" ||
      !/^[a-zA-Z0-9._-]{1,128}$/.test(value.operationId) ||
      typeof value.operationKind !== "string" ||
      !/^[a-zA-Z0-9._-]{1,64}$/.test(value.operationKind) ||
      !Number.isInteger(value.pid) ||
      Number(value.pid) <= 0 ||
      typeof value.token !== "string" ||
      !/^[a-f0-9]{32}$/.test(value.token) ||
      typeof value.createdAt !== "string"
    ) {
      return null;
    }
    return value as StorageMaintenanceRecord;
  } catch {
    return null;
  }
}

function removeIfOwned(intentPath: string, token: string): void {
  if (readRecord(intentPath)?.token === token) {
    fs.rmSync(intentPath, { force: true });
  }
}

export function assertStorageMaintenanceAvailable(
  activeRoot: string,
  options: { isProcessAlive?: (pid: number) => boolean } = {},
): void {
  const intentPath = getStorageMaintenanceIntentPath(activeRoot);
  if (!fs.existsSync(intentPath)) return;
  const record = readRecord(intentPath);
  if (!record) {
    throw new StorageMaintenanceBusyError(
      "PromptHub storage maintenance intent is malformed or unsafe",
    );
  }
  if ((options.isProcessAlive ?? defaultIsProcessAlive)(record.pid)) {
    throw new StorageMaintenanceBusyError();
  }
  fs.rmSync(intentPath, { force: true });
}

export function assertStorageMaintenanceIntentHeld(
  activeRoot: string,
  operationId: string,
): void {
  const record = readRecord(getStorageMaintenanceIntentPath(activeRoot));
  if (
    !record ||
    record.pid !== process.pid ||
    record.operationId !== operationId
  ) {
    throw new StorageMaintenanceBusyError(
      "PromptHub storage maintenance ownership could not be verified",
    );
  }
}

export function acquireStorageMaintenanceIntent(
  activeRoot: string,
  input: { operationId: string; operationKind: string },
  options: {
    pid?: number;
    token?: string;
    isProcessAlive?: (pid: number) => boolean;
  } = {},
): StorageMaintenanceIntent {
  assertStorageMaintenanceAvailable(activeRoot, options);
  const intentPath = getStorageMaintenanceIntentPath(activeRoot);
  const pid = options.pid ?? process.pid;
  const token = options.token ?? crypto.randomBytes(16).toString("hex");
  const record: StorageMaintenanceRecord = {
    kind: "prompthub-storage-maintenance",
    version: 1,
    operationId: input.operationId,
    operationKind: input.operationKind,
    pid,
    token,
    createdAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(intentPath), { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(intentPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new StorageMaintenanceBusyError();
    }
    throw error;
  }
  return {
    intentPath,
    release: () => removeIfOwned(intentPath, token),
  };
}
