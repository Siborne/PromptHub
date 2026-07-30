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
    await expect(store.hasMany(["codex-provider:none"])).resolves.toEqual(
      new Set(),
    );
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

  it("serializes concurrent mutations without dropping unrelated secrets", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });
    const entries = Array.from({ length: 32 }, (_, index) => ({
      ref: `agent-provider:concurrent-${index}`,
      value: `value-${index}`,
    }));

    await Promise.all(entries.map(({ ref, value }) => store.write(ref, value)));

    await expect(store.hasMany(entries.map(({ ref }) => ref))).resolves.toEqual(
      new Set(entries.map(({ ref }) => ref)),
    );
    await Promise.all(
      entries.map(({ ref, value }) =>
        expect(store.read(ref)).resolves.toBe(value),
      ),
    );
  });

  it("applies concurrent writes and clears in invocation order", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    await Promise.all([
      store.write("agent-provider:a", "value-a"),
      store.clear("agent-provider:a"),
      store.write("agent-provider:b", "value-b"),
    ]);

    await expect(store.read("agent-provider:a")).resolves.toBeNull();
    await expect(store.read("agent-provider:b")).resolves.toBe("value-b");
  });

  it("makes reads wait for mutations invoked before them", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });

    const write = store.write("agent-provider:pending", "pending-value");

    await expect(store.has("agent-provider:pending")).resolves.toBe(true);
    await expect(store.read("agent-provider:pending")).resolves.toBe(
      "pending-value",
    );
    await write;
  });

  it("serializes mutations from multiple store instances for one file", async () => {
    const root = await createRoot();
    const filePath = path.join(root, "shared-agent-secrets.json");
    const encryption = createFakeEncryption().encryption;
    const first = createAgentSecretStore({ filePath, encryption });
    const second = createAgentSecretStore({ filePath, encryption });

    await Promise.all([
      first.write("agent-provider:first", "first-value"),
      second.write("agent-provider:second", "second-value"),
    ]);

    await expect(
      first.hasMany(["agent-provider:first", "agent-provider:second"]),
    ).resolves.toEqual(
      new Set(["agent-provider:first", "agent-provider:second"]),
    );
  });

  it("continues queued mutations after an earlier mutation fails", async () => {
    const root = await createRoot();
    const baseEncryption = createFakeEncryption().encryption;
    let failNextEncryption = true;
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: {
        ...baseEncryption,
        encryptString(value) {
          if (failNextEncryption) {
            failNextEncryption = false;
            throw new Error("injected encryption failure");
          }
          return baseEncryption.encryptString(value);
        },
      },
    });

    const first = store.write("agent-provider:first", "first-value");
    const second = store.write("agent-provider:second", "second-value");

    await expect(first).rejects.toThrow("injected encryption failure");
    await expect(second).resolves.toBeUndefined();
    await expect(store.read("agent-provider:second")).resolves.toBe(
      "second-value",
    );
  });

  it("checks multiple refs from one bounded snapshot", async () => {
    const root = await createRoot();
    const store = createAgentSecretStore({
      userDataPath: root,
      encryption: createFakeEncryption().encryption,
    });
    await store.write("agent-provider:a", "value-a");
    await store.write("agent-provider:b", "value-b");

    await expect(
      store.hasMany([
        "agent-provider:a",
        "agent-provider:missing",
        "agent-provider:b",
        "agent-provider:a",
      ]),
    ).resolves.toEqual(new Set(["agent-provider:a", "agent-provider:b"]));
    await expect(store.hasMany([])).resolves.toEqual(new Set());
    await expect(store.hasMany(["invalid ref"])).rejects.toThrow(
      "AGENT_SECRET_STORE_REF_INVALID",
    );
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
    await expect(store.write("codex-provider:x", "")).rejects.toThrow(
      "AGENT_SECRET_STORE_VALUE_INVALID",
    );
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
