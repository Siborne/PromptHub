/**
 * Provider preset catalog types.
 *
 * The preset catalog is a static, versioned, non-secret collection of default
 * provider configurations per Agent platform. It must never carry real
 * credentials, tokens, or OAuth data. It borrows the preset organization and
 * protocol mapping contract of CC Switch (MIT v3.19.2) as selective reference
 * only; no runtime code is copied.
 */

export type AgentProviderPresetProtocol =
  | "platform-native"
  | "anthropic-messages"
  | "openai-chat"
  | "openai-responses"
  | "google-generative-ai";

export type AgentProviderPresetCategory =
  | "official"
  | "cn"
  | "third-party"
  | "partner";

export interface AgentProviderPresetModelMapping {
  routeKey: string;
  modelId: string;
  parameters?: Record<string, unknown>;
}

export interface AgentProviderPresetCredential {
  /** "managed": PromptHub secret store owns the key; "environment": env var. */
  source: "managed" | "environment";
  /** Environment variable name; required when source is "environment". */
  envKey?: string;
  /** Platform native auth field selector, e.g. Claude API key vs auth token. */
  apiKeyField?: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN";
}

export interface AgentProviderPresetTheme {
  backgroundColor: string;
  textColor: string;
}

export interface AgentProviderPreset {
  /** Owning Agent platform id, e.g. "codex" | "claude" | "kimi". */
  platformId: string;
  /** Display name; prefer nameKey for localization. */
  name: string;
  /** i18n key when the display name should be localized. */
  nameKey?: string;
  /** Provider home page. */
  websiteUrl: string;
  /** Link for obtaining an API key (optional). */
  apiKeyUrl?: string;
  /** Provider kind, e.g. "anthropic" | "openai" | "moonshot". */
  providerKind: string;
  /** Wire protocol, see AgentProviderPresetProtocol. */
  protocol: AgentProviderPresetProtocol;
  /** Default endpoint; null = platform-native default. */
  endpoint: string | null;
  /** Non-sensitive platform-specific config (e.g. providerId, envKey). */
  config: Record<string, unknown>;
  /** Default model route mappings. */
  modelMappings: AgentProviderPresetModelMapping[];
  /** Credential reference mode; never a real secret. */
  credential: AgentProviderPresetCredential;
  /** Classification used for ordering/grouping in the preset selector. */
  category: AgentProviderPresetCategory;
  /** Neutral display icon name/color; no third-party brand assets beyond official marks. */
  icon?: string;
  iconColor?: string;
  theme?: AgentProviderPresetTheme;
  /** Endpoint candidates for speed tests/address management. */
  endpointCandidates?: string[];
  /** True when the preset depends on the platform's own OAuth (no key input). */
  requiresOAuth?: boolean;
}
