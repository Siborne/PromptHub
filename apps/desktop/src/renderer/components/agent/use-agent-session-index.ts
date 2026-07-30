import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AgentSessionIndexProgress,
  AgentSessionIndexPublicState,
} from "@prompthub/shared/types";

const EMPTY_STATE: AgentSessionIndexPublicState = {
  supported: false,
  enabled: false,
  lastStatus: null,
  lastScannedAt: null,
  lastErrorCode: null,
};

let requestSequence = 0;

function nextRequestId(): string {
  requestSequence += 1;
  return `session-index-${Date.now().toString(36)}-${requestSequence}`;
}

function isEmptyState(state: AgentSessionIndexPublicState): boolean {
  return (
    state.supported === EMPTY_STATE.supported &&
    state.enabled === EMPTY_STATE.enabled &&
    state.lastStatus === EMPTY_STATE.lastStatus &&
    state.lastScannedAt === EMPTY_STATE.lastScannedAt &&
    state.lastErrorCode === EMPTY_STATE.lastErrorCode
  );
}

export function useAgentSessionIndex(agentId: string) {
  const [state, setState] = useState<AgentSessionIndexPublicState>(EMPTY_STATE);
  const [progress, setProgress] = useState<AgentSessionIndexProgress | null>(
    null,
  );
  const [isChanging, setIsChanging] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const activeRequest = useRef<string | null>(null);
  const currentAgent = useRef(agentId);
  currentAgent.current = agentId;

  useEffect(() => {
    let active = true;
    setState(EMPTY_STATE);
    setProgress(null);
    setError(null);
    setIsChanging(false);
    setIsIndexing(false);
    window.api.agent
      .getSessionIndexState(agentId)
      .then((next) => {
        if (active && !isEmptyState(next)) setState(next);
      })
      .catch(() => active && setError("state"));
    return () => {
      active = false;
      const requestId = activeRequest.current;
      if (requestId) {
        void window.api.agent.cancelSessionIndex({ requestId });
        activeRequest.current = null;
      }
    };
  }, [agentId]);

  useEffect(
    () =>
      window.api.agent.onSessionIndexProgress((next) => {
        if (
          next.agentId === currentAgent.current &&
          next.requestId === activeRequest.current
        ) {
          setProgress(next);
        }
      }),
    [],
  );

  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    const requestId = nextRequestId();
    activeRequest.current = requestId;
    setIsIndexing(true);
    setProgress({ agentId, requestId, processed: 0, total: 0 });
    setError(null);
    try {
      const next = await window.api.agent.refreshSessionIndex({
        agentId,
        requestId,
      });
      if (
        currentAgent.current === agentId &&
        activeRequest.current === requestId
      ) {
        setState(next);
        setRevision((value) => value + 1);
      }
    } catch {
      if (currentAgent.current === agentId) setError("refresh");
    } finally {
      if (activeRequest.current === requestId) {
        activeRequest.current = null;
        setProgress(null);
        setIsIndexing(false);
      }
    }
  }, [agentId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (isChanging || isIndexing) return;
      setIsChanging(true);
      setError(null);
      try {
        const next = await window.api.agent.setSessionIndexEnabled({
          agentId,
          enabled,
        });
        if (currentAgent.current !== agentId) return;
        setState(next);
        setRevision((value) => value + 1);
        if (enabled) await refresh();
      } catch {
        if (currentAgent.current === agentId) setError("toggle");
      } finally {
        if (currentAgent.current === agentId) setIsChanging(false);
      }
    },
    [agentId, isChanging, isIndexing, refresh],
  );

  const cancel = useCallback(async () => {
    const requestId = activeRequest.current;
    if (!requestId) return false;
    return window.api.agent.cancelSessionIndex({ requestId });
  }, []);

  return {
    state,
    progress,
    isChanging,
    isIndexing,
    error,
    revision,
    refresh,
    setEnabled,
    cancel,
  };
}
