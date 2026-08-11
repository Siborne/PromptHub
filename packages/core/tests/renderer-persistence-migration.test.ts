import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createRendererPersistenceStore,
  type RendererPersistenceEncryption,
} from "../src/renderer-persistence-migration";

const roots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-renderer-state-"));
  roots.push(root);
  return root;
}

const encryption: RendererPersistenceEncryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
  decryptString: (value) => {
    const decoded = value.toString("utf8");
    if (!decoded.startsWith("encrypted:")) throw new Error("bad ciphertext");
    return decoded.slice("encrypted:".length);
  },
};

function persisted(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 19 });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("renderer persistence migration", () => {
  it("moves durable settings, sources, device identity, recovery paths, and secrets to canonical owners", async () => {
    const root = createRoot();
    const store = createRendererPersistenceStore({ rootPath: root, encryption });

    const result = await store.migrate({
      settings: persisted({
        language: "zh",
        themeMode: "dark",
        webdavEnabled: true,
        webdavUrl: "https://dav.example.test/root",
        webdavUsername: "alice",
        webdavPassword: "dav-secret",
        aiApiKey: "root-ai-secret",
        aiProviders: [
          {
            id: "provider-1",
            provider: "openai",
            apiProtocol: "openai",
            apiUrl: "https://api.example.test/v1",
            apiKey: "provider-secret",
          },
        ],
        aiModels: [
          {
            id: "model-1",
            type: "chat",
            provider: "openai",
            apiProtocol: "openai",
            apiUrl: "https://api.example.test/v1",
            apiKey: "model-secret",
            model: "gpt-test",
          },
        ],
        networkProxy: {
          mode: "manual",
          protocol: "http",
          host: "127.0.0.1",
          port: 7890,
          username: "proxy-user",
          password: "proxy-secret",
          bypass: "localhost",
        },
        githubToken: "github-secret",
        unknownSecret: "must-not-persist",
      }),
      skillStore: persisted({
        customStoreSources: [
          {
            id: "source-shared",
            name: "Shared",
            type: "git-repo",
            url: "https://github.com/example/skills.git",
            branch: "main",
            enabled: true,
            order: 0,
            createdAt: 1,
          },
        ],
      }),
      mcpStore: persisted({
        customStoreSources: [
          {
            id: "source-shared",
            name: "Shared MCP",
            type: "marketplace-json",
            url: "https://example.test/mcp.json",
            enabled: true,
            order: 0,
            createdAt: 2,
          },
        ],
      }),
      pluginStore: persisted({ customStoreSources: [] }),
      selfHostedDeviceId: "desktop-device-1",
      recoveryPaths: JSON.stringify(["/safe/recovery", "/safe/recovery"]),
      indexedDbMigrationDone: "1",
    });

    expect(result.status).toBe("migrated");
    expect(result.redactLegacyKeys).toEqual(
      expect.arrayContaining([
        "prompthub-settings",
        "skill-store",
        "mcp-store",
        "plugin-store",
        "prompthub-self-hosted-device-id",
        "prompthub-manual-recovery-paths",
        "prompthub:idb-migration-done",
      ]),
    );

    const allFiles = fs
      .readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => fs.statSync(path.join(root, entry)).isFile());
    const storedBytes = allFiles
      .map((entry) => fs.readFileSync(path.join(root, entry), "utf8"))
      .join("\n");
    for (const secret of [
      "dav-secret",
      "root-ai-secret",
      "provider-secret",
      "model-secret",
      "proxy-secret",
      "github-secret",
      "must-not-persist",
    ]) {
      expect(storedBytes).not.toContain(secret);
    }

    const restored = await store.readHydratedState();
    expect(restored.settings).toMatchObject({
      language: "zh",
      themeMode: "dark",
      webdavEnabled: true,
      webdavUsername: "alice",
      webdavPassword: "dav-secret",
      aiApiKey: "root-ai-secret",
      githubToken: "github-secret",
      networkProxy: {
        mode: "manual",
        host: "127.0.0.1",
        username: "proxy-user",
        password: "proxy-secret",
      },
    });
    expect(restored.settings.aiProviders).toEqual([
      expect.objectContaining({ id: "provider-1", apiKey: "provider-secret" }),
    ]);
    expect(restored.settings.aiModels).toEqual([
      expect.objectContaining({ id: "model-1", apiKey: "model-secret" }),
    ]);
    expect(restored.marketplaceSources.skill).toHaveLength(1);
    expect(restored.marketplaceSources.mcp).toHaveLength(1);
    expect(restored.recoveryPaths).toEqual(["/safe/recovery"]);
    expect(restored.selfHostedDeviceId).toBe("desktop-device-1");
    expect(restored.indexedDbMigrationDone).toBe(true);
  });

  it("survives an empty renderer snapshot after browser storage is cleared", async () => {
    const root = createRoot();
    const store = createRendererPersistenceStore({ rootPath: root, encryption });
    await store.migrate({
      settings: persisted({ language: "ja", s3SecretAccessKey: "secret" }),
      skillStore: persisted({ customStoreSources: [] }),
      selfHostedDeviceId: "desktop-device-2",
    });

    const rerun = await store.migrate({});
    expect(rerun.status).toBe("already-complete");
    const restored = await store.readHydratedState();
    expect(restored.settings.language).toBe("ja");
    expect(restored.settings.s3SecretAccessKey).toBe("secret");
    expect(restored.selfHostedDeviceId).toBe("desktop-device-2");
  });

  it("imports and redacts the legacy AI config when renderer storage has no provider copy", async () => {
    const root = createRoot();
    const store = createRendererPersistenceStore({ rootPath: root, encryption });
    await store.migrate({
      settings: persisted({ language: "en" }),
      legacyAIConfig: {
        kind: "prompthub-ai-config",
        version: 1,
        updatedAt: "2026-08-11T00:00:00.000Z",
        providers: [
          {
            id: "legacy-provider",
            provider: "openai",
            apiProtocol: "openai",
            apiUrl: "https://api.example.test/v1",
            apiKey: "legacy-provider-secret",
          },
        ],
        models: [],
        modelRouteDefaults: {},
      },
    });

    expect((await store.readHydratedState()).settings.aiProviders).toEqual([
      expect.objectContaining({
        id: "legacy-provider",
        apiKey: "legacy-provider-secret",
      }),
    ]);
    const legacyConfig = fs.readFileSync(
      path.join(root, "config", "ai-models.json"),
      "utf8",
    );
    expect(legacyConfig).not.toContain("legacy-provider-secret");
    expect(JSON.parse(legacyConfig).providers[0].apiKey).toBe("");
  });

  it("fails closed on malformed sources without publishing a completion marker", async () => {
    const root = createRoot();
    const store = createRendererPersistenceStore({ rootPath: root, encryption });

    await expect(
      store.migrate({
        skillStore: persisted({
          customStoreSources: [
            {
              id: "../escape",
              name: "Unsafe",
              type: "local-dir",
              url: "/tmp/source",
            },
          ],
        }),
      }),
    ).rejects.toThrow(/source|invalid|unsafe/iu);

    expect(
      fs.existsSync(
        path.join(
          root,
          "data",
          "operations",
          "migrations",
          "renderer-persistence-v1.json",
        ),
      ),
    ).toBe(false);
    expect(fs.existsSync(path.join(root, "config", "marketplace-sources.json"))).toBe(
      false,
    );
  });

  it("rolls back every canonical file when publication fails", async () => {
    const root = createRoot();
    const appConfigPath = path.join(root, "config", "app.json");
    fs.mkdirSync(path.dirname(appConfigPath), { recursive: true });
    fs.writeFileSync(appConfigPath, "previous-app-config\n", "utf8");
    const store = createRendererPersistenceStore({
      rootPath: root,
      encryption,
      failPublicationAt: "config/marketplace-sources.json",
    });

    await expect(
      store.migrate({
        settings: persisted({ language: "fr" }),
        skillStore: persisted({ customStoreSources: [] }),
      }),
    ).rejects.toThrow(/injected|publication/iu);

    expect(fs.readFileSync(appConfigPath, "utf8")).toBe("previous-app-config\n");
    expect(fs.existsSync(path.join(root, "secrets", "vault.enc"))).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          root,
          "data",
          "operations",
          "migrations",
          "renderer-persistence-v1.json",
        ),
      ),
    ).toBe(false);
  });

  it("moves the IndexedDB completion marker outside renderer storage", async () => {
    const root = createRoot();
    const store = createRendererPersistenceStore({ rootPath: root, encryption });
    await store.migrate({ settings: persisted({ language: "en" }) });

    expect(await store.isIndexedDbMigrationDone()).toBe(false);
    await store.markIndexedDbMigrationDone();
    expect(await store.isIndexedDbMigrationDone()).toBe(true);
    expect((await store.readHydratedState()).indexedDbMigrationDone).toBe(true);
  });

  it("keeps canonical settings, sources, recovery paths, and device identity current", async () => {
    const root = createRoot();
    const store = createRendererPersistenceStore({ rootPath: root, encryption });
    await store.migrate({ settings: persisted({ language: "en" }) });

    await store.replaceSettings({ language: "de", githubToken: "next-token" });
    await store.replaceMarketplaceSources("plugin", [
      {
        id: "plugin-source",
        name: "Plugins",
        type: "marketplace-json",
        url: "https://example.test/plugins.json",
        enabled: true,
        order: 0,
        createdAt: 1,
      },
    ]);
    await store.replaceRecoveryPaths(["/recovery/one", "/recovery/one"]);
    const firstDeviceId = await store.getOrCreateSelfHostedDeviceId();
    const secondDeviceId = await store.getOrCreateSelfHostedDeviceId();

    const restored = await store.readHydratedState();
    expect(restored.settings).toMatchObject({
      language: "de",
      githubToken: "next-token",
    });
    expect(restored.marketplaceSources.plugin).toHaveLength(1);
    expect(restored.recoveryPaths).toEqual(["/recovery/one"]);
    expect(firstDeviceId).toMatch(/^desktop-/u);
    expect(secondDeviceId).toBe(firstDeviceId);
    expect(
      fs.readFileSync(path.join(root, "secrets", "vault.enc"), "utf8"),
    ).not.toContain("next-token");
  });
});
