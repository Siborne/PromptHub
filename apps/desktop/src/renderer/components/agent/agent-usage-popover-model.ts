import type {
  AgentUsageQueryOptions,
  AgentUsageQuota,
} from "@prompthub/shared/types";

export const AGENT_USAGE_POPOVER_AGENTS = [
  { id: "claude", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "kimi", name: "Kimi Code" },
  { id: "antigravity", name: "Antigravity" },
  { id: "gemini", name: "Gemini" },
  { id: "copilot", name: "GitHub Copilot" },
] as const;

export type AgentUsagePopoverAgent =
  (typeof AGENT_USAGE_POPOVER_AGENTS)[number];

interface LoadAgentUsageBatchOptions {
  forceRefresh?: boolean;
  getUsage: (
    agentId: string,
    options?: AgentUsageQueryOptions,
  ) => Promise<AgentUsageQuota>;
  onItem?: (quota: AgentUsageQuota) => void;
}

function unavailableQuota(agentId: string): AgentUsageQuota {
  return {
    agentId,
    adapter: "popover-projection",
    status: "unavailable",
    source: "provider",
    plan: null,
    fetchedAt: Date.now(),
    errorCode: "internal-error",
    metrics: [],
  };
}

export async function loadAgentUsageBatch({
  forceRefresh = false,
  getUsage,
  onItem,
}: LoadAgentUsageBatchOptions): Promise<AgentUsageQuota[]> {
  const results = new Array<AgentUsageQuota>(AGENT_USAGE_POPOVER_AGENTS.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < AGENT_USAGE_POPOVER_AGENTS.length) {
      const index = nextIndex++;
      const agent = AGENT_USAGE_POPOVER_AGENTS[index];
      let quota: AgentUsageQuota;
      try {
        quota = await getUsage(agent.id, { forceRefresh });
      } catch {
        quota = unavailableQuota(agent.id);
      }
      results[index] = quota;
      onItem?.(quota);
    }
  };
  await Promise.all([worker(), worker()]);
  return results;
}

export function getRemainingPercent(utilization: number): number {
  if (!Number.isFinite(utilization)) return 0;
  return Math.max(0, Math.min(100, 100 - Math.round(utilization)));
}

export function formatAgentUsagePlan(plan: string): string {
  const trimmed = plan.trim();
  const normalized = trimmed.replace(/^level[_\s-]+/i, "");
  if (!normalized) return "";
  if (!/[_-]/.test(normalized)) {
    return normalized === normalized.toUpperCase()
      ? `${normalized[0].toUpperCase()}${normalized.slice(1).toLowerCase()}`
      : normalized;
  }
  return normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function getPrimaryUsageMetric(quota: AgentUsageQuota) {
  return quota.metrics.reduce((mostConstrained, metric) =>
    metric.utilization > mostConstrained.utilization ? metric : mostConstrained,
  );
}
