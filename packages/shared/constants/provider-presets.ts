/**
 * Provider preset catalog (static, versioned, non-secret).
 *
 * The catalog only carries each Agent platform's official configuration plus
 * suppliers with verifiable official evidence. Sponsor/promotional presets
 * (affiliate links, promo codes) are intentionally excluded.
 *
 * Evidence source for Codex entries: CC Switch v3.19.2
 * (`/Users/lingxiaotian/Programs/public/cc-switch`,
 *  src/config/codexProviderPresets.ts, MIT, selective reference only) plus the
 * upstream official docs cited in the entry comments.
 */

import { assertAgentProviderPreset } from "@prompthub/shared/utils/provider-preset";
import type { AgentProviderPreset } from "@prompthub/shared/types/provider-preset";

export const AGENT_PROVIDER_PRESET_CATALOG_VERSION = 1;

export const AGENT_PROVIDER_PRESETS: readonly AgentProviderPreset[] = [
  // ---------------------------------------------------------------------------
  // codex (ChatGPT)
  // ---------------------------------------------------------------------------
  {
    platformId: "codex",
    name: "OpenAI Official",
    websiteUrl: "https://chatgpt.com/codex",
    providerKind: "openai",
    protocol: "platform-native",
    endpoint: null,
    config: { providerId: "openai" },
    // The official entry maps to the built-in `openai` provider and the
    // ChatGPT login. It is the additive-mode baseline: switching to a
    // third-party provider must never modify auth.json or this entry.
    modelMappings: [{ routeKey: "primary", modelId: "gpt-5.5" }],
    credential: { source: "managed" },
    category: "official",
    icon: "openai",
    iconColor: "#00A67E",
    requiresOAuth: true,
  },
  {
    platformId: "codex",
    name: "DeepSeek",
    websiteUrl: "https://platform.deepseek.com",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    providerKind: "openai-compatible",
    protocol: "openai-responses",
    endpoint: "https://api.deepseek.com",
    config: { providerId: "deepseek" },
    // DeepSeek official Codex integration: deepseek-v4-flash speaks the native
    // Responses protocol against api.deepseek.com (no conversion needed).
    // Evidence: CC Switch v3.19.2 comment citing
    // api-docs.deepseek.com -> agent_integrations/codex.
    modelMappings: [
      { routeKey: "primary", modelId: "deepseek-v4-flash" },
    ],
    credential: { source: "managed" },
    category: "cn",
    icon: "deepseek",
    iconColor: "#1E88E5",
    endpointCandidates: ["https://api.deepseek.com"],
  },
  {
    platformId: "codex",
    name: "Kimi (Moonshot)",
    websiteUrl: "https://platform.kimi.com",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys",
    providerKind: "openai-compatible",
    protocol: "openai-chat",
    endpoint: "https://api.moonshot.cn/v1",
    config: { providerId: "kimi" },
    // Moonshot OpenAI-compatible chat endpoint with the Kimi code model.
    // Evidence: CC Switch v3.19.2 preset entry (apiFormat openai_chat).
    modelMappings: [
      { routeKey: "primary", modelId: "kimi-k2.7-code" },
    ],
    credential: { source: "managed" },
    category: "cn",
    icon: "kimi",
    iconColor: "#6366F1",
    endpointCandidates: ["https://api.moonshot.cn/v1"],
  },
];

const PRESETS_BY_PLATFORM: ReadonlyMap<string, readonly AgentProviderPreset[]> =
  new Map(
    (() => {
      const grouped = new Map<string, AgentProviderPreset[]>();
      for (const preset of AGENT_PROVIDER_PRESETS) {
        const list = grouped.get(preset.platformId) ?? [];
        list.push(preset);
        grouped.set(preset.platformId, list);
      }
      return [...grouped.entries()];
    })(),
  );

// Fail fast on catalog defects everywhere: the array is small and static.
for (const preset of AGENT_PROVIDER_PRESETS) {
  assertAgentProviderPreset(preset);
}

export function getAgentProviderPresets(
  platformId: string,
): readonly AgentProviderPreset[] {
  return PRESETS_BY_PLATFORM.get(platformId) ?? [];
}
