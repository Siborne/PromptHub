/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

const handlers = new Map<string, (...args: any[]) => any>();

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    }),
  },
}));

vi.mock("@prompthub/core", () => ({
  coreAIConfigService: {
    read: vi.fn(() => ({
      kind: "prompthub-ai-config",
      version: 1,
      updatedAt: "2026-08-11T00:00:00.000Z",
      providers: [],
      models: [],
      modelRouteDefaults: {},
    })),
    replace: vi.fn(),
  },
}));

vi.mock("../../../src/main/services/network-proxy", () => ({
  applyNetworkProxySettings: vi.fn(async () => undefined),
}));

describe("settings renderer persistence IPC", () => {
  beforeEach(() => handlers.clear());

  it("routes migration, canonical updates, device identity, and IDB state through main", async () => {
    const persistence = {
      migrate: vi.fn(async () => ({ status: "migrated", redactLegacyKeys: [] })),
      readHydratedState: vi.fn(async () => ({
        migrationComplete: true,
        settings: { language: "de" },
        marketplaceSources: { skill: [], mcp: [], plugin: [] },
        recoveryPaths: [],
        selfHostedDeviceId: "desktop-1",
        indexedDbMigrationDone: false,
      })),
      replaceSettings: vi.fn(async () => undefined),
      replaceMarketplaceSources: vi.fn(async () => undefined),
      replaceRecoveryPaths: vi.fn(async () => undefined),
      getOrCreateSelfHostedDeviceId: vi.fn(async () => "desktop-1"),
      isIndexedDbMigrationDone: vi.fn(async () => false),
      markIndexedDbMigrationDone: vi.fn(async () => undefined),
    };
    const database = {
      prepare: vi.fn(() => ({ all: vi.fn(() => []), run: vi.fn() })),
      transaction: vi.fn((callback: () => void) => callback),
    };
    const { registerSettingsIPC } = await import(
      "../../../src/main/ipc/settings.ipc"
    );
    registerSettingsIPC(database as never, {
      rendererPersistence: persistence,
    });

    await handlers.get(IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_MIGRATE)?.(
      {},
      { settings: "{}" },
    );
    await handlers.get(
      IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_SETTINGS,
    )?.({}, { language: "fr" });
    await handlers.get(
      IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_SOURCES,
    )?.({}, "skill", []);
    await handlers.get(
      IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_RECOVERY_PATHS,
    )?.({}, ["/recovery"]);
    expect(
      await handlers.get(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_DEVICE_ID,
      )?.({}),
    ).toBe("desktop-1");
    expect(
      await handlers.get(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_IDB_STATUS,
      )?.({}),
    ).toBe(false);
    await handlers.get(IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_IDB_DONE)?.(
      {},
    );

    expect(persistence.migrate).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: "{}",
        legacyAIConfig: expect.objectContaining({
          kind: "prompthub-ai-config",
        }),
      }),
    );
    expect(persistence.replaceSettings).toHaveBeenCalledWith({ language: "fr" });
    expect(persistence.replaceMarketplaceSources).toHaveBeenCalledWith(
      "skill",
      [],
    );
    expect(persistence.replaceRecoveryPaths).toHaveBeenCalledWith(["/recovery"]);
    expect(persistence.markIndexedDbMigrationDone).toHaveBeenCalledOnce();

    const settings = await handlers.get(IPC_CHANNELS.SETTINGS_GET)?.({});
    expect(settings.language).toBe("de");
  });

  it("rejects an unknown marketplace domain before persistence", async () => {
    const persistence = {
      migrate: vi.fn(),
      readHydratedState: vi.fn(),
      replaceSettings: vi.fn(),
      replaceMarketplaceSources: vi.fn(),
      replaceRecoveryPaths: vi.fn(),
      getOrCreateSelfHostedDeviceId: vi.fn(),
      isIndexedDbMigrationDone: vi.fn(),
      markIndexedDbMigrationDone: vi.fn(),
    };
    const { registerSettingsIPC } = await import(
      "../../../src/main/ipc/settings.ipc"
    );
    registerSettingsIPC({} as never, { rendererPersistence: persistence as never });

    await expect(
      handlers.get(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_SOURCES,
      )?.({}, "unknown", []),
    ).rejects.toThrow(/domain/iu);
    expect(persistence.replaceMarketplaceSources).not.toHaveBeenCalled();
  });
});
