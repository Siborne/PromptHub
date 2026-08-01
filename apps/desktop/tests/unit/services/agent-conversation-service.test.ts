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
  const resolveExecutable = vi.fn(async (command: string) => `/${command}`);
  const service = new AgentConversationService({
    repository,
    sessions: {
      list: vi.fn(async () => sessionList()),
      read: vi.fn(async () => detail()),
    },
    resolveExecutable,
    launch,
    copyText: vi.fn(),
    homeDir: "/Users/alice",
    now: () => 100,
    ...overrides,
  });
  return { launch, repository, resolveExecutable, service };
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

  it("rejects stale previews and exposes copy fallback when direct launch is unavailable", async () => {
    const { service } = createService({
      resolveExecutable: vi.fn(async () => null),
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });
    expect(preview.transport).toBe("launch-and-copy");
    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: "sha256:stale",
      }),
    ).rejects.toThrow("HANDOFF_PREVIEW_STALE");
  });

  it("uses copy fallback when the desktop cannot launch an interactive terminal", async () => {
    const copyText = vi.fn();
    const launchAgent = vi.fn(async () => true);
    const { launch, service } = createService({
      copyText,
      launchAgent,
      supportsInteractiveLaunch: false,
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    expect(preview.transport).toBe("launch-and-copy");
    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: preview.payloadDigest,
      }),
    ).resolves.toMatchObject({ status: "copied", mode: "cross-agent" });
    expect(copyText).toHaveBeenCalledWith(preview.payload);
    expect(launchAgent).toHaveBeenCalledWith("codex");
    expect(launch).not.toHaveBeenCalled();
  });

  it("reports a copied fallback when the target Agent cannot be opened", async () => {
    const copyText = vi.fn();
    const { service } = createService({
      copyText,
      launchAgent: vi.fn(async () => false),
      supportsInteractiveLaunch: false,
    });
    const preview = await service.previewHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/project",
    });

    await expect(
      service.continueInAgent({
        ...preview,
        confirmedPayloadDigest: preview.payloadDigest,
      }),
    ).resolves.toEqual({
      status: "copied",
      mode: "cross-agent",
      errorCode: "AGENT_CONVERSATION_TARGET_LAUNCH_FAILED",
    });
    expect(copyText).toHaveBeenCalledWith(preview.payload);
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
});
