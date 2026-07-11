import { useMemo } from "react";
import type { Prompt } from "@prompthub/shared/types";
import { resolveScenarioModel } from "../../../services/ai-defaults";
import { useSettingsStore } from "../../../stores/settings.store";

function usePromptAiSettings() {
  const aiProvider = useSettingsStore((state) => state.aiProvider);
  const aiApiProtocol = useSettingsStore((state) => state.aiApiProtocol);
  const aiApiKey = useSettingsStore((state) => state.aiApiKey);
  const aiApiUrl = useSettingsStore((state) => state.aiApiUrl);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const aiModels = useSettingsStore((state) => state.aiModels);
  const scenarioModelDefaults = useSettingsStore(
    (state) => state.scenarioModelDefaults,
  );
  const modelRouteDefaults = useSettingsStore(
    (state) => state.modelRouteDefaults,
  );
  return {
    aiProvider,
    aiApiProtocol,
    aiApiKey,
    aiApiUrl,
    aiModel,
    aiModels,
    scenarioModelDefaults,
    modelRouteDefaults,
  };
}

function useScenarioModels(settings: ReturnType<typeof usePromptAiSettings>) {
  const defaultChatModel = useMemo(
    () =>
      resolveScenarioModel(
        settings.aiModels,
        settings.scenarioModelDefaults,
        "promptTest",
        "chat",
        undefined,
        settings.modelRouteDefaults,
      ),
    [
      settings.aiModels,
      settings.modelRouteDefaults,
      settings.scenarioModelDefaults,
    ],
  );
  const defaultImageModel = useMemo(
    () =>
      resolveScenarioModel(
        settings.aiModels,
        settings.scenarioModelDefaults,
        "imageTest",
        "image",
        undefined,
        settings.modelRouteDefaults,
      ),
    [
      settings.aiModels,
      settings.modelRouteDefaults,
      settings.scenarioModelDefaults,
    ],
  );
  return { defaultChatModel, defaultImageModel };
}

function useCompareModels(
  prompts: Prompt[],
  selectedId: string | null,
  aiModels: ReturnType<typeof usePromptAiSettings>["aiModels"],
) {
  return useMemo(() => {
    const selectedPrompt = prompts.find((prompt) => prompt.id === selectedId);
    return selectedPrompt?.promptType === "image"
      ? []
      : aiModels.filter((model) => (model.type ?? "chat") === "chat");
  }, [aiModels, prompts, selectedId]);
}

function createSingleChatConfig(
  settings: ReturnType<typeof usePromptAiSettings>,
  defaultChatModel: ReturnType<typeof useScenarioModels>["defaultChatModel"],
) {
  return defaultChatModel
    ? {
        id: defaultChatModel.id,
        provider: defaultChatModel.provider,
        apiProtocol: defaultChatModel.apiProtocol,
        apiKey: defaultChatModel.apiKey,
        apiUrl: defaultChatModel.apiUrl,
        model: defaultChatModel.model,
        chatParams: defaultChatModel.chatParams,
      }
    : {
        provider: settings.aiProvider,
        apiProtocol: settings.aiApiProtocol,
        apiKey: settings.aiApiKey,
        apiUrl: settings.aiApiUrl,
        model: settings.aiModel,
      };
}

function isConfiguredModel(
  model: { apiKey?: string; apiUrl?: string; model?: string } | null,
) {
  return Boolean(model?.apiKey && model.apiUrl && model.model);
}

export function usePromptAiModels(
  prompts: Prompt[],
  selectedId: string | null,
) {
  const settings = usePromptAiSettings();
  const { defaultChatModel, defaultImageModel } = useScenarioModels(settings);
  const compareModels = useCompareModels(
    prompts,
    selectedId,
    settings.aiModels,
  );
  const singleChatConfig = createSingleChatConfig(settings, defaultChatModel);
  return {
    aiModel: settings.aiModel,
    compareModels,
    defaultImageModel,
    singleChatConfig,
    canRunSingleAiTest:
      isConfiguredModel(singleChatConfig) ||
      isConfiguredModel(defaultImageModel),
  };
}
