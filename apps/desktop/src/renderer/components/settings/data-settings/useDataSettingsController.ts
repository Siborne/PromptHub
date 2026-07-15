import { createContext, createElement, useContext } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "../../../stores/prompt.store";
import { useSettingsStore } from "../../../stores/settings.store";
import { useToast } from "../../ui/Toast";
import {
  DEFAULT_VISIBLE_UPGRADE_BACKUPS,
  EXPANDED_UPGRADE_BACKUP_MAX_HEIGHT,
  formatBytes,
  getErrorMessage,
  WEBDAV_SYNC_ON_SAVE_AVAILABLE,
} from "./data-settings-controller-utils";
import type {
  BackupImportControllerLike,
  DataSettingsControllerOptions,
  DataSettingsSubsectionId,
} from "./data-settings-controller-utils";
import { useBackupController } from "./useBackupController";
import { useDataPathController } from "./useDataPathController";
import { useDataSettingsRuntime } from "./useDataSettingsRuntime";
import { useDataSyncController } from "./useDataSyncController";
import { useRecoveryController } from "./useRecoveryController";

export {
  DEFAULT_VISIBLE_UPGRADE_BACKUPS,
  EXPANDED_UPGRADE_BACKUP_MAX_HEIGHT,
  getErrorMessage,
  WEBDAV_SYNC_ON_SAVE_AVAILABLE,
} from "./data-settings-controller-utils";
export type {
  BackupImportControllerLike,
  DataSettingsSubsectionId,
} from "./data-settings-controller-utils";

/**
 * Composes data settings domain hooks without coupling panels to persistence
 * or provider implementations. Panels consume the existing flat context.
 */
export function useDataSettingsController({
  activeSubsection,
  backupImportController,
}: DataSettingsControllerOptions) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const settings = useSettingsStore();
  const currentPromptCount = usePromptStore((state) => state.prompts.length);
  const runtime = useDataSettingsRuntime();
  const dataPath = useDataPathController();
  const recovery = useRecoveryController(runtime.webRuntime);
  const backup = useBackupController({
    backupImportController,
    currentVersion: runtime.currentVersion,
    securityConfigured: runtime.securityConfigured,
    webRuntime: runtime.webRuntime,
    onDatabaseBackupPath: runtime.webRuntime
      ? undefined
      : recovery.handleInspectDroppedDatabase,
  });
  const sync = useDataSyncController(activeSubsection, runtime.webRuntime);
  const refreshRecoveryBackups = async () => {
    await backup.refreshUpgradeBackups();
    await recovery.handleScanRecoverySources();
  };

  return {
    activeSubsection,
    backupImportController,
    t,
    translateLabel: (key: string, fallback: string) => t(key, fallback),
    showToast,
    settings,
    currentPromptCount,
    ...runtime,
    ...dataPath,
    ...recovery,
    ...backup,
    ...sync,
    refreshRecoveryBackups,
    formatBytes,
    DEFAULT_VISIBLE_UPGRADE_BACKUPS,
    EXPANDED_UPGRADE_BACKUP_MAX_HEIGHT,
    WEBDAV_SYNC_ON_SAVE_AVAILABLE,
  };
}

export type DataSettingsController = ReturnType<
  typeof useDataSettingsController
>;

const DataSettingsContext = createContext<DataSettingsController | null>(null);

export function DataSettingsControllerProvider({
  value,
  children,
}: {
  value: DataSettingsController;
  children: ReactNode;
}) {
  return createElement(DataSettingsContext.Provider, { value }, children);
}

export function useDataSettingsControllerContext(): DataSettingsController {
  const value = useContext(DataSettingsContext);
  if (!value) {
    throw new Error(
      "DataSettings panels require DataSettingsControllerProvider",
    );
  }
  return value;
}
