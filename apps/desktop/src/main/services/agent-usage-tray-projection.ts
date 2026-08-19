import type {
  AgentUsageQueryOptions,
  AgentUsageQuota,
} from "@prompthub/shared/types";
import { getAgentPlatformCapabilityInventory } from "@prompthub/shared/constants/agent-platform-capabilities";
import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";

const PREFERRED_USAGE_ORDER = [
  "claude",
  "codex",
  "kimi",
  "antigravity",
  "gemini",
  "copilot",
] as const;

const verifiedUsagePlatforms = SKILL_PLATFORMS.filter(
  (platform) =>
    getAgentPlatformCapabilityInventory(platform).usage.status === "supported",
);
const verifiedById = new Map(
  verifiedUsagePlatforms.map((platform) => [platform.id, platform]),
);
const preferredIds = new Set<string>(PREFERRED_USAGE_ORDER);

export const AGENT_USAGE_TRAY_AGENTS = [
  ...PREFERRED_USAGE_ORDER.map((id) => verifiedById.get(id)).filter(
    (platform) => platform !== undefined,
  ),
  ...verifiedUsagePlatforms.filter(
    (platform) => !preferredIds.has(platform.id),
  ),
].map(({ id, name }) => ({ id, name }));

export interface AgentUsageTrayEntry {
  id: string;
  name: string;
  quota: AgentUsageQuota | null;
  isLoading: boolean;
  isStale: boolean;
}

interface AgentUsageTrayProjectionOptions {
  getUsage: (
    agentId: string,
    options?: AgentUsageQueryOptions,
  ) => Promise<AgentUsageQuota>;
  onChange?: () => void;
  now?: () => number;
}

interface AgentUsageTrayRefreshOptions {
  forceRefresh?: boolean;
}

export interface AgentUsageTrayProjection {
  destroy: () => void;
  getSnapshot: () => AgentUsageTrayEntry[];
  refresh: (options?: AgentUsageTrayRefreshOptions) => Promise<void>;
}

function createInitialEntries(): AgentUsageTrayEntry[] {
  return AGENT_USAGE_TRAY_AGENTS.map((agent) => ({
    ...agent,
    quota: null,
    isLoading: true,
    isStale: false,
  }));
}

function unavailableQuota(
  agentId: string,
  errorCode: string,
  now: () => number,
): AgentUsageQuota {
  return {
    schemaVersion: 2,
    agentId,
    adapter: "native-tray-projection",
    status: "unavailable",
    source: "provider",
    plan: null,
    fetchedAt: now(),
    errorCode,
    metrics: [],
  };
}

export function createAgentUsageTrayProjection(
  options: AgentUsageTrayProjectionOptions,
): AgentUsageTrayProjection {
  const now = options.now ?? Date.now;
  let entries = createInitialEntries();
  let destroyed = false;
  let generation = 0;
  let inFlight: Promise<void> | null = null;

  const getSnapshot = () => entries.map((entry) => ({ ...entry }));

  const publish = (
    index: number,
    quota: AgentUsageQuota,
    loadGeneration: number,
  ) => {
    if (destroyed || generation !== loadGeneration) return;
    const previous = entries[index];
    const preserveSuccessful =
      quota.status === "unavailable" && previous.quota?.status === "ok";
    entries[index] = {
      ...previous,
      quota: preserveSuccessful ? previous.quota : quota,
      isLoading: false,
      isStale: preserveSuccessful,
    };
    try {
      options.onChange?.();
    } catch {
      // A native-menu rebuild failure must not abort the remaining providers.
    }
  };

  const refresh = (
    refreshOptions: AgentUsageTrayRefreshOptions = {},
  ): Promise<void> => {
    if (destroyed) return Promise.resolve();
    if (inFlight) return inFlight;
    const loadGeneration = generation;
    const forceRefresh = refreshOptions.forceRefresh === true;
    let nextIndex = 0;

    const worker = async () => {
      while (
        !destroyed &&
        generation === loadGeneration &&
        nextIndex < AGENT_USAGE_TRAY_AGENTS.length
      ) {
        const index = nextIndex++;
        const agent = AGENT_USAGE_TRAY_AGENTS[index];
        let quota: AgentUsageQuota;
        try {
          const result = await options.getUsage(agent.id, { forceRefresh });
          quota =
            result.agentId === agent.id
              ? result
              : unavailableQuota(agent.id, "identity-mismatch", now);
        } catch {
          quota = unavailableQuota(agent.id, "internal-error", now);
        }
        publish(index, quota, loadGeneration);
      }
    };

    const pending = Promise.all([worker(), worker()]).then(() => undefined);
    let tracked: Promise<void>;
    tracked = pending.finally(() => {
      if (inFlight === tracked) inFlight = null;
    });
    inFlight = tracked;
    return tracked;
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    entries = createInitialEntries();
    inFlight = null;
  };

  return { destroy, getSnapshot, refresh };
}
