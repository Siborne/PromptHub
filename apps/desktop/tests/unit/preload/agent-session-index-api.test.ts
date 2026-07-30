import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: mocks,
}));

import { agentApi } from "../../../src/preload/api/agent";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

describe("Agent session index preload API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue(undefined);
  });

  it("forwards state, opt-in, refresh, cancel, list search, and detail calls", async () => {
    const enableRequest = { agentId: "claude", enabled: true };
    const refreshRequest = {
      agentId: "claude",
      requestId: "session-index-request-1",
    };
    const cancelRequest = { requestId: refreshRequest.requestId };

    await agentApi.getSessionIndexState("claude");
    await agentApi.setSessionIndexEnabled(enableRequest);
    await agentApi.refreshSessionIndex(refreshRequest);
    await agentApi.cancelSessionIndex(cancelRequest);
    await agentApi.listSessions("claude", 25, 50, "review");
    await agentApi.readSession("claude", "session-1");

    expect(mocks.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.AGENT_SESSION_INDEX_GET_STATE, "claude"],
      [IPC_CHANNELS.AGENT_SESSION_INDEX_SET_ENABLED, enableRequest],
      [IPC_CHANNELS.AGENT_SESSION_INDEX_REFRESH, refreshRequest],
      [IPC_CHANNELS.AGENT_SESSION_INDEX_CANCEL, cancelRequest],
      [IPC_CHANNELS.AGENT_SESSIONS_LIST, "claude", 25, 50, "review"],
      [IPC_CHANNELS.AGENT_SESSION_READ, "claude", "session-1"],
    ]);
  });

  it("scopes progress subscription cleanup to the installed handler", () => {
    const listener = vi.fn();
    const unsubscribe = agentApi.onSessionIndexProgress(listener);
    const handler = mocks.on.mock.calls[0][1];
    const progress = {
      agentId: "claude",
      requestId: "session-index-request-1",
      processed: 1,
      total: 3,
    };

    handler({}, progress);
    expect(listener).toHaveBeenCalledWith(progress);
    unsubscribe();
    expect(mocks.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_SESSION_INDEX_PROGRESS,
      handler,
    );
  });
});
