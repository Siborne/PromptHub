import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadSelectiveExport } from "../../../services/database-backup";
import { runFullExportBackup } from "../../../services/backup-orchestrator";
import { useToast } from "../../ui/Toast";
import type {
  ExportScope,
  ExportScopeKey,
} from "./data-settings-controller-utils";

const DEFAULT_EXPORT_SCOPE: ExportScope = {
  prompts: true,
  folders: true,
  images: true,
  videos: true,
  aiConfig: true,
  settings: true,
  versions: false,
  rules: true,
  skills: true,
  mcp: true,
  plugins: true,
  agents: true,
};

function createExportScopeItems(
  translate: ReturnType<typeof useTranslation>["t"],
): Array<{ key: ExportScopeKey; label: string }> {
  return [
    ["prompts", "settings.exportPrompts", "Prompts"],
    ["folders", "settings.exportFolders", "Folders"],
    ["images", "settings.exportImages", "Media"],
    ["aiConfig", "settings.exportAiConfig", "AI Config"],
    ["settings", "settings.exportSettings", "Settings"],
    ["versions", "settings.exportVersions", "Version History"],
    ["rules", "settings.exportRules", "Rules"],
    ["skills", "settings.exportSkills", "Skills"],
    ["mcp", "settings.exportMcp", "MCP"],
    ["plugins", "settings.exportPlugins", "Plugins"],
    ["agents", "settings.exportAgents", "Agents"],
  ].map(([key, translationKey, fallback]) => ({
    key: key as ExportScopeKey,
    label: translate(translationKey, fallback),
  }));
}

function useExportScope() {
  const { t } = useTranslation();
  const [exportScope, setExportScope] = useState(DEFAULT_EXPORT_SCOPE);
  const exportScopeItems = useMemo(() => createExportScopeItems(t), [t]);
  return { exportScope, setExportScope, exportScopeItems };
}

function useExportRequests(currentVersion: string, exportScope: ExportScope) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const handleSelectiveExport = async () => {
    try {
      await downloadSelectiveExport(exportScope);
      showToast(t("toast.exportSuccess"), "success");
    } catch (error) {
      console.error("Selective export failed:", error);
      showToast(t("toast.exportFailed"), "error");
    }
  };

  const handleFullBackup = async () => {
    try {
      await runFullExportBackup({ currentVersion, recordManualBackup: true });
      showToast(t("toast.exportSuccess"), "success");
    } catch (error) {
      console.error("Backup failed:", error);
      showToast(t("toast.exportFailed"), "error");
    }
  };

  return { handleSelectiveExport, handleFullBackup };
}

export function useBackupExportActions(currentVersion: string) {
  const scope = useExportScope();
  const requests = useExportRequests(currentVersion, scope.exportScope);
  return { ...scope, ...requests };
}
