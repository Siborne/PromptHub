import fs from "node:fs/promises";
import path from "node:path";

const BACKUP_VERSION = 1;
const MAX_BACKUP_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_ENCRYPTED_BACKUP_BYTES = 4 * 1024 * 1024;

interface PersistedEncryptedBackup {
  version: 1;
  payload: string;
}

export interface AgentConfigEncryption {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

function assertInsideRoot(rootPath: string, candidatePath: string): void {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error("AGENT_CONFIG_BACKUP_PATH_INVALID");
  }
}

function requireEncryption(encryption: AgentConfigEncryption): void {
  if (!encryption.isEncryptionAvailable()) {
    throw new Error("AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE");
  }
}

interface EncryptedConfigBackupOptions {
  backupRoot: string;
  agentId: string;
  sourcePath: string;
  encryption: AgentConfigEncryption;
}

export function createEncryptedConfigBackup(
  options: EncryptedConfigBackupOptions & { content: string },
): Promise<string>;
export function createEncryptedConfigBackup(
  options: EncryptedConfigBackupOptions & { content: null },
): Promise<null>;
export function createEncryptedConfigBackup(
  options: EncryptedConfigBackupOptions & { content: string | null },
): Promise<string | null>;
export async function createEncryptedConfigBackup(
  options: EncryptedConfigBackupOptions & { content: string | null },
): Promise<string | null> {
  if (options.content === null) return null;
  if (Buffer.byteLength(options.content, "utf8") > MAX_BACKUP_CONTENT_BYTES) {
    throw new Error("AGENT_CONFIG_BACKUP_SIZE_INVALID");
  }
  requireEncryption(options.encryption);
  const targetDir = path.join(
    options.backupRoot,
    options.agentId,
    String(Date.now()),
  );
  const targetPath = path.join(
    targetDir,
    `${path.basename(options.sourcePath)}.enc`,
  );
  assertInsideRoot(options.backupRoot, targetPath);
  const persisted: PersistedEncryptedBackup = {
    version: BACKUP_VERSION,
    payload: options.encryption
      .encryptString(options.content)
      .toString("base64"),
  };
  await fs.mkdir(targetDir, { recursive: true, mode: 0o700 });
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(persisted), {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporaryPath, targetPath);
    await fs.chmod(targetPath, 0o600).catch(() => undefined);
    return targetPath;
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function readEncryptedConfigBackup(options: {
  backupRoot: string;
  backupRef: string;
  encryption: AgentConfigEncryption;
}): Promise<string> {
  assertInsideRoot(options.backupRoot, options.backupRef);
  requireEncryption(options.encryption);
  const stat = await fs.lstat(options.backupRef);
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.size > MAX_ENCRYPTED_BACKUP_BYTES
  ) {
    throw new Error("AGENT_CONFIG_BACKUP_INVALID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(options.backupRef, "utf8"));
  } catch {
    throw new Error("AGENT_CONFIG_BACKUP_INVALID");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as Record<string, unknown>).version !== BACKUP_VERSION ||
    typeof (parsed as Record<string, unknown>).payload !== "string"
  ) {
    throw new Error("AGENT_CONFIG_BACKUP_INVALID");
  }
  try {
    return options.encryption.decryptString(
      Buffer.from((parsed as PersistedEncryptedBackup).payload, "base64"),
    );
  } catch {
    throw new Error("AGENT_CONFIG_BACKUP_INVALID");
  }
}
