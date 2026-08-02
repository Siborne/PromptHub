import { describe, expect, it } from "vitest";

import { createAgentConfigEncryption } from "./agent-config-encryption";

describe("Web Agent config encryption", () => {
  it("stays unavailable for missing or malformed deployment keys", () => {
    expect(createAgentConfigEncryption(undefined).isEncryptionAvailable()).toBe(
      false,
    );
    expect(createAgentConfigEncryption("short").isEncryptionAvailable()).toBe(
      false,
    );
    expect(
      createAgentConfigEncryption(
        Buffer.alloc(31).toString("base64"),
      ).isEncryptionAvailable(),
    ).toBe(false);
  });

  it("accepts 32-byte base64 and 64-character hex keys", () => {
    const base64 = createAgentConfigEncryption(
      Buffer.alloc(32, 7).toString("base64"),
    );
    const hex = createAgentConfigEncryption(
      Buffer.alloc(32, 9).toString("hex"),
    );

    expect(base64.isEncryptionAvailable()).toBe(true);
    expect(hex.isEncryptionAvailable()).toBe(true);
    expect(base64.decryptString(base64.encryptString("secret-value"))).toBe(
      "secret-value",
    );
    expect(hex.decryptString(hex.encryptString("第二个密钥"))).toBe(
      "第二个密钥",
    );
  });

  it("uses authenticated random nonces and rejects tampered ciphertext", () => {
    const encryption = createAgentConfigEncryption(
      Buffer.alloc(32, 3).toString("hex"),
    );
    const first = encryption.encryptString("same-secret");
    const second = encryption.encryptString("same-secret");
    expect(first.equals(second)).toBe(false);

    const tampered = Buffer.from(first);
    tampered[tampered.length - 1] ^= 1;
    expect(() => encryption.decryptString(tampered)).toThrow(
      "AGENT_CONFIG_ENCRYPTED_PAYLOAD_INVALID",
    );
    expect(() => encryption.decryptString(Buffer.alloc(3))).toThrow(
      "AGENT_CONFIG_ENCRYPTED_PAYLOAD_INVALID",
    );
  });

  it("refuses encryption and decryption when no valid key is configured", () => {
    const encryption = createAgentConfigEncryption(undefined);
    expect(() => encryption.encryptString("secret")).toThrow(
      "AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE",
    );
    expect(() => encryption.decryptString(Buffer.alloc(32))).toThrow(
      "AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE",
    );
  });
});
