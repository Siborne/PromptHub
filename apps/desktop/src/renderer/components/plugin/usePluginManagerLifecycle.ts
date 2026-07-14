import { useEffect, useRef } from "react";
import type { PluginMarketEntry } from "@prompthub/shared/types/plugin";
import type { PluginManagerBindings } from "./usePluginManagerBindings";
import type { PluginManagerState } from "./usePluginManagerState";
import type { usePluginSourceImport } from "./usePluginSourceImport";
import {
  OPEN_ADD_PLUGIN_MODAL_EVENT,
  registerAssetWorkflowEvent,
} from "../app/app-command-events";
import {
  MARKET_PREVIEW_PREFETCH_CONCURRENCY,
} from "./plugin-manager-utils";

interface PluginManagerLifecycleOptions {
  marketPreviewPrefetchEntries: PluginMarketEntry[];
  visibleLibraryPluginIds: string[];
  visibleMarketEntryIds: string[];
  bindings: PluginManagerBindings;
  setIsAddPluginModalOpen: ReturnType<
    typeof usePluginSourceImport
  >["setIsAddPluginModalOpen"];
  state: PluginManagerState;
}

function useInitialPluginLoad(
  load: PluginManagerBindings["pluginStore"]["load"],
) {
  useEffect(() => {
    void load();
  }, [load]);
}

function useMarketSourceFallback(
  marketSources: PluginManagerBindings["pluginStore"]["marketSources"],
  selectedMarketSourceId: PluginManagerBindings["pluginStore"]["selectedMarketSourceId"],
  setSelectedMarketSourceId: PluginManagerBindings["pluginStore"]["setSelectedMarketSourceId"],
) {
  useEffect(() => {
    if (
      selectedMarketSourceId === "all" ||
      selectedMarketSourceId === "new-custom" ||
      marketSources.length === 0
    )
      return;
    if (marketSources.some((source) => source.id === selectedMarketSourceId))
      return;
    const fallback =
      marketSources.find((source) => source.id === "prompthub-official") ??
      marketSources[0];
    setSelectedMarketSourceId(fallback.id);
  }, [marketSources, selectedMarketSourceId, setSelectedMarketSourceId]);
}

function useVisibleSelectionPruning(
  selectedIds: Set<string>,
  setSelectedIds: PluginManagerState["setSelectedMarketEntryIds"],
  visibleIds: string[],
) {
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIdSet = new Set(visibleIds);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIdSet.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [selectedIds.size, setSelectedIds, visibleIds]);
}

function useMarketPreviewPrefetch(
  entries: PluginMarketEntry[],
  previewMarketPlugin: PluginManagerBindings["pluginStore"]["previewMarketPlugin"],
  selectedTab: PluginManagerBindings["pluginStore"]["selectedTab"],
) {
  const inFlightRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (selectedTab !== "market" || entries.length === 0) return;
    const pending = entries.filter((entry) =>
      reservePreview(inFlightRef.current, entry),
    );
    if (pending.length === 0) return;
    void prefetchMarketEntries(
      pending,
      inFlightRef.current,
      previewMarketPlugin,
    );
  }, [entries, previewMarketPlugin, selectedTab]);
}

function reservePreview(inFlight: Set<string>, entry: PluginMarketEntry) {
  if (inFlight.has(entry.id)) return false;
  inFlight.add(entry.id);
  return true;
}

async function prefetchMarketEntries(
  entries: PluginMarketEntry[],
  inFlight: Set<string>,
  previewMarketPlugin: PluginManagerBindings["pluginStore"]["previewMarketPlugin"],
) {
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    const entry = entries[cursor++];
    if (!entry) return;
    try {
      await previewMarketPlugin(entry.id);
    } catch (error) {
      console.warn("Plugin market preview prefetch failed:", error);
    } finally {
      inFlight.delete(entry.id);
    }
    await runNext();
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MARKET_PREVIEW_PREFETCH_CONCURRENCY, entries.length) },
      runNext,
    ),
  );
}

function useDetailNavigationReset(
  detailLibraryPlugin: PluginManagerState["detailLibraryPlugin"],
  selectedTab: PluginManagerBindings["pluginStore"]["selectedTab"],
  setDetailLibraryPlugin: PluginManagerState["setDetailLibraryPlugin"],
) {
  useEffect(() => {
    if (selectedTab !== "library" && detailLibraryPlugin)
      setDetailLibraryPlugin(null);
  }, [detailLibraryPlugin, selectedTab, setDetailLibraryPlugin]);
}

function useOpenAddPluginEvent(
  setSelectedTab: PluginManagerBindings["pluginStore"]["setSelectedTab"],
  setIsAddPluginModalOpen: ReturnType<
    typeof usePluginSourceImport
  >["setIsAddPluginModalOpen"],
) {
  useEffect(() => {
    const openAddPluginModal = () => {
      setSelectedTab("library");
      setIsAddPluginModalOpen(true);
    };
    return registerAssetWorkflowEvent({
      asset: "plugin",
      eventName: OPEN_ADD_PLUGIN_MODAL_EVENT,
      listener: openAddPluginModal,
    });
  }, [setIsAddPluginModalOpen, setSelectedTab]);
}

export function usePluginManagerLifecycle(
  options: PluginManagerLifecycleOptions,
) {
  const {
    bindings,
    marketPreviewPrefetchEntries,
    setIsAddPluginModalOpen,
    state,
    visibleLibraryPluginIds,
    visibleMarketEntryIds,
  } = options;
  useInitialPluginLoad(bindings.pluginStore.load);
  useMarketSourceFallback(
    bindings.pluginStore.marketSources,
    bindings.pluginStore.selectedMarketSourceId,
    bindings.pluginStore.setSelectedMarketSourceId,
  );
  useVisibleSelectionPruning(
    state.selectedMarketEntryIds,
    state.setSelectedMarketEntryIds,
    visibleMarketEntryIds,
  );
  useVisibleSelectionPruning(
    state.selectedLibraryPluginIds,
    state.setSelectedLibraryPluginIds,
    visibleLibraryPluginIds,
  );
  useMarketPreviewPrefetch(
    marketPreviewPrefetchEntries,
    bindings.pluginStore.previewMarketPlugin,
    bindings.pluginStore.selectedTab,
  );
  useDetailNavigationReset(
    state.detailLibraryPlugin,
    bindings.pluginStore.selectedTab,
    state.setDetailLibraryPlugin,
  );
  useOpenAddPluginEvent(
    bindings.pluginStore.setSelectedTab,
    setIsAddPluginModalOpen,
  );
}
