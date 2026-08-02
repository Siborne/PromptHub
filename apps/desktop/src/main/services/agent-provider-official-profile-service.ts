import type {
  AgentProviderAdapterContext,
  AgentProviderImportPreview,
  AgentProviderProfilePublic,
  CreateAgentProviderProfileRequest,
} from "@prompthub/shared";

interface OfficialProfileServiceOptions {
  createProfile(
    request: CreateAgentProviderProfileRequest,
  ): Promise<AgentProviderProfilePublic>;
  importCurrent(input: {
    context: AgentProviderAdapterContext;
  }): Promise<AgentProviderImportPreview>;
  listProfiles(options: {
    platformId: string;
  }): Promise<AgentProviderProfilePublic[]>;
  resolveContext(platformId: string): AgentProviderAdapterContext;
}

interface OfficialPreset {
  name: string;
  providerKind: string;
  protocol: "platform-native";
  config: Record<string, unknown>;
}

const PLATFORM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const OFFICIAL_PRESETS: Record<string, OfficialPreset> = {
  claude: {
    name: "Anthropic Official",
    providerKind: "anthropic",
    protocol: "platform-native",
    config: {},
  },
  codex: {
    name: "OpenAI Official",
    providerKind: "openai",
    protocol: "platform-native",
    config: { providerId: "openai" },
  },
};

function requirePlatformId(value: unknown): string {
  if (typeof value !== "string" || !PLATFORM_ID.test(value.trim())) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return value.trim();
}

function primaryModel(preview: AgentProviderImportPreview): string {
  const model = preview.modelMappings
    .find((mapping) => mapping.routeKey === "primary")
    ?.modelId.trim();
  if (!model) throw new Error("AGENT_PROVIDER_OFFICIAL_MODEL_REQUIRED");
  return model;
}

function sameConfig(
  profile: AgentProviderProfilePublic,
  preset: OfficialPreset,
  model: string,
): boolean {
  const mapping = profile.modelMappings.find(
    (candidate) => candidate.routeKey === "primary",
  );
  return (
    !profile.archived &&
    profile.providerKind === preset.providerKind &&
    profile.protocol === preset.protocol &&
    profile.endpoint === null &&
    JSON.stringify(profile.config) === JSON.stringify(preset.config) &&
    mapping?.modelId === model
  );
}

function uniqueName(
  base: string,
  profiles: AgentProviderProfilePublic[],
): string {
  const names = new Set(profiles.map((profile) => profile.name));
  if (!names.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
  throw new Error("AGENT_PROVIDER_PROFILE_NAME_UNAVAILABLE");
}

export function createAgentProviderOfficialProfileService(
  options: OfficialProfileServiceOptions,
) {
  async function ensure(
    requestedPlatformId: string,
  ): Promise<AgentProviderProfilePublic> {
    const platformId = requirePlatformId(requestedPlatformId);
    const preset = OFFICIAL_PRESETS[platformId];
    if (!preset) {
      throw new Error("AGENT_PROVIDER_OFFICIAL_RESTORE_UNSUPPORTED");
    }
    const preview = await options.importCurrent({
      context: options.resolveContext(platformId),
    });
    const model = primaryModel(preview);
    const profiles = await options.listProfiles({ platformId });
    const existing = profiles.find((profile) =>
      sameConfig(profile, preset, model),
    );
    if (existing) return existing;
    return options.createProfile({
      profile: {
        platformId,
        name: uniqueName(preset.name, profiles),
        providerKind: preset.providerKind,
        protocol: preset.protocol,
        endpoint: null,
        config: preset.config,
        source: "manual",
      },
      modelMappings: [{ routeKey: "primary", modelId: model, parameters: {} }],
    });
  }

  return { ensure };
}
