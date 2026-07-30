import type {
  AgentProviderMigrationCandidate,
  AgentProviderMigrationCredentialSource,
  AgentProviderMigrationPreview,
  AgentProviderMigrationRequest,
  AgentProviderMigrationResult,
  AgentProviderProfilePublic,
  CreateAgentProviderProfileRequest,
} from "@prompthub/shared";

import type { AgentSecretStore } from "./agent-secret-store";

export interface AgentCodexProviderMigrationSource {
  providerId: string;
  name: string;
  baseUrl: string;
  wireApi: "chat" | "responses";
  envKey: string | null;
  credentialSource: AgentProviderMigrationCredentialSource;
  /** Main-process-only migration material. Never return this object over IPC. */
  credential: string | null;
  isActive: boolean;
  profileModel: string | null;
}

export interface AgentCodexProviderMigrationInspection {
  nativeDigest: string;
  defaultModel: string | null;
  sources: AgentCodexProviderMigrationSource[];
}

export interface AgentCodexProviderMigrationSourceReader {
  inspect(agentId: string): Promise<AgentCodexProviderMigrationInspection>;
}

export interface AgentCodexProviderMigrationProfileService {
  list(options: {
    platformId: string;
    includeArchived?: boolean;
  }): Promise<AgentProviderProfilePublic[]>;
  create(
    request: CreateAgentProviderProfileRequest,
  ): Promise<AgentProviderProfilePublic>;
  delete(id: string): Promise<void>;
}

interface MigrationOptions {
  sourceReader: AgentCodexProviderMigrationSourceReader;
  profiles: AgentCodexProviderMigrationProfileService;
  secrets: AgentSecretStore;
}

interface MigrationState {
  inspection: AgentCodexProviderMigrationInspection;
  profileByProviderId: Map<string, AgentProviderProfilePublic>;
}

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-_]*$/;
const MAX_PROVIDER_COUNT = 256;

function legacySecretRef(providerId: string): string {
  return `codex-provider:${providerId}`;
}

function migratedProviderId(
  profile: AgentProviderProfilePublic,
): string | null {
  const value = profile.config.legacyProviderId;
  return typeof value === "string" && PROVIDER_ID_PATTERN.test(value)
    ? value
    : null;
}

function publicCandidate(
  source: AgentCodexProviderMigrationSource,
  migrated: boolean,
): AgentProviderMigrationCandidate {
  return {
    providerId: source.providerId,
    name: source.name,
    baseUrl: source.baseUrl,
    wireApi: source.wireApi,
    envKey: source.envKey,
    credentialSource: source.credentialSource,
    credentialReady:
      source.credentialSource === "environment"
        ? Boolean(source.envKey)
        : Boolean(source.credential),
    isActive: source.isActive,
    profileModel: source.profileModel,
    alreadyMigrated: migrated,
  };
}

function validateInspection(
  inspection: AgentCodexProviderMigrationInspection,
): void {
  if (
    !inspection ||
    typeof inspection.nativeDigest !== "string" ||
    !inspection.nativeDigest ||
    !Array.isArray(inspection.sources) ||
    inspection.sources.length > MAX_PROVIDER_COUNT
  ) {
    throw new Error("AGENT_PROVIDER_MIGRATION_SOURCE_INVALID");
  }
  const ids = new Set<string>();
  for (const source of inspection.sources) {
    const valid =
      source &&
      PROVIDER_ID_PATTERN.test(source.providerId) &&
      !ids.has(source.providerId) &&
      typeof source.name === "string" &&
      source.name.trim().length > 0 &&
      typeof source.baseUrl === "string" &&
      (source.wireApi === "chat" || source.wireApi === "responses") &&
      (source.envKey === null || typeof source.envKey === "string") &&
      ["legacy-managed", "environment", "native-inline", "none"].includes(
        source.credentialSource,
      ) &&
      (source.credential === null || typeof source.credential === "string") &&
      typeof source.isActive === "boolean" &&
      (source.profileModel === null || typeof source.profileModel === "string");
    if (!valid) throw new Error("AGENT_PROVIDER_MIGRATION_SOURCE_INVALID");
    ids.add(source.providerId);
  }
}

function validateRequest(request: AgentProviderMigrationRequest): string[] {
  if (request.agentId !== "codex") {
    throw new Error("AGENT_PROVIDER_MIGRATION_UNSUPPORTED");
  }
  if (
    typeof request.expectedNativeDigest !== "string" ||
    !request.expectedNativeDigest ||
    !Array.isArray(request.providerIds) ||
    request.providerIds.length === 0 ||
    request.providerIds.length > MAX_PROVIDER_COUNT
  ) {
    throw new Error("AGENT_PROVIDER_MIGRATION_INPUT_INVALID");
  }
  const providerIds = request.providerIds.map((providerId) =>
    typeof providerId === "string" ? providerId.trim() : "",
  );
  if (
    providerIds.some((providerId) => !PROVIDER_ID_PATTERN.test(providerId)) ||
    new Set(providerIds).size !== providerIds.length
  ) {
    throw new Error("AGENT_PROVIDER_MIGRATION_INPUT_INVALID");
  }
  return providerIds;
}

function createRequest(
  source: AgentCodexProviderMigrationSource,
  defaultModel: string | null,
): CreateAgentProviderProfileRequest {
  const model = source.profileModel || defaultModel;
  const shouldCopyCredential =
    source.credentialSource === "legacy-managed" ||
    source.credentialSource === "native-inline";
  return {
    profile: {
      platformId: "codex",
      name: source.name,
      providerKind: "openai-compatible",
      protocol: source.wireApi,
      endpoint: source.baseUrl || null,
      config: {
        legacyProviderId: source.providerId,
        envKey: source.envKey,
      },
      source: "native-import",
    },
    modelMappings: model
      ? [{ routeKey: "primary", modelId: model, parameters: {} }]
      : [],
    secret: shouldCopyCredential ? source.credential : null,
  };
}

function profileMap(
  profiles: AgentProviderProfilePublic[],
): Map<string, AgentProviderProfilePublic> {
  const result = new Map<string, AgentProviderProfilePublic>();
  for (const profile of profiles) {
    if (profile.platformId !== "codex" || profile.archived) continue;
    const providerId = migratedProviderId(profile);
    if (providerId && !result.has(providerId)) result.set(providerId, profile);
  }
  return result;
}

export function createAgentCodexProviderMigrationService(
  options: MigrationOptions,
) {
  let running = false;

  async function readState(): Promise<MigrationState> {
    const [inspection, profiles] = await Promise.all([
      options.sourceReader.inspect("codex"),
      options.profiles.list({ platformId: "codex", includeArchived: true }),
    ]);
    validateInspection(inspection);
    return { inspection, profileByProviderId: profileMap(profiles) };
  }

  async function preview(
    agentId: string,
  ): Promise<AgentProviderMigrationPreview> {
    if (agentId !== "codex") {
      throw new Error("AGENT_PROVIDER_MIGRATION_UNSUPPORTED");
    }
    const state = await readState();
    return {
      agentId: "codex",
      nativeDigest: state.inspection.nativeDigest,
      candidates: state.inspection.sources.map((source) =>
        publicCandidate(
          source,
          state.profileByProviderId.has(source.providerId),
        ),
      ),
    };
  }

  async function compensate(
    created: AgentProviderProfilePublic[],
    cleared: AgentCodexProviderMigrationSource[],
  ): Promise<void> {
    const restored = await Promise.allSettled(
      cleared.map((source) =>
        options.secrets.write(
          legacySecretRef(source.providerId),
          source.credential!,
        ),
      ),
    );
    const deleted = await Promise.allSettled(
      [...created]
        .reverse()
        .map((profile) => options.profiles.delete(profile.id)),
    );
    if (
      [...restored, ...deleted].some((result) => result.status === "rejected")
    ) {
      throw new Error("AGENT_PROVIDER_MIGRATION_ROLLBACK_FAILED");
    }
  }

  async function migrate(
    request: AgentProviderMigrationRequest,
  ): Promise<AgentProviderMigrationResult> {
    const providerIds = validateRequest(request);
    if (running) throw new Error("AGENT_PROVIDER_MIGRATION_BUSY");
    running = true;
    const created: AgentProviderProfilePublic[] = [];
    const cleared: AgentCodexProviderMigrationSource[] = [];
    try {
      const state = await readState();
      if (state.inspection.nativeDigest !== request.expectedNativeDigest) {
        throw new Error("AGENT_PROVIDER_MIGRATION_STALE");
      }
      const sourceById = new Map(
        state.inspection.sources.map((source) => [source.providerId, source]),
      );
      const result: AgentProviderProfilePublic[] = [];
      for (const providerId of providerIds) {
        const existing = state.profileByProviderId.get(providerId);
        if (existing) {
          result.push(existing);
          continue;
        }
        const source = sourceById.get(providerId);
        if (!source) throw new Error("AGENT_PROVIDER_MIGRATION_SOURCE_MISSING");
        const createdProfile = await options.profiles.create(
          createRequest(source, state.inspection.defaultModel),
        );
        created.push(createdProfile);
        const expectsSecret =
          source.credentialSource === "legacy-managed" ||
          source.credentialSource === "native-inline";
        if (
          createdProfile.platformId !== "codex" ||
          migratedProviderId(createdProfile) !== providerId ||
          (expectsSecret && createdProfile.secretState !== "available")
        ) {
          throw new Error("AGENT_PROVIDER_MIGRATION_VERIFY_FAILED");
        }
        result.push(createdProfile);
      }
      for (const providerId of providerIds) {
        if (state.profileByProviderId.has(providerId)) continue;
        const source = sourceById.get(providerId)!;
        if (source.credentialSource === "legacy-managed" && source.credential) {
          await options.secrets.clear(legacySecretRef(providerId));
          cleared.push(source);
        }
      }
      return { profiles: result };
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "AGENT_PROVIDER_MIGRATION_STALE",
          "AGENT_PROVIDER_MIGRATION_SOURCE_MISSING",
        ].includes(error.message) &&
        created.length === 0
      ) {
        throw error;
      }
      try {
        await compensate(created, cleared);
      } catch {
        throw new Error("AGENT_PROVIDER_MIGRATION_ROLLBACK_FAILED");
      }
      throw new Error("AGENT_PROVIDER_MIGRATION_FAILED");
    } finally {
      running = false;
    }
  }

  return { preview, migrate };
}
