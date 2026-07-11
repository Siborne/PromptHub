import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Prompt, UpdatePromptDTO } from "@prompthub/shared/types";
import type { TFunction } from "i18next";
import type { useToast } from "../ui/Toast";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface CollapsePromptTreeParams {
  setCollapsedPromptIds: Dispatch<SetStateAction<Set<string>>>;
  visibleHierarchyMeta: { childCountById: Map<string, number> };
  visiblePrompts: Prompt[];
}

export function useCollapsePromptTreeAction(params: CollapsePromptTreeParams) {
  return useCallback(() => {
    const parents = params.visiblePrompts
      .filter(
        (prompt) =>
          (params.visibleHierarchyMeta.childCountById.get(prompt.id) ?? 0) > 0,
      )
      .map((prompt) => prompt.id);
    params.setCollapsedPromptIds(new Set(parents));
  }, [params]);
}

interface MovePromptTreeParams {
  movePrompt: (
    promptId: string,
    newParentId: string | null,
    newOrder: number,
  ) => Promise<void>;
  prompts: Prompt[];
  setCollapsedPromptIds: Dispatch<SetStateAction<Set<string>>>;
  showToast: ShowToast;
  t: TFunction;
}

export function useMovePromptTreeActions(params: MovePromptTreeParams) {
  const handleMovePromptToNode = useCallback(
    (prompt: Prompt, parentId: string | null) =>
      movePromptToNode(prompt, parentId, params),
    [params],
  );
  const handleMovePromptInTree = useCallback(
    (promptId: string, parentId: string | null, order: number) =>
      movePromptInTree(promptId, parentId, order, params),
    [params],
  );
  return { handleMovePromptToNode, handleMovePromptInTree };
}

async function movePromptToNode(
  prompt: Prompt,
  parentId: string | null,
  params: MovePromptTreeParams,
) {
  try {
    const order = params.prompts.filter(
      (item) => (item.parentId ?? null) === parentId && item.id !== prompt.id,
    ).length;
    await params.movePrompt(prompt.id, parentId, order);
    if (parentId)
      params.setCollapsedPromptIds((ids) => expandPromptParent(ids, parentId));
    params.showToast(
      params.t("prompt.moveToNodeSuccess", "Prompt moved to node"),
      "success",
    );
  } catch (error) {
    console.error("Failed to move prompt to node:", error);
    params.showToast(
      params.t("prompt.relationships.moveFailed", "Failed to move prompt"),
      "error",
    );
  }
}

function expandPromptParent(ids: Set<string>, parentId: string) {
  const next = new Set(ids);
  next.delete(parentId);
  return next;
}

async function movePromptInTree(
  promptId: string,
  parentId: string | null,
  order: number,
  params: MovePromptTreeParams,
) {
  try {
    await params.movePrompt(promptId, parentId, order);
  } catch (error) {
    console.error("Failed to move prompt in tree:", error);
    params.showToast(
      params.t("prompt.relationships.moveFailed", "Failed to move prompt"),
      "error",
    );
  }
}

interface BatchPromptParams {
  deletePrompt: (id: string) => Promise<void>;
  prompts: Prompt[];
  showToast: ShowToast;
  t: TFunction;
  toggleFavorite: (id: string) => Promise<void>;
  updatePrompt: (id: string, data: UpdatePromptDTO) => Promise<void>;
}

export function usePromptBatchActions(params: BatchPromptParams) {
  const handleBatchFavorite = useCallback(
    (ids: string[], favorite: boolean) =>
      batchFavoritePrompts(ids, favorite, params),
    [params],
  );
  const handleBatchMove = useCallback(
    (ids: string[], folderId: string | undefined) =>
      batchMovePrompts(ids, folderId, params),
    [params],
  );
  const handleBatchDelete = useCallback(
    (ids: string[]) => batchDeletePrompts(ids, params),
    [params],
  );
  return { handleBatchFavorite, handleBatchMove, handleBatchDelete };
}

async function batchFavoritePrompts(
  ids: string[],
  favorite: boolean,
  params: BatchPromptParams,
) {
  if (favorite)
    for (const id of ids)
      if (
        params.prompts.find((prompt) => prompt.id === id && !prompt.isFavorite)
      )
        await params.toggleFavorite(id);
  params.showToast(params.t("toast.batchFavorited"), "success");
}

async function batchMovePrompts(
  ids: string[],
  folderId: string | undefined,
  params: BatchPromptParams,
) {
  for (const id of ids) await params.updatePrompt(id, { folderId });
  params.showToast(params.t("toast.batchMoved"), "success");
}

async function batchDeletePrompts(ids: string[], params: BatchPromptParams) {
  if (!confirm(params.t("prompt.confirmBatchDelete", { count: ids.length })))
    return;
  for (const id of ids) await params.deletePrompt(id);
  params.showToast(params.t("toast.batchDeleted"), "success");
}
