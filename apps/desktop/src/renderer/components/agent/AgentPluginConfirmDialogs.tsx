import { useTranslation } from "react-i18next";

import type {
  PluginLibraryEntry,
  PluginTargetCompatibility,
} from "@prompthub/shared/types/plugin";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export interface PendingPluginDistributionRemoval {
  plugin: PluginLibraryEntry;
  target: PluginTargetCompatibility;
}

export function AgentPluginDeleteDialog({
  isLoading,
  onClose,
  onConfirm,
  plugin,
}: {
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  plugin: PluginLibraryEntry | null;
}) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      isOpen={Boolean(plugin)}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t("plugin.deletePlugin", "Delete Plugin")}
      message={t("plugin.deleteConfirmMessage", {
        name: plugin?.displayName ?? "",
        defaultValue: "Delete {{name}} from My Plugins?",
      })}
      confirmText={t("common.delete", "Delete")}
      cancelText={t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={isLoading}
    />
  );
}

export function AgentPluginRemoveDistributionDialog({
  isLoading,
  onClose,
  onConfirm,
  pending,
}: {
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: PendingPluginDistributionRemoval | null;
}) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      isOpen={Boolean(pending)}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t(
        "plugin.removePluginFromAgentConfirmTitle",
        "Remove Plugin from Agent",
      )}
      message={t("plugin.removePluginFromAgentConfirmDescription", {
        agent: pending?.target.displayName ?? "",
        defaultValue:
          "Remove {{name}} from {{agent}}? This only removes the distributed Plugin package and keeps My Plugins unchanged.",
        name: pending?.plugin.displayName ?? "",
      })}
      confirmText={t("plugin.removeFromAgent", "Remove from Agent")}
      cancelText={t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={isLoading}
    />
  );
}
