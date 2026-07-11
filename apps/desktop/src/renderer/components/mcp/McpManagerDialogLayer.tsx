import type { ComponentProps } from "react";
import { McpManagerDialogs } from "./McpManagerDialogs";
import type { McpManagerViewModel } from "./useMcpManagerController";

interface McpManagerDialogLayerProps {
  model: McpManagerViewModel;
}

function getMcpDialogDataProps(model: McpManagerViewModel) {
  return {
    agentDeployPreset: model.agentDeployPreset,
    customStoreSources: model.customStoreSources,
    deleteConfirm: model.deleteConfirm,
    deployDialogServers: model.deployDialogServers,
    editingCustomSourceId: model.editingCustomSourceId,
    isCreateModalOpen: model.isCreateModalOpen,
    isDeletingServers: model.isDeletingServers,
    isRemovingAgentEntry: model.isRemovingAgentEntry,
    loadingMarketSourceId: model.loadingMarketSourceId,
    pendingAgentRemoval: model.pendingAgentRemoval,
    pendingDeleteCustomSource: model.pendingDeleteCustomSource,
    selectedServers: model.selectedServers,
    servers: model.servers,
    showBatchDeployDialog: model.showBatchDeployDialog,
    showBatchTagDialog: model.showBatchTagDialog,
    t: model.t,
    targetPresets: model.visibleAgentTargetPresets,
    targetStatus: model.visibleTargetStatus,
  } satisfies Partial<ComponentProps<typeof McpManagerDialogs>>;
}

function getMcpDialogActionProps(model: McpManagerViewModel) {
  return {
    onAgentDeploy: model.handleAgentDeployFromLibrary,
    onBatchApply: model.handleBatchApplyPresets,
    onBatchTagSubmit: model.handleBatchTagSubmit,
    onCloseAgentDeploy: () => model.setAgentDeployPreset(null),
    onCloseBatchTag: () => model.setShowBatchTagDialog(false),
    onCloseCreate: () => model.setIsCreateModalOpen(false),
    onCloseDelete: model.closeDeleteConfirm,
    onCloseDeploy: model.closeDeployDialog,
    onCloseEditCustomSource: () => model.setEditingCustomSourceId(null),
    onClosePendingAgentRemoval: () => {
      if (!model.isRemovingAgentEntry) model.setPendingAgentRemoval(null);
    },
    onClosePendingCustomSourceDelete: () =>
      model.setPendingDeleteCustomSourceId(null),
    onConfirmDelete: model.confirmDelete,
    onConfirmPendingAgentRemoval: model.confirmRemoveAgentMcp,
    onConfirmPendingCustomSourceDelete: model.handleConfirmDeleteCustomSource,
    onCreateFromSource: model.handleCreateFromSource,
    onManualCreate: (draft) => model.handleCreate(null, draft),
    onQuickApply: model.handleQuickApplyPresets,
    onRefreshCustomSource: (sourceId) =>
      void model.loadMarketSource(sourceId, true),
    onRequestDeleteCustomSource: model.setPendingDeleteCustomSourceId,
    onSaveCustomSource: model.handleUpdateCustomSource,
    onToggleCustomSource: model.toggleCustomStoreSource,
  } satisfies Partial<ComponentProps<typeof McpManagerDialogs>>;
}

export function McpManagerDialogLayer({ model }: McpManagerDialogLayerProps) {
  return (
    <McpManagerDialogs
      {...getMcpDialogDataProps(model)}
      {...getMcpDialogActionProps(model)}
    />
  );
}
