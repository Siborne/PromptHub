/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createEncryptedConfigBackup,
  readEncryptedConfigBackup,
} from "../../../src/main/services/agent-encrypted-config-backup";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-backup-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

function encryption(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value: string) =>
      Buffer.from(`cipher:${Buffer.from(value).toString("base64")}`),
    decryptString: (value: Buffer) =>
      Buffer.from(
        value.toString().replace(/^cipher:/, ""),
        "base64",
      ).toString(),
  };
}

describe("encrypted Agent config backups", () => {
  it("persists only encrypted material and restores the exact text", async () => {
    const root = await temporaryRoot();
    const content = 'experimental_bearer_token = "secret-token"\n';
    const backupRef = await createEncryptedConfigBackup({
      backupRoot: root,
      agentId: "codex",
      sourcePath: "/tmp/config.toml",
      content,
      encryption: encryption(),
    });

    expect(backupRef).not.toBeNull();
    const persisted = await fs.readFile(backupRef!, "utf8");
    expect(persisted).not.toContain("secret-token");
    await expect(
      readEncryptedConfigBackup({
        backupRoot: root,
        backupRef: backupRef!,
        encryption: encryption(),
      }),
    ).resolves.toBe(content);
  });

  it("returns no backup for a config that did not exist", async () => {
    const root = await temporaryRoot();
    await expect(
      createEncryptedConfigBackup({
        backupRoot: root,
        agentId: "codex",
        sourcePath: "/tmp/config.toml",
        content: null,
        encryption: encryption(),
      }),
    ).resolves.toBeNull();
  });

  it("fails closed when encryption is unavailable", async () => {
    const root = await temporaryRoot();
    await expect(
      createEncryptedConfigBackup({
        backupRoot: root,
        agentId: "codex",
        sourcePath: "/tmp/config.toml",
        content: 'model = "gpt-5"\n',
        encryption: encryption(false),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE");
  });

  it("rejects traversal, symlink, malformed, and oversized backup inputs", async () => {
    const root = await temporaryRoot();
    const outside = path.join(await temporaryRoot(), "outside.enc");
    await fs.writeFile(outside, "{}");
    await expect(
      readEncryptedConfigBackup({
        backupRoot: root,
        backupRef: outside,
        encryption: encryption(),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_PATH_INVALID");

    const malformed = path.join(root, "malformed.enc");
    await fs.writeFile(malformed, '{"version":1,"payload":7}');
    await expect(
      readEncryptedConfigBackup({
        backupRoot: root,
        backupRef: malformed,
        encryption: encryption(),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_INVALID");

    const symlink = path.join(root, "symlink.enc");
    await fs.symlink(malformed, symlink);
    await expect(
      readEncryptedConfigBackup({
        backupRoot: root,
        backupRef: symlink,
        encryption: encryption(),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_INVALID");

    await expect(
      createEncryptedConfigBackup({
        backupRoot: root,
        agentId: "codex",
        sourcePath: "/tmp/config.toml",
        content: "x".repeat(2 * 1024 * 1024 + 1),
        encryption: encryption(),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_SIZE_INVALID");
  });

  it("rejects unreadable JSON and ciphertext that cannot be decrypted", async () => {
    const root = await temporaryRoot();
    const invalidJson = path.join(root, "invalid-json.enc");
    await fs.writeFile(invalidJson, "{");
    await expect(
      readEncryptedConfigBackup({
        backupRoot: root,
        backupRef: invalidJson,
        encryption: encryption(),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_INVALID");

    const invalidCiphertext = path.join(root, "invalid-ciphertext.enc");
    await fs.writeFile(
      invalidCiphertext,
      JSON.stringify({ version: 1, payload: "Y2lwaGVyOg==" }),
    );
    await expect(
      readEncryptedConfigBackup({
        backupRoot: root,
        backupRef: invalidCiphertext,
        encryption: {
          ...encryption(),
          decryptString: () => {
            throw new Error("decrypt failed");
          },
        },
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_INVALID");
  });
});
