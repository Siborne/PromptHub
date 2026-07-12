import fs from "node:fs/promises";
import path from "node:path";

const CLOUD_AUTH_FILE = "cloud-auth.json";

export interface CloudCredential {
  baseUrl: string;
  token: string;
}

export interface CloudStorageEncryption {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export interface CloudCredentialStore {
  read(): Promise<CloudCredential | null>;
  write(value: CloudCredential): Promise<void>;
  clear(): Promise<void>;
}

interface PersistedCloudCredential {
  version: 1;
  baseUrl: string;
  encryptedToken: string;
}

export function createCloudCredentialStore(options: {
  userDataPath: string;
  encryption: CloudStorageEncryption;
}): CloudCredentialStore {
  const filePath = path.join(options.userDataPath, CLOUD_AUTH_FILE);

  return {
    async read() {
      let raw: string;
      try {
        raw = await fs.readFile(filePath, "utf8");
      } catch (error) {
        if (isFileMissing(error)) return null;
        throw error;
      }

      const persisted = parsePersistedCredential(raw);
      if (!options.encryption.isEncryptionAvailable()) {
        throw new Error("CLOUD_AUTH_SECURE_STORAGE_UNAVAILABLE");
      }
      const token = options.encryption.decryptString(
        Buffer.from(persisted.encryptedToken, "base64"),
      );
      if (!token.trim()) throw new Error("CLOUD_AUTH_CREDENTIAL_INVALID");
      return { baseUrl: persisted.baseUrl, token };
    },

    async write(value) {
      if (!options.encryption.isEncryptionAvailable()) {
        throw new Error("CLOUD_AUTH_SECURE_STORAGE_UNAVAILABLE");
      }
      if (!value.baseUrl.trim() || !value.token.trim()) {
        throw new Error("CLOUD_AUTH_CREDENTIAL_INVALID");
      }
      const persisted: PersistedCloudCredential = {
        version: 1,
        baseUrl: value.baseUrl.trim(),
        encryptedToken: options.encryption
          .encryptString(value.token)
          .toString("base64"),
      };
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(persisted), {
        encoding: "utf8",
        mode: 0o600,
      });
      await fs.rename(temporaryPath, filePath);
      await fs.chmod(filePath, 0o600).catch(() => undefined);
    },

    async clear() {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (!isFileMissing(error)) throw error;
      }
    },
  };
}

function parsePersistedCredential(raw: string): PersistedCloudCredential {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("CLOUD_AUTH_CREDENTIAL_INVALID");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).version !== 1 ||
    typeof (value as Record<string, unknown>).baseUrl !== "string" ||
    typeof (value as Record<string, unknown>).encryptedToken !== "string"
  ) {
    throw new Error("CLOUD_AUTH_CREDENTIAL_INVALID");
  }
  const record = value as Record<string, unknown>;
  const baseUrl = record.baseUrl;
  const encryptedToken = record.encryptedToken;
  if (
    typeof baseUrl !== "string" ||
    typeof encryptedToken !== "string" ||
    !baseUrl.trim() ||
    !encryptedToken.trim()
  ) {
    throw new Error("CLOUD_AUTH_CREDENTIAL_INVALID");
  }
  return {
    version: 1,
    baseUrl,
    encryptedToken,
  };
}

function isFileMissing(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
