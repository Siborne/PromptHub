import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

const temporaryRoots: string[] = [];

async function createHome(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-agent-session-"),
  );
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Agent session service", () => {
  it("indexes and reads Claude JSONL lazily with malformed rows isolated", async () => {
    const homeDir = await createHome();
    const projectDir = path.join(
      homeDir,
      ".claude",
      "projects",
      "-Users-test-project",
    );
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "session-new.jsonl"),
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-07-15T10:00:00.000Z",
          message: { role: "user", content: "Fix the release workflow" },
        }),
        "{ malformed",
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-07-15T10:01:00.000Z",
          message: { role: "assistant", content: "I found the issue." },
        }),
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(projectDir, "session-old.jsonl"),
      `${JSON.stringify({ type: "user", message: { content: "Older task" } })}\n`,
    );
    await fs.utimes(
      path.join(projectDir, "session-old.jsonl"),
      new Date("2026-01-01"),
      new Date("2026-01-01"),
    );

    const service = createAgentSessionService({ homeDir });
    const result = await service.list("claude", { limit: 1 });

    expect(result.adapter).toBe("claude-jsonl-v1");
    expect(result.hasMore).toBe(true);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      id: "session-new",
      title: "Fix the release workflow",
      projectLabel: "-Users-test-project",
      resume: {
        executable: "claude",
        args: ["--resume", "session-new"],
      },
    });

    const detail = await service.read("claude", "session-new");
    expect(detail.entries.map((entry) => entry.text)).toEqual([
      "Fix the release workflow",
      "I found the issue.",
    ]);
    expect(detail.parseErrors).toBe(1);
    expect(detail.truncated).toBe(false);
  });

  it("uses OpenCode's bounded JSON CLI and sanitized export", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        stdout: JSON.stringify([
          {
            id: "ses_123",
            title: "Review Agent adapters",
            updated: 1783674347562,
            created: 1783674135075,
            projectId: "project-1",
            directory: "/workspace/project",
          },
        ]),
        stderr: "",
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          info: { id: "ses_123", title: "Review Agent adapters" },
          messages: [{ role: "user", content: "Audit the adapter" }],
        }),
        stderr: "",
      });
    const service = createAgentSessionService({
      homeDir: await createHome(),
      commandRunner: {
        resolve: vi.fn().mockResolvedValue("/opt/homebrew/bin/opencode"),
        run,
      },
    });

    const list = await service.list("opencode", { limit: 20 });
    expect(list.sessions[0]).toMatchObject({
      id: "ses_123",
      title: "Review Agent adapters",
      projectPath: "/workspace/project",
      resume: {
        executable: "/opt/homebrew/bin/opencode",
        args: ["--session", "ses_123"],
      },
    });
    const detail = await service.read("opencode", "ses_123");
    expect(detail.entries[0].text).toContain("Audit the adapter");
    expect(run).toHaveBeenNthCalledWith(
      1,
      "/opt/homebrew/bin/opencode",
      ["session", "list", "--format", "json", "--max-count", "21"],
      expect.objectContaining({ maxBuffer: 2 * 1024 * 1024 }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      "/opt/homebrew/bin/opencode",
      ["export", "ses_123", "--sanitize"],
      expect.objectContaining({ maxBuffer: 2 * 1024 * 1024 }),
    );
  });

  it("indexes Gemini project sessions and returns a bounded transcript", async () => {
    const homeDir = await createHome();
    const chatsDir = path.join(
      homeDir,
      ".gemini",
      "tmp",
      "project-hash",
      "chats",
    );
    await fs.mkdir(chatsDir, { recursive: true });
    await fs.writeFile(
      path.join(chatsDir, "session-2026-07-15-abcd1234.json"),
      JSON.stringify({
        sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        projectHash: "project-hash",
        startTime: "2026-07-15T10:00:00.000Z",
        lastUpdated: "2026-07-15T10:02:00.000Z",
        messages: [
          {
            id: "message-1",
            timestamp: "2026-07-15T10:00:00.000Z",
            type: "user",
            content: [{ text: "Review the release plan" }],
          },
          {
            id: "message-2",
            timestamp: "2026-07-15T10:01:00.000Z",
            type: "gemini",
            content: [{ text: "The plan has one open risk." }],
          },
        ],
      }),
    );

    const service = createAgentSessionService({ homeDir });
    const list = await service.list("gemini", { limit: 20 });

    expect(list.sessions[0]).toMatchObject({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      title: "Review the release plan",
      projectLabel: "project-hash",
      resume: {
        executable: "gemini",
        args: ["--resume", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
      },
    });
    const detail = await service.read(
      "gemini",
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(detail.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Review the release plan"],
      ["assistant", "The plan has one open risk."],
    ]);
    expect(detail.truncated).toBe(false);
  });

  it("fails closed for unsupported Agents, missing commands and unsafe ids", async () => {
    const service = createAgentSessionService({
      homeDir: await createHome(),
      commandRunner: {
        resolve: vi.fn().mockResolvedValue(null),
        run: vi.fn(),
      },
    });

    await expect(service.list("cursor", { limit: 20 })).rejects.toThrow(
      "AGENT_SESSION_UNSUPPORTED",
    );
    await expect(service.list("opencode", { limit: 20 })).rejects.toThrow(
      "AGENT_SESSION_COMMAND_NOT_FOUND",
    );
    await expect(service.read("claude", "../auth.json")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
    await expect(service.list("claude", { limit: 0 })).rejects.toThrow(
      "AGENT_SESSION_LIMIT_INVALID",
    );
  });
});
