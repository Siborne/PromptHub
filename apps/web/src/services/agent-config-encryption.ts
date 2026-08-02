import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { AgentConfigEncryption } from "@prompthub/core";

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const PAYLOAD_VERSION = 1;

function parseKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  const trimmed = value.trim();
  try {
    const key = /^[a-f0-9]{64}$/iu.test(trimmed)
      ? Buffer.from(trimmed, "hex")
      : Buffer.from(trimmed, "base64");
    return key.length === KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

function requireKey(key: Buffer | null): Buffer {
  if (!key) throw new Error("AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE");
  return key;
}

function invalidPayload(): never {
  throw new Error("AGENT_CONFIG_ENCRYPTED_PAYLOAD_INVALID");
}

/** AES-256-GCM adapter for self-hosted Agent secrets and rollback backups. */
export function createAgentConfigEncryption(
  rawKey: string | undefined,
): AgentConfigEncryption {
  const key = parseKey(rawKey);
  return {
    isEncryptionAvailable: () => key !== null,
    encryptString(value) {
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv("aes-256-gcm", requireKey(key), nonce);
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([
        Buffer.from([PAYLOAD_VERSION]),
        nonce,
        cipher.getAuthTag(),
        encrypted,
      ]);
    },
    decryptString(value) {
      requireKey(key);
      if (value.length < 1 + NONCE_BYTES + TAG_BYTES) invalidPayload();
      if (value[0] !== PAYLOAD_VERSION) invalidPayload();
      try {
        const nonce = value.subarray(1, 1 + NONCE_BYTES);
        const tag = value.subarray(
          1 + NONCE_BYTES,
          1 + NONCE_BYTES + TAG_BYTES,
        );
        const encrypted = value.subarray(1 + NONCE_BYTES + TAG_BYTES);
        const decipher = createDecipheriv("aes-256-gcm", key!, nonce);
        decipher.setAuthTag(tag);
        return Buffer.concat([
          decipher.update(encrypted),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        return invalidPayload();
      }
    },
  };
}
