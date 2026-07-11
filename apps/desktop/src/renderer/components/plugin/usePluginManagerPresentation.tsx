import { useTranslation } from "react-i18next";
import {
  PluginChildSkillImportOverlay,
  usePluginLibraryContextMenuItems,
} from "./PluginManagerOverlays";
import type { usePluginManagerActions } from "./usePluginManagerActions";
import type { PluginManagerState } from "./usePluginManagerState";
import type { usePluginCatalogModel } from "./usePluginCatalogModel";

interface PluginManagerPresentationOptions {
  actions: ReturnType<typeof usePluginManagerActions>;
  catalog: ReturnType<typeof usePluginCatalogModel>;
  state: PluginManagerState;
  t: ReturnType<typeof useTranslation>["t"];
}

export function usePluginManagerPresentation({
  actions,
  catalog,
  state,
  t,
}: PluginManagerPresentationOptions) {
  const childSkillImportModal = (
    <PluginChildSkillImportOverlay
      actions={actions}
      installedSkillPaths={catalog.installedSkillPaths}
      state={state}
    />
  );
  const contextMenuItems = usePluginLibraryContextMenuItems({
    actions,
    openSinglePluginTagDialog: actions.openSinglePluginTagDialog,
    state,
    t,
  });
  return { childSkillImportModal, contextMenuItems };
}
