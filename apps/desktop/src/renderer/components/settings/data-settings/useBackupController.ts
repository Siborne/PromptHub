import type { BackupImportControllerLike } from "./data-settings-controller-utils";
import { useBackupExportActions } from "./useBackupExportActions";
import { useBackupImportFlow } from "./useBackupImportFlow";
import { useClearDataFlow } from "./useClearDataFlow";
import { useUpgradeBackupFlow } from "./useUpgradeBackupFlow";

interface BackupControllerOptions {
  backupImportController?: BackupImportControllerLike;
  currentVersion: string;
  securityConfigured: boolean;
  webRuntime: boolean;
}

/** Composes independent export, import, rollback, and destructive-data flows. */
export function useBackupController({
  backupImportController,
  currentVersion,
  securityConfigured,
  webRuntime,
}: BackupControllerOptions) {
  const exportActions = useBackupExportActions(currentVersion);
  const importFlow = useBackupImportFlow(backupImportController);
  const upgradeBackups = useUpgradeBackupFlow(webRuntime);
  const clearData = useClearDataFlow(securityConfigured);

  return {
    ...exportActions,
    ...importFlow,
    ...upgradeBackups,
    ...clearData,
  };
}
