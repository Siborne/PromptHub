import { useCallback, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  BACKUP_IMPORT_ACCEPT,
  isPotentialSqliteBackupFileName,
  pickSupportedBackupFile,
} from "../../../services/database-backup";
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
  onDatabaseBackupPath?: (sourcePath: string) => Promise<void>,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActive(false);
    const databaseFile = Array.from(event.dataTransfer.files).find((file) =>
      isPotentialSqliteBackupFileName(file.name),
    );
    if (databaseFile && onDatabaseBackupPath) {
      const sourcePath = window.electron?.getPathForFile?.(databaseFile) ?? "";
      if (sourcePath) {
        await onDatabaseBackupPath(sourcePath);
        return;
      }
    }
    const file = pickSupportedBackupFile(event.dataTransfer.files);
    if (!file) {
      showToast(
        t(
          "settings.backupDropUnsupported",
          "Please drop a PromptHub export archive or SQLite database backup.",
        ),
        "error",
      );
      return;
    }
    await controller.beginImportFromFile(file);
  };
}

function useBackupFileAction(
  controller: BackupImportControllerLike,
  onDatabaseBackupPath?: (sourcePath: string) => Promise<void>,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  return useCallback(
    async (files: FileList | File[]) => {
      const databaseFile = Array.from(files).find((file) =>
        isPotentialSqliteBackupFileName(file.name),
      );
      if (databaseFile && onDatabaseBackupPath) {
        const sourcePath =
          window.electron?.getPathForFile?.(databaseFile) ?? "";
        if (sourcePath) {
          await onDatabaseBackupPath(sourcePath);
          return;
        }
      }

      const file = pickSupportedBackupFile(files);
      if (file) {
        await controller.beginImportFromFile(file);
        return;
      }
      showToast(
        t(
          "settings.backupDropUnsupported",
          "Please select a PromptHub export archive or SQLite database backup.",
        ),
        "error",
      );
    },
    [controller, onDatabaseBackupPath, showToast, t],
  );
}

export function useBackupImportFlow(
  backupImportController?: BackupImportControllerLike,
  onDatabaseBackupPath?: (sourcePath: string) => Promise<void>,
) {
  const { t } = useTranslation();
  const localBackupImportController = useBackupImportController();
  const effectiveBackupImportController =
    backupImportController ?? localBackupImportController;
  const dropState = useBackupDropState();
  const handleBackupFiles = useBackupFileAction(
    effectiveBackupImportController,
    onDatabaseBackupPath,
  );
  const handleBackupDrop = useBackupDropAction(
    effectiveBackupImportController,
    dropState.setIsBackupDropTargetActive,
    onDatabaseBackupPath,
  );
  const backupDropDescription = useMemo(
    () =>
      t(
        "settings.backupDropRestoreDesc",
        "Drag a PromptHub export archive or SQLite database backup here to review and restore it.",
      ),
    [t],
  );
  const handleImportBackup = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = BACKUP_IMPORT_ACCEPT;
    input.onchange = (event) => {
      void handleBackupFiles((event.target as HTMLInputElement).files ?? []);
    };
    input.click();
  }, [handleBackupFiles]);

  return {
    localBackupImportController,
    effectiveBackupImportController,
    handleImportBackup,
    backupDropDescription,
    handleBackupDrop,
    ...dropState,
  };
}
