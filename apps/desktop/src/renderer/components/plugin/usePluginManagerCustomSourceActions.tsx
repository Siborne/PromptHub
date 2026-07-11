import { useMemo } from "react";
import { DatabaseIcon, GlobeIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CustomStoreSourceType } from "../../services/custom-store-source";
import { useToast } from "../ui/Toast";
import type { PluginManagerBindings } from "./usePluginManagerBindings";
import type { PluginManagerState } from "./usePluginManagerState";
import { getErrorMessage } from "./plugin-manager-utils";

interface PluginManagerCustomSourceActionOptions {
  bindings: PluginManagerBindings;
  showToast: ReturnType<typeof useToast>["showToast"];
  state: PluginManagerState;
  t: ReturnType<typeof useTranslation>["t"];
}

function useSelectedCustomSource(
  options: PluginManagerCustomSourceActionOptions,
) {
  const { bindings } = options;
  return useMemo(
    () =>
      bindings.pluginStore.customStoreSources.find(
        (source) => source.id === bindings.pluginStore.selectedMarketSourceId,
      ) ?? null,
    [
      bindings.pluginStore.customStoreSources,
      bindings.pluginStore.selectedMarketSourceId,
    ],
  );
}

function useSelectedMarketSource(
  options: PluginManagerCustomSourceActionOptions,
) {
  const { bindings } = options;
  return useMemo(
    () =>
      bindings.pluginStore.marketSources.find(
        (source) => source.id === bindings.pluginStore.selectedMarketSourceId,
      ) ?? null,
    [
      bindings.pluginStore.marketSources,
      bindings.pluginStore.selectedMarketSourceId,
    ],
  );
}

function usePendingDeleteCustomSource(
  options: PluginManagerCustomSourceActionOptions,
) {
  const { bindings, state } = options;
  return useMemo(
    () =>
      bindings.pluginStore.customStoreSources.find(
        (source) => source.id === state.pendingDeleteCustomSourceId,
      ) ?? null,
    [
      bindings.pluginStore.customStoreSources,
      state.pendingDeleteCustomSourceId,
    ],
  );
}

function useCustomSourceTypeOptions() {
  return useMemo(
    () => [
      {
        value: "marketplace-json" as const,
        icon: <DatabaseIcon className="h-4 w-4" />,
      },
      { value: "git-repo" as const, icon: <GlobeIcon className="h-4 w-4" /> },
    ],
    [],
  );
}

function useAddCustomSourceAction(
  options: PluginManagerCustomSourceActionOptions,
) {
  const { bindings, showToast, state, t } = options;
  return () => {
    if (!state.sourceName.trim() || !state.sourceUrl.trim()) {
      showToast(
        t("skill.storeSourceRequired", "Store name and URL are required"),
        "error",
      );
      return;
    }
    try {
      bindings.pluginStore.addCustomStoreSource(
        state.sourceName,
        state.sourceUrl,
        state.sourceType,
        { branch: state.sourceBranch, directory: state.sourceDirectory },
      );
      clearCustomSourceForm(state);
      void bindings.pluginStore.load();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  };
}

function clearCustomSourceForm(state: PluginManagerState) {
  state.setSourceName("");
  state.setSourceUrl("");
  state.setSourceBranch("");
  state.setSourceDirectory("");
}

function useUpdateCustomSourceAction(
  options: PluginManagerCustomSourceActionOptions,
) {
  const { bindings, showToast, state } = options;
  return (payload: {
    branch?: string;
    directory?: string;
    id: string;
    name: string;
    type: CustomStoreSourceType;
    url: string;
  }) => {
    try {
      bindings.pluginStore.updateCustomStoreSource(payload);
      state.setEditingCustomSourceId(null);
      void bindings.pluginStore.load();
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  };
}

function useConfirmDeleteCustomSourceAction(
  options: PluginManagerCustomSourceActionOptions,
  pendingDeleteCustomSource: ReturnType<typeof usePendingDeleteCustomSource>,
) {
  const { bindings, state } = options;
  return () => {
    if (!pendingDeleteCustomSource) return;
    bindings.pluginStore.removeCustomStoreSource(pendingDeleteCustomSource.id);
    state.setPendingDeleteCustomSourceId(null);
    state.setEditingCustomSourceId(null);
  };
}

export function usePluginManagerCustomSourceActions(
  options: PluginManagerCustomSourceActionOptions,
) {
  const selectedCustomSource = useSelectedCustomSource(options);
  const selectedMarketSource = useSelectedMarketSource(options);
  const pendingDeleteCustomSource = usePendingDeleteCustomSource(options);
  const customSourceTypeOptions = useCustomSourceTypeOptions();
  const handleAddCustomSource = useAddCustomSourceAction(options);
  const handleUpdateCustomSource = useUpdateCustomSourceAction(options);
  const handleConfirmDeleteCustomSource = useConfirmDeleteCustomSourceAction(
    options,
    pendingDeleteCustomSource,
  );
  return {
    selectedCustomSource,
    selectedMarketSource,
    pendingDeleteCustomSource,
    customSourceTypeOptions,
    handleAddCustomSource,
    handleUpdateCustomSource,
    handleConfirmDeleteCustomSource,
  };
}
