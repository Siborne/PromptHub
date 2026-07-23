import fs from "node:fs/promises";
import path from "node:path";

const AGENT_SECRETS_FILE = "agent-secrets.json";
const MAX_SECRET_REF_LENGTH = 128;
const MAX_SECRET_VALUE_BYTES = 64 * 1024;

/**
 * Encryption boundary for the agent secret store. Matches the Electron
 * `safeStorage` surface so the main process can inject it directly while
 * tests inject a deterministic fake.
 */
export interface AgentSecretStoreEncryption {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export interface AgentSecretStore {
  read(ref: string): Promise<string | null>;
  write(ref: string, value: string): Promise<void>;
  clear(ref: string): Promise<void>;
  has(ref: string): Promise<boolean>;
}

interface PersistedAgentSecrets {
  version: 1;
  secrets: Record<string, string>;
}

export function createAgentSecretStore(options: {
  userDataPath?: string;
  filePath?: string;
  encryption: AgentSecretStoreEncryption;
}): AgentSecretStore {
  const filePath =
    options.filePath ??
    path.join(requireUserDataPath(options.userDataPath), AGENT_SECRETS_FILE);

  async function loadPersisted(): Promise<PersistedAgentSecrets | null> {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (isFileMissing(error)) return null;
      throw error;
    }
    return parsePersistedSecrets(raw);
  }

  async function persist(secrets: Record<string, string>): Promise<void> {
    const persisted: PersistedAgentSecrets = { version: 1, secrets };
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(persisted), {
        encoding: "utf8",
        mode: 0o600,
      });
      await fs.rename(temporaryPath, filePath);
      await fs.chmod(filePath, 0o600).catch(() => undefined);
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  function requireEncryption(): void {
    if (!options.encryption.isEncryptionAvailable()) {
      throw new Error("AGENT_SECRET_STORE_UNAVAILABLE");
    }
  }

  return {
    async read(ref) {
      const secretRef = normalizeSecretRef(ref);
      const persisted = await loadPersisted();
      const encrypted = persisted?.secrets[secretRef];
      if (!encrypted) return null;
      requireEncryption();
      const value = options.encryption.decryptString(
        Buffer.from(encrypted, "base64"),
      );
      if (!value) throw new Error("AGENT_SECRET_STORE_INVALID");
      return value;
    },

    async write(ref, value) {
      const secretRef = normalizeSecretRef(ref);
      if (
        typeof value !== "string" ||
        !value ||
        Buffer.byteLength(value, "utf8") > MAX_SECRET_VALUE_BYTES
      ) {
        throw new Error("AGENT_SECRET_STORE_VALUE_INVALID");
      }
      requireEncryption();
      const persisted = (await loadPersisted()) ?? {
        version: 1 as const,
        secrets: {},
      };
      persisted.secrets[secretRef] = options.encryption
        .encryptString(value)
        .toString("base64");
      await persist(persisted.secrets);
    },

    async clear(ref) {
      const secretRef = normalizeSecretRef(ref);
      const persisted = await loadPersisted();
      if (!persisted || !(secretRef in persisted.secrets)) return;
      delete persisted.secrets[secretRef];
      await persist(persisted.secrets);
    },

    async has(ref) {
      const secretRef = normalizeSecretRef(ref);
      const persisted = await loadPersisted();
      return Boolean(persisted && secretRef in persisted.secrets);
    },
  };
}

function requireUserDataPath(userDataPath: string | undefined): string {
  if (!userDataPath || !userDataPath.trim()) {
    throw new Error(
      "Agent secret store requires a userDataPath or explicit filePath",
    );
  }
  return userDataPath;
}

function normalizeSecretRef(ref: string): string {
  if (
    typeof ref !== "string" ||
    !ref.trim() ||
    ref.length > MAX_SECRET_REF_LENGTH ||
    /[\u0000-\u001f]/.test(ref) ||
    /\s/.test(ref)
  ) {
    throw new Error("AGENT_SECRET_STORE_REF_INVALID");
  }
  return ref;
}

function parsePersistedSecrets(raw: string): PersistedAgentSecrets {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("AGENT_SECRET_STORE_INVALID");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AGENT_SECRET_STORE_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !isStringRecord(record.secrets)) {
    throw new Error("AGENT_SECRET_STORE_INVALID");
  }
  return { version: 1, secrets: record.secrets };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isFileMissing(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
