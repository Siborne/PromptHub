import type {
  AgentProviderActivationExecutionResult,
  AgentProviderActivationPlan,
  AgentProviderAdapterContext,
  AgentProviderCurrentState,
  AgentProviderProfilePublic,
  AgentProviderSnapshot,
} from "@prompthub/shared";

export interface AgentProviderTrayProfile {
  id: string;
  name: string;
  model: string | null;
  isCurrent: boolean;
}

export interface AgentProviderTrayGroup {
  agentId: string;
  name: string;
  currentProfileId: string | null;
  profiles: AgentProviderTrayProfile[];
}

export interface AgentProviderTrayConfirmation {
  agentName: string;
  profileName: string;
  model: string | null;
  changedFields: number;
}

export type AgentProviderTraySwitchStatus =
  | "verified"
  | "cancelled"
  | "review-required"
  | "already-active"
  | "failed";

export interface AgentProviderTraySwitchResult {
  status: AgentProviderTraySwitchStatus;
  agentId: string;
  profileId: string;
}

interface AgentProviderTrayServiceOptions {
  activate(input: {
    context: AgentProviderAdapterContext;
    profileId: string;
    expectedCurrentDigest: string;
  }): Promise<AgentProviderActivationExecutionResult>;
  getLatestVerifiedSnapshot(platformId: string): AgentProviderSnapshot | null;
  listProfiles(): Promise<AgentProviderProfilePublic[]>;
  preview(input: {
    context: AgentProviderAdapterContext;
    profileId: string;
  }): Promise<AgentProviderActivationPlan>;
  resolveContext(agentId: string): AgentProviderAdapterContext;
  resolvePlatformName(platformId: string): string | null;
  supportedPlatformIds: readonly string[];
}

export interface AgentProviderTrayService {
  getCurrentState(agentId: string): Promise<AgentProviderCurrentState>;
  listGroups(): Promise<AgentProviderTrayGroup[]>;
  switchProfile(
    input: { agentId: string; profileId: string },
    confirm: (summary: AgentProviderTrayConfirmation) => Promise<boolean>,
  ): Promise<AgentProviderTraySwitchResult>;
}

function primaryModel(profile: AgentProviderProfilePublic): string | null {
  return (
    profile.modelMappings.find((mapping) => mapping.routeKey === "primary")
      ?.modelId ??
    profile.modelMappings[0]?.modelId ??
    null
  );
}

export function createAgentProviderTrayService(
  options: AgentProviderTrayServiceOptions,
): AgentProviderTrayService {
  const supported = new Set(options.supportedPlatformIds);

  const publicProfiles = async (): Promise<AgentProviderProfilePublic[]> =>
    (await options.listProfiles()).filter(
      (profile) => !profile.archived && supported.has(profile.platformId),
    );

  const resolveCurrentState = async (
    platformId: string,
    profiles: AgentProviderProfilePublic[],
  ): Promise<AgentProviderCurrentState> => {
    const checkedAt = Date.now();
    const latest = options.getLatestVerifiedSnapshot(platformId);
    if (!latest?.providerProfileId) {
      return {
        platformId,
        status: "none",
        currentProfileId: null,
        checkedAt,
      };
    }
    if (!profiles.some((profile) => profile.id === latest.providerProfileId)) {
      return {
        platformId,
        status: "stale",
        currentProfileId: null,
        checkedAt,
      };
    }
    try {
      const currentPlan = await options.preview({
        context: options.resolveContext(platformId),
        profileId: latest.providerProfileId,
      });
      const verified =
        currentPlan.platformId === platformId &&
        currentPlan.profileId === latest.providerProfileId &&
        currentPlan.currentDigest === latest.nativeDigest &&
        currentPlan.status === "preserve" &&
        !currentPlan.requiresReview;
      return {
        platformId,
        status: verified ? "verified" : "stale",
        currentProfileId: verified ? latest.providerProfileId : null,
        checkedAt,
      };
    } catch {
      return {
        platformId,
        status: "unavailable",
        currentProfileId: null,
        checkedAt,
      };
    }
  };

  const requireSupportedPlatform = (platformId: string): void => {
    if (
      !supported.has(platformId) ||
      !options.resolvePlatformName(platformId)
    ) {
      throw new Error("AGENT_PROVIDER_PLATFORM_UNSUPPORTED");
    }
  };

  const getCurrentState = async (
    platformId: string,
  ): Promise<AgentProviderCurrentState> => {
    requireSupportedPlatform(platformId);
    const profiles = (await publicProfiles()).filter(
      (profile) => profile.platformId === platformId,
    );
    return resolveCurrentState(platformId, profiles);
  };

  const listGroups = async (): Promise<AgentProviderTrayGroup[]> => {
    const profiles = await publicProfiles();
    const byPlatform = new Map<string, AgentProviderProfilePublic[]>();
    for (const profile of profiles) {
      const group = byPlatform.get(profile.platformId) ?? [];
      group.push(profile);
      byPlatform.set(profile.platformId, group);
    }

    const groups: AgentProviderTrayGroup[] = [];
    for (const platformId of options.supportedPlatformIds) {
      const platformProfiles = byPlatform.get(platformId);
      const name = options.resolvePlatformName(platformId);
      if (!platformProfiles?.length || !name) continue;
      const currentState = await resolveCurrentState(
        platformId,
        platformProfiles,
      );
      const currentProfileId = currentState.currentProfileId;
      groups.push({
        agentId: platformId,
        name,
        currentProfileId,
        profiles: platformProfiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          model: primaryModel(profile),
          isCurrent: profile.id === currentProfileId,
        })),
      });
    }
    return groups;
  };

  const result = (
    status: AgentProviderTraySwitchStatus,
    agentId: string,
    profileId: string,
  ): AgentProviderTraySwitchResult => ({ status, agentId, profileId });

  return {
    getCurrentState,
    listGroups,
    async switchProfile(input, confirm) {
      try {
        const groups = await listGroups();
        const group = groups.find(
          (candidate) => candidate.agentId === input.agentId,
        );
        const profile = group?.profiles.find(
          (candidate) => candidate.id === input.profileId,
        );
        if (!group || !profile) {
          return result("failed", input.agentId, input.profileId);
        }

        const context = options.resolveContext(input.agentId);
        const plan = await options.preview({
          context,
          profileId: profile.id,
        });
        if (plan.status === "preserve" && !plan.requiresReview) {
          return result("already-active", input.agentId, input.profileId);
        }
        if (!plan.canApply || plan.requiresReview || plan.status !== "apply") {
          return result("review-required", input.agentId, input.profileId);
        }

        const accepted = await confirm({
          agentName: group.name,
          profileName: profile.name,
          model: profile.model,
          changedFields: plan.decisions.filter(
            (decision) => decision.status === "apply",
          ).length,
        });
        if (!accepted) {
          return result("cancelled", input.agentId, input.profileId);
        }

        const activation = await options.activate({
          context,
          profileId: profile.id,
          expectedCurrentDigest: plan.currentDigest,
        });
        return result(
          activation.status === "verified" ? "verified" : "failed",
          input.agentId,
          input.profileId,
        );
      } catch {
        return result("failed", input.agentId, input.profileId);
      }
    },
  };
}
