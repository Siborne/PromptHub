import { useCallback, useEffect, useState } from "react";

import type { AgentUsageQuota } from "@prompthub/shared/types";

export type AgentUsageTone = "normal" | "warning" | "critical";

export function getAgentUsageTone(utilization: number): AgentUsageTone {
  if (utilization >= 90) return "critical";
  if (utilization >= 70) return "warning";
  return "normal";
}

export function getAgentRemainingTone(remaining: number): AgentUsageTone {
  if (remaining <= 10) return "critical";
  if (remaining <= 30) return "warning";
  return "normal";
}

export interface AgentUsageState {
  quota: AgentUsageQuota | null;
  isLoading: boolean;
  hasError: boolean;
  refresh: () => void;
}

const CACHE_KEY_PREFIX = "prompthub.agent-usage.";

function readCachedQuota(agentId: string): AgentUsageQuota | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_KEY_PREFIX}${agentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentUsageQuota;
    if (parsed?.agentId !== agentId || parsed?.status !== "ok") return null;
    // Caches written by older contract versions (fixed window fields, no
    // metrics array) must be ignored instead of crashing the banner.
    if (!Array.isArray(parsed.metrics)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedQuota(quota: AgentUsageQuota): void {
  try {
    if (quota.status === "ok") {
      window.localStorage.setItem(
        `${CACHE_KEY_PREFIX}${quota.agentId}`,
        JSON.stringify(quota),
      );
    }
  } catch {
    // Best-effort cache; storage failures must not break usage display.
  }
}

export function useAgentUsage(agentId: string): AgentUsageState {
  const [quota, setQuota] = useState<AgentUsageQuota | null>(() =>
    readCachedQuota(agentId),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [requestSeq, setRequestSeq] = useState(0);

  useEffect(() => {
    let active = true;
    setQuota((previous) =>
      previous && previous.agentId === agentId
        ? previous
        : readCachedQuota(agentId),
    );
    setHasError(false);
    setIsLoading(true);
    window.api.agent
      .getUsage(agentId)
      .then((result) => {
        if (!active) return;
        setQuota(result);
        writeCachedQuota(result);
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [agentId, requestSeq]);

  const refresh = useCallback(() => setRequestSeq((value) => value + 1), []);

  return { quota, isLoading, hasError, refresh };
}
