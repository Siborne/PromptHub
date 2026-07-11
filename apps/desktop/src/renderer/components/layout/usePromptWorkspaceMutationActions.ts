import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  CreatePromptDTO,
  Prompt,
  PromptVersion,
  UpdatePromptDTO,
} from "@prompthub/shared/types";
import type { TFunction } from "i18next";
import type { useToast } from "../ui/Toast";

type ShowToast = ReturnType<typeof useToast>["showToast"];
type PromptUpdater = (id: string, data: UpdatePromptDTO) => Promise<void>;

interface DuplicatePromptParams {
  createPrompt: (data: CreatePromptDTO) => Promise<Prompt>;
  selectPrompt: (id: string | null) => void;
  showToast: ShowToast;
  t: TFunction;
}

export function useDuplicatePromptAction(params: DuplicatePromptParams) {
  return useCallback(
    async (prompt: Prompt) => {
      const duplicate = await params.createPrompt(
        createDuplicatePromptInput(prompt, params.t),
      );
      params.selectPrompt(duplicate.id);
      params.showToast(
        params.t("prompt.promptDuplicated", "Prompt duplicate created"),
        "success",
      );
    },
    [params],
  );
}

function createDuplicatePromptInput(
  prompt: Prompt,
  t: TFunction,
): CreatePromptDTO {
  return {
    title: `${prompt.title} (${t("prompt.duplicateSuffix", "Duplicate")})`,
    description: prompt.description ?? undefined,
    promptType: prompt.promptType,
    systemPrompt: prompt.systemPrompt ?? undefined,
    systemPromptEn: prompt.systemPromptEn ?? undefined,
    userPrompt: prompt.userPrompt,
    userPromptEn: prompt.userPromptEn ?? undefined,
    variables: prompt.variables,
    tags: prompt.tags,
    folderId: prompt.folderId,
    images: prompt.images,
    videos: prompt.videos,
    source: prompt.source ?? undefined,
    notes: prompt.notes ?? undefined,
  };
}

interface DeletePromptParams {
  deleteConfirm: { isOpen: boolean; prompt: Prompt | null };
  deletePrompt: (id: string) => Promise<void>;
  setDeleteConfirm: Dispatch<
    SetStateAction<{ isOpen: boolean; prompt: Prompt | null }>
  >;
  showToast: ShowToast;
  t: TFunction;
}

export function useDeletePromptActions(params: DeletePromptParams) {
  const handleDeletePrompt = useCallback(
    (prompt: Prompt) => params.setDeleteConfirm({ isOpen: true, prompt }),
    [params],
  );
  const confirmDelete = useCallback(async () => {
    if (params.deleteConfirm.prompt) {
      await params.deletePrompt(params.deleteConfirm.prompt.id);
      params.showToast(params.t("prompt.promptDeleted"), "success");
    }
    params.setDeleteConfirm({ isOpen: false, prompt: null });
  }, [params]);
  return { handleDeletePrompt, confirmDelete };
}

interface AiTestParams {
  canRunSingleAiTest: boolean;
  setAiTestInitialMode: Dispatch<
    SetStateAction<"single" | "compare" | "image">
  >;
  setAiTestPrompt: Dispatch<SetStateAction<Prompt | null>>;
  setIsAiTestModalOpen: Dispatch<SetStateAction<boolean>>;
  showToast: ShowToast;
  t: TFunction;
}

export function useAiTestModalAction(params: AiTestParams) {
  return useCallback(
    (
      prompt: Prompt,
      initialMode: "single" | "compare" | "image" = "single",
    ) => {
      if (!params.canRunSingleAiTest)
        return params.showToast(params.t("toast.configAI"), "error");
      params.setAiTestPrompt(prompt);
      params.setAiTestInitialMode(initialMode);
      params.setIsAiTestModalOpen(true);
    },
    [params],
  );
}

interface PromptModalParams {
  setDetailPrompt: Dispatch<SetStateAction<Prompt | null>>;
  setIsDetailModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsVersionModalOpen: Dispatch<SetStateAction<boolean>>;
  setVersionHistoryPrompt: Dispatch<SetStateAction<Prompt | null>>;
}

export function usePromptModalActions(params: PromptModalParams) {
  const handleViewDetail = useCallback(
    (prompt: Prompt) => openPromptDetail(prompt, params),
    [params],
  );
  const handleVersionHistory = useCallback(
    (prompt: Prompt) => openPromptVersionHistory(prompt, params),
    [params],
  );
  return { handleViewDetail, handleVersionHistory };
}

function openPromptDetail(prompt: Prompt, params: PromptModalParams) {
  params.setDetailPrompt(prompt);
  params.setIsDetailModalOpen(true);
}

function openPromptVersionHistory(prompt: Prompt, params: PromptModalParams) {
  params.setVersionHistoryPrompt(prompt);
  params.setIsVersionModalOpen(true);
}

interface RestoreVersionParams {
  setIsVersionModalOpen: Dispatch<SetStateAction<boolean>>;
  setVersionHistoryPrompt: Dispatch<SetStateAction<Prompt | null>>;
  showToast: ShowToast;
  t: TFunction;
  updatePrompt: PromptUpdater;
  versionHistoryPrompt: Prompt | null;
}

export function useRestoreVersionAction(params: RestoreVersionParams) {
  return useCallback(
    async (version: PromptVersion) => {
      if (!params.versionHistoryPrompt) return;
      await params.updatePrompt(params.versionHistoryPrompt.id, {
        systemPrompt: version.systemPrompt,
        userPrompt: version.userPrompt,
      });
      params.showToast(params.t("toast.restored"), "success");
      params.setIsVersionModalOpen(false);
      params.setVersionHistoryPrompt(null);
    },
    [params],
  );
}

interface AiResponseParams {
  incrementUsageCount: (id: string) => Promise<void>;
  setAiResponseCache: Dispatch<SetStateAction<Record<string, string>>>;
  updatePrompt: PromptUpdater;
}

export function useAiResponseActions(params: AiResponseParams) {
  const handleAiUsageIncrement = useCallback(
    (id: string) => params.incrementUsageCount(id),
    [params],
  );
  const handleSaveAiResponse = useCallback(
    async (promptId: string, response: string) => {
      await params.updatePrompt(promptId, { lastAiResponse: response });
      params.setAiResponseCache((cache) => ({
        ...cache,
        [promptId]: response,
      }));
    },
    [params],
  );
  return { handleAiUsageIncrement, handleSaveAiResponse };
}
