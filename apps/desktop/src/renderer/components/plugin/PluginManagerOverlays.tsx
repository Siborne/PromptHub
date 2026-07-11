import { lazy, Suspense } from "react";
import {
  EyeIcon,
  FolderOpenIcon,
  SendIcon,
  StarIcon,
  TagsIcon,
  TrashIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ContextMenuItem } from "../ui/ContextMenu";
import type { PluginManagerState } from "./usePluginManagerState";
import { getPluginLocalPackagePath } from "./plugin-manager-utils";

const SkillScanPreview = lazy(() =>
  import("../skill/SkillScanPreview").then((module) => ({
    default: module.SkillScanPreview,
  })),
);

interface ChildSkillImportOverlayProps {
  actions: {
    handleImportScannedChildSkills: (
      skills: PluginManagerState["childSkillScanResults"],
      userTagsByPath?: Record<string, string[]>,
    ) => Promise<number>;
    handleRescanChildSkills: (paths: string[]) => Promise<boolean>;
  };
  installedSkillPaths: Set<string>;
  state: PluginManagerState;
}

export function PluginChildSkillImportOverlay({
  actions,
  installedSkillPaths,
  state,
}: ChildSkillImportOverlayProps) {
  if (!state.childSkillImportPlugin) return null;
  return (
    <Suspense fallback={null}>
      <SkillScanPreview
        scannedSkills={state.childSkillScanResults}
        installedPaths={installedSkillPaths}
        onImport={actions.handleImportScannedChildSkills}
        onRescan={actions.handleRescanChildSkills}
        onClose={() => closeChildSkillImportOverlay(state)}
      />
    </Suspense>
  );
}

function closeChildSkillImportOverlay(state: PluginManagerState) {
  state.setChildSkillImportPlugin(null);
  state.setChildSkillScanResults([]);
}

interface PluginLibraryContextMenuOptions {
  actions: {
    handleOpenLibraryAgentTargets: (
      plugin: NonNullable<PluginManagerState["contextMenu"]>["plugin"],
    ) => void;
    handleOpenLibraryFolder: (
      plugin: NonNullable<PluginManagerState["contextMenu"]>["plugin"],
    ) => void;
    handleToggleFavorite: (
      plugin: NonNullable<PluginManagerState["contextMenu"]>["plugin"],
    ) => Promise<void>;
  };
  openSinglePluginTagDialog: (
    plugin: NonNullable<PluginManagerState["contextMenu"]>["plugin"],
  ) => void;
  state: PluginManagerState;
  t: ReturnType<typeof useTranslation>["t"];
}

function getFavoriteMenuItem(
  options: PluginLibraryContextMenuOptions,
): ContextMenuItem {
  const { actions, state, t } = options;
  const plugin = state.contextMenu!.plugin;
  return {
    label: plugin.isFavorite
      ? t("plugin.removeFavorite", "Remove Favorite")
      : t("plugin.addFavorite", "Add Favorite"),
    icon: (
      <StarIcon
        className={`h-4 w-4 ${plugin.isFavorite ? "fill-amber-400 text-amber-400" : ""}`}
      />
    ),
    onClick: () => void actions.handleToggleFavorite(plugin),
  };
}

function getLibraryContextMenuItems(
  options: PluginLibraryContextMenuOptions,
): ContextMenuItem[] {
  const { actions, openSinglePluginTagDialog, state, t } = options;
  if (!state.contextMenu) return [];
  const plugin = state.contextMenu.plugin;
  return [
    {
      label: t("plugin.viewDetail", "View Details"),
      icon: <EyeIcon className="h-4 w-4" />,
      onClick: () => state.setDetailLibraryPlugin(plugin),
    },
    getFavoriteMenuItem(options),
    {
      label: t("plugin.batchTags", "Batch Tags"),
      icon: <TagsIcon className="h-4 w-4" />,
      onClick: () => openSinglePluginTagDialog(plugin),
    },
    {
      label: t("plugin.selectAgentTargets", "Select Agent targets"),
      icon: <SendIcon className="h-4 w-4" />,
      onClick: () => actions.handleOpenLibraryAgentTargets(plugin),
    },
    {
      label: t("plugin.openPluginFolder", "Open Plugin folder"),
      icon: <FolderOpenIcon className="h-4 w-4" />,
      disabled: !getPluginLocalPackagePath(plugin),
      onClick: () => actions.handleOpenLibraryFolder(plugin),
    },
    {
      label: t("common.delete", "Delete"),
      icon: <TrashIcon className="h-4 w-4" />,
      variant: "destructive",
      onClick: () => state.setDeleteTarget(plugin),
    },
  ];
}

export function usePluginLibraryContextMenuItems(
  options: PluginLibraryContextMenuOptions,
) {
  return getLibraryContextMenuItems(options);
}
