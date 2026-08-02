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
    await agentApi.readSession("claude", "session-1", {
      cursor: "page-2",
      limit: 80,
    });

    expect(mocks.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.AGENT_SESSION_INDEX_GET_STATE, "claude"],
      [IPC_CHANNELS.AGENT_SESSION_INDEX_SET_ENABLED, enableRequest],
      [IPC_CHANNELS.AGENT_SESSION_INDEX_REFRESH, refreshRequest],
      [IPC_CHANNELS.AGENT_SESSION_INDEX_CANCEL, cancelRequest],
      [IPC_CHANNELS.AGENT_SESSIONS_LIST, "claude", 25, 50, "review"],
      [
        IPC_CHANNELS.AGENT_SESSION_READ,
        "claude",
        "session-1",
        { cursor: "page-2", limit: 80 },
      ],
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

  it("forwards conversation metadata, continuation, and export requests", async () => {
    const identity = { agentId: "claude", sessionId: "session-1" };
    const metadata = {
      ...identity,
      title: "Release fix",
      tags: ["release"],
    };
    const handoff = {
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    };
    const continuation = {
      ...handoff,
      sourceTitle: "Release fix",
      payload: "portable context",
      payloadDigest: `sha256:${"a".repeat(64)}`,
      confirmedPayloadDigest: `sha256:${"a".repeat(64)}`,
      transport: "direct" as const,
      cliCommand: "cd '/workspace/project' && codex 'portable context'",
    };

    await agentApi.listConversationMetadata("claude", ["session-1"]);
    await agentApi.updateConversationMetadata(metadata);
    await agentApi.deleteConversation(identity);
    await agentApi.restoreConversation(identity);
    await agentApi.resumeConversation(identity);
    await agentApi.previewConversationHandoff(handoff);
    await agentApi.continueConversationInAgent(continuation);
    await agentApi.exportConversation({ ...identity, format: "markdown" });

    expect(mocks.invoke.mock.calls).toEqual([
      [
        IPC_CHANNELS.AGENT_CONVERSATION_METADATA_LIST,
        {
          agentId: "claude",
          sessionIds: ["session-1"],
        },
      ],
      [IPC_CHANNELS.AGENT_CONVERSATION_METADATA_UPDATE, metadata],
      [IPC_CHANNELS.AGENT_CONVERSATION_DELETE, identity],
      [IPC_CHANNELS.AGENT_CONVERSATION_RESTORE, identity],
      [IPC_CHANNELS.AGENT_CONVERSATION_RESUME, identity],
      [IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_PREVIEW, handoff],
      [IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_CONTINUE, continuation],
      [
        IPC_CHANNELS.AGENT_CONVERSATION_EXPORT,
        {
          ...identity,
          format: "markdown",
        },
      ],
    ]);
  });
});
