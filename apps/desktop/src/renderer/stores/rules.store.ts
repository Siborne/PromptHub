import { useSettingsStore } from "./settings.store";
import { create } from "zustand";
import { scheduleAllSaveSync } from "../services/webdav-save-sync";
import { getOrderedGlobalRuleFiles } from "../services/rule-platform-order";
import {
  isCompleteRuleAIModel,
  resolveRuleAIModel,
} from "../services/rule-ai-models";
import type {
  CreateRuleProjectInput,
  RuleConflictResolutionStrategy,
  RuleFileContent,
  RuleFileDescriptor,
  RuleFileId,
  RuleMissingCleanupResult,
} from "@prompthub/shared/types";

function isOutOfSyncRule(file: RuleFileContent | null | undefined): boolean {
  return (
    file?.syncStatus === "out-of-sync" && typeof file.targetContent === "string"
  );
}

interface RulesState {
  files: RuleFileDescriptor[];
  selectedRuleId: RuleFileId | null;
  currentFile: RuleFileContent | null;
  /** Explicit conflict dialog target. Not derived from out-of-sync alone. */
  conflictDialogRuleId: RuleFileId | null;
  /** Rules the user closed without resolving; do not auto-prompt again this session. */
  dismissedConflictRuleIds: RuleFileId[];
  searchQuery: string;
  draftContent: string;
  aiInstruction: string;
  aiSummary: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isRewriting: boolean;
  error: string | null;
  hasLoadedFiles: boolean;
  loadFiles: (options?: { force?: boolean }) => Promise<void>;
  selectRule: (ruleId: RuleFileId) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setDraftContent: (content: string) => void;
  setAiInstruction: (instruction: string) => void;
  saveCurrentRule: () => Promise<void>;
  resolveCurrentRuleConflict: (
    strategy: RuleConflictResolutionStrategy,
  ) => Promise<void>;
  dismissConflictDialog: (ruleId?: RuleFileId | null) => void;
  rewriteCurrentRule: (modelId?: string) => Promise<void>;
  deleteRuleVersion: (ruleId: RuleFileId, versionId: string) => Promise<void>;
  addProjectRule: (input: CreateRuleProjectInput) => Promise<void>;
  removeProjectRule: (projectId: string) => Promise<void>;
  cleanupMissingProjectRules: (
    ruleIds: string[],
  ) => Promise<RuleMissingCleanupResult>;
  getSidebarSections: () => Array<{
    id: "global" | "project";
    title: string;
    items: Array<{
      id: RuleFileId;
      type: "global" | "project";
      platformId: RuleFileDescriptor["platformId"];
      file: RuleFileDescriptor;
      path: string;
      exists: boolean;
      active: boolean;
      canRemove: boolean;
      projectId: string | null;
      description: string;
      icon: string;
      badge: string | null;
      name: string;
    }>;
  }>;
  getProjectRuleCount: () => number;
  getGlobalRuleCount: () => number;
  getProjectRuleItems: () => Array<{
    id: RuleFileId;
    type: "project";
    platformId: RuleFileDescriptor["platformId"];
    file: RuleFileDescriptor;
    path: string;
    exists: boolean;
    active: boolean;
    canRemove: boolean;
    projectId: string | null;
    description: string;
    icon: string;
    badge: string | null;
    name: string;
  }>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function filterVisibleRuleFiles(
  files: RuleFileDescriptor[],
): RuleFileDescriptor[] {
  const settings = useSettingsStore.getState();
  const disabledPlatformIds = settings.disabledPlatformIds ?? [];
  const disabledSet = new Set(disabledPlatformIds);

  return files.filter((file) => {
    if (file.id.startsWith("project:")) {
      return true;
    }

    return file.exists && !disabledSet.has(file.platformId);
  });
}

let latestLoadFilesRequestId = 0;
let latestSelectRuleRequestId = 0;

export const useRulesStore = create<RulesState>((set, get) => ({
  files: [],
  selectedRuleId: null,
  currentFile: null,
  conflictDialogRuleId: null,
  dismissedConflictRuleIds: [],
  searchQuery: "",
  draftContent: "",
  aiInstruction: "",
  aiSummary: null,
  isLoading: false,
  isSaving: false,
  isRewriting: false,
  error: null,
  hasLoadedFiles: false,

  loadFiles: async (options) => {
    if (get().hasLoadedFiles && !options?.force) {
      return;
    }

    const requestId = ++latestLoadFilesRequestId;
    set({ isLoading: true, error: null });
    try {
      const allFiles = options?.force
        ? await window.api.rules.scan()
        : await window.api.rules.list();
      const files = filterVisibleRuleFiles(allFiles);
      if (requestId !== latestLoadFilesRequestId) {
        return;
      }
      const currentSelectedRuleId = get().selectedRuleId;
      const selectedRuleId =
        currentSelectedRuleId &&
        files.some((file) => file.id === currentSelectedRuleId)
          ? currentSelectedRuleId
          : (files[0]?.id ?? null);
      set({ files, selectedRuleId, isLoading: false, hasLoadedFiles: true });

      if (selectedRuleId) {
        // When force-scanning, clear currentFile so selectRule's early-return guard
        // doesn't skip re-reading the file from disk.
        if (options?.force) {
          set({ currentFile: null, conflictDialogRuleId: null });
        }
        await get().selectRule(selectedRuleId);
      } else {
        set({
          currentFile: null,
          draftContent: "",
          conflictDialogRuleId: null,
        });
      }
    } catch (error) {
      if (requestId === latestLoadFilesRequestId) {
        set({ isLoading: false, error: getErrorMessage(error) });
      }
    }
  },

  selectRule: async (ruleId) => {
    const currentState = get();
    if (
      currentState.selectedRuleId === ruleId &&
      currentState.currentFile?.id === ruleId
    ) {
      return;
    }

    const requestId = ++latestSelectRuleRequestId;
    set({
      selectedRuleId: ruleId,
      isLoading: true,
      error: null,
      aiSummary: null,
      // Close any previous rule's conflict dialog while loading the next rule.
      conflictDialogRuleId: null,
    });
    try {
      const file = await window.api.rules.read(ruleId);
      if (
        requestId !== latestSelectRuleRequestId ||
        get().selectedRuleId !== ruleId
      ) {
        return;
      }
      const dismissed = get().dismissedConflictRuleIds;
      const shouldPromptConflict =
        isOutOfSyncRule(file) && !dismissed.includes(file.id);
      set({
        currentFile: file,
        draftContent: file.content,
        isLoading: false,
        conflictDialogRuleId: shouldPromptConflict ? file.id : null,
      });
    } catch (error) {
      if (
        requestId === latestSelectRuleRequestId &&
        get().selectedRuleId === ruleId
      ) {
        set({ isLoading: false, error: getErrorMessage(error) });
      }
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setDraftContent: (content) => set({ draftContent: content }),

  setAiInstruction: (instruction) => set({ aiInstruction: instruction }),

  saveCurrentRule: async () => {
    const selectedRuleId = get().selectedRuleId;
    if (!selectedRuleId) {
      return;
    }

    set({ isSaving: true, error: null });
    try {
      const updated = await window.api.rules.save(
        selectedRuleId,
        get().draftContent,
      );
      const nextFiles = get().files.map((file) =>
        file.id === updated.id
          ? { ...file, exists: true, path: updated.path }
          : file,
      );
      set({
        selectedRuleId: updated.id,
        currentFile: updated,
        files: nextFiles,
        draftContent: updated.content,
        isSaving: false,
      });
      scheduleAllSaveSync("rules:save");
    } catch (error) {
      set({ isSaving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  resolveCurrentRuleConflict: async (strategy) => {
    const selectedRuleId = get().selectedRuleId;
    if (!selectedRuleId) {
      return;
    }

    set({ isSaving: true, error: null });
    try {
      const updated = await window.api.rules.resolveConflict(
        selectedRuleId,
        strategy,
      );
      const nextFiles = get().files.map((file) =>
        file.id === updated.id
          ? {
              ...file,
              exists: updated.exists,
              path: updated.path,
              syncStatus: updated.syncStatus,
            }
          : file,
      );
      set({
        selectedRuleId: updated.id,
        currentFile: updated,
        files: nextFiles,
        draftContent: updated.content,
        isSaving: false,
        conflictDialogRuleId: null,
        dismissedConflictRuleIds: get().dismissedConflictRuleIds.filter(
          (id) => id !== updated.id,
        ),
      });
      scheduleAllSaveSync("rules:resolve-conflict");
    } catch (error) {
      set({ isSaving: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  dismissConflictDialog: (ruleId) => {
    const targetId =
      ruleId ?? get().conflictDialogRuleId ?? get().currentFile?.id;
    if (!targetId) {
      set({ conflictDialogRuleId: null });
      return;
    }

    const dismissed = get().dismissedConflictRuleIds;
    set({
      conflictDialogRuleId: null,
      dismissedConflictRuleIds: dismissed.includes(targetId)
        ? dismissed
        : [...dismissed, targetId],
    });
  },

  rewriteCurrentRule: async (modelId) => {
    const currentFile = get().currentFile;
    const instruction = get().aiInstruction.trim();
    if (!currentFile || !instruction) {
      return;
    }
    const settings = useSettingsStore.getState();
    const selectedModel = resolveRuleAIModel(settings, modelId);

    if (!selectedModel) {
      throw new Error("RULE_AI_MODEL_UNAVAILABLE");
    }
    if (!isCompleteRuleAIModel(selectedModel)) {
      throw new Error("RULE_AI_MODEL_INCOMPLETE");
    }

    set({ isRewriting: true, error: null, aiSummary: null });
    try {
      const result = await window.api.rules.rewrite({
        instruction,
        currentContent: get().draftContent,
        fileName: currentFile.name,
        platformName: currentFile.platformName,
        aiConfig: {
          apiKey: selectedModel.apiKey,
          apiUrl: selectedModel.apiUrl,
          model: selectedModel.model,
          provider: selectedModel.provider,
          apiProtocol: selectedModel.apiProtocol,
        },
      });
      set({
        draftContent: result.content,
        aiSummary: result.summary || "done",
        isRewriting: false,
      });
    } catch (error) {
      set({ isRewriting: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  addProjectRule: async (input) => {
    set({ isLoading: true, error: null });
    try {
      await window.api.rules.addProject(input);
      const files = await window.api.rules.list();
      const created = files.find(
        (file) =>
          file.id.startsWith("project:") &&
          file.projectRootPath?.toLowerCase() === input.rootPath.toLowerCase(),
      );
      set({
        files,
        selectedRuleId: created?.id ?? get().selectedRuleId,
        isLoading: false,
        hasLoadedFiles: true,
      });

      if (created) {
        await get().selectRule(created.id);
      }
      scheduleAllSaveSync("rules:add-project");
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  removeProjectRule: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      await window.api.rules.removeProject(projectId);
      const files = await window.api.rules.list();
      const removedRuleId = `project:${projectId}`;
      const nextSelectedRuleId =
        get().selectedRuleId === removedRuleId
          ? (files[0]?.id ?? null)
          : get().selectedRuleId;

      set({
        files,
        selectedRuleId: nextSelectedRuleId,
        isLoading: false,
        hasLoadedFiles: true,
      });

      if (nextSelectedRuleId) {
        await get().selectRule(nextSelectedRuleId);
      } else {
        set({ currentFile: null, draftContent: "" });
      }
      scheduleAllSaveSync("rules:remove-project");
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  cleanupMissingProjectRules: async (ruleIds) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.api.rules.removeMissingProjects(ruleIds);
      const files = filterVisibleRuleFiles(await window.api.rules.list());
      const selectedRuleId = files.some(
        (file) => file.id === get().selectedRuleId,
      )
        ? get().selectedRuleId
        : (files[0]?.id ?? null);
      set({
        files,
        selectedRuleId,
        currentFile:
          selectedRuleId === get().currentFile?.id ? get().currentFile : null,
        isLoading: false,
        hasLoadedFiles: true,
      });
      if (selectedRuleId && selectedRuleId !== get().currentFile?.id) {
        await get().selectRule(selectedRuleId);
      }
      if (result.removed.length > 0) {
        scheduleAllSaveSync("rules:cleanup-missing-projects");
      }
      return result;
    } catch (error) {
      set({ isLoading: false, error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteRuleVersion: async (ruleId, versionId) => {
    try {
      const updatedVersions = await window.api.rules.deleteVersion(
        ruleId,
        versionId,
      );
      const currentFile = get().currentFile;
      if (currentFile?.id === ruleId) {
        set({ currentFile: { ...currentFile, versions: updatedVersions } });
      }
      scheduleAllSaveSync("rules:delete-version");
    } catch (error) {
      throw error;
    }
  },

  getSidebarSections: () => {
    const { files, selectedRuleId } = get();
    const skillPlatformOrder =
      useSettingsStore.getState().skillPlatformOrder ?? [];
    const globalItems = getOrderedGlobalRuleFiles(
      files,
      skillPlatformOrder,
    ).map((file) => ({
      id: file.id,
      type: "global" as const,
      platformId: file.platformId,
      file,
      path: file.path,
      exists: file.exists,
      active: selectedRuleId === file.id,
      canRemove: true,
      projectId: null,
      description: file.description,
      icon: file.platformIcon,
      badge: null,
      name: file.platformName,
    }));

    const projectItems = files
      .filter((file) => file.id.startsWith("project:"))
      .map((file) => ({
        id: file.id,
        type: "project" as const,
        platformId: file.platformId,
        file,
        path: file.path,
        exists: file.exists,
        active: selectedRuleId === file.id,
        canRemove: file.id.startsWith("project:"),
        projectId: file.id.startsWith("project:")
          ? file.id.slice("project:".length)
          : null,
        description: file.description,
        icon: "FolderRoot",
        badge: null,
        name: file.platformName,
      }));

    return [
      {
        id: "global" as const,
        title: "",
        items: globalItems,
      },
      {
        id: "project" as const,
        title: "",
        items: projectItems,
      },
    ];
  },
  getProjectRuleCount: () =>
    get().files.filter((file) => file.id.startsWith("project:")).length,
  getGlobalRuleCount: () =>
    get().files.filter(
      (file) =>
        file.platformId !== "workspace" && !file.id.startsWith("project:"),
    ).length,
  getProjectRuleItems: () =>
    get()
      .files.filter((file) => file.id.startsWith("project:"))
      .map((file) => ({
        id: file.id,
        type: "project" as const,
        platformId: file.platformId,
        file,
        path: file.path,
        exists: file.exists,
        active: get().selectedRuleId === file.id,
        canRemove: true,
        projectId: file.id.slice("project:".length),
        description: file.description,
        icon: "FolderRoot",
        badge: null,
        name: file.platformName,
      })),
}));
