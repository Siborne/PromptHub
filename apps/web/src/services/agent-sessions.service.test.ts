import { describe, expect, it, vi } from "vitest";
import type { AgentSessionIndexDB } from "@prompthub/db";

import { WebAgentSessionsService } from "./agent-sessions.service";

describe("WebAgentSessionsService", () => {
  it("merges bounded indexed sources into a searchable global page", () => {
    const listSessions = vi.fn(({ sourceId }: { sourceId: string }) => ({
      items: [
        {
          id: `session-${sourceId}`,
          sourceId,
          title: `Title ${sourceId}`,
          projectPath: `/srv/${sourceId}`,
          createdAt: 1,
          updatedAt: sourceId === "source-2" ? 20 : 10,
          model: "gpt-5",
          messageCount: 3,
          redactedPreview: "safe preview",
          sourceStatus: "present",
        },
      ],
      total: 1,
      hasMore: false,
    }));
    const index = {
      listSources: () => [{ id: "source-1" }, { id: "source-2" }],
      listSessions,
    } as unknown as AgentSessionIndexDB;
    const service = new WebAgentSessionsService(index);

    expect(service.list("codex", 1, 0, "safe")).toMatchObject({
      agentId: "codex",
      adapter: "web-session-index-v1",
      total: 2,
      hasMore: true,
      sessions: [{ id: "session-source-2", sourcePath: null, resume: null }],
    });
    expect(listSessions).toHaveBeenCalledWith({
      sourceId: "source-1",
      limit: 1,
      offset: 0,
      statuses: ["present"],
      search: "safe",
    });
  });

  it("returns only the indexed redacted preview for an owned session", () => {
    const index = {
      getSession: () => ({
        id: "session-1",
        sourceId: "source-1",
        redactedPreview: "token=[REDACTED]",
      }),
      getSource: () => ({ id: "source-1", platformId: "codex" }),
    } as unknown as AgentSessionIndexDB;
    const service = new WebAgentSessionsService(index);

    expect(service.read("codex", "session-1")).toMatchObject({
      sessionId: "session-1",
      entries: [{ text: "token=[REDACTED]", role: "unknown" }],
      truncated: true,
    });
    expect(() => service.read("qwen", "session-1")).toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
  });
});
