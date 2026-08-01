import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: { handle: handleMock },
}));

type Handler = (...args: unknown[]) => Promise<unknown>;

async function setup() {
  vi.resetModules();
  handleMock.mockReset();
  const [{ registerAgentConversationIPC }, { IPC_CHANNELS }] =
    await Promise.all([
      import("../../../src/main/ipc/agent-conversation.ipc"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
  const service = {
    listMetadata: vi.fn(() => []),
    updateMetadata: vi.fn((input) => ({ ...input, id: "metadata-1" })),
    softDelete: vi.fn(() => ({ deletedAt: 10 })),
    restore: vi.fn(() => ({ deletedAt: null })),
    resume: vi.fn(async () => ({
      status: "launched",
      mode: "native-resume",
    })),
    previewHandoff: vi.fn(async (request) => ({
      ...request,
      sourceTitle: "Session",
      payload: "portable context",
      payloadDigest: `sha256:${"a".repeat(64)}`,
      transport: "direct",
    })),
    continueInAgent: vi.fn(async () => ({
      status: "launched",
      mode: "cross-agent",
    })),
    exportConversation: vi.fn(async () => ({
      fileName: "session.md",
      content: "# Session",
      mimeType: "text/markdown",
    })),
  };
  const saveExport = vi.fn(async () => "/tmp/session.md");
  registerAgentConversationIPC({ service, saveExport });
  return {
    IPC_CHANNELS,
    service,
    saveExport,
    handlers: Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>,
  };
}

describe("Agent conversation IPC", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("forwards bounded metadata CRUD and native resume requests", async () => {
    const { handlers, IPC_CHANNELS, service } = await setup();
    await handlers[IPC_CHANNELS.AGENT_CONVERSATION_METADATA_LIST](
      {},
      {
        agentId: "claude",
        sessionIds: ["session-1"],
      },
    );
    expect(service.listMetadata).toHaveBeenCalledWith("claude", ["session-1"]);

    const update = {
      agentId: "claude",
      sessionId: "session-1",
      title: "Release fix",
      projectId: "project-1",
      projectPath: "/workspace/project",
      tags: ["release"],
      note: "note",
      favorite: true,
      archived: false,
    };
    await handlers[IPC_CHANNELS.AGENT_CONVERSATION_METADATA_UPDATE]({}, update);
    expect(service.updateMetadata).toHaveBeenCalledWith(update);
    await handlers[IPC_CHANNELS.AGENT_CONVERSATION_RESUME](
      {},
      {
        agentId: "claude",
        sessionId: "session-1",
      },
    );
    expect(service.resume).toHaveBeenCalledWith({
      agentId: "claude",
      sessionId: "session-1",
    });
  });

  it("previews and confirms a cross-Agent handoff with an exact digest", async () => {
    const { handlers, IPC_CHANNELS, service } = await setup();
    const request = {
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    };
    const preview = await handlers[
      IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_PREVIEW
    ]({}, request);
    await handlers[IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_CONTINUE](
      {},
      {
        ...(preview as object),
        confirmedPayloadDigest: `sha256:${"a".repeat(64)}`,
      },
    );
    expect(service.previewHandoff).toHaveBeenCalledWith(request);
    expect(service.continueInAgent).toHaveBeenCalledWith(
      expect.objectContaining({ targetAgentId: "codex" }),
    );
  });

  it("saves an export through the trusted main-process boundary", async () => {
    const { handlers, IPC_CHANNELS, saveExport } = await setup();
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONVERSATION_EXPORT](
        {},
        {
          agentId: "claude",
          sessionId: "session-1",
          format: "markdown",
        },
      ),
    ).resolves.toEqual({ canceled: false, filePath: "/tmp/session.md" });
    expect(saveExport).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "session.md" }),
    );
  });

  it("rejects oversized batches and malformed handoff payloads", async () => {
    const { handlers, IPC_CHANNELS } = await setup();
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONVERSATION_METADATA_LIST](
        {},
        {
          agentId: "claude",
          sessionIds: Array.from({ length: 201 }, (_, index) => `s-${index}`),
        },
      ),
    ).rejects.toThrow("AGENT_CONVERSATION_REQUEST_INVALID");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_CONTINUE](
        {},
        {
          sourceAgentId: "claude",
        },
      ),
    ).rejects.toThrow("AGENT_CONVERSATION_REQUEST_INVALID");
  });
});
