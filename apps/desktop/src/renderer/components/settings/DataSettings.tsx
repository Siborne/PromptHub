import { lazy, Suspense } from "react";
import {
  DataSettingsControllerProvider,
  type BackupImportControllerLike,
  type DataSettingsSubsectionId,
  useDataSettingsController,
} from "./data-settings/useDataSettingsController";
import { LocalDataPanel } from "./data-settings/LocalDataPanel";
import { RecoveryPanel } from "./data-settings/RecoveryPanel";
import { SelfHostedSyncPanel } from "./data-settings/SelfHostedSyncPanel";
import { WebDAVSyncPanel } from "./data-settings/WebDAVSyncPanel";
import { S3SyncPanel } from "./data-settings/S3SyncPanel";
import { AutoSyncHistoryPanel } from "./data-settings/AutoSyncHistoryPanel";
import { BackupPanel } from "./data-settings/BackupPanel";
import { DangerPanel } from "./data-settings/DangerPanel";

const DataSettingsDialogs = lazy(() =>
  import("./data-settings/DataSettingsDialogs").then((module) => ({
    default: module.DataSettingsDialogs,
  })),
);

export type { DataSettingsSubsectionId };

interface DataSettingsProps {
  activeSubsection?: DataSettingsSubsectionId;
  backupImportController?: BackupImportControllerLike;
}

/**
 * Composes the data-path, sync, backup, recovery, and danger workflows.
 * Durable storage and sync behavior remains owned by renderer services.
 */
export function DataSettings({
  activeSubsection = "local",
  backupImportController,
}: DataSettingsProps) {
  const controller = useDataSettingsController({
    activeSubsection,
    backupImportController,
  });
  const shouldRenderDialogs =
    controller.pendingDataPathChange !== null ||
    controller.showClearConfirm ||
    controller.restoreCandidate !== null ||
    controller.deleteCandidate !== null ||
    controller.showRecoveryBrowser ||
    (!controller.backupImportController &&
      controller.localBackupImportController.importPreview !== null);

  return (
    <DataSettingsControllerProvider value={controller}>
      <div
        className={
          controller.webRuntime
            ? "space-y-6"
            : "data-settings-shell min-w-0 space-y-6"
        }
      >
        <LocalDataPanel />
        <RecoveryPanel />
        <SelfHostedSyncPanel />
        <WebDAVSyncPanel />
        <S3SyncPanel />
        <AutoSyncHistoryPanel />
        <BackupPanel />
        <DangerPanel />
      </div>
      {shouldRenderDialogs ? (
        <Suspense fallback={null}>
          <DataSettingsDialogs />
        </Suspense>
      ) : null}
    </DataSettingsControllerProvider>
  );
}
