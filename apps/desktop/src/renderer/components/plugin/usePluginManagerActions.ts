import type { PluginLibraryEntry } from "@prompthub/shared/types/plugin";
import { useTranslation } from "react-i18next";
import { useToast } from "../ui/Toast";
import type { PluginManagerBindings } from "./usePluginManagerBindings";
import { usePluginManagerBatchActions } from "./usePluginManagerBatchActions";
import { usePluginManagerChildAssetActions } from "./usePluginManagerChildAssetActions";
import { usePluginManagerLibraryActions } from "./usePluginManagerLibraryActions";
import { usePluginManagerMarketActions } from "./usePluginManagerMarketActions";
import { usePluginManagerSelectionActions } from "./usePluginManagerSelectionActions";
import type { PluginManagerState } from "./usePluginManagerState";
import type { usePluginCatalogModel } from "./usePluginCatalogModel";

interface PluginManagerActionsOptions {
  bindings: PluginManagerBindings;
  catalog: ReturnType<typeof usePluginCatalogModel>;
  showToast: ReturnType<typeof useToast>["showToast"];
  state: PluginManagerState;
  t: ReturnType<typeof useTranslation>["t"];
}

function useOpenSinglePluginTagDialog(state: PluginManagerState) {
  return (plugin: PluginLibraryEntry) => {
    state.setSelectedLibraryPluginIds(new Set([plugin.id]));
    state.setBatchTagDialogOpen(true);
  };
}

export function usePluginManagerActions(options: PluginManagerActionsOptions) {
  const shared = {
    bindings: options.bindings,
    showToast: options.showToast,
    state: options.state,
    t: options.t,
  };
  const marketActions = usePluginManagerMarketActions(shared);
  const batchActions = usePluginManagerBatchActions({
    ...shared,
    selectedInstallEntries: options.catalog.selectedInstallEntries,
    selectedInstalledMarketPlugins:
      options.catalog.selectedInstalledMarketPlugins,
    selectedLibraryPlugins: options.catalog.selectedLibraryPlugins,
    selectedLibraryPluginsAllFavorite:
      options.catalog.selectedLibraryPluginsAllFavorite,
    selectedMarketEntryCount: options.catalog.selectedMarketEntries.length,
  });
  const libraryActions = usePluginManagerLibraryActions({
    ...shared,
    selectedLibraryPlugins: options.catalog.selectedLibraryPlugins,
  });
  const childAssetActions = usePluginManagerChildAssetActions(shared);
  const selectionActions = usePluginManagerSelectionActions({
    ...options.catalog,
    selectedTab: options.bindings.pluginStore.selectedTab,
    state: options.state,
  });
  const openSinglePluginTagDialog = useOpenSinglePluginTagDialog(options.state);
  return {
    ...marketActions,
    ...batchActions,
    ...libraryActions,
    ...childAssetActions,
    ...selectionActions,
    openSinglePluginTagDialog,
  };
}
