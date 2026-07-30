import type {
  AgentProviderComparableState,
  AgentProviderModelMapping,
  AgentProviderProfile,
  AgentProviderSnapshot,
  CreateAgentProviderSnapshotInput,
} from "@prompthub/shared";
import type { AgentProviderActivationRepository } from "@prompthub/core";
import { assertAgentProviderPublicConfig } from "@prompthub/shared/utils/agent-provider-config";

interface AgentProviderProfileStorage {
  getProfileById(id: string): AgentProviderProfile | null;
  listModelMappings(profileId: string): AgentProviderModelMapping[];
  getLatestVerifiedSnapshot(platformId: string): AgentProviderSnapshot | null;
  createSnapshot(
    input: CreateAgentProviderSnapshotInput,
  ): AgentProviderSnapshot;
}

function readBaseline(
  snapshot: AgentProviderSnapshot,
): AgentProviderComparableState {
  const redacted = snapshot.redactedSnapshot;
  const adapterVersion = redacted.adapterVersion;
  const values = redacted.values;
  let valuesValid = false;
  try {
    assertAgentProviderPublicConfig(values);
    valuesValid = true;
  } catch {
    valuesValid = false;
  }
  const valid =
    typeof adapterVersion === "string" &&
    adapterVersion.trim().length > 0 &&
    valuesValid;
  if (!valid) throw new Error("AGENT_PROVIDER_BASELINE_INVALID");
  return {
    platformId: snapshot.platformId,
    adapterVersion: adapterVersion.trim(),
    nativeDigest: snapshot.nativeDigest,
    values: structuredClone(values) as AgentProviderComparableState["values"],
  };
}

export function createAgentProviderActivationRepository(
  storage: AgentProviderProfileStorage,
): AgentProviderActivationRepository {
  return {
    getProfile: async (profileId) => storage.getProfileById(profileId),
    listModelMappings: async (profileId) =>
      storage.listModelMappings(profileId),
    getBaseline: async (platformId) => {
      const snapshot = storage.getLatestVerifiedSnapshot(platformId);
      return snapshot ? readBaseline(snapshot) : null;
    },
    recordSnapshot: async (input) => storage.createSnapshot(input),
  };
}
