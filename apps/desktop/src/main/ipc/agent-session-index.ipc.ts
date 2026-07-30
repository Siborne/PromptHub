import { ipcMain } from "electron";

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type {
  AgentSessionDetail,
  AgentSessionIndexPublicState,
  AgentSessionListResult,
} from "@prompthub/shared/types";
import type {
  AgentSessionIndexListOptions,
  AgentSessionIndexRefreshOptions,
  AgentSessionIndexState,
} from "../services/agent-session-index-service";

export interface AgentSessionIndexOperations {
  getState(agentId: string): AgentSessionIndexState;
  setEnabled(agentId: string, enabled: boolean): AgentSessionIndexState;
  refresh(
    agentId: string,
    options?: AgentSessionIndexRefreshOptions,
  ): Promise<unknown>;
  list(
    agentId: string,
    options: AgentSessionIndexListOptions,
  ): Promise<AgentSessionListResult>;
  read(agentId: string, sessionId: string): Promise<AgentSessionDetail>;
}

export interface AgentSessionIndexIpcOptions {
  createService(agentId: string): AgentSessionIndexOperations;
}

interface Sender {
  id: number;
  send(channel: string, value: unknown): void;
  once?(event: "destroyed", listener: () => void): unknown;
  removeListener?(event: "destroyed", listener: () => void): unknown;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AGENT_SESSION_INDEX_REQUEST_INVALID");
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new Error("AGENT_SESSION_INDEX_REQUEST_INVALID");
  }
  return value.trim();
}

function requireRequestId(value: unknown): string {
  const requestId = requireText(value);
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error("AGENT_SESSION_INDEX_REQUEST_INVALID");
  }
  return requestId;
}

function requireSender(event: unknown): Sender {
  const sender = requireRecord(
    requireRecord(event).sender,
  ) as unknown as Sender;
  if (
    !Number.isInteger(sender.id) ||
    sender.id < 0 ||
    typeof sender.send !== "function"
  ) {
    throw new Error("AGENT_SESSION_INDEX_REQUEST_INVALID");
  }
  return sender;
}

function bindDestroyed(sender: Sender, listener: () => void): () => void {
  sender.once?.("destroyed", listener);
  return () => sender.removeListener?.("destroyed", listener);
}

function toPublicState(
  state: AgentSessionIndexState,
): AgentSessionIndexPublicState {
  return {
    supported: state.supported,
    enabled: state.enabled,
    lastStatus: state.source?.lastStatus ?? null,
    lastScannedAt: state.source?.lastScannedAt ?? null,
    lastErrorCode: state.source?.lastErrorCode ?? null,
  };
}

function toPublicError(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error("AGENT_SESSION_SCAN_CANCELLED");
  }
  if (
    error instanceof Error &&
    /^AGENT_SESSION_[A-Z0-9_]+$/.test(error.message)
  ) {
    return new Error(error.message);
  }
  console.error("[agent-session-index] operation failed");
  return new Error("AGENT_SESSION_INDEX_OPERATION_FAILED");
}

async function invoke<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toPublicError(error);
  }
}

export function registerAgentSessionIndexIPC(
  options: AgentSessionIndexIpcOptions,
): void {
  const activeScans = new Map<string, AbortController>();

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_INDEX_GET_STATE,
    async (_, agentId: unknown) =>
      invoke(async () =>
        toPublicState(
          options
            .createService(requireText(agentId))
            .getState(requireText(agentId)),
        ),
      ),
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_INDEX_SET_ENABLED,
    async (_, value: unknown) =>
      invoke(async () => {
        const request = requireRecord(value);
        const agentId = requireText(request.agentId);
        if (typeof request.enabled !== "boolean") {
          throw new Error("AGENT_SESSION_INDEX_REQUEST_INVALID");
        }
        return toPublicState(
          options.createService(agentId).setEnabled(agentId, request.enabled),
        );
      }),
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_INDEX_REFRESH,
    async (event: unknown, value: unknown) =>
      invoke(async () => {
        const request = requireRecord(value);
        const agentId = requireText(request.agentId);
        const requestId = requireRequestId(request.requestId);
        const sender = requireSender(event);
        const key = `${sender.id}:${requestId}`;
        if (activeScans.has(key)) {
          throw new Error("AGENT_SESSION_INDEX_IN_PROGRESS");
        }
        const controller = new AbortController();
        const unbind = bindDestroyed(sender, () =>
          controller.abort("renderer-destroyed"),
        );
        activeScans.set(key, controller);
        const service = options.createService(agentId);
        try {
          await service.refresh(agentId, {
            signal: controller.signal,
            onProgress: ({ processed, total }) =>
              sender.send(IPC_CHANNELS.AGENT_SESSION_INDEX_PROGRESS, {
                agentId,
                requestId,
                processed,
                total,
              }),
          });
          return toPublicState(service.getState(agentId));
        } finally {
          unbind();
          activeScans.delete(key);
        }
      }),
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_INDEX_CANCEL,
    async (event: unknown, value: unknown) =>
      invoke(async () => {
        const request = requireRecord(value);
        const requestId = requireRequestId(request.requestId);
        const sender = requireSender(event);
        const controller = activeScans.get(`${sender.id}:${requestId}`);
        if (!controller) return false;
        controller.abort("cancelled");
        return true;
      }),
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSIONS_LIST,
    async (
      _,
      agentIdValue: unknown,
      limitValue: unknown,
      offsetValue: unknown,
      searchValue: unknown,
    ) =>
      invoke(async () => {
        const agentId = requireText(agentIdValue);
        if (
          typeof limitValue !== "number" ||
          !Number.isInteger(limitValue) ||
          typeof offsetValue !== "number" ||
          !Number.isInteger(offsetValue) ||
          offsetValue < 0 ||
          (searchValue !== undefined &&
            (typeof searchValue !== "string" || searchValue.length > 512))
        ) {
          throw new Error("AGENT_SESSION_INDEX_REQUEST_INVALID");
        }
        return options.createService(agentId).list(agentId, {
          limit: limitValue,
          offset: offsetValue,
          ...(typeof searchValue === "string" ? { search: searchValue } : {}),
        });
      }),
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_READ,
    async (_, agentIdValue: unknown, sessionIdValue: unknown) =>
      invoke(async () => {
        const agentId = requireText(agentIdValue);
        const sessionId = requireText(sessionIdValue);
        return options.createService(agentId).read(agentId, sessionId);
      }),
  );
}
