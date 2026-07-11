import { useTranslation } from "react-i18next";
import type { VariableInputImageAttachment } from "../prompt/VariableInputModal";
import { usePromptStore } from "../../stores/prompt.store";
import { useToast } from "../ui/Toast";
import { usePromptAiModels } from "./prompt-ai-workbench/usePromptAiModels";
import { usePromptAiRunner } from "./prompt-ai-workbench/prompt-ai-workbench-runner";
import { usePromptAiTestState } from "./prompt-ai-workbench/prompt-ai-workbench-state";
import { usePromptAiSelection } from "./prompt-ai-workbench/usePromptAiSelection";
import { usePromptAiStreaming } from "./prompt-ai-workbench/usePromptAiStreaming";

function usePromptAiStoreInputs() {
  const prompts = usePromptStore((state) => state.prompts);
  const selectedId = usePromptStore((state) => state.selectedId);
  const incrementUsageCount = usePromptStore(
    (state) => state.incrementUsageCount,
  );
  const updatePrompt = usePromptStore((state) => state.updatePrompt);
  return { prompts, selectedId, incrementUsageCount, updatePrompt };
}

function getDisplayedAiResult(
  currentState: ReturnType<typeof usePromptAiTestState>["currentState"],
  streaming: ReturnType<typeof usePromptAiStreaming>,
) {
  return {
    aiResponse: streaming.isStreaming
      ? streaming.streamingContent
      : currentState?.aiResponse || null,
    aiThinking: streaming.isStreaming
      ? streaming.streamingThinking
      : currentState?.aiThinking || null,
    isAiResponseImage: currentState?.isAiResponseImage || false,
    isTestingAI: currentState?.isTestingAI || false,
    isComparingModels: currentState?.isComparingModels || false,
  };
}

export function usePromptAiWorkbench(
  inlineAiTestImages: VariableInputImageAttachment[],
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const store = usePromptAiStoreInputs();
  const state = usePromptAiTestState(store.selectedId);
  const streaming = usePromptAiStreaming();
  const models = usePromptAiModels(store.prompts, store.selectedId);
  const selection = usePromptAiSelection(
    store.selectedId,
    models.compareModels,
  );
  const runner = usePromptAiRunner({
    ...store,
    ...models,
    ...state,
    streaming,
    selection,
    inlineAiTestImages,
    selectedModelIds: selection.selectedModelIds,
    t,
    showToast,
  });
  return {
    ...getDisplayedAiResult(state.currentState, streaming),
    ...selection,
    ...runner,
    aiModel: models.aiModel,
    canRunSingleAiTest: models.canRunSingleAiTest,
    compareModels: models.compareModels,
    defaultImageModel: models.defaultImageModel,
  };
}
