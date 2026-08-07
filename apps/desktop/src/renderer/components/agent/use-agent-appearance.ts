import { useCallback, useEffect, useState } from "react";

import type { AgentAppearanceOverview } from "@prompthub/shared/types";

type AppearanceAction =
  | "refresh"
  | "import-theme"
  | "apply-theme"
  | "export-theme"
  | "restore-theme"
  | "delete-theme"
  | "import-pet"
  | "update-pet"
  | "install-store-pet"
  | "export-pet"
  | "delete-pet";

export function useAgentAppearance(agentId: string) {
  const [overview, setOverview] = useState<AgentAppearanceOverview | null>(
    null,
  );
  const [activeAction, setActiveAction] = useState<AppearanceAction | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setActiveAction("refresh");
    setError(null);
    try {
      setOverview(await window.api.agent.getAppearance(agentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setActiveAction(null);
    }
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: AppearanceAction, operation: () => Promise<unknown>) => {
      setActiveAction(action);
      setError(null);
      try {
        const result = await operation();
        if (result !== null) {
          setOverview(await window.api.agent.getAppearance(agentId));
        }
        return result;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return null;
      } finally {
        setActiveAction(null);
      }
    },
    [agentId],
  );

  return { overview, activeAction, error, refresh, run };
}
