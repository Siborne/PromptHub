import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCoPawSessionAdapter } from "../../../src/main/services/agent-session-copaw";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("CoPaw session adapter", () => {
  let homeDir: string;
  let workingRoot: string;
  let workspaceDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-copaw-"));
    workingRoot = path.join(homeDir, ".qwenpaw");
    workspaceDir = path.join(homeDir, "custom-workspaces", "research");
    await fs.mkdir(path.join(workspaceDir, "sessions", "console"), {
      recursive: true,
    });
    await fs.mkdir(workingRoot, { recursive: true });
    await fs.writeFile(
      path.join(workingRoot, "config.json"),
      JSON.stringify({
        agents: {
          profiles: {
            research: {
              id: "research",
              workspace_dir: workspaceDir,
              enabled: true,
            },
          },
        },
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeCurrentSession(): Promise<string> {
    const sessionId = "console:user-42";
    const sessionPath = path.join(
      workspaceDir,
      "sessions",
      "console",
      "user-42_console--user-42.json",
    );
    await fs.writeFile(
      path.join(workspaceDir, "chats.json"),
      JSON.stringify({
        version: 1,
        chats: [
          {
            id: "chat-1",
            name: "Investigate queue durability",
            session_id: sessionId,
            user_id: "user-42",
            channel: "console",
            created_at: "2026-08-01T09:00:00Z",
            updated_at: "2026-08-01T09:05:00Z",
          },
        ],
      }),
    );
    await fs.writeFile(
      sessionPath,
      JSON.stringify({
        agent: {
          state: {
            session_id: sessionId,
            summary: "",
            context: [
              {
                id: "u1",
                name: "user",
                role: "user",
                timestamp: "2026-08-01 09:00:00.000000",
                content: "Check durable queue recovery",
              },
              {
                id: "synthetic",
                name: "memory",
                role: "user",
                metadata: { qwenpaw_tag: "scroll_memory" },
                content: "<system-info>[context compressed]</system-info>",
              },
              {
                id: "a1",
                name: "assistant",
                role: "assistant",
                timestamp: "2026-08-01 09:00:02.000000",
                content: [
                  { type: "thinking", thinking: "private reasoning" },
                  {
                    type: "text",
                    text: "Use the persisted sequence.\n⟦ done ⟧",
                  },
                  { type: "tool_call", id: "tool-1", name: "grep" },
                  {
                    type: "tool_result",
                    id: "tool-1",
                    output: "private tool output",
                  },
                ],
              },
              {
                id: "auto",
                name: "user",
                role: "user",
                metadata: { qwenpaw_tag: "auto_continue" },
                content: "Continue automatically",
              },
            ],
          },
        },
      }),
    );
    return sessionPath;
  }

  it("reads current QwenPaw workspaces and filters model-only context", async () => {
    const sessionPath = await writeCurrentSession();
    const realWorkspaceDir = await fs.realpath(workspaceDir);
    const realSessionPath = await fs.realpath(sessionPath);
    const adapter = createCoPawSessionAdapter([workingRoot]);
    const result = await adapter.list(20, 0, "persisted sequence");
    expect(result).toMatchObject({
      agentId: "copaw",
      adapter: "copaw-safe-json-session-v2",
      total: 1,
      hasMore: false,
      sessions: [
        {
          title: "Investigate queue durability",
          projectLabel: "research",
          projectPath: realWorkspaceDir,
          messageCount: 2,
          sourcePath: realSessionPath,
          resume: null,
        },
      ],
    });
    expect(result.sessions[0].id).toMatch(/^copaw-[a-f0-9]{32}$/);
    await expect(
      adapter.list(20, 0, "private reasoning"),
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      adapter.list(20, 0, "private tool output"),
    ).resolves.toMatchObject({ total: 0 });

    const first = await adapter.read(result.sessions[0].id, { limit: 1 });
    expect(first.entries).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Check durable queue recovery",
      }),
    ]);
    const second = await adapter.read(result.sessions[0].id, {
      cursor: first.nextCursor || undefined,
      limit: 1,
    });
    expect(second).toMatchObject({
      entries: [
        expect.objectContaining({
          role: "assistant",
          text: "Use the persisted sequence.",
        }),
      ],
      nextCursor: null,
      parseErrors: 0,
      truncated: false,
    });

    const service = createAgentSessionService({
      homeDir,
      copawRootDirs: [workingRoot],
    });
    await expect(service.list("copaw", { limit: 20 })).resolves.toMatchObject({
      total: 1,
      adapter: "copaw-safe-json-session-v2",
    });
  });

  it("reads the legacy memory shape still supported by current QwenPaw", async () => {
    const sessionsDir = path.join(
      workingRoot,
      "workspaces",
      "default",
      "sessions",
    );
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionsDir, "legacy.json"),
      JSON.stringify({
        agent: {
          memory: {
            content: [
              [
                {
                  id: "u1",
                  name: "user",
                  role: "user",
                  content: "Legacy visible request",
                },
                [],
              ],
              [
                {
                  id: "a1",
                  name: "assistant",
                  role: "assistant",
                  content: "Legacy visible answer",
                },
                [],
              ],
            ],
          },
        },
      }),
    );

    const adapter = createCoPawSessionAdapter([workingRoot]);
    const result = await adapter.list(20, 0, "legacy visible answer");
    expect(result).toMatchObject({ total: 1 });
    await expect(adapter.read(result.sessions[0].id)).resolves.toMatchObject({
      entries: [
        expect.objectContaining({
          role: "user",
          text: "Legacy visible request",
        }),
        expect.objectContaining({
          role: "assistant",
          text: "Legacy visible answer",
        }),
      ],
    });
  });

  it("ignores malformed snapshots and symlinked workspace roots", async () => {
    const sessionsDir = path.join(
      workingRoot,
      "workspaces",
      "default",
      "sessions",
    );
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(path.join(sessionsDir, "broken.json"), "not json");
    const outside = path.join(homeDir, "outside-workspace");
    await fs.mkdir(path.join(outside, "sessions"), { recursive: true });
    await fs.symlink(outside, path.join(workingRoot, "workspaces", "linked"));

    const adapter = createCoPawSessionAdapter([workingRoot]);
    await expect(adapter.list(20, 0)).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });
  });
});
