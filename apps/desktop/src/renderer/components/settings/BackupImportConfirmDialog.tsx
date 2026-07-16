import { useTranslation } from "react-i18next";

import { hasAnySkipped } from "../../services/database-backup-format";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import {
  formatImportSkippedDetails,
  type BackupImportPreviewState,
} from "../../hooks/useBackupImportController";

interface BackupImportConfirmDialogProps {
  importPreview: BackupImportPreviewState | null;
  confirmingImport: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function formatImportCounts(
  t: ReturnType<typeof useTranslation>["t"],
  counts: BackupImportPreviewState["summary"]["counts"],
): string {
  return [
    t("settings.importCountPrompts", { count: counts.prompts }),
    t("settings.importCountFolders", { count: counts.folders }),
    t("settings.importCountVersions", { count: counts.versions }),
    t("settings.importCountPromptRelations", {
      count: counts.promptRelations,
    }),
    t("settings.importCountOutputFormats", {
      count: counts.outputFormatItems,
    }),
    t("settings.importCountRules", { count: counts.rules }),
    t("settings.importCountSkills", { count: counts.skills }),
    t("settings.importCountSkillVersions", { count: counts.skillVersions }),
    t("settings.importCountSkillFiles", { count: counts.skillFiles }),
    t("settings.importCountMcpServers", { count: counts.mcpServers }),
    t("settings.importCountPlugins", { count: counts.plugins }),
    t("settings.importCountPluginFiles", { count: counts.pluginFiles }),
    t("settings.importCountImages", { count: counts.images }),
    t("settings.importCountVideos", { count: counts.videos }),
  ].join(", ");
}

export function BackupImportConfirmDialog({
  importPreview,
  confirmingImport,
  onClose,
  onConfirm,
}: BackupImportConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      isOpen={importPreview !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t("settings.importPreviewTitle", "Review import summary")}
      message={
        importPreview ? (
          <div className="space-y-2 text-left">
            <p>
              {t("settings.importPreviewFile", "File")}:{" "}
              {importPreview.file.name}
            </p>
            <p>
              {t("settings.importPreviewExportedAt", "Exported at")}:{" "}
              {new Date(importPreview.summary.exportedAt).toLocaleString()}
            </p>
            <p>
              {t("settings.importPreviewCounts", "Will import")}:{" "}
              {formatImportCounts(t, importPreview.summary.counts)}
            </p>
            <p>
              {t(
                "settings.importPreviewBackupNotice",
                "PromptHub will automatically create a local safety backup of your current state before importing.",
              )}
            </p>
            {hasAnySkipped(importPreview.summary.skipped) ? (
              <p>
                {t(
                  "settings.importPreviewSkipped",
                  "Invalid records that will be skipped",
                )}
                : {formatImportSkippedDetails(importPreview.summary.skipped)}
              </p>
            ) : null}
          </div>
        ) : (
          ""
        )
      }
      confirmText={t(
        "settings.importConfirmAction",
        "Back up current data and import",
      )}
      cancelText={t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={confirmingImport}
    />
  );
}
