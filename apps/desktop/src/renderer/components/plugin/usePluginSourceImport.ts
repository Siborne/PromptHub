import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  PluginImportSourceRequest,
  PluginMarketPreview,
} from "@prompthub/shared/types/plugin";
import { usePluginStore } from "../../stores/plugin.store";
import { useToast } from "../ui/Toast";
import {
  getPluginInstallErrorMessage,
  normalizeDroppedPluginPath,
} from "./plugin-manager-utils";

interface PluginSourceImportOptions {
  importLocalPluginPackage: ReturnType<
    typeof usePluginStore.getState
  >["importLocalPluginPackage"];
  importSourcePlugin: ReturnType<
    typeof usePluginStore.getState
  >["importSourcePlugin"];
  previewSourcePlugin: ReturnType<
    typeof usePluginStore.getState
  >["previewSourcePlugin"];
  setSelectedTab: ReturnType<typeof usePluginStore.getState>["setSelectedTab"];
  showToast: ReturnType<typeof useToast>["showToast"];
  t: ReturnType<typeof useTranslation>["t"];
}

export function usePluginSourceImport({
  importLocalPluginPackage,
  importSourcePlugin,
  previewSourcePlugin,
  setSelectedTab,
  showToast,
  t,
}: PluginSourceImportOptions) {
  const [isImportingLocalPlugin, setIsImportingLocalPlugin] = useState(false);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const [isAddPluginModalOpen, setIsAddPluginModalOpen] = useState(false);
  const [isSourceImportOpen, setIsSourceImportOpen] = useState(false);
  const [isPreviewingSourcePlugin, setIsPreviewingSourcePlugin] =
    useState(false);
  const [isImportingSourcePlugin, setIsImportingSourcePlugin] = useState(false);
  const [sourceImportUrl, setSourceImportUrl] = useState("");
  const [sourceImportBranch, setSourceImportBranch] = useState("");
  const [sourceImportPackagePath, setSourceImportPackagePath] = useState("");
  const [sourceImportLabel, setSourceImportLabel] = useState("");
  const [sourceImportPreview, setSourceImportPreview] = useState<{
    preview: PluginMarketPreview;
    request: PluginImportSourceRequest;
  } | null>(null);

  const handleImportLocalPlugin = async () => {
    if (isImportingLocalPlugin) return;

    setIsImportingLocalPlugin(true);
    try {
      const sourcePath = await window.electron?.selectFolder?.();
      if (!sourcePath) return;
      const result = await importLocalPluginPackage({ sourcePath });
      setSelectedTab("library");
      showToast(
        t("plugin.importLocalPluginSuccess", {
          defaultValue: "Imported {{name}} to My Plugins",
          name: result.plugin.displayName,
        }),
        "success",
      );
    } catch (error) {
      showToast(getPluginInstallErrorMessage(error, t), "error");
    } finally {
      setIsImportingLocalPlugin(false);
    }
  };

  const handleDropImport = async (files: FileList | File[]) => {
    if (isImportingLocalPlugin) return;

    const sourcePaths = Array.from(files)
      .map((file) => window.electron?.getPathForFile?.(file) || "")
      .map(normalizeDroppedPluginPath)
      .filter((value) => value.length > 0);
    const uniqueSourcePaths = Array.from(new Set(sourcePaths));
    if (uniqueSourcePaths.length === 0) {
      showToast(
        t(
          "plugin.dropImportUnsupported",
          "Drop a local Plugin package folder from your filesystem.",
        ),
        "error",
      );
      return;
    }

    setIsImportingLocalPlugin(true);
    try {
      let importedCount = 0;
      let firstPluginName = "";
      for (const sourcePath of uniqueSourcePaths) {
        const result = await importLocalPluginPackage({ sourcePath });
        importedCount += 1;
        firstPluginName ||= result.plugin.displayName;
      }
      setSelectedTab("library");
      showToast(
        importedCount === 1
          ? t("plugin.importLocalPluginSuccess", {
              defaultValue: "Imported {{name}} to My Plugins",
              name: firstPluginName,
            })
          : t("plugin.dropImportSuccess", {
              count: importedCount,
              defaultValue:
                "Imported {{count}} Plugin package(s) to My Plugins",
            }),
        "success",
      );
    } catch (error) {
      showToast(getPluginInstallErrorMessage(error, t), "error");
    } finally {
      setIsImportingLocalPlugin(false);
    }
  };

  const resetSourceImportForm = () => {
    setSourceImportUrl("");
    setSourceImportBranch("");
    setSourceImportPackagePath("");
    setSourceImportLabel("");
  };

  const buildSourceImportRequest = (): PluginImportSourceRequest | null => {
    const url = sourceImportUrl.trim();
    if (!url) {
      showToast(
        t("plugin.importSourceUrlRequired", "Plugin URL is required"),
        "error",
      );
      return null;
    }
    return {
      url,
      branch: sourceImportBranch.trim() || undefined,
      packagePath: sourceImportPackagePath.trim() || undefined,
      label: sourceImportLabel.trim() || undefined,
    };
  };

  const handleCloseSourceImport = () => {
    if (isImportingSourcePlugin || isPreviewingSourcePlugin) return;
    setIsSourceImportOpen(false);
    resetSourceImportForm();
  };

  const handlePreviewSourcePlugin = async () => {
    const request = buildSourceImportRequest();
    if (!request) return;

    setIsPreviewingSourcePlugin(true);
    try {
      const preview = await previewSourcePlugin(request);
      setSourceImportPreview({ preview, request });
      setIsSourceImportOpen(false);
    } catch (error) {
      showToast(getPluginInstallErrorMessage(error, t), "error");
    } finally {
      setIsPreviewingSourcePlugin(false);
    }
  };

  const handleBackToSourceImportEdit = () => {
    if (isImportingSourcePlugin) return;
    setSourceImportPreview(null);
    setIsSourceImportOpen(true);
  };

  const handleCloseSourcePreview = () => {
    if (isImportingSourcePlugin) return;
    setSourceImportPreview(null);
    resetSourceImportForm();
  };

  const handleConfirmSourceImport = async () => {
    if (!sourceImportPreview) return;
    setIsImportingSourcePlugin(true);
    try {
      const result = await importSourcePlugin(sourceImportPreview.request);
      setSourceImportPreview(null);
      resetSourceImportForm();
      showToast(
        t("plugin.importSourcePluginSuccess", {
          defaultValue: "Imported {{name}} to My Plugins",
          name: result.plugin.displayName,
        }),
        "success",
      );
    } catch (error) {
      showToast(getPluginInstallErrorMessage(error, t), "error");
    } finally {
      setIsImportingSourcePlugin(false);
    }
  };

  return {
    handleBackToSourceImportEdit,
    handleCloseSourceImport,
    handleCloseSourcePreview,
    handleConfirmSourceImport,
    handleDropImport,
    handleImportLocalPlugin,
    handlePreviewSourcePlugin,
    isAddPluginModalOpen,
    isDropTargetActive,
    isImportingLocalPlugin,
    isImportingSourcePlugin,
    isPreviewingSourcePlugin,
    isSourceImportOpen,
    setIsAddPluginModalOpen,
    setIsDropTargetActive,
    setIsSourceImportOpen,
    setSourceImportBranch,
    setSourceImportLabel,
    setSourceImportPackagePath,
    setSourceImportUrl,
    sourceImportBranch,
    sourceImportLabel,
    sourceImportPackagePath,
    sourceImportPreview,
    sourceImportUrl,
  };
}
