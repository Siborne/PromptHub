import type { ScannedSkill } from "@prompthub/shared/types";
import type { PluginLibraryEntry } from "@prompthub/shared/types/plugin";
import { useTranslation } from "react-i18next";
import { useToast } from "../ui/Toast";
import type { PluginManagerBindings } from "./usePluginManagerBindings";
import type { PluginManagerState } from "./usePluginManagerState";
import {
  getErrorMessage,
  getPluginLocalPackagePath,
} from "./plugin-manager-utils";

interface PluginManagerChildAssetActionOptions {
  bindings: PluginManagerBindings;
  showToast: ReturnType<typeof useToast>["showToast"];
  state: PluginManagerState;
  t: ReturnType<typeof useTranslation>["t"];
}

function useImportChildSkillsAction(
  options: PluginManagerChildAssetActionOptions,
) {
  const { bindings, showToast, state, t } = options;
  return async (plugin: PluginLibraryEntry) => {
    const localPackagePath = getPluginLocalPackagePath(plugin);
    if (!localPackagePath)
      return showToast(
        t(
          "plugin.importChildSkillsMissingPackage",
          "This Plugin has no local package folder to scan.",
        ),
        "error",
      );
    state.setIsScanningChildSkills(true);
    try {
      const scannedSkills = await bindings.scanLocalPreview([localPackagePath]);
      state.setChildSkillScanResults(scannedSkills);
      if (scannedSkills.length === 0) {
        state.setChildSkillImportPlugin(null);
        showToast(
          t(
            "plugin.noChildSkillsFound",
            "No importable Skills were found in this Plugin.",
          ),
          "info",
        );
        return;
      }
      state.setChildSkillImportPlugin(plugin);
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      state.setIsScanningChildSkills(false);
    }
  };
}

function useRescanChildSkillsAction(
  options: PluginManagerChildAssetActionOptions,
) {
  const { bindings, showToast, state, t } = options;
  return async (customPaths: string[]) => {
    const localPackagePath =
      state.childSkillImportPlugin &&
      getPluginLocalPackagePath(state.childSkillImportPlugin);
    if (!localPackagePath) return false;
    try {
      const scannedSkills = await bindings.scanLocalPreview([
        localPackagePath,
        ...customPaths,
      ]);
      state.setChildSkillScanResults(scannedSkills);
      showToast(
        t("skill.scanLocalComplete", {
          count: scannedSkills.length,
          defaultValue: "Found {{count}} skill(s)",
        }),
        "success",
      );
      return true;
    } catch (error) {
      showToast(getErrorMessage(error), "error");
      return false;
    }
  };
}

function useImportScannedChildSkillsAction(
  options: PluginManagerChildAssetActionOptions,
) {
  const { bindings, showToast, state, t } = options;
  return async (
    scannedSkills: ScannedSkill[],
    userTagsByPath?: Record<string, string[]>,
  ) => {
    try {
      const result = await bindings.importScannedSkills(
        scannedSkills,
        userTagsByPath,
        "copy",
      );
      await bindings.loadSkills();
      navigateToImportedSkills(
        result.importedSkills,
        result.importedCount,
        bindings,
      );
      showToast(
        t("plugin.importChildSkillsSuccess", {
          count: result.importedCount,
          defaultValue: "Imported {{count}} Skill(s) to My Skills",
        }),
        result.failed.length > 0 ? "error" : "success",
      );
      return result.importedCount;
    } catch (error) {
      showToast(getErrorMessage(error), "error");
      throw error;
    }
  };
}

function navigateToImportedSkills(
  importedSkills: Awaited<
    ReturnType<PluginManagerBindings["importScannedSkills"]>
  >["importedSkills"],
  importedCount: number,
  bindings: PluginManagerBindings,
) {
  if (importedCount === 0) return;
  const ids = importedSkills
    .map((skill) => skill.id)
    .filter((id): id is string => Boolean(id));
  bindings.requestPluginChildSkillDeploy(ids);
  bindings.setSkillStoreView("my-skills");
  if (importedSkills[0]?.id) bindings.selectSkill(importedSkills[0].id);
  bindings.setAppModule("skill");
}

function useImportChildMcpAction(
  options: PluginManagerChildAssetActionOptions,
) {
  const { bindings, showToast, state, t } = options;
  return async (plugin: PluginLibraryEntry) => {
    state.setIsImportingChildMcp(true);
    try {
      const result = await bindings.pluginStore.importChildMcpServers(
        plugin.id,
      );
      if (result.imported.length > 0)
        await navigateToImportedMcp(result.imported, bindings);
      showChildMcpImportResult(result, showToast, t);
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      state.setIsImportingChildMcp(false);
    }
  };
}

async function navigateToImportedMcp(
  imported: Awaited<
    ReturnType<PluginManagerBindings["pluginStore"]["importChildMcpServers"]>
  >["imported"],
  bindings: PluginManagerBindings,
) {
  await bindings.loadMcp();
  bindings.requestPluginChildMcpDeploy(
    imported
      .map((server) => server.id)
      .filter((id): id is string => Boolean(id)),
  );
  bindings.setMcpSelectedTab("library");
  bindings.selectMcpServer(imported[0]?.id ?? null);
  bindings.setAppModule("mcp");
}

function showChildMcpImportResult(
  result: Awaited<
    ReturnType<PluginManagerBindings["pluginStore"]["importChildMcpServers"]>
  >,
  showToast: ReturnType<typeof useToast>["showToast"],
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (result.imported.length > 0)
    return showToast(
      t("plugin.importChildMcpSuccess", {
        count: result.imported.length,
        defaultValue: "Imported {{count}} MCP server(s) to My MCP",
      }),
      result.failedFiles.length > 0 ? "error" : "success",
    );
  if (result.scannedFiles.length === 0)
    return showToast(
      t(
        "plugin.noChildMcpFound",
        "No importable MCP configs were found in this Plugin.",
      ),
      "info",
    );
  if (result.skipped.length > 0 && result.failedFiles.length === 0)
    return showToast(
      t(
        "plugin.importChildMcpSkipped",
        "Detected MCP servers already exist in My MCP.",
      ),
      "info",
    );
  showToast(
    t(
      "plugin.importChildMcpFailed",
      "No MCP servers were imported from detected Plugin configs.",
    ),
    "error",
  );
}

export function usePluginManagerChildAssetActions(
  options: PluginManagerChildAssetActionOptions,
) {
  const handleImportChildSkills = useImportChildSkillsAction(options);
  const handleRescanChildSkills = useRescanChildSkillsAction(options);
  const handleImportScannedChildSkills =
    useImportScannedChildSkillsAction(options);
  const handleImportChildMcp = useImportChildMcpAction(options);
  return {
    handleImportChildSkills,
    handleRescanChildSkills,
    handleImportScannedChildSkills,
    handleImportChildMcp,
  };
}
