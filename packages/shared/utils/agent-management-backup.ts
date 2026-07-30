import type {
  AgentManagementBackup,
  AgentManagementBackupProfile,
  AgentManagementBackupSessionSourcePreference,
  AgentManagementBackupSnapshot,
  AgentProviderProfileSource,
  AgentProviderSnapshotOperation,
  AgentProviderSnapshotResult,
  CreateAgentProviderModelMappingInput,
  CreateAgentProviderProfileInput,
} from "@prompthub/shared/types/agent";
import {
  assertAgentProviderPublicConfig,
  normalizeAgentProviderEndpoint,
} from "@prompthub/shared/utils/agent-provider-config";

const MAX_PROFILES = 1_000;
const MAX_MAPPINGS_PER_PROFILE = 100;
const MAX_SNAPSHOTS = 5_000;
const MAX_SESSION_SOURCE_PREFERENCES = 128;
const MAX_ID_LENGTH = 128;
const MAX_TEXT_LENGTH = 512;
const MAX_DIGEST_LENGTH = 512;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const PROFILE_SOURCES = new Set<AgentProviderProfileSource>([
  "manual",
  "native-import",
  "universal",
  "import",
]);
const SNAPSHOT_OPERATIONS = new Set<AgentProviderSnapshotOperation>([
  "import",
  "activate",
  "backfill",
  "restore",
]);
const SNAPSHOT_RESULTS = new Set<AgentProviderSnapshotResult>([
  "planned",
  "applied",
  "verified",
  "rolled-back",
  "failed",
]);

function invalid(): never {
  throw new Error("AGENT_MANAGEMENT_BACKUP_INVALID");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key));
}

function requiredText(value: unknown, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") invalid();
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid();
  return normalized;
}

function requiredId(value: unknown): string {
  const id = requiredText(value, MAX_ID_LENGTH);
  if (!ID_PATTERN.test(id)) invalid();
  return id;
}

function timestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    invalid();
  }
  return value;
}

function publicObject(value: unknown): Record<string, unknown> {
  try {
    assertAgentProviderPublicConfig(value);
  } catch {
    invalid();
  }
  return value;
}

function parseProfileInput(
  value: unknown,
): Omit<CreateAgentProviderProfileInput, "secretRef"> {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "platformId",
      "name",
      "providerKind",
      "protocol",
      "endpoint",
      "config",
      "source",
    ])
  ) {
    invalid();
  }
  const source = value.source as AgentProviderProfileSource;
  if (!PROFILE_SOURCES.has(source)) invalid();
  let endpoint: string | null;
  try {
    endpoint = normalizeAgentProviderEndpoint(
      value.endpoint as string | null | undefined,
    );
  } catch {
    invalid();
  }
  return {
    platformId: requiredText(value.platformId, MAX_ID_LENGTH),
    name: requiredText(value.name),
    providerKind: requiredText(value.providerKind, MAX_ID_LENGTH),
    protocol: requiredText(value.protocol, MAX_ID_LENGTH),
    endpoint,
    config: publicObject(value.config),
    source,
  };
}

function parseMapping(value: unknown): CreateAgentProviderModelMappingInput {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["routeKey", "modelId", "parameters"])
  ) {
    invalid();
  }
  return {
    routeKey: requiredText(value.routeKey, MAX_ID_LENGTH),
    modelId: requiredText(value.modelId),
    parameters: publicObject(value.parameters),
  };
}

function parseBackupProfile(value: unknown): AgentManagementBackupProfile {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "profile",
      "modelMappings",
      "requiresSecret",
      "archived",
      "createdAt",
      "updatedAt",
    ]) ||
    !Array.isArray(value.modelMappings) ||
    value.modelMappings.length > MAX_MAPPINGS_PER_PROFILE ||
    typeof value.requiresSecret !== "boolean" ||
    typeof value.archived !== "boolean"
  ) {
    invalid();
  }
  const mappings = value.modelMappings.map(parseMapping);
  if (
    new Set(mappings.map((mapping) => mapping.routeKey)).size !==
    mappings.length
  ) {
    invalid();
  }
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  if (updatedAt < createdAt) invalid();
  return {
    id: requiredId(value.id),
    profile: parseProfileInput(value.profile),
    modelMappings: mappings,
    requiresSecret: value.requiresSecret,
    archived: value.archived,
    createdAt,
    updatedAt,
  };
}

function parseSnapshot(value: unknown): AgentManagementBackupSnapshot {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "platformId",
      "providerProfileId",
      "nativeDigest",
      "redactedSnapshot",
      "operation",
      "result",
      "createdAt",
    ])
  ) {
    invalid();
  }
  const operation = value.operation as AgentProviderSnapshotOperation;
  const result = value.result as AgentProviderSnapshotResult;
  if (
    !SNAPSHOT_OPERATIONS.has(operation) ||
    !SNAPSHOT_RESULTS.has(result) ||
    (value.providerProfileId !== null &&
      typeof value.providerProfileId !== "string")
  ) {
    invalid();
  }
  return {
    id: requiredId(value.id),
    platformId: requiredText(value.platformId, MAX_ID_LENGTH),
    providerProfileId:
      value.providerProfileId === null
        ? null
        : requiredId(value.providerProfileId),
    nativeDigest: requiredText(value.nativeDigest, MAX_DIGEST_LENGTH),
    redactedSnapshot: publicObject(value.redactedSnapshot),
    operation,
    result,
    createdAt: timestamp(value.createdAt),
  };
}

function parseSessionSourcePreference(
  value: unknown,
): AgentManagementBackupSessionSourcePreference {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["platformId", "adapterId", "enabled"]) ||
    typeof value.enabled !== "boolean"
  ) {
    invalid();
  }
  return {
    platformId: requiredId(value.platformId),
    adapterId: requiredId(value.adapterId),
    enabled: value.enabled,
  };
}

function parseSessionSourcePreferences(
  value: unknown,
): AgentManagementBackupSessionSourcePreference[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_SESSION_SOURCE_PREFERENCES) {
    invalid();
  }
  const preferences = value.map(parseSessionSourcePreference);
  if (
    new Set(preferences.map((preference) => preference.platformId)).size !==
    preferences.length
  ) {
    invalid();
  }
  return preferences;
}

function assertUniqueProfiles(profiles: AgentManagementBackupProfile[]): void {
  const ids = new Set<string>();
  const activeNames = new Set<string>();
  for (const item of profiles) {
    if (ids.has(item.id)) invalid();
    ids.add(item.id);
    if (item.archived) continue;
    const nameKey = `${item.profile.platformId}\0${item.profile.name.toLocaleLowerCase()}`;
    if (activeNames.has(nameKey)) invalid();
    activeNames.add(nameKey);
  }
}

function assertSnapshots(
  snapshots: AgentManagementBackupSnapshot[],
  profileIds: Set<string>,
): void {
  const snapshotIds = new Set<string>();
  for (const snapshot of snapshots) {
    if (
      snapshotIds.has(snapshot.id) ||
      (snapshot.providerProfileId !== null &&
        !profileIds.has(snapshot.providerProfileId))
    ) {
      invalid();
    }
    snapshotIds.add(snapshot.id);
  }
}

export function parseAgentManagementBackup(
  value: unknown,
): AgentManagementBackup {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "version",
      "providerProfiles",
      "snapshots",
      "sessionSourcePreferences",
    ]) ||
    value.version !== 1 ||
    !Array.isArray(value.providerProfiles) ||
    value.providerProfiles.length > MAX_PROFILES ||
    !Array.isArray(value.snapshots) ||
    value.snapshots.length > MAX_SNAPSHOTS
  ) {
    invalid();
  }
  const providerProfiles = value.providerProfiles.map(parseBackupProfile);
  const snapshots = value.snapshots.map(parseSnapshot);
  const sessionSourcePreferences = parseSessionSourcePreferences(
    value.sessionSourcePreferences,
  );
  assertUniqueProfiles(providerProfiles);
  const profileIds = new Set(providerProfiles.map((profile) => profile.id));
  assertSnapshots(snapshots, profileIds);
  return {
    version: 1,
    providerProfiles,
    snapshots,
    ...(sessionSourcePreferences === undefined
      ? {}
      : { sessionSourcePreferences }),
  };
}
