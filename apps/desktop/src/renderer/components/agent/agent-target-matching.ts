import type { ManagedAgentSummary } from "@prompthub/shared/types";

/**
 * Match an adapter target to the selected agent without falling back to
 * display names or path fragments. Target ids are the durable ownership key;
 * displayIconId is the only compatibility alias exposed by the agent model.
 */
export function matchesManagedAgentTarget(
  candidateIds: Array<string | undefined>,
  agent: ManagedAgentSummary,
): boolean {
  const acceptedIds = new Set(
    [agent.id, agent.displayIconId].filter((value): value is string =>
      Boolean(value),
    ),
  );
  return candidateIds.some(
    (candidate) => candidate && acceptedIds.has(candidate),
  );
}
