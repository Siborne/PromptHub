import type { TFunction } from "i18next";
import type { McpTargetPreset } from "@prompthub/core";
import type {
  McpCreateFromSourceRequest,
  McpCreateFromSourceResult,
  McpServerConfig,
  McpServerDraft,
  McpTargetStatusEntry,
} from "@prompthub/shared/types/mcp";
import type {
  CustomStoreSource,
  CustomStoreSourceType,
} from "../../services/custom-store-source";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SkillStoreSourceEditModal } from "../skill/SkillStoreSourceEditModal";
import { McpBatchDeployDialog } from "./McpBatchDeployDialog";
import { McpBatchTagDialog } from "./McpBatchTagDialog";
import { McpCreateModal } from "./McpCreateModal";
import { McpLibraryDeployDialog } from "./McpLibraryDeployDialog";
import { MCP_CUSTOM_SOURCE_TYPE_OPTIONS } from "./McpStoreWorkspace";
import type { McpBatchTagMode } from "./batch-utils";
import type { PendingAgentRemoval } from "./mcp-manager-utils";

export interface McpDeleteConfirmation {
  isOpen: boolean;
  serverIds: string[];
  serverNames: string[];
}

interface McpManagerDialogsProps {
  agentDeployPreset: McpTargetPreset | null;
  customStoreSources: CustomStoreSource[];
  deleteConfirm: McpDeleteConfirmation;
  deployDialogServers: McpServerConfig[];
  editingCustomSourceId: string | null;
  isCreateModalOpen: boolean;
  isDeletingServers: boolean;
  isRemovingAgentEntry: boolean;
  loadingMarketSourceId: string | null;
  pendingAgentRemoval: PendingAgentRemoval | null;
  pendingDeleteCustomSource: CustomStoreSource | null;
  selectedServers: McpServerConfig[];
  servers: McpServerConfig[];
  showBatchDeployDialog: boolean;
  showBatchTagDialog: boolean;
  t: TFunction;
  targetPresets: McpTargetPreset[];
  targetStatus: McpTargetStatusEntry[];
  onAgentDeploy: (serverIds: string[]) => Promise<void>;
  onBatchApply: (
    presets: McpTargetPreset[],
    serverIds: string[],
  ) => Promise<void>;
  onBatchTagSubmit: (tag: string, mode: McpBatchTagMode) => Promise<void>;
  onCloseAgentDeploy: () => void;
  onCloseBatchTag: () => void;
  onCloseCreate: () => void;
  onCloseDelete: () => void;
  onCloseDeploy: () => void;
  onCloseEditCustomSource: () => void;
  onClosePendingAgentRemoval: () => void;
  onClosePendingCustomSourceDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onConfirmPendingAgentRemoval: () => Promise<void>;
  onConfirmPendingCustomSourceDelete: () => void;
  onCreateFromSource: (
    request: McpCreateFromSourceRequest,
  ) => Promise<McpCreateFromSourceResult>;
  onManualCreate: (draft: McpServerDraft) => Promise<void>;
  onQuickApply: (
    presets: McpTargetPreset[],
    serverIds: string[],
  ) => Promise<void>;
  onRefreshCustomSource: (sourceId: string) => void;
  onRequestDeleteCustomSource: (sourceId: string) => void;
  onSaveCustomSource: (payload: {
    branch?: string;
    directory?: string;
    id: string;
    name: string;
    type: CustomStoreSourceType;
    url: string;
  }) => void;
  onToggleCustomSource: (sourceId: string) => void;
}

function McpCreationAndDeployDialogs(props: McpManagerDialogsProps) {
  return (
    <>
      {props.isCreateModalOpen ? (
        <McpCreateModal
          onClose={props.onCloseCreate}
          onManualSave={props.onManualCreate}
          onCreateFromSource={props.onCreateFromSource}
        />
      ) : null}
      {props.showBatchTagDialog ? (
        <McpBatchTagDialog
          servers={props.selectedServers}
          onClose={props.onCloseBatchTag}
          onSubmit={props.onBatchTagSubmit}
        />
      ) : null}
      {props.deployDialogServers.length > 0 ? (
        <McpBatchDeployDialog
          servers={props.deployDialogServers}
          targetPresets={props.targetPresets}
          targetStatus={props.targetStatus}
          onClose={props.onCloseDeploy}
          onApply={
            props.showBatchDeployDialog
              ? props.onBatchApply
              : props.onQuickApply
          }
        />
      ) : null}
      {props.agentDeployPreset ? (
        <McpLibraryDeployDialog
          preset={props.agentDeployPreset}
          servers={props.servers}
          targetStatus={props.targetStatus}
          onClose={props.onCloseAgentDeploy}
          onApply={props.onAgentDeploy}
        />
      ) : null}
    </>
  );
}

function McpDeleteConfirmationDialog(props: McpManagerDialogsProps) {
  const { deleteConfirm, t } = props;
  return (
    <ConfirmDialog
      isOpen={deleteConfirm.isOpen}
      onClose={props.onCloseDelete}
      onConfirm={() => void props.onConfirmDelete()}
      title={t("mcp.deleteConfirmTitle", "Delete MCP")}
      message={t("mcp.deleteConfirmMessage", {
        count: deleteConfirm.serverIds.length,
        names: deleteConfirm.serverNames.join(", "),
        defaultValue:
          deleteConfirm.serverIds.length === 1
            ? `Delete ${deleteConfirm.serverNames[0] || "this MCP"}?`
            : `Delete ${deleteConfirm.serverIds.length} MCP servers?`,
      })}
      confirmText={t("common.delete", "Delete")}
      cancelText={t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={props.isDeletingServers}
    />
  );
}

function McpCustomSourceDialogs(props: McpManagerDialogsProps) {
  const editingSource =
    props.customStoreSources.find(
      (source) => source.id === props.editingCustomSourceId,
    ) ?? null;
  return (
    <>
      <SkillStoreSourceEditModal
        isOpen={props.editingCustomSourceId !== null}
        onClose={props.onCloseEditCustomSource}
        onDelete={props.onRequestDeleteCustomSource}
        onSave={props.onSaveCustomSource}
        onToggleEnabled={props.onToggleCustomSource}
        onRefresh={props.onRefreshCustomSource}
        refreshingSourceId={props.loadingMarketSourceId}
        source={editingSource}
        typeOptions={MCP_CUSTOM_SOURCE_TYPE_OPTIONS}
      />
      <ConfirmDialog
        isOpen={Boolean(props.pendingDeleteCustomSource)}
        onClose={props.onClosePendingCustomSourceDelete}
        onConfirm={props.onConfirmPendingCustomSourceDelete}
        title={props.t("skill.deleteStoreSourceTitle", "Delete custom store")}
        message={props.t("skill.deleteStoreSourceMessage", {
          name: props.pendingDeleteCustomSource?.name ?? "",
          defaultValue:
            'Delete custom store "{{name}}"? Installed items will stay in your library, but this source and its cached store entries will be removed.',
        })}
        confirmText={props.t("common.delete", "Delete")}
        cancelText={props.t("common.cancel", "Cancel")}
        variant="destructive"
      />
    </>
  );
}

function McpAgentRemovalDialog(props: McpManagerDialogsProps) {
  return (
    <ConfirmDialog
      isOpen={Boolean(props.pendingAgentRemoval)}
      onClose={props.onClosePendingAgentRemoval}
      onConfirm={() => void props.onConfirmPendingAgentRemoval()}
      title={props.t("mcp.uninstallFromAgent", "Uninstall from Agent")}
      message={props.t(
        "mcp.uninstallFromAgentConfirm",
        "Remove this MCP entry from the selected agent config?",
      )}
      confirmText={props.t("common.uninstall", "Uninstall")}
      cancelText={props.t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={props.isRemovingAgentEntry}
    />
  );
}

export function McpManagerDialogs(props: McpManagerDialogsProps) {
  return (
    <>
      <McpCreationAndDeployDialogs {...props} />
      <McpDeleteConfirmationDialog {...props} />
      <McpCustomSourceDialogs {...props} />
      <McpAgentRemovalDialog {...props} />
    </>
  );
}
