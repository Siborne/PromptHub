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
const AUTOMATIC_REFRESH_MAX_AGE_MS = 5 * 60 * 1000;
const automaticRefreshes = new Map<
  string,
  Promise<AgentSessionIndexPublicState>
>();

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

function needsAutomaticRefresh(state: AgentSessionIndexPublicState): boolean {
  return (
    state.lastScannedAt === null ||
    Date.now() - state.lastScannedAt >= AUTOMATIC_REFRESH_MAX_AGE_MS
  );
}

function refreshAutomatically(
  agentId: string,
): Promise<AgentSessionIndexPublicState> {
  const current = automaticRefreshes.get(agentId);
  if (current) return current;
  const requestId = nextRequestId();
  const pending = window.api.agent
    .refreshSessionIndex({ agentId, requestId })
    .finally(() => {
      if (automaticRefreshes.get(agentId) === pending) {
        automaticRefreshes.delete(agentId);
      }
    });
  automaticRefreshes.set(agentId, pending);
  return pending;
}

export function useAgentSessionIndex(
  agentId: string,
  automaticPreference?: boolean,
) {
  const [state, setState] = useState<AgentSessionIndexPublicState>(EMPTY_STATE);
  const [progress, setProgress] = useState<AgentSessionIndexProgress | null>(
    null,
  );
  const [isChanging, setIsChanging] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [hasLoadedState, setHasLoadedState] = useState(false);
  const activeRequest = useRef<string | null>(null);
  const reconciledPreference = useRef<string | null>(null);
  const currentAgent = useRef(agentId);
  currentAgent.current = agentId;

  useEffect(() => {
    let active = true;
    setState(EMPTY_STATE);
    setProgress(null);
    setError(null);
    setIsChanging(false);
    setIsIndexing(false);
    setHasLoadedState(false);
    setRevision(0);
    window.api.agent
      .getSessionIndexState(agentId)
      .then((next) => {
        if (!active) return;
        if (!isEmptyState(next)) setState(next);
        setHasLoadedState(true);
      })
      .catch(() => {
        if (!active) return;
        setError("state");
        setHasLoadedState(true);
      });
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
    async (enabled: boolean): Promise<AgentSessionIndexPublicState | null> => {
      if (isChanging || isIndexing) return null;
      setIsChanging(true);
      setError(null);
      try {
        const next = await window.api.agent.setSessionIndexEnabled({
          agentId,
          enabled,
        });
        if (currentAgent.current !== agentId) return null;
        setState(next);
        setRevision((value) => value + 1);
        if (enabled) await refresh();
        return next;
      } catch {
        if (currentAgent.current === agentId) setError("toggle");
        return null;
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

  useEffect(() => {
    if (
      automaticPreference === undefined ||
      !hasLoadedState ||
      !state.supported
    ) {
      return;
    }
    const preferenceKey = `${agentId}:${automaticPreference}`;
    if (reconciledPreference.current === preferenceKey) return;
    reconciledPreference.current = preferenceKey;

    let active = true;
    void (async () => {
      let next = state;
      const changed = state.enabled !== automaticPreference;
      if (changed) {
        try {
          next = await window.api.agent.setSessionIndexEnabled({
            agentId,
            enabled: automaticPreference,
          });
        } catch {
          if (active && currentAgent.current === agentId) setError("toggle");
          reconciledPreference.current = null;
          return;
        }
        if (!active || currentAgent.current !== agentId) return;
        if (!automaticPreference) {
          setState(next);
          setRevision((value) => value + 1);
          return;
        }
      }
      if (!automaticPreference) return;
      if (!needsAutomaticRefresh(next)) {
        if (changed) {
          setState(next);
          setRevision((value) => value + 1);
        }
        return;
      }
      try {
        const refreshed = await refreshAutomatically(agentId);
        if (!active || currentAgent.current !== agentId) return;
        setState(refreshed);
        setRevision((value) => value + 1);
      } catch {
        if (active && currentAgent.current === agentId) setError("refresh");
      }
    })();
    return () => {
      active = false;
    };
  }, [
    agentId,
    automaticPreference,
    hasLoadedState,
    state.enabled,
    state.lastScannedAt,
    state.supported,
  ]);

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
