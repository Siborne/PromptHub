import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { OutputFormatItem, Prompt } from "@prompthub/shared/types";
import type { TFunction } from "i18next";
import {
  buildPromptCopyText,
  copyTextToClipboard,
  hasUserDefinedPromptVariables,
  resolvePromptContentByLanguage,
} from "../prompt/prompt-copy-utils";

interface CopyState {
  copyPromptQueue: Prompt[];
  copyPromptQueueIndex: number;
  copyPromptResults: string[];
  copyPromptSourceId: string | null;
  setCopyPrompt: Dispatch<SetStateAction<Prompt | null>>;
  setCopyPromptQueue: Dispatch<SetStateAction<Prompt[]>>;
  setCopyPromptQueueIndex: Dispatch<SetStateAction<number>>;
  setCopyPromptResults: Dispatch<SetStateAction<string[]>>;
  setCopyPromptSourceId: Dispatch<SetStateAction<string | null>>;
  setIsCopyVariableModalOpen: Dispatch<SetStateAction<boolean>>;
}

interface PromptCopyFlowParams {
  copy: CopyState;
  incrementUsageCount: (id: string) => Promise<void>;
  outputFormatItems: OutputFormatItem[];
  promptById: Map<string, Prompt>;
  showCopyNotification: boolean;
  showEnglish: boolean;
  showToast: (
    message: string,
    variant: "success",
    sendSystemNotification?: boolean,
  ) => void;
  t: TFunction;
  triggerCopied: () => void;
}

function getOutputFormatPromptQueue(
  prompt: Prompt,
  items: OutputFormatItem[],
  promptById: Map<string, Prompt>,
) {
  const configured = items
    .filter((item) => item.sourcePromptId === prompt.id)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.createdAt.localeCompare(right.createdAt),
    );
  if (configured.length === 0) return [prompt];
  const queue = configured
    .map((item) =>
      item.targetPromptId
        ? (promptById.get(item.targetPromptId) ?? null)
        : prompt,
    )
    .filter((item): item is Prompt => item !== null);
  return queue.length > 0 ? queue : [prompt];
}

function usePromptCopyHandler(params: PromptCopyFlowParams) {
  return useCallback(
    async (prompt: Prompt) => {
      const queue = getOutputFormatPromptQueue(
        prompt,
        params.outputFormatItems,
        params.promptById,
      );
      if (queue.length > 1)
        return startCopyQueue(queue, prompt.id, params.copy);
      await copySinglePrompt(queue[0], params);
    },
    [params],
  );
}

function startCopyQueue(queue: Prompt[], sourceId: string, state: CopyState) {
  state.setCopyPromptQueue(queue);
  state.setCopyPromptResults(new Array(queue.length).fill(""));
  state.setCopyPromptQueueIndex(0);
  state.setCopyPromptSourceId(sourceId);
}

async function copySinglePrompt(prompt: Prompt, params: PromptCopyFlowParams) {
  const resolvedPrompt = resolvePromptContentByLanguage(
    prompt,
    params.showEnglish,
  );
  if (hasUserDefinedPromptVariables(undefined, resolvedPrompt.userPrompt)) {
    params.copy.setCopyPrompt(prompt);
    params.copy.setIsCopyVariableModalOpen(true);
    return;
  }
  await copyTextToClipboard(buildPromptCopyText(resolvedPrompt));
  await params.incrementUsageCount(prompt.id);
  params.showToast(
    params.t("toast.copied"),
    "success",
    params.showCopyNotification,
  );
}

function useCopyQueueProcessor(params: PromptCopyFlowParams) {
  useEffect(() => {
    if (canProcessCopyQueue(params.copy)) void processCopyQueue(params);
  }, [
    params.copy.copyPromptQueue,
    params.copy.copyPromptQueueIndex,
    params.copy.copyPromptResults,
    params.copy.copyPromptSourceId,
    params.incrementUsageCount,
    params.showCopyNotification,
    params.showEnglish,
    params.showToast,
    params.t,
    params.triggerCopied,
  ]);
}

function canProcessCopyQueue(state: CopyState) {
  return state.copyPromptQueue.length > 0 && state.copyPromptQueueIndex >= 0;
}

async function processCopyQueue(params: PromptCopyFlowParams) {
  if (isCopyQueueComplete(params.copy)) return finishCopyQueue(params);
  const prompt = params.copy.copyPromptQueue[params.copy.copyPromptQueueIndex];
  const resolved = resolvePromptContentByLanguage(prompt, params.showEnglish);
  if (hasUserDefinedPromptVariables(undefined, resolved.userPrompt))
    return requestCopyVariables(prompt, params.copy);
  appendCopyQueueResult(buildPromptCopyText(resolved), params.copy);
}

function isCopyQueueComplete(state: CopyState) {
  return state.copyPromptQueueIndex >= state.copyPromptQueue.length;
}

async function finishCopyQueue(params: PromptCopyFlowParams) {
  const text = params.copy.copyPromptResults
    .filter((item) => item.trim())
    .join("\n\n");
  try {
    await copyTextToClipboard(text);
    if (params.copy.copyPromptSourceId)
      await params.incrementUsageCount(params.copy.copyPromptSourceId);
    params.triggerCopied();
    params.showToast(
      params.t("toast.copied"),
      "success",
      params.showCopyNotification,
    );
  } finally {
    resetCopyQueue(params.copy);
  }
}

function requestCopyVariables(prompt: Prompt, state: CopyState) {
  state.setCopyPrompt(prompt);
  state.setIsCopyVariableModalOpen(true);
}

function appendCopyQueueResult(result: string, state: CopyState) {
  state.setCopyPromptResults((items) =>
    replaceCopyQueueResult(items, state.copyPromptQueueIndex, result),
  );
  state.setCopyPromptQueueIndex((index) => index + 1);
}

function replaceCopyQueueResult(
  items: string[],
  index: number,
  result: string,
) {
  const next = [...items];
  next[index] = result;
  return next;
}

function resetCopyQueue(state: CopyState) {
  state.setIsCopyVariableModalOpen(false);
  state.setCopyPrompt(null);
  state.setCopyPromptQueue([]);
  state.setCopyPromptResults([]);
  state.setCopyPromptQueueIndex(-1);
  state.setCopyPromptSourceId(null);
}

export function usePromptWorkspaceCopyFlow(params: PromptCopyFlowParams) {
  useCopyQueueProcessor(params);
  return { handleCopyPrompt: usePromptCopyHandler(params) };
}
