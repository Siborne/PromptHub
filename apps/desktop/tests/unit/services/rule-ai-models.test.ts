import { describe, expect, it } from "vitest";

import {
  getRuleAIModelChoices,
  isCompleteRuleAIModel,
  resolveRuleAIModel,
} from "../../../src/renderer/services/rule-ai-models";

const legacySettings = {
  aiProvider: "openai",
  aiApiProtocol: "openai" as const,
  aiApiKey: "legacy-key",
  aiApiUrl: "https://legacy.example/v1",
  aiModel: "legacy-chat",
  aiProviders: [],
  aiModels: [],
};

describe("rule AI model selection", () => {
  it("hydrates chat models from their provider and filters image models", () => {
    const choices = getRuleAIModelChoices({
      ...legacySettings,
      aiProviders: [
        {
          id: "anthropic-provider",
          name: "Anthropic Team",
          provider: "anthropic",
          apiProtocol: "anthropic",
          apiKey: "provider-key",
          apiUrl: "https://anthropic.example/v1",
        },
      ],
      aiModels: [
        {
          id: "review-model",
          type: "chat",
          providerId: "anthropic-provider",
          provider: "",
          apiProtocol: "openai",
          apiKey: "",
          apiUrl: "",
          model: "claude-review",
        },
        {
          id: "image-model",
          type: "image",
          providerId: "anthropic-provider",
          provider: "anthropic",
          apiProtocol: "anthropic",
          apiKey: "provider-key",
          apiUrl: "https://anthropic.example/v1",
          model: "image-only",
        },
      ],
    });

    expect(choices).toEqual([
      {
        providerId: "anthropic-provider",
        providerLabel: "Anthropic Team",
        model: expect.objectContaining({
          id: "review-model",
          providerId: "anthropic-provider",
          provider: "anthropic",
          apiProtocol: "anthropic",
          apiKey: "provider-key",
          apiUrl: "https://anthropic.example/v1",
          model: "claude-review",
        }),
      },
    ]);
    expect(isCompleteRuleAIModel(choices[0].model)).toBe(true);
  });

  it("resolves an explicit model without changing the configured default", () => {
    const settings = {
      ...legacySettings,
      aiModels: [
        {
          id: "default-model",
          type: "chat" as const,
          name: "Default",
          provider: "openai",
          apiProtocol: "openai" as const,
          apiKey: "default-key",
          apiUrl: "https://default.example/v1",
          model: "default-chat",
          isDefault: true,
        },
        {
          id: "selected-model",
          type: "chat" as const,
          name: "Selected",
          provider: "anthropic",
          apiProtocol: "anthropic" as const,
          apiKey: "selected-key",
          apiUrl: "https://selected.example/v1",
          model: "selected-chat",
        },
      ],
    };

    expect(resolveRuleAIModel(settings)?.id).toBe("default-model");
    expect(resolveRuleAIModel(settings, "selected-model")?.id).toBe(
      "selected-model",
    );
    expect(resolveRuleAIModel(settings, "missing-model")).toBeNull();
  });

  it("falls back to the complete legacy chat model only when it is configured", () => {
    const legacyChoice = getRuleAIModelChoices(legacySettings);

    expect(legacyChoice).toHaveLength(1);
    expect(legacyChoice[0]).toEqual(
      expect.objectContaining({
        providerId: "legacy-rule-ai-provider",
        providerLabel: "openai",
        model: expect.objectContaining({
          id: "legacy-rule-ai-model",
          isDefault: true,
        }),
      }),
    );
    expect(isCompleteRuleAIModel(legacyChoice[0].model)).toBe(true);

    expect(
      getRuleAIModelChoices({
        ...legacySettings,
        aiApiKey: "",
      }),
    ).toEqual([]);
    expect(
      isCompleteRuleAIModel({
        ...legacyChoice[0].model,
        apiKey: "",
      }),
    ).toBe(false);
  });

  it("keeps standalone chat models selectable without provider metadata", () => {
    const settings = {
      ...legacySettings,
      aiProvider: "",
      aiApiKey: "",
      aiApiUrl: "",
      aiModel: "",
      aiModels: [
        {
          id: "standalone",
          type: "chat" as const,
          provider: "",
          apiProtocol: "openai" as const,
          apiKey: "model-key",
          apiUrl: "https://standalone.example/v1",
          model: "standalone-chat",
        },
      ],
    };
    const choices = getRuleAIModelChoices(settings);

    expect(choices[0]).toEqual(
      expect.objectContaining({
        providerId: "model-provider::openai:https://standalone.example/v1",
        providerLabel: "AI",
      }),
    );
    expect(resolveRuleAIModel(settings)?.id).toBe("standalone");
    expect(resolveRuleAIModel({ ...settings, aiModels: [] })).toBeNull();
  });

  it("uses the provider kind as the label when a provider has no display name", () => {
    const choices = getRuleAIModelChoices({
      ...legacySettings,
      aiProviders: [
        {
          id: "openai-provider",
          provider: "openai",
          apiProtocol: "openai",
          apiKey: "provider-key",
          apiUrl: "https://provider.example/v1",
        },
      ],
      aiModels: [
        {
          id: "provider-model",
          type: "chat",
          providerId: "openai-provider",
          provider: "openai",
          apiProtocol: "openai",
          apiKey: "provider-key",
          apiUrl: "https://provider.example/v1",
          model: "provider-chat",
        },
      ],
    });

    expect(choices[0].providerLabel).toBe("openai");
  });
});
