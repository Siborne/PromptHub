import type {
  AgentProviderConnectionTestResult,
  AgentProviderModelTestResult,
} from "@prompthub/shared";

import {
  testAnthropicProviderConnection,
  testAnthropicProviderModel,
  type AnthropicProviderConnectionInput,
  type AnthropicProviderModelTestInput,
} from "./agent-anthropic-provider-probe";
import {
  testGoogleGeminiProviderConnection,
  testGoogleGeminiProviderModel,
  type GoogleGeminiProviderConnectionInput,
  type GoogleGeminiProviderModelTestInput,
} from "./agent-google-gemini-provider-probe";
import {
  testOpenAICompatibleProviderConnection,
  type OpenAICompatibleConnectionInput,
} from "./agent-provider-connectivity";
import {
  testOpenAICompatibleProviderModel,
  type OpenAICompatibleModelTestInput,
} from "./agent-provider-model-test";

export type DirectProviderProtocol =
  | "openai-chat"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai";

export interface ProviderProbeInput {
  profileId: string;
  protocol: DirectProviderProtocol;
  endpoint: string | null;
  credential: string | null;
  model: string;
}

export interface ProviderProbeOptions {
  openAIConnection?: (
    input: OpenAICompatibleConnectionInput,
  ) => Promise<
    Omit<AgentProviderConnectionTestResult, "platformId" | "profileId">
  >;
  openAIModel?: (
    input: OpenAICompatibleModelTestInput,
  ) => Promise<Omit<AgentProviderModelTestResult, "platformId" | "profileId">>;
  anthropicConnection?: (
    input: AnthropicProviderConnectionInput,
  ) => Promise<
    Omit<AgentProviderConnectionTestResult, "platformId" | "profileId">
  >;
  anthropicModel?: (
    input: AnthropicProviderModelTestInput,
  ) => Promise<Omit<AgentProviderModelTestResult, "platformId" | "profileId">>;
  googleConnection?: (
    input: GoogleGeminiProviderConnectionInput,
  ) => Promise<
    Omit<AgentProviderConnectionTestResult, "platformId" | "profileId">
  >;
  googleModel?: (
    input: GoogleGeminiProviderModelTestInput,
  ) => Promise<Omit<AgentProviderModelTestResult, "platformId" | "profileId">>;
}

export function createProviderProbeDispatcher(
  platformId: string,
  options: ProviderProbeOptions,
): {
  testConnection(
    input: ProviderProbeInput,
  ): Promise<AgentProviderConnectionTestResult>;
  testModel(
    input: ProviderProbeInput,
    signal: AbortSignal,
  ): Promise<AgentProviderModelTestResult>;
} {
  const openAIConnection =
    options.openAIConnection ?? testOpenAICompatibleProviderConnection;
  const openAIModel = options.openAIModel ?? testOpenAICompatibleProviderModel;
  const anthropicConnection =
    options.anthropicConnection ?? testAnthropicProviderConnection;
  const anthropicModel = options.anthropicModel ?? testAnthropicProviderModel;
  const googleConnection =
    options.googleConnection ?? testGoogleGeminiProviderConnection;
  const googleModel = options.googleModel ?? testGoogleGeminiProviderModel;

  return {
    async testConnection(input) {
      const common = {
        endpoint: input.endpoint,
        credential: input.credential,
        model: input.model,
      };
      const result =
        input.protocol === "anthropic-messages"
          ? await anthropicConnection({
              ...common,
              credentialKind: "api-key",
              protocol: "anthropic-messages",
            })
          : input.protocol === "google-generative-ai"
            ? await googleConnection({
                ...common,
                protocol: "google-generative-ai",
              })
            : await openAIConnection({
                ...common,
                protocol:
                  input.protocol === "openai-responses" ? "responses" : "chat",
              });
      return { platformId, profileId: input.profileId, ...result };
    },
    async testModel(input, signal) {
      const common = {
        endpoint: input.endpoint,
        credential: input.credential,
        model: input.model,
        signal,
      };
      const result =
        input.protocol === "anthropic-messages"
          ? await anthropicModel({
              ...common,
              credentialKind: "api-key",
              protocol: "anthropic-messages",
            })
          : input.protocol === "google-generative-ai"
            ? await googleModel({
                ...common,
                protocol: "google-generative-ai",
              })
            : await openAIModel({
                ...common,
                protocol:
                  input.protocol === "openai-responses" ? "responses" : "chat",
              });
      return { platformId, profileId: input.profileId, ...result };
    },
  };
}
