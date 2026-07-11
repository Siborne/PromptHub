import { useRef, useState, type RefObject } from "react";
import type {
  PluginLibraryEntry,
  PluginMarketEntry,
  PluginTargetInstalledPlugin,
} from "@prompthub/shared/types/plugin";
import type { ScannedSkill } from "@prompthub/shared/types";
import type { CustomStoreSourceType } from "../../services/custom-store-source";

export interface PluginAgentTargetPickerState {
  plugins: PluginLibraryEntry[];
  targetIds: string[];
}

export interface PluginLibraryContextMenuState {
  plugin: PluginLibraryEntry;
  x: number;
  y: number;
}

function usePluginManagerDetailState() {
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const [detailMarketEntry, setDetailMarketEntry] =
    useState<PluginMarketEntry | null>(null);
  const [detailLibraryPlugin, setDetailLibraryPlugin] =
    useState<PluginLibraryEntry | null>(null);
  return {
    contentScrollRef,
    detailMarketEntry,
    setDetailMarketEntry,
    detailLibraryPlugin,
    setDetailLibraryPlugin,
  };
}

function usePluginManagerProgressState() {
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [importingTargetPluginId, setImportingTargetPluginId] = useState<
    string | null
  >(null);
  const [isImportingChildMcp, setIsImportingChildMcp] = useState(false);
  const [isScanningChildSkills, setIsScanningChildSkills] = useState(false);
  return {
    installingId,
    setInstallingId,
    previewingId,
    setPreviewingId,
    importingTargetPluginId,
    setImportingTargetPluginId,
    isImportingChildMcp,
    setIsImportingChildMcp,
    isScanningChildSkills,
    setIsScanningChildSkills,
  };
}

function usePluginManagerSelectionState() {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedMarketEntryIds, setSelectedMarketEntryIds] = useState<
    Set<string>
  >(new Set());
  const [selectedLibraryPluginIds, setSelectedLibraryPluginIds] = useState<
    Set<string>
  >(new Set());
  return {
    isBatchMode,
    setIsBatchMode,
    selectedMarketEntryIds,
    setSelectedMarketEntryIds,
    selectedLibraryPluginIds,
    setSelectedLibraryPluginIds,
  };
}

function usePluginManagerBatchDialogState() {
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [batchMarketRemoveConfirmOpen, setBatchMarketRemoveConfirmOpen] =
    useState(false);
  const [batchMarketUpdateConfirmOpen, setBatchMarketUpdateConfirmOpen] =
    useState(false);
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false);
  return {
    batchDeleteConfirmOpen,
    setBatchDeleteConfirmOpen,
    batchMarketRemoveConfirmOpen,
    setBatchMarketRemoveConfirmOpen,
    batchMarketUpdateConfirmOpen,
    setBatchMarketUpdateConfirmOpen,
    batchTagDialogOpen,
    setBatchTagDialogOpen,
  };
}

function usePluginManagerBatchProgressState() {
  const [isBatchInstalling, setIsBatchInstalling] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [isBatchRemovingMarket, setIsBatchRemovingMarket] = useState(false);
  return {
    isBatchInstalling,
    setIsBatchInstalling,
    isBatchUpdating,
    setIsBatchUpdating,
    isBatchRemovingMarket,
    setIsBatchRemovingMarket,
  };
}

function usePluginManagerDeleteState() {
  const [deleteTarget, setDeleteTarget] = useState<PluginLibraryEntry | null>(
    null,
  );
  const [removeDistributedOnDelete, setRemoveDistributedOnDelete] =
    useState(false);
  const [removeDistributedOnBatchDelete, setRemoveDistributedOnBatchDelete] =
    useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removingLibraryPluginId, setRemovingLibraryPluginId] = useState<
    string | null
  >(null);
  return {
    deleteTarget,
    setDeleteTarget,
    removeDistributedOnDelete,
    setRemoveDistributedOnDelete,
    removeDistributedOnBatchDelete,
    setRemoveDistributedOnBatchDelete,
    isDeleting,
    setIsDeleting,
    removingLibraryPluginId,
    setRemovingLibraryPluginId,
  };
}

function usePluginManagerAgentTargetState() {
  const [agentTargetPicker, setAgentTargetPicker] =
    useState<PluginAgentTargetPickerState | null>(null);
  const [initialAgentPluginTargetId, setInitialAgentPluginTargetId] = useState<
    string | null
  >(null);
  return {
    agentTargetPicker,
    setAgentTargetPicker,
    initialAgentPluginTargetId,
    setInitialAgentPluginTargetId,
  };
}

function usePluginManagerChildSkillState() {
  const [childSkillImportPlugin, setChildSkillImportPlugin] =
    useState<PluginLibraryEntry | null>(null);
  const [childSkillScanResults, setChildSkillScanResults] = useState<
    ScannedSkill[]
  >([]);
  return {
    childSkillImportPlugin,
    setChildSkillImportPlugin,
    childSkillScanResults,
    setChildSkillScanResults,
  };
}

function usePluginManagerCustomSourceState() {
  const [editingCustomSourceId, setEditingCustomSourceId] = useState<
    string | null
  >(null);
  const [pendingDeleteCustomSourceId, setPendingDeleteCustomSourceId] =
    useState<string | null>(null);
  const [sourceType, setSourceType] =
    useState<CustomStoreSourceType>("marketplace-json");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceBranch, setSourceBranch] = useState("");
  const [sourceDirectory, setSourceDirectory] = useState("");
  return {
    editingCustomSourceId,
    setEditingCustomSourceId,
    pendingDeleteCustomSourceId,
    setPendingDeleteCustomSourceId,
    sourceType,
    setSourceType,
    sourceName,
    setSourceName,
    sourceUrl,
    setSourceUrl,
    sourceBranch,
    setSourceBranch,
    sourceDirectory,
    setSourceDirectory,
  };
}

function usePluginManagerContextState() {
  const [contextMenu, setContextMenu] =
    useState<PluginLibraryContextMenuState | null>(null);
  return { contextMenu, setContextMenu };
}

export function usePluginManagerState() {
  const detailState = usePluginManagerDetailState();
  const progressState = usePluginManagerProgressState();
  const selectionState = usePluginManagerSelectionState();
  const dialogState = usePluginManagerBatchDialogState();
  const batchProgressState = usePluginManagerBatchProgressState();
  const deleteState = usePluginManagerDeleteState();
  const targetState = usePluginManagerAgentTargetState();
  const childState = usePluginManagerChildSkillState();
  const sourceState = usePluginManagerCustomSourceState();
  const contextState = usePluginManagerContextState();
  return {
    ...detailState,
    ...progressState,
    ...selectionState,
    ...dialogState,
    ...batchProgressState,
    ...deleteState,
    ...targetState,
    ...childState,
    ...sourceState,
    ...contextState,
  };
}

export type PluginManagerState = ReturnType<typeof usePluginManagerState>;
export type PluginManagerContentScrollRef = RefObject<HTMLDivElement>;
export type PluginManagerTargetPlugin = PluginTargetInstalledPlugin;
