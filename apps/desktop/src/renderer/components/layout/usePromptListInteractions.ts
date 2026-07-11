import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Dispatch,
  DragEvent as ReactDragEvent,
  SetStateAction,
} from "react";
import type { Prompt } from "@prompthub/shared/types";
import {
  getPromptDropPosition,
  getPromptMoveTarget,
  type PromptDropPosition,
} from "../prompt/prompt-drag-utils";
import type { VirtualizedPromptListProps } from "./prompt-list-types";

function readDraggedPromptId(
  event: ReactDragEvent<HTMLDivElement>,
  draggingId: string | null,
) {
  return (
    draggingId ||
    event.dataTransfer.getData("application/x-prompthub-prompt-id") ||
    event.dataTransfer.getData("text/plain")
  );
}

export function useCollapsedPromptIds({
  prompts,
  onCollapsedPromptIdsChange,
}: Pick<VirtualizedPromptListProps, "prompts" | "onCollapsedPromptIdsChange">) {
  const togglePromptCollapse = useCallback(
    (promptId: string) => {
      onCollapsedPromptIdsChange((current) => {
        const next = new Set(current);
        next.has(promptId) ? next.delete(promptId) : next.add(promptId);
        return next;
      });
    },
    [onCollapsedPromptIdsChange],
  );

  useEffect(() => {
    const promptIds = new Set(prompts.map((prompt) => prompt.id));
    onCollapsedPromptIdsChange((current) => {
      const next = new Set([...current].filter((id) => promptIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [onCollapsedPromptIdsChange, prompts]);

  return togglePromptCollapse;
}

export function usePromptListDrag({
  prompts,
  onMovePrompt,
}: Pick<VirtualizedPromptListProps, "prompts" | "onMovePrompt">) {
  const state = usePromptDragState();
  const resetDropState = usePromptDragReset(state);
  const handleDragStart = usePromptDragStart(state);
  const updateDropTarget = usePromptDropTarget(
    prompts,
    state.draggingId,
    state.setDropTargetId,
    state.setDropPosition,
  );
  const handleDragLeave = usePromptDragLeave(state);
  const handleDrop = usePromptDrop(
    prompts,
    state.draggingId,
    state.dropPosition,
    onMovePrompt,
    resetDropState,
  );
  return {
    draggingId: state.draggingId,
    dropTargetId: state.dropTargetId,
    dropPosition: state.dropPosition,
    resetDropState,
    handleDragStart,
    updateDropTarget,
    handleDragLeave,
    handleDrop,
  };
}

interface PromptDragState {
  draggingId: string | null;
  dropTargetId: string | null;
  dropPosition: PromptDropPosition | null;
  setDraggingId: Dispatch<SetStateAction<string | null>>;
  setDropTargetId: Dispatch<SetStateAction<string | null>>;
  setDropPosition: Dispatch<SetStateAction<PromptDropPosition | null>>;
}

function usePromptDragState(): PromptDragState {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<PromptDropPosition | null>(
    null,
  );
  return {
    draggingId,
    dropTargetId,
    dropPosition,
    setDraggingId,
    setDropTargetId,
    setDropPosition,
  };
}

function usePromptDragReset(state: PromptDragState) {
  return useCallback(() => {
    state.setDraggingId(null);
    state.setDropTargetId(null);
    state.setDropPosition(null);
  }, [state]);
}

function usePromptDragStart(state: PromptDragState) {
  return useCallback(
    (event: ReactDragEvent<HTMLDivElement>, promptId: string) => {
      state.setDraggingId(promptId);
      state.setDropTargetId(null);
      state.setDropPosition(null);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-prompthub-prompt-id", promptId);
      event.dataTransfer.setData("text/plain", promptId);
    },
    [state],
  );
}

function usePromptDragLeave(state: PromptDragState) {
  return useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      )
        return;
      state.setDropTargetId(null);
      state.setDropPosition(null);
    },
    [state],
  );
}

function usePromptDropTarget(
  prompts: Prompt[],
  draggingId: string | null,
  setDropTargetId: Dispatch<SetStateAction<string | null>>,
  setDropPosition: Dispatch<SetStateAction<PromptDropPosition | null>>,
) {
  return useCallback(
    (event: ReactDragEvent<HTMLDivElement>, targetPromptId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const sourcePromptId = readDraggedPromptId(event, draggingId);
      const position = getPromptDropPosition(
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
      );
      const isValid =
        sourcePromptId &&
        sourcePromptId !== targetPromptId &&
        getPromptMoveTarget(prompts, sourcePromptId, targetPromptId, position);
      setDropTargetId(isValid ? targetPromptId : null);
      setDropPosition(isValid ? position : null);
    },
    [draggingId, prompts, setDropPosition, setDropTargetId],
  );
}

function usePromptDrop(
  prompts: Prompt[],
  draggingId: string | null,
  dropPosition: PromptDropPosition | null,
  onMovePrompt: VirtualizedPromptListProps["onMovePrompt"],
  resetDropState: () => void,
) {
  return useCallback(
    async (event: ReactDragEvent<HTMLDivElement>, targetPromptId: string) => {
      event.preventDefault();
      const sourcePromptId = readDraggedPromptId(event, draggingId);
      const target =
        sourcePromptId && sourcePromptId !== targetPromptId && dropPosition
          ? getPromptMoveTarget(
              prompts,
              sourcePromptId,
              targetPromptId,
              dropPosition,
            )
          : null;
      resetDropState();
      if (sourcePromptId && target)
        await onMovePrompt(sourcePromptId, target.parentId, target.order);
    },
    [draggingId, dropPosition, onMovePrompt, prompts, resetDropState],
  );
}

export function useEffectiveCollapsedPromptIds(
  collapsedPromptIds: Set<string>,
  highlightTerms: string[],
) {
  return useMemo(
    () => (highlightTerms.length > 0 ? new Set<string>() : collapsedPromptIds),
    [collapsedPromptIds, highlightTerms.length],
  );
}
