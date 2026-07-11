import type { MouseEvent } from "react";
import type {
  PluginLibraryEntry,
  PluginMarketEntry,
} from "@prompthub/shared/types/plugin";
import type { PluginManagerBindings } from "./usePluginManagerBindings";
import type { PluginManagerState } from "./usePluginManagerState";
import { getPluginEntryId } from "./plugin-manager-utils";

interface PluginManagerSelectionActionOptions {
  areVisibleLibraryPluginsSelected: boolean;
  areVisibleMarketEntriesSelected: boolean;
  libraryTotalPages: number;
  selectedTab: PluginManagerBindings["pluginStore"]["selectedTab"];
  state: PluginManagerState;
  visibleLibraryPluginIds: string[];
  visibleMarketEntryIds: string[];
}

function toggleSelectedEntry<T extends PluginLibraryEntry | PluginMarketEntry>(
  setSelectedIds: PluginManagerState["setSelectedMarketEntryIds"],
  entry: T,
) {
  setSelectedIds((current) => {
    const next = new Set(current);
    const id = getPluginEntryId(entry);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}

function useMarketSelectionAction(state: PluginManagerState) {
  return (entry: PluginMarketEntry) =>
    toggleSelectedEntry(state.setSelectedMarketEntryIds, entry);
}

function useLibrarySelectionAction(state: PluginManagerState) {
  return (plugin: PluginLibraryEntry) =>
    toggleSelectedEntry(state.setSelectedLibraryPluginIds, plugin);
}

function useLibraryContextMenuAction(state: PluginManagerState) {
  return (event: MouseEvent, plugin: PluginLibraryEntry) => {
    event.preventDefault();
    state.setContextMenu({ x: event.clientX, y: event.clientY, plugin });
  };
}

function usePageNavigationAction(
  libraryTotalPages: number,
  setCurrentLibraryPage: (page: number) => void,
) {
  return (page: number) =>
    setCurrentLibraryPage(Math.min(Math.max(page, 1), libraryTotalPages));
}

function useBatchModeToggleAction(state: PluginManagerState) {
  return () =>
    state.setIsBatchMode((current) => {
      if (current) {
        state.setSelectedMarketEntryIds(new Set());
        state.setSelectedLibraryPluginIds(new Set());
      }
      return !current;
    });
}

function updateVisibleSelection(
  setSelectedIds: PluginManagerState["setSelectedMarketEntryIds"],
  ids: string[],
  remove: boolean,
) {
  setSelectedIds((current) => {
    const next = new Set(current);
    ids.forEach((id) => (remove ? next.delete(id) : next.add(id)));
    return next;
  });
}

function useVisibleSelectionAction(
  options: PluginManagerSelectionActionOptions,
) {
  const {
    areVisibleLibraryPluginsSelected,
    areVisibleMarketEntriesSelected,
    selectedTab,
    state,
    visibleLibraryPluginIds,
    visibleMarketEntryIds,
  } = options;
  return () => {
    if (selectedTab === "library") {
      updateVisibleSelection(
        state.setSelectedLibraryPluginIds,
        visibleLibraryPluginIds,
        areVisibleLibraryPluginsSelected,
      );
      return;
    }
    updateVisibleSelection(
      state.setSelectedMarketEntryIds,
      visibleMarketEntryIds,
      areVisibleMarketEntriesSelected,
    );
  };
}

function useClearBatchSelectionAction(state: PluginManagerState) {
  return () => {
    state.setSelectedMarketEntryIds(new Set());
    state.setSelectedLibraryPluginIds(new Set());
  };
}

export function usePluginManagerSelectionActions(
  options: PluginManagerSelectionActionOptions & {
    setCurrentLibraryPage: (page: number) => void;
  },
) {
  const handleToggleMarketSelection = useMarketSelectionAction(options.state);
  const handleToggleLibrarySelection = useLibrarySelectionAction(options.state);
  const handleLibraryContextMenu = useLibraryContextMenuAction(options.state);
  const goToLibraryPage = usePageNavigationAction(
    options.libraryTotalPages,
    options.setCurrentLibraryPage,
  );
  const handleToggleBatchMode = useBatchModeToggleAction(options.state);
  const handleSelectVisibleEntries = useVisibleSelectionAction(options);
  const handleClearBatchSelection = useClearBatchSelectionAction(options.state);
  return {
    handleToggleMarketSelection,
    handleToggleLibrarySelection,
    handleLibraryContextMenu,
    goToLibraryPage,
    handleToggleBatchMode,
    handleSelectVisibleEntries,
    handleClearBatchSelection,
  };
}
