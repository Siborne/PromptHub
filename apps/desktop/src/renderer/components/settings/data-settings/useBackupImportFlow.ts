import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { pickSupportedBackupFile } from "../../../services/database-backup";
import { useBackupImportController } from "../../../hooks/useBackupImportController";
import { useToast } from "../../ui/Toast";
import type { BackupImportControllerLike } from "./data-settings-controller-utils";

function useBackupDropState() {
  const [isBackupDropTargetActive, setIsBackupDropTargetActive] =
    useState(false);
  return { isBackupDropTargetActive, setIsBackupDropTargetActive };
}

function useBackupDropAction(
  controller: BackupImportControllerLike,
  setActive: (active: boolean) => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActive(false);
    const file = pickSupportedBackupFile(event.dataTransfer.files);
    if (!file) {
      showToast(
        t(
          "settings.backupDropUnsupported",
          "Please drop a PromptHub backup file (.json, .phub.gz, .gz, or .zip).",
        ),
        "error",
      );
      return;
    }
    await controller.beginImportFromFile(file);
  };
}

export function useBackupImportFlow(
  backupImportController?: BackupImportControllerLike,
) {
  const { t } = useTranslation();
  const localBackupImportController = useBackupImportController();
  const effectiveBackupImportController =
    backupImportController ?? localBackupImportController;
  const dropState = useBackupDropState();
  const handleBackupDrop = useBackupDropAction(
    effectiveBackupImportController,
    dropState.setIsBackupDropTargetActive,
  );
  const backupDropDescription = useMemo(
    () =>
      t(
        "settings.backupDropRestoreDesc",
        "Drag a PromptHub backup archive here to review and restore it quickly.",
      ),
    [t],
  );

  return {
    localBackupImportController,
    effectiveBackupImportController,
    handleImportBackup: effectiveBackupImportController.requestFileSelection,
    backupDropDescription,
    handleBackupDrop,
    ...dropState,
  };
}
