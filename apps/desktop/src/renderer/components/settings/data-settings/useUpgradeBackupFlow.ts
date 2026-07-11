import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteUpgradeBackup,
  listUpgradeBackups,
  restoreUpgradeBackup,
} from "../../../services/upgrade-backup";
import type { UpgradeBackupEntry } from "@prompthub/shared/types";
import { useToast } from "../../ui/Toast";
import {
  DEFAULT_VISIBLE_UPGRADE_BACKUPS,
  getErrorMessage,
} from "./data-settings-controller-utils";

function useUpgradeBackupState() {
  const [upgradeBackups, setUpgradeBackups] = useState<UpgradeBackupEntry[]>(
    [],
  );
  const [loadingUpgradeBackups, setLoadingUpgradeBackups] = useState(false);
  const [upgradeBackupActionId, setUpgradeBackupActionId] = useState<
    string | null
  >(null);
  const [showAllUpgradeBackups, setShowAllUpgradeBackups] = useState(false);
  const [restoreCandidate, setRestoreCandidate] =
    useState<UpgradeBackupEntry | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<UpgradeBackupEntry | null>(null);
  return {
    upgradeBackups,
    setUpgradeBackups,
    loadingUpgradeBackups,
    setLoadingUpgradeBackups,
    upgradeBackupActionId,
    setUpgradeBackupActionId,
    showAllUpgradeBackups,
    setShowAllUpgradeBackups,
    restoreCandidate,
    setRestoreCandidate,
    deleteCandidate,
    setDeleteCandidate,
  };
}

function useUpgradeBackupRefresh(
  webRuntime: boolean,
  setLoading: (loading: boolean) => void,
  setBackups: (backups: UpgradeBackupEntry[]) => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return useCallback(async () => {
    if (webRuntime) return;
    setLoading(true);
    try {
      setBackups(await listUpgradeBackups());
    } catch (error) {
      console.error("Failed to load upgrade backups:", error);
      showToast(
        `${t("settings.upgradeBackupLoadFailed", "Failed to load upgrade backups")}: ${getErrorMessage(error)}`,
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [setBackups, setLoading, showToast, t, webRuntime]);
}

function useUpgradeBackupRestore(
  candidate: UpgradeBackupEntry | null,
  setActionId: (value: string | null) => void,
  setCandidate: (value: UpgradeBackupEntry | null) => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async () => {
    if (!candidate) return;
    setActionId(candidate.backupId);
    try {
      const result = await restoreUpgradeBackup(candidate.backupId);
      if (!result.success) {
        showToast(
          `${t("settings.upgradeBackupRestoreFailed", "Failed to restore upgrade backup")}: ${result.error || t("common.unknownError", "Unknown error")}`,
          "error",
        );
        return;
      }
      showToast(
        t(
          "settings.upgradeBackupRestoreScheduled",
          "Upgrade backup restored. PromptHub will restart automatically.",
        ),
        "success",
      );
      setCandidate(null);
    } catch (error) {
      console.error("Failed to restore upgrade backup:", error);
      showToast(
        `${t("settings.upgradeBackupRestoreFailed", "Failed to restore upgrade backup")}: ${getErrorMessage(error)}`,
        "error",
      );
    } finally {
      setActionId(null);
    }
  };
}

function useUpgradeBackupDelete(
  candidate: UpgradeBackupEntry | null,
  refresh: () => Promise<void>,
  setActionId: (value: string | null) => void,
  setCandidate: (value: UpgradeBackupEntry | null) => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async () => {
    if (!candidate) return;
    setActionId(candidate.backupId);
    try {
      await deleteUpgradeBackup(candidate.backupId);
      setCandidate(null);
      await refresh();
      showToast(
        t("settings.upgradeBackupDeleteSuccess", "Upgrade backup deleted"),
        "success",
      );
    } catch (error) {
      console.error("Failed to delete upgrade backup:", error);
      showToast(
        `${t("settings.upgradeBackupDeleteFailed", "Failed to delete upgrade backup")}: ${getErrorMessage(error)}`,
        "error",
      );
    } finally {
      setActionId(null);
    }
  };
}

function getVisibleBackups(backups: UpgradeBackupEntry[], expanded: boolean) {
  return expanded ? backups : backups.slice(0, DEFAULT_VISIBLE_UPGRADE_BACKUPS);
}

export function useUpgradeBackupFlow(webRuntime: boolean) {
  const state = useUpgradeBackupState();
  const refreshUpgradeBackups = useUpgradeBackupRefresh(
    webRuntime,
    state.setLoadingUpgradeBackups,
    state.setUpgradeBackups,
  );
  const handleConfirmRestoreUpgradeBackup = useUpgradeBackupRestore(
    state.restoreCandidate,
    state.setUpgradeBackupActionId,
    state.setRestoreCandidate,
  );
  const handleConfirmDeleteUpgradeBackup = useUpgradeBackupDelete(
    state.deleteCandidate,
    refreshUpgradeBackups,
    state.setUpgradeBackupActionId,
    state.setDeleteCandidate,
  );

  useEffect(() => {
    void refreshUpgradeBackups();
  }, [refreshUpgradeBackups]);

  return {
    ...state,
    refreshUpgradeBackups,
    handleConfirmRestoreUpgradeBackup,
    handleConfirmDeleteUpgradeBackup,
    visibleUpgradeBackups: getVisibleBackups(
      state.upgradeBackups,
      state.showAllUpgradeBackups,
    ),
    hiddenUpgradeBackupsCount: Math.max(
      0,
      state.upgradeBackups.length - DEFAULT_VISIBLE_UPGRADE_BACKUPS,
    ),
  };
}
