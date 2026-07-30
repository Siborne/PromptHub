import type {
  RegistrySkill,
  SkillSafetyScanMode,
  SkillStoreSource,
} from "@prompthub/shared/types";

export const SKILL_SAFETY_CHANNELS = [
  "official",
  "community",
  "git-repo",
  "marketplace-json",
  "local-dir",
] as const;

export type SkillSafetyChannel = (typeof SKILL_SAFETY_CHANNELS)[number];
export type SkillSafetyPolicyValue = SkillSafetyScanMode;
export type SkillSafetyPolicySelection = SkillSafetyPolicyValue | "inherit";

export interface SkillSafetyPolicyState {
  autoScanStoreSkillsBeforeInstall: boolean;
  skillSafetyChannelPolicies: Partial<
    Record<SkillSafetyChannel, SkillSafetyPolicyValue>
  >;
  skillSafetyStorePolicies: Record<string, SkillSafetyPolicyValue>;
}

export interface SkillSafetySourceContext {
  storeId: string;
  channel: SkillSafetyChannel;
}

export const BUILTIN_SKILL_SAFETY_STORES: ReadonlyArray<
  SkillSafetySourceContext & {
    labelKey: string;
    defaultLabel: string;
  }
> = [
  {
    storeId: "official",
    channel: "official",
    labelKey: "skill.officialStore",
    defaultLabel: "Official Store",
  },
  {
    storeId: "prompthub-cloud",
    channel: "official",
    labelKey: "skill.promptHubCloudStore",
    defaultLabel: "PromptHub Cloud",
  },
  {
    storeId: "community",
    channel: "community",
    labelKey: "skill.communityStore",
    defaultLabel: "skills.sh Community",
  },
  {
    storeId: "clawhub",
    channel: "community",
    labelKey: "skill.clawHubStore",
    defaultLabel: "ClawHub",
  },
  {
    storeId: "claude-code",
    channel: "git-repo",
    labelKey: "skill.claudeCodeStore",
    defaultLabel: "Claude Code",
  },
  {
    storeId: "openai-codex",
    channel: "git-repo",
    labelKey: "skill.openAiCodexStore",
    defaultLabel: "OpenAI Codex",
  },
];

const BUILTIN_CHANNEL_BY_STORE = new Map(
  BUILTIN_SKILL_SAFETY_STORES.map((store) => [store.storeId, store.channel]),
);

function normalizeSourceLocation(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\/+$/u, "");
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    url.username = "";
    url.password = "";
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/u, "");
  } catch {
    return trimmed;
  }
}

function getRegistrySourceLocations(skill: RegistrySkill): string[] {
  return [
    skill.source_label,
    skill.source_url,
    skill.content_url,
    skill.package_url,
  ]
    .map(normalizeSourceLocation)
    .filter((value): value is string => Boolean(value));
}

function findCustomStoreForRegistrySkill(
  skill: RegistrySkill,
  customStores: readonly SkillStoreSource[],
): SkillStoreSource | undefined {
  const locations = getRegistrySourceLocations(skill);
  return customStores.find((store) => {
    if (skill.source_label === store.id || skill.source_label === store.name) {
      return true;
    }
    const storeLocation = normalizeSourceLocation(store.url);
    if (!storeLocation) return false;
    return locations.some(
      (location) =>
        location === storeLocation || location.startsWith(`${storeLocation}/`),
    );
  });
}

function inferBuiltinStoreId(skill: RegistrySkill): string | undefined {
  const source = getRegistrySourceLocations(skill).join("\n").toLowerCase();
  if (skill.source_id?.startsWith("cloud:")) return "prompthub-cloud";
  if (source.includes("skills.sh")) return "community";
  if (source.includes("clawhub")) return "clawhub";
  if (source.includes("anthropics/skills")) return "claude-code";
  if (source.includes("openai/skills")) return "openai-codex";
  return undefined;
}

function inferRegistrySkillChannel(skill: RegistrySkill): SkillSafetyChannel {
  const locations = getRegistrySourceLocations(skill);
  if (
    locations.some(
      (location) =>
        location.startsWith("/") ||
        location.startsWith("~/") ||
        location.startsWith("file:") ||
        /^[a-z]:\\/iu.test(location),
    )
  ) {
    return "local-dir";
  }
  if (
    skill.source_branch ||
    skill.source_directory ||
    locations.some((location) =>
      /(?:^|[./])(git(?:hub|lab)?|gitea)(?:[./:]|$)/iu.test(location),
    )
  ) {
    return "git-repo";
  }
  return "community";
}

export function isSkillSafetyChannel(
  value: unknown,
): value is SkillSafetyChannel {
  return (
    typeof value === "string" &&
    SKILL_SAFETY_CHANNELS.includes(value as SkillSafetyChannel)
  );
}

export function isSkillSafetyPolicyValue(
  value: unknown,
): value is SkillSafetyPolicyValue {
  return value === "enabled" || value === "disabled";
}

export function normalizeSkillSafetyStoreId(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= 512 ? normalized : undefined;
}

export function getSkillSafetyChannelForStore(
  storeId: string,
  storeType?: SkillStoreSource["type"],
): SkillSafetyChannel {
  const builtin = BUILTIN_CHANNEL_BY_STORE.get(storeId);
  if (builtin) return builtin;
  if (
    storeType === "git-repo" ||
    storeType === "marketplace-json" ||
    storeType === "local-dir"
  ) {
    return storeType;
  }
  if (storeType === "official") return "official";
  return "community";
}

export function getRegistrySkillSafetySourceContext(
  skill: RegistrySkill,
  customStores: readonly SkillStoreSource[],
): SkillSafetySourceContext {
  const customStore = findCustomStoreForRegistrySkill(skill, customStores);
  if (customStore) {
    return {
      storeId: customStore.id,
      channel: getSkillSafetyChannelForStore(customStore.id, customStore.type),
    };
  }
  const builtinStoreId = inferBuiltinStoreId(skill);
  if (builtinStoreId) {
    return {
      storeId: builtinStoreId,
      channel: getSkillSafetyChannelForStore(builtinStoreId),
    };
  }
  return {
    storeId: skill.source_id || "unattributed",
    channel: inferRegistrySkillChannel(skill),
  };
}

export function resolveSkillSafetyScanMode(
  policy: SkillSafetyPolicyState,
  context: SkillSafetySourceContext,
): SkillSafetyScanMode {
  return (
    policy.skillSafetyStorePolicies?.[context.storeId] ??
    policy.skillSafetyChannelPolicies?.[context.channel] ??
    (policy.autoScanStoreSkillsBeforeInstall ? "enabled" : "disabled")
  );
}
