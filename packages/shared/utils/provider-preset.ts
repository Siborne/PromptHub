/**
 * Provider preset catalog validation.
 *
 * Presets are static non-secret defaults; the validator enforces the public
 * data boundary (no sensitive keys, bounded shapes, http(s) URLs without
 * userinfo/fragments, allowlisted protocols) so the catalog can never smuggle
 * credentials into renderer payloads, backups, or logs. It reuses the shared
 * public-config and endpoint validators.
 */

import {
  assertAgentProviderPublicConfig,
  normalizeAgentProviderEndpoint,
} from "@prompthub/shared/utils/agent-provider-config";

import type {
  AgentProviderPreset,
  AgentProviderPresetModelMapping,
  AgentProviderPresetProtocol,
} from "@prompthub/shared/types/provider-preset";

const MAX_MODEL_MAPPINGS = 16;
const MAX_ENDPOINT_CANDIDATES = 8;
const MAX_NAME_LENGTH = 200;
const MAX_MODEL_ID_LENGTH = 2_048;
const MAX_URL_LENGTH = 2_048;
const MAX_ENV_KEY_LENGTH = 128;
const MAX_ICON_LENGTH = 128;

const PROTOCOLS: ReadonlySet<AgentProviderPresetProtocol> = new Set([
  "platform-native",
  "anthropic-messages",
  "openai-chat",
  "openai-responses",
  "google-generative-ai",
]);

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const API_KEY_FIELDS = new Set(["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]);
const ROUTE_KEYS = new Set(["primary", "secondary"]);

function requireHttpUrl(value: string, field: string): void {
  if (!value || value.length > MAX_URL_LENGTH) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
}

function assertModelMapping(
  mapping: AgentProviderPresetModelMapping,
): void {
  if (
    mapping === null ||
    typeof mapping !== "object" ||
    !ROUTE_KEYS.has(mapping.routeKey) ||
    typeof mapping.modelId !== "string" ||
    !mapping.modelId.trim() ||
    mapping.modelId.length > MAX_MODEL_ID_LENGTH
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (mapping.parameters !== undefined) {
    try {
      assertAgentProviderPublicConfig(mapping.parameters);
    } catch {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
  }
}

export function assertAgentProviderPreset(
  preset: unknown,
): asserts preset is AgentProviderPreset {
  if (preset === null || typeof preset !== "object" || Array.isArray(preset)) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  const value = preset as Record<string, unknown>;
  if (
    typeof value.platformId !== "string" ||
    !value.platformId.trim() ||
    value.platformId.length > 128 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (value.nameKey !== undefined && typeof value.nameKey !== "string") {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (
    typeof value.providerKind !== "string" ||
    !value.providerKind.trim() ||
    value.providerKind.length > 200
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (
    typeof value.protocol !== "string" ||
    !PROTOCOLS.has(value.protocol as AgentProviderPresetProtocol)
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  requireHttpUrl(String(value.websiteUrl), "websiteUrl");
  if (value.apiKeyUrl !== undefined) {
    if (typeof value.apiKeyUrl !== "string") {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
    requireHttpUrl(value.apiKeyUrl, "apiKeyUrl");
  }
  const endpoint =
    value.endpoint === null || value.endpoint === undefined
      ? null
      : String(value.endpoint);
  try {
    normalizeAgentProviderEndpoint(endpoint);
  } catch {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }

  if (!Array.isArray(value.modelMappings) || value.modelMappings.length === 0) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (value.modelMappings.length > MAX_MODEL_MAPPINGS) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  for (const mapping of value.modelMappings) {
    assertModelMapping(mapping as AgentProviderPresetModelMapping);
  }

  try {
    assertAgentProviderPublicConfig(value.config);
  } catch {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }

  const credential = value.credential as Record<string, unknown> | undefined;
  if (
    credential === null ||
    typeof credential !== "object" ||
    Array.isArray(credential)
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (credential.source !== "managed" && credential.source !== "environment") {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (credential.source === "environment") {
    if (
      typeof credential.envKey !== "string" ||
      !ENV_KEY_PATTERN.test(credential.envKey)
    ) {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
  } else if (credential.envKey !== undefined) {
    if (
      typeof credential.envKey !== "string" ||
      credential.envKey.length > MAX_ENV_KEY_LENGTH
    ) {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
  }
  if (
    credential.apiKeyField !== undefined &&
    (typeof credential.apiKeyField !== "string" ||
      !API_KEY_FIELDS.has(credential.apiKeyField))
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }

  if (value.category !== undefined) {
    const category = value.category;
    if (
      category !== "official" &&
      category !== "cn" &&
      category !== "third-party" &&
      category !== "partner"
    ) {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
  }
  if (
    value.icon !== undefined &&
    (typeof value.icon !== "string" ||
      !value.icon ||
      value.icon.length > MAX_ICON_LENGTH)
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (
    value.iconColor !== undefined &&
    (typeof value.iconColor !== "string" ||
      value.iconColor.length > MAX_ICON_LENGTH)
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
  if (value.theme !== undefined) {
    const theme = value.theme as Record<string, unknown>;
    if (
      typeof theme !== "object" ||
      typeof theme.backgroundColor !== "string" ||
      typeof theme.textColor !== "string"
    ) {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
  }
  if (value.endpointCandidates !== undefined) {
    if (
      !Array.isArray(value.endpointCandidates) ||
      value.endpointCandidates.length > MAX_ENDPOINT_CANDIDATES
    ) {
      throw new Error("AGENT_PROVIDER_PRESET_INVALID");
    }
    for (const candidate of value.endpointCandidates) {
      if (typeof candidate !== "string") {
        throw new Error("AGENT_PROVIDER_PRESET_INVALID");
      }
      try {
        normalizeAgentProviderEndpoint(candidate);
      } catch {
        throw new Error("AGENT_PROVIDER_PRESET_INVALID");
      }
    }
  }
  if (
    value.requiresOAuth !== undefined &&
    typeof value.requiresOAuth !== "boolean"
  ) {
    throw new Error("AGENT_PROVIDER_PRESET_INVALID");
  }
}
