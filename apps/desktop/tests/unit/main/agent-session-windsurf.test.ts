import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Windsurf public transcript sessions", () => {
  let homeDir: string;
  let transcriptsDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "prompthub-windsurf-session-"),
    );
    transcriptsDir = path.join(homeDir, ".windsurf", "transcripts");
    await fs.mkdir(transcriptsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeTranscript(
    sessionId: string,
    lines: Array<string | Record<string, unknown>>,
    updatedAt: number,
  ): Promise<string> {
    const filePath = path.join(transcriptsDir, `${sessionId}.jsonl`);
    await fs.writeFile(
      filePath,
      `${lines
        .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
        .join("\n")}\n`,
      "utf8",
    );
    const timestamp = new Date(updatedAt);
    await fs.utimes(filePath, timestamp, timestamp);
    return filePath;
  }

  it("lists and reads only visible user and planner response text", async () => {
    const sourcePath = await writeTranscript(
      "trajectory-new",
      [
        {
          status: "done",
          type: "user_input",
          user_input: {
            user_response: "Review the release plan",
            rules_applied: { always_on: ["private-rule.md"] },
          },
        },
        {
          status: "done",
          type: "code_action",
          code_action: {
            path: "/workspace/private.ts",
            new_content: "PRIVATE_FILE_CONTENT",
          },
        },
        {
          status: "done",
          type: "planner_response",
          planner_response: {
            response: "The release plan needs one rollback step.",
          },
        },
        {
          status: "done",
          type: "future_private_tool_step",
          tool_info: { command_output: "PRIVATE_TOOL_OUTPUT" },
        },
        "{not-json",
      ],
      Date.parse("2026-07-28T01:02:03.000Z"),
    );
    await writeTranscript(
      "trajectory-old",
      [
        {
          status: "done",
          type: "user_input",
          user_input: { user_response: "Older task" },
        },
      ],
      Date.parse("2026-07-27T01:02:03.000Z"),
    );
    const sourceBefore = await fs.readFile(sourcePath, "utf8");
    const service = createAgentSessionService({ homeDir });

    const firstPage = await service.list("windsurf", { limit: 1 });
    expect(firstPage).toEqual({
      agentId: "windsurf",
      adapter: "windsurf-transcript-jsonl-v1",
      sessions: [
        {
          id: "trajectory-new",
          title: "Review the release plan",
          projectLabel: null,
          projectPath: null,
          createdAt: null,
          updatedAt: Date.parse("2026-07-28T01:02:03.000Z"),
          model: null,
          messageCount: 2,
          sizeBytes: expect.any(Number),
          nativeDeleteSupported: true,
          sourcePath,
          resume: null,
        },
      ],
      total: 2,
      hasMore: true,
    });
    await expect(
      service.list("windsurf", { limit: 1, offset: 1 }),
    ).resolves.toMatchObject({
      sessions: [{ id: "trajectory-old", title: "Older task" }],
      total: 2,
      hasMore: false,
    });

    const detail = await service.read("windsurf", "trajectory-new");
    expect(detail).toEqual({
      agentId: "windsurf",
      adapter: "windsurf-transcript-jsonl-v1",
      sessionId: "trajectory-new",
      entries: [
        {
          id: "0",
          role: "user",
          timestamp: null,
          text: "Review the release plan",
        },
        {
          id: "2",
          role: "assistant",
          timestamp: null,
          text: "The release plan needs one rollback step.",
        },
      ],
      parseErrors: 1,
      truncated: false,
    });
    expect(JSON.stringify(detail)).not.toContain("PRIVATE_FILE_CONTENT");
    expect(JSON.stringify(detail)).not.toContain("PRIVATE_TOOL_OUTPUT");
    await expect(fs.readFile(sourcePath, "utf8")).resolves.toBe(sourceBefore);
    await service.delete("windsurf", "trajectory-new");
    await expect(fs.access(sourcePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      service.list("windsurf", { limit: 20 }),
    ).resolves.toMatchObject({
      total: 1,
      sessions: [expect.objectContaining({ id: "trajectory-old" })],
    });
  });

  it("skips unsafe files and bounds transcript content", async () => {
    const outsidePath = path.join(homeDir, "outside.jsonl");
    await fs.writeFile(
      outsidePath,
      `${JSON.stringify({
        type: "user_input",
        user_input: { user_response: "outside secret" },
      })}\n`,
      "utf8",
    );
    await fs.symlink(
      outsidePath,
      path.join(transcriptsDir, "linked-session.jsonl"),
    );
    await writeTranscript(
      "invalid.name",
      [
        {
          type: "user_input",
          user_input: { user_response: "invalid id" },
        },
      ],
      Date.now(),
    );
    await writeTranscript(
      "bounded-session",
      [
        {
          type: "user_input",
          user_input: { user_response: "x".repeat(70 * 1024) },
        },
        {
          type: "future_private_tool_step",
          tool_info: {
            command_output: "private".repeat(384 * 1024),
          },
        },
      ],
      Date.now() + 1,
    );
    const service = createAgentSessionService({ homeDir });

    const list = await service.list("windsurf", { limit: 20 });
    expect(list.sessions.map((session) => session.id)).toEqual([
      "bounded-session",
    ]);
    expect(list.sessions[0]).toMatchObject({
      messageCount: null,
      resume: null,
    });

    const detail = await service.read("windsurf", "bounded-session");
    expect(detail.truncated).toBe(true);
    expect(detail.entries).toHaveLength(1);
    expect(detail.entries[0]?.text).toHaveLength(64 * 1024);
    await expect(service.read("windsurf", "../outside")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
    await expect(service.read("windsurf", "linked-session")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
  });
});
