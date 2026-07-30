import type {
  AgentManagementBackup,
  AgentManagementBackupRestoreResult,
  AgentManagementBackupSessionSourcePreference,
  AgentProviderModelMapping,
  AgentProviderProfile,
  AgentProviderSnapshot,
} from "@prompthub/shared";
import { parseAgentManagementBackup } from "@prompthub/shared/utils/agent-management-backup";

interface AgentManagementBackupStorage {
  listProfiles(options: { includeArchived: boolean }): AgentProviderProfile[];
  listModelMappingsForProfiles(
    profileIds: string[],
  ): AgentProviderModelMapping[];
  listSnapshotsForBackup(limit?: number): AgentProviderSnapshot[];
  replacePortableBackup(backup: AgentManagementBackup): void;
}

interface AgentManagementBackupSecretStore {
  hasMany(refs: string[]): Promise<Set<string>>;
}

interface AgentManagementBackupSessionStorage {
  listSourcesForBackup(): Array<{
    platformId: string;
    rootPath: string;
    adapterId: string;
    enabled: boolean;
  }>;
  registerSource(input: {
    platformId: string;
    rootPath: string;
    adapterId: string;
    adapterVersion: string;
    enabled: boolean;
  }): unknown;
}

interface AgentSessionSourceDescriptor {
  platformId: string;
  rootPath: string;
  adapterId: string;
  adapterVersion: string;
}

interface CreateAgentManagementBackupServiceOptions {
  profiles: AgentManagementBackupStorage;
  secrets: AgentManagementBackupSecretStore;
  sessions: AgentManagementBackupSessionStorage;
  resolveSessionSource(platformId: string): AgentSessionSourceDescriptor | null;
  transaction<T>(operation: () => T): T;
}

function groupMappings(
  mappings: AgentProviderModelMapping[],
): Map<string, AgentProviderModelMapping[]> {
  const groups = new Map<string, AgentProviderModelMapping[]>();
  for (const mapping of mappings) {
    const group = groups.get(mapping.providerProfileId) ?? [];
    group.push(mapping);
    groups.set(mapping.providerProfileId, group);
  }
  return groups;
}

function secretRef(profileId: string): string {
  return `agent-provider:${profileId}`;
}

function resolveSessionSource(
  options: CreateAgentManagementBackupServiceOptions,
  platformId: string,
): AgentSessionSourceDescriptor | null {
  try {
    return options.resolveSessionSource(platformId);
  } catch {
    return null;
  }
}

function portableSessionPreferences(
  options: CreateAgentManagementBackupServiceOptions,
): AgentManagementBackupSessionSourcePreference[] {
  const preferences: AgentManagementBackupSessionSourcePreference[] = [];
  const seen = new Set<string>();
  for (const source of options.sessions.listSourcesForBackup()) {
    if (seen.has(source.platformId)) continue;
    const descriptor = resolveSessionSource(options, source.platformId);
    if (!descriptor) continue;
    seen.add(source.platformId);
    preferences.push({
      platformId: descriptor.platformId,
      adapterId: descriptor.adapterId,
      enabled: source.enabled,
    });
  }
  return preferences;
}

function resolvePortableSessionPreferences(
  options: CreateAgentManagementBackupServiceOptions,
  preferences: AgentManagementBackupSessionSourcePreference[] | undefined,
): {
  resolved: Array<AgentSessionSourceDescriptor & { enabled: boolean }>;
  unresolvedKeys: string[];
} {
  const resolved: Array<AgentSessionSourceDescriptor & { enabled: boolean }> =
    [];
  const unresolvedKeys: string[] = [];
  for (const preference of preferences ?? []) {
    const descriptor = resolveSessionSource(options, preference.platformId);
    if (!descriptor) {
      unresolvedKeys.push(`${preference.platformId}:${preference.adapterId}`);
      continue;
    }
    resolved.push({ ...descriptor, enabled: preference.enabled });
  }
  return { resolved, unresolvedKeys };
}

export function createAgentManagementBackupService(
  options: CreateAgentManagementBackupServiceOptions,
) {
  async function exportBackup(): Promise<AgentManagementBackup> {
    const profiles = options.profiles.listProfiles({
      includeArchived: true,
    });
    const mappings = groupMappings(
      options.profiles.listModelMappingsForProfiles(
        profiles.map((profile) => profile.id),
      ),
    );
    return parseAgentManagementBackup({
      version: 1,
      providerProfiles: profiles.map((profile) => ({
        id: profile.id,
        profile: {
          platformId: profile.platformId,
          name: profile.name,
          providerKind: profile.providerKind,
          protocol: profile.protocol,
          endpoint: profile.endpoint,
          config: profile.config,
          source: profile.source,
        },
        modelMappings: (mappings.get(profile.id) ?? []).map(
          ({ routeKey, modelId, parameters }) => ({
            routeKey,
            modelId,
            parameters,
          }),
        ),
        requiresSecret: Boolean(profile.secretRef),
        archived: profile.archived,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })),
      snapshots: options.profiles
        .listSnapshotsForBackup()
        .map(
          ({
            id,
            platformId,
            providerProfileId,
            nativeDigest,
            redactedSnapshot,
            operation,
            result,
            createdAt,
          }) => ({
            id,
            platformId,
            providerProfileId,
            nativeDigest,
            redactedSnapshot,
            operation,
            result,
            createdAt,
          }),
        ),
      sessionSourcePreferences: portableSessionPreferences(options),
    });
  }

  async function restoreBackup(
    input: AgentManagementBackup,
  ): Promise<AgentManagementBackupRestoreResult> {
    const backup = parseAgentManagementBackup(input);
    const secretProfiles = backup.providerProfiles.filter(
      (profile) => profile.requiresSecret,
    );
    const presentRefs = await options.secrets.hasMany(
      secretProfiles.map((profile) => secretRef(profile.id)),
    );
    const sessionPreferences = resolvePortableSessionPreferences(
      options,
      backup.sessionSourcePreferences,
    );
    options.transaction(() => {
      options.profiles.replacePortableBackup(backup);
      for (const preference of sessionPreferences.resolved) {
        options.sessions.registerSource(preference);
      }
    });
    const availableSecretProfileIds: string[] = [];
    const missingSecretProfileIds: string[] = [];
    for (const profile of secretProfiles) {
      (presentRefs.has(secretRef(profile.id))
        ? availableSecretProfileIds
        : missingSecretProfileIds
      ).push(profile.id);
    }
    return {
      profileCount: backup.providerProfiles.length,
      snapshotCount: backup.snapshots.length,
      availableSecretProfileIds,
      missingSecretProfileIds,
      restoredSessionPreferenceCount: sessionPreferences.resolved.length,
      unresolvedSessionPreferenceKeys: sessionPreferences.unresolvedKeys,
    };
  }

  return { exportBackup, restoreBackup };
}

export type AgentManagementBackupService = ReturnType<
  typeof createAgentManagementBackupService
>;
