import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAgentSecretStore,
  type AgentSecretStoreEncryption,
} from "../../../src/main/services/agent-secret-store";

const SECRET_VALUE = "sk-test-secret-value-12345";

const temporaryRoots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-agent-secrets-"),
  );
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

// Deterministic fake that mimics safeStorage: reversible "encryption" whose
// output never contains the plaintext, plus a toggleable availability flag.
function createFakeEncryption(initialAvailable = true): {
  encryption: AgentSecretStoreEncryption;
  setAvailable(value: boolean): void;
} {
  let available = initialAvailable;
  return {
    encryption: {
      isEncryptionAvailable: () => available,
      encryptString: (value: string) =>
        Buffer.from(`enc:${Buffer.from(value, "utf8").toString("base64")}`),
      decryptString: (value: Buffer) => {
        const text = value.toString("utf8");
        if (!text.startsWith("enc:")) {
          throw new Error("decryption failed");
        }
        return Buffer.from(text.slice(4), "base64").toString("utf8");
      },
    },
    setAvailable(value: boolean) {
      available = value;
    },
  };
}

describe("agent secret store", () => {
  it("round-trips secrets through encrypted storage without plaintext on disk", async () => {
    const root = await createRoot();
    const { encryption } = createFakeEncryption();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption,
    });

    await store.write("codex-provider:deepseek", SECRET_VALUE);

    const filePath = path.join(root, "agent-secrets.json");
    const raw = await fs.readFile(filePath, "utf8");
    expect(raw).not.toContain(SECRET_VALUE);
    const persisted = JSON.parse(raw) as {
      version: number;
      secrets: Record<string, string>;
    };
    expect(persisted.version).toBe(1);
    expect(
      Object.keys(persisted.secrets).includes("codex-provider:deepseek"),
    ).toBe(true);

    await expect(store.read("codex-provider:deepseek")).resolves.toBe(
      SECRET_VALUE,
    );
    await expect(store.has("codex-provider:deepseek")).resolves.toBe(true);
    await expect(store.read("codex-provider:missing")).resolves.toBeNull();
    await expect(store.has("codex-provider:missing")).resolves.toBe(false);
  });

  it("returns null and false when the secrets file is missing", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    await expect(store.read("codex-provider:none")).resolves.toBeNull();
    await expect(store.has("codex-provider:none")).resolves.toBe(false);
    await expect(store.clear("codex-provider:none")).resolves.toBeUndefined();
    expect(
      await fs
        .access(path.join(root, "agent-secrets.json"))
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it("fails closed when encryption is unavailable", async () => {
    const root = await createRoot();
    const fake = createFakeEncryption();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: fake.encryption,
    });

    await store.write("codex-provider:deepseek", SECRET_VALUE);
    fake.setAvailable(false);

    await expect(store.read("codex-provider:deepseek")).rejects.toThrow(
      "AGENT_SECRET_STORE_UNAVAILABLE",
    );
    await expect(
      store.write("codex-provider:other", SECRET_VALUE),
    ).rejects.toThrow("AGENT_SECRET_STORE_UNAVAILABLE");

    // The stored ciphertext is left untouched by failed operations.
    fake.setAvailable(true);
    await expect(store.read("codex-provider:deepseek")).resolves.toBe(
      SECRET_VALUE,
    );
  });

  it("writes with 0600 permissions and leaves no temporary files behind", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    await store.write("codex-provider:deepseek", SECRET_VALUE);

    const filePath = path.join(root, "agent-secrets.json");
    const stat = await fs.stat(filePath);
    expect(stat.mode & 0o777).toBe(0o600);
    const siblings = await fs.readdir(root);
    expect(siblings).toEqual(["agent-secrets.json"]);
  });

  it("rejects malformed persisted JSON for every operation", async () => {
    const root = await createRoot();
    const filePath = path.join(root, "agent-secrets.json");
    await fs.writeFile(filePath, "{ broken json", "utf8");
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    await expect(store.read("codex-provider:x")).rejects.toThrow(
      "AGENT_SECRET_STORE_INVALID",
    );
    await expect(store.has("codex-provider:x")).rejects.toThrow(
      "AGENT_SECRET_STORE_INVALID",
    );
    await expect(store.clear("codex-provider:x")).rejects.toThrow(
      "AGENT_SECRET_STORE_INVALID",
    );
    await expect(store.write("codex-provider:x", SECRET_VALUE)).rejects.toThrow(
      "AGENT_SECRET_STORE_INVALID",
    );
  });

  it("rejects structurally invalid persisted payloads", async () => {
    const root = await createRoot();
    const filePath = path.join(root, "agent-secrets.json");
    await fs.writeFile(
      filePath,
      JSON.stringify({ version: 2, secrets: { a: "b" } }),
      "utf8",
    );
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });
    await expect(store.has("a")).rejects.toThrow("AGENT_SECRET_STORE_INVALID");
  });

  it("clears only the targeted ref and supports overwriting values", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    await store.write("codex-provider:a", "value-a");
    await store.write("codex-provider:b", "value-b");
    await store.write("codex-provider:a", "value-a2");

    await expect(store.read("codex-provider:a")).resolves.toBe("value-a2");

    await store.clear("codex-provider:a");
    await expect(store.has("codex-provider:a")).resolves.toBe(false);
    await expect(store.read("codex-provider:b")).resolves.toBe("value-b");
  });

  it("rejects invalid refs and empty values", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    await expect(store.read("")).rejects.toThrow(
      "AGENT_SECRET_STORE_REF_INVALID",
    );
    await expect(store.write("has space", SECRET_VALUE)).rejects.toThrow(
      "AGENT_SECRET_STORE_REF_INVALID",
    );
    await expect(
      store.write("codex-provider:x", ""),
    ).rejects.toThrow("AGENT_SECRET_STORE_VALUE_INVALID");
  });

  it("never includes secret values in error messages", async () => {
    const root = await createRoot();
    const fake = createFakeEncryption(false);
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: fake.encryption,
    });

    const failure = await store
      .write("codex-provider:x", SECRET_VALUE)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(SECRET_VALUE);
    expect((failure as Error).message).not.toContain(root);
  });
});
