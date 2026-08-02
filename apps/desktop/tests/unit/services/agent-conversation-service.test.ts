/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import type {
  AgentConversationHandoffRecord,
  AgentConversationMetadata,
  AgentSessionDetail,
  AgentSessionListResult,
} from "@prompthub/shared/types";
import {
  AgentConversationService,
  type AgentConversationRepository,
} from "../../../src/main/services/agent-conversation-service";

function metadata(
  overrides: Partial<AgentConversationMetadata> = {},
): AgentConversationMetadata {
  return {
    id: "metadata-1",
    agentId: "claude",
    sessionId: "session-1",
    title: null,
    projectId: null,
    projectPath: null,
    tags: [],
    note: null,
    favorite: false,
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createRepository(): AgentConversationRepository {
  return {
    listMetadata: vi.fn(() => []),
    upsertMetadata: vi.fn((input) => metadata(input)),
    softDelete: vi.fn(() => metadata({ deletedAt: 10 })),
    restore: vi.fn(() => metadata()),
    createHandoff: vi.fn(
      (input): AgentConversationHandoffRecord => ({
        id: "handoff-1",
        ...input,
        targetSessionId: null,
        errorCode: null,
        createdAt: 1,
        updatedAt: 1,
      }),
    ),
    updateHandoff: vi.fn((id, input) => ({
      id,
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
      transport: "direct" as const,
      payloadDigest: "sha256:test",
      status: input.status,
      targetSessionId: input.targetSessionId ?? null,
      errorCode: input.errorCode ?? null,
      createdAt: 1,
      updatedAt: 2,
    })),
  };
}

function sessionList(): AgentSessionListResult {
  return {
    agentId: "claude",
    adapter: "claude-jsonl-v1",
    sessions: [
      {
        id: "session-1",
        title: "Fix release updater",
        projectLabel: "project",
        projectPath: "/workspace/project",
        createdAt: 1,
        updatedAt: 2,
        model: "claude-sonnet",
        messageCount: 2,
        sourcePath: "/private/source.jsonl",
        resume: {
          executable: "claude",
          args: ["--resume", "session-1"],
          cwd: "/workspace/project",
        },
      },
    ],
    total: 1,
    hasMore: false,
  };
}

function detail(): AgentSessionDetail {
  return {
    agentId: "claude",
    adapter: "claude-jsonl-v1",
    sessionId: "session-1",
    entries: [
      {
        id: "1",
        role: "system",
        timestamp: 1,
        text: "secret system prompt",
      },
      {
        id: "2",
        role: "user",
        timestamp: 2,
        text: "Fix /Users/alice/project using token sk-test-secret",
      },
      {
        id: "3",
        role: "assistant",
        timestamp: 3,
        text: "I found the updater checksum mismatch.",
      },
      { id: "4", role: "tool", timestamp: 4, text: "raw tool output" },
    ],
    parseErrors: 0,
    truncated: false,
  };
}

function createService(overrides: Record<string, unknown> = {}) {
  const repository = createRepository();
  const launch = vi.fn(async () => ({ launched: true }));
  const copyText = vi.fn();
  const resolveExecutable = vi.fn(async (command: string) => `/${command}`);
  const service = new AgentConversationService({
    repository,
    sessions: {
      list: vi.fn(async () => sessionList()),
      read: vi.fn(async () => detail()),
    },
    resolveExecutable,
    launch,
    copyText,
    homeDir: "/Users/alice",
    now: () => 100,
    ...overrides,
  });
  return { copyText, launch, repository, resolveExecutable, service };
}

describe("AgentConversationService", () => {
  it("launches the verified native resume command instead of reconstructing it", async () => {
    const { launch, service } = createService();
    const result = await service.resume({
      agentId: "claude",
      sessionId: "session-1",
    });

    expect(result).toMatchObject({
      status: "launched",
      mode: "native-resume",
    });
    expect(launch).toHaveBeenCalledWith({
      executable: "/claude",
      args: ["--resume", "session-1"],
      cwd: "/workspace/project",
    });
  });

  it("builds a reviewed portable handoff and launches a new target session", async () => {
    const { launch, repository, service } = createService();
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    expect(preview.transport).toBe("direct");
    expect(preview.payload).toContain("Fix release updater");
    expect(preview.payload).toContain("I found the updater checksum mismatch");
    expect(preview.payload).not.toContain("secret system prompt");
    expect(preview.payload).not.toContain("raw tool output");
    expect(preview.payload).not.toContain("sk-test-secret");
    expect(preview.payload).toContain("~/project");
    expect(preview.cliCommand).toMatch(
      /^cd '\/workspace\/project' && codex '# PromptHub conversation handoff/,
    );

    const result = await service.continueInAgent({
      ...preview,
      confirmedPayloadDigest: preview.payloadDigest,
    });
    expect(result.status).toBe("launched");
    expect(launch).toHaveBeenCalledWith({
      executable: "/codex",
      args: [preview.payload],
      cwd: "/workspace/project",
    });
    expect(repository.createHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAgentId: "claude",
        targetAgentId: "codex",
        payloadDigest: preview.payloadDigest,
      }),
    );
  });

  it("rejects stale previews and plans a direct Agent launch when prompt injection is unavailable", async () => {
    const { service } = createService({
      resolveExecutable: vi.fn(async () => null),
      canLaunchAgent: vi.fn(async () => true),
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });
    expect(preview.transport).toBe("launch");
    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: "sha256:stale",
      }),
    ).rejects.toThrow("HANDOFF_PREVIEW_STALE");
  });

  it("shell-quotes copied CLI commands derived from external project paths", async () => {
    const { service } = createService();
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/it's; echo injected",
    });

    expect(preview.cliCommand).toContain(
      `cd '/workspace/it'"'"'s; echo injected' && codex '`,
    );
  });

  it("copies the portable context before opening a non-CLI target Agent", async () => {
    const launchAgent = vi.fn(async () => true);
    const { copyText, launch, service } = createService({
      canLaunchAgent: vi.fn(async () => true),
      launchAgent,
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "antigravity",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    expect(preview.transport).toBe("launch");
    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: preview.payloadDigest,
      }),
    ).resolves.toMatchObject({ status: "launched", mode: "cross-agent" });
    expect(copyText).toHaveBeenCalledWith(preview.payload);
    expect(copyText.mock.invocationCallOrder[0]).toBeLessThan(
      launchAgent.mock.invocationCallOrder[0],
    );
    expect(launchAgent).toHaveBeenCalledWith("antigravity");
    expect(launch).not.toHaveBeenCalled();
  });

  it("keeps a copy-only fallback when PromptHub cannot launch the target Agent", async () => {
    const { service } = createService({
      canLaunchAgent: vi.fn(async () => false),
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "copilot",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    expect(preview).toMatchObject({
      targetAgentId: "copilot",
      transport: "unavailable",
      cliCommand: null,
    });
    expect(preview.payload).toContain("# PromptHub conversation handoff");
  });

  it("leaves copied context available when opening the target Agent fails", async () => {
    const launchAgent = vi.fn(async () => false);
    const { copyText, service } = createService({
      canLaunchAgent: vi.fn(async () => true),
      launchAgent,
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "antigravity",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: preview.payloadDigest,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      mode: "cross-agent",
      errorCode: "AGENT_CONVERSATION_TARGET_LAUNCH_FAILED",
    });
    expect(copyText).toHaveBeenCalledWith(preview.payload);
  });

  it("does not open the target Agent when copying its handoff context fails", async () => {
    const launchAgent = vi.fn(async () => true);
    const copyText = vi.fn(() => {
      throw new Error("clipboard unavailable");
    });
    const { repository, service } = createService({
      canLaunchAgent: vi.fn(async () => true),
      copyText,
      launchAgent,
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "antigravity",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: preview.payloadDigest,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      mode: "cross-agent",
      errorCode: "AGENT_CONVERSATION_CONTEXT_COPY_FAILED",
    });
    expect(launchAgent).not.toHaveBeenCalled();
    expect(repository.updateHandoff).toHaveBeenCalledWith("handoff-1", {
      status: "failed",
      errorCode: "AGENT_CONVERSATION_CONTEXT_COPY_FAILED",
    });
  });

  it("exports versioned JSON and Markdown with visible turns only", async () => {
    const { service } = createService();
    const json = await service.exportConversation({
      agentId: "claude",
      sessionId: "session-1",
      format: "json",
    });
    const parsed = JSON.parse(json.content);
    expect(parsed).toMatchObject({ version: 1, agentId: "claude" });
    expect(parsed.entries).toHaveLength(2);
    expect(json.fileName).toMatch(/\.json$/);

    const markdown = await service.exportConversation({
      agentId: "claude",
      sessionId: "session-1",
      format: "markdown",
    });
    expect(markdown.content).toContain("# Fix release updater");
    expect(markdown.content).toContain("## User");
    expect(markdown.content).not.toContain("secret system prompt");
    expect(markdown.content).not.toContain("/Users/alice");
    expect(markdown.fileName).toMatch(/\.md$/);
  });

  it("collects every transcript page before exporting a conversation", async () => {
    const read = vi.fn(
      async (
        _agentId: string,
        _sessionId: string,
        input?: { cursor?: string },
      ) => ({
        ...detail(),
        entries: input?.cursor
          ? [
              {
                id: "page-2",
                role: "assistant" as const,
                timestamp: 5,
                text: "Final paged answer",
              },
            ]
          : [
              {
                id: "page-1",
                role: "user" as const,
                timestamp: 4,
                text: "Paged question",
              },
            ],
        nextCursor: input?.cursor ? null : "next-page",
      }),
    );
    const { service } = createService({
      sessions: {
        list: vi.fn(async () => sessionList()),
        read,
      },
    });

    const exported = await service.exportConversation({
      agentId: "codex",
      sessionId: "session-1",
      format: "json",
    });

    expect(JSON.parse(exported.content).entries).toEqual([
      expect.objectContaining({ text: "Paged question" }),
      expect.objectContaining({ text: "Final paged answer" }),
    ]);
    expect(read).toHaveBeenNthCalledWith(2, "codex", "session-1", {
      cursor: "next-page",
      limit: 200,
    });
  });
});
