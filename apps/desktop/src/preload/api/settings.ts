import { ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type { Settings } from "@prompthub/shared/types";
import type {
  MarketplaceSourceRecord,
  RendererPersistenceMigrationInput,
} from "@prompthub/core";

export const settingsApi = {
  get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  set: (settings: Partial<Settings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  rendererPersistence: {
    migrate: (input: RendererPersistenceMigrationInput) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_MIGRATE,
        input,
      ),
    get: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_GET),
    replaceSettings: (settings: Record<string, unknown>) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_SETTINGS,
        settings,
      ),
    replaceSources: (
      domain: "skill" | "mcp" | "plugin",
      sources: MarketplaceSourceRecord[],
    ) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_SOURCES,
        domain,
        sources,
      ),
    replaceRecoveryPaths: (paths: string[]) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_REPLACE_RECOVERY_PATHS,
        paths,
      ),
    getOrCreateDeviceId: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_DEVICE_ID,
      ),
    isIndexedDbMigrationDone: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_IDB_STATUS,
      ),
    markIndexedDbMigrationDone: () =>
      ipcRenderer.invoke(
        IPC_CHANNELS.SETTINGS_RENDERER_PERSISTENCE_IDB_DONE,
      ),
  },
};
