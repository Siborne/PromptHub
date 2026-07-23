import type {
  AgentIdentityChoice,
  AgentIdentityPreference,
  AgentIdentityPreferences,
} from "@prompthub/shared/types";

export const DEFAULT_CODEX_IDENTITY: AgentIdentityPreference = Object.freeze({
  name: "codex",
  icon: "codex",
});

const DISPLAY_NAMES: Record<AgentIdentityChoice, string> = {
  codex: "Codex",
  chatgpt: "ChatGPT",
};

function normalizeChoice(value: unknown): AgentIdentityChoice | undefined {
  return value === "codex" || value === "chatgpt" ? value : undefined;
}

export function normalizeAgentIdentityPreferences(
  value: unknown,
): AgentIdentityPreferences {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const codex =
    record.codex &&
    typeof record.codex === "object" &&
    !Array.isArray(record.codex)
      ? (record.codex as Record<string, unknown>)
      : {};

  return {
    codex: {
      name: normalizeChoice(codex.name) ?? DEFAULT_CODEX_IDENTITY.name,
      icon: normalizeChoice(codex.icon) ?? DEFAULT_CODEX_IDENTITY.icon,
    },
  };
}

export function resolveAgentIdentity(
  platformId: string,
  fallbackName: string,
  preferences: AgentIdentityPreferences | undefined,
): { name: string; iconId: string } {
  if (platformId !== "codex") {
    return { name: fallbackName, iconId: platformId };
  }

  const preference = normalizeAgentIdentityPreferences(preferences).codex!;
  return {
    name: DISPLAY_NAMES[preference.name],
    iconId: preference.icon,
  };
}
