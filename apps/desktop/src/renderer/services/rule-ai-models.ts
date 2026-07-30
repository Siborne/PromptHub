import type {
  AIModelConfig,
  AIProviderConfig,
  SettingsState,
} from "../stores/settings/settings-types";
import { findMatchingAIProvider } from "../stores/settings/settings-ai";

type RuleAISettings = Pick<
  SettingsState,
  | "aiApiKey"
  | "aiApiProtocol"
  | "aiApiUrl"
  | "aiModel"
  | "aiModels"
  | "aiProvider"
  | "aiProviders"
>;

export interface RuleAIModelChoice {
  model: AIModelConfig;
  providerId: string;
  providerLabel: string;
}

function buildLegacyModel(settings: RuleAISettings): AIModelConfig | null {
  if (
    !settings.aiProvider.trim() ||
    !settings.aiApiKey.trim() ||
    !settings.aiApiUrl.trim() ||
    !settings.aiModel.trim()
  ) {
    return null;
  }

  return {
    id: "legacy-rule-ai-model",
    type: "chat",
    name: settings.aiModel,
    provider: settings.aiProvider,
    apiProtocol: settings.aiApiProtocol,
    apiKey: settings.aiApiKey,
    apiUrl: settings.aiApiUrl,
    model: settings.aiModel,
    isDefault: true,
  };
}

function resolveProvider(
  model: AIModelConfig,
  providers: AIProviderConfig[],
): AIProviderConfig | undefined {
  return findMatchingAIProvider(providers, model);
}

function hydrateModelEndpoint(
  model: AIModelConfig,
  provider: AIProviderConfig | undefined,
): AIModelConfig {
  if (!provider) {
    return model;
  }

  return {
    ...model,
    providerId: provider.id,
    provider: provider.provider,
    apiProtocol: provider.apiProtocol,
    apiKey: provider.apiKey,
    apiUrl: provider.apiUrl,
  };
}

export function getRuleAIModelChoices(
  settings: RuleAISettings,
): RuleAIModelChoice[] {
  const configuredModels = settings.aiModels
    .filter((model) => model.type === "chat")
    .map((model) => {
      const provider = resolveProvider(model, settings.aiProviders);
      const hydratedModel = hydrateModelEndpoint(model, provider);
      return {
        model: hydratedModel,
        providerId:
          provider?.id ||
          model.providerId ||
          `model-provider:${model.provider}:${model.apiProtocol}:${model.apiUrl}`,
        providerLabel:
          provider?.name?.trim() ||
          provider?.provider ||
          model.provider ||
          "AI",
      };
    });

  if (configuredModels.length > 0) {
    return configuredModels;
  }

  const legacyModel = buildLegacyModel(settings);
  return legacyModel
    ? [
        {
          model: legacyModel,
          providerId: "legacy-rule-ai-provider",
          providerLabel: settings.aiProvider,
        },
      ]
    : [];
}

export function resolveRuleAIModel(
  settings: RuleAISettings,
  modelId?: string,
): AIModelConfig | null {
  const choices = getRuleAIModelChoices(settings);
  if (modelId) {
    return choices.find((choice) => choice.model.id === modelId)?.model ?? null;
  }

  return (
    choices.find((choice) => choice.model.isDefault)?.model ??
    choices[0]?.model ??
    null
  );
}

export function isCompleteRuleAIModel(model: AIModelConfig): boolean {
  return Boolean(
    model.apiKey.trim() &&
    model.apiUrl.trim() &&
    model.model.trim() &&
    model.provider.trim(),
  );
}
