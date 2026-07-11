import { useTranslation } from "react-i18next";
import { useToast } from "../ui/Toast";
import { usePluginManagerActions } from "./usePluginManagerActions";
import { usePluginManagerBindings } from "./usePluginManagerBindings";
import { usePluginManagerCustomSourceActions } from "./usePluginManagerCustomSourceActions";
import { usePluginManagerLifecycle } from "./usePluginManagerLifecycle";
import { usePluginManagerPresentation } from "./usePluginManagerPresentation";
import { usePluginManagerState } from "./usePluginManagerState";
import { usePluginCatalogModel } from "./usePluginCatalogModel";
import { usePluginSourceImport } from "./usePluginSourceImport";

function getCatalogOptions(
  bindings: ReturnType<typeof usePluginManagerBindings>,
  state: ReturnType<typeof usePluginManagerState>,
  selectedMarketSource: ReturnType<
    typeof usePluginManagerCustomSourceActions
  >["selectedMarketSource"],
  t: ReturnType<typeof useTranslation>["t"],
) {
  const store = bindings.pluginStore;
  return {
    deleteTarget: state.deleteTarget,
    detailLibraryPlugin: state.detailLibraryPlugin,
    isLoading: store.isLoading,
    library: store.library,
    libraryGalleryColumns: store.libraryGalleryColumns,
    libraryTagFilters: store.filterTags,
    marketEntries: store.marketEntries,
    marketPreviews: store.marketPreviews,
    pageSize: bindings.pageSize,
    searchQuery: store.searchQuery,
    selectedLibraryPluginIds: state.selectedLibraryPluginIds,
    selectedMarketEntryIds: state.selectedMarketEntryIds,
    selectedMarketSource,
    selectedMarketSourceId: store.selectedMarketSourceId,
    selectedTab: store.selectedTab,
    skills: bindings.skills,
    t,
    targetMatrix: store.targetMatrix,
  };
}

function getSourceImportOptions(
  bindings: ReturnType<typeof usePluginManagerBindings>,
  showToast: ReturnType<typeof useToast>["showToast"],
  t: ReturnType<typeof useTranslation>["t"],
) {
  const store = bindings.pluginStore;
  return {
    importLocalPluginPackage: store.importLocalPluginPackage,
    importSourcePlugin: store.importSourcePlugin,
    previewSourcePlugin: store.previewSourcePlugin,
    setSelectedTab: store.setSelectedTab,
    showToast,
    t,
  };
}

function getActionOptions(
  context: PluginManagerControllerContext,
  catalog: ReturnType<typeof usePluginCatalogModel>,
) {
  return { ...context, catalog };
}

function getLifecycleOptions(
  bindings: ReturnType<typeof usePluginManagerBindings>,
  catalog: ReturnType<typeof usePluginCatalogModel>,
  state: ReturnType<typeof usePluginManagerState>,
  sourceImport: ReturnType<typeof usePluginSourceImport>,
) {
  return {
    bindings,
    marketPreviewPrefetchEntries: catalog.marketPreviewPrefetchEntries,
    setIsAddPluginModalOpen: sourceImport.setIsAddPluginModalOpen,
    state,
    visibleLibraryPluginIds: catalog.visibleLibraryPluginIds,
    visibleMarketEntryIds: catalog.visibleMarketEntryIds,
  };
}

function getPresentationOptions(
  actions: ReturnType<typeof usePluginManagerActions>,
  catalog: ReturnType<typeof usePluginCatalogModel>,
  state: ReturnType<typeof usePluginManagerState>,
  t: ReturnType<typeof useTranslation>["t"],
) {
  return { actions, catalog, state, t };
}

interface PluginManagerControllerContext {
  bindings: ReturnType<typeof usePluginManagerBindings>;
  showToast: ReturnType<typeof useToast>["showToast"];
  state: ReturnType<typeof usePluginManagerState>;
  t: ReturnType<typeof useTranslation>["t"];
}

export function usePluginManagerController() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const bindings = usePluginManagerBindings();
  const state = usePluginManagerState();
  const context = { bindings, showToast, state, t };
  const sourceImport = usePluginSourceImport(
    getSourceImportOptions(bindings, showToast, t),
  );
  const customSourceActions = usePluginManagerCustomSourceActions(context);
  const catalog = usePluginCatalogModel(
    getCatalogOptions(
      bindings,
      state,
      customSourceActions.selectedMarketSource,
      t,
    ),
  );
  const actions = usePluginManagerActions(getActionOptions(context, catalog));
  usePluginManagerLifecycle(
    getLifecycleOptions(bindings, catalog, state, sourceImport),
  );
  const presentation = usePluginManagerPresentation(
    getPresentationOptions(actions, catalog, state, t),
  );
  return {
    t,
    ...bindings.pluginStore,
    ...bindings,
    ...state,
    ...sourceImport,
    ...customSourceActions,
    ...catalog,
    ...actions,
    ...presentation,
  };
}

export type PluginManagerViewModel = ReturnType<
  typeof usePluginManagerController
>;
