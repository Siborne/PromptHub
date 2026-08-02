import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createQoderSessionAdapter } from "../../../src/main/services/agent-session-qoder";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Qoder session adapter", () => {
  let homeDir: string;
  let rootPath: string;
  let projectPath: string;
  let transcriptPath: string;
  const nativeSessionId = "86379a0e-8b8a-4f79-a9e1-5b670a1f5820";

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-qoder-"));
    rootPath = path.join(homeDir, ".qoder");
    projectPath = path.join(homeDir, "Projects", "PromptHub");
    transcriptPath = path.join(
      rootPath,
      "projects",
      "-Users-test-Projects-PromptHub",
      "transcript",
      `${nativeSessionId}.jsonl`,
    );
    await fs.mkdir(path.dirname(transcriptPath), { recursive: true });
    await fs.mkdir(projectPath, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeTranscript(): Promise<void> {
    const records = [
      {
        type: "session_meta",
        sessionId: nativeSessionId,
        uuid: "meta-1",
        timestamp: "2026-08-01T08:00:00.000Z",
        cwd: projectPath,
        data: {
          meta_type: "session_info",
          content: { mode: "agent", session_type: "assistant" },
        },
      },
      {
        type: "progress",
        sessionId: nativeSessionId,
        uuid: "progress-1",
        timestamp: "2026-08-01T08:00:01.000Z",
        cwd: projectPath,
        data: { type: "hook_progress", command: "private hook command" },
      },
      {
        type: "user",
        sessionId: nativeSessionId,
        uuid: "user-1",
        timestamp: "2026-08-01T08:00:02.000Z",
        cwd: projectPath,
        message: {
          role: "user",
          content: "Repair the Qoder transcript parser",
        },
      },
      {
        type: "assistant",
        sessionId: nativeSessionId,
        uuid: "assistant-1",
        timestamp: "2026-08-01T08:00:03.000Z",
        cwd: projectPath,
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Read only the visible conversation." },
            {
              type: "tool_use",
              id: "tool-1",
              name: "read_file",
              input: { secret: "private tool payload" },
            },
          ],
        },
      },
      {
        type: "user",
        sessionId: nativeSessionId,
        uuid: "tool-result-1",
        timestamp: "2026-08-01T08:00:04.000Z",
        cwd: projectPath,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "private tool result",
            },
          ],
        },
      },
      {
        type: "assistant",
        sessionId: nativeSessionId,
        uuid: "assistant-2",
        timestamp: "2026-08-01T08:00:05.000Z",
        cwd: projectPath,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: `Use source-bound pagination. ${"x".repeat(70_000)}`,
            },
          ],
        },
      },
    ];
    await fs.writeFile(
      transcriptPath,
      `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    );
  }

  it("lists, body-searches and cursor-pages the current official transcript", async () => {
    await writeTranscript();
    const adapter = createQoderSessionAdapter(rootPath);
    const resolvedTranscriptPath = await fs.realpath(transcriptPath);

    await expect(
      adapter.list(20, 0, "visible conversation"),
    ).resolves.toMatchObject({
      agentId: "qoder",
      adapter: "qoder-transcript-jsonl-v1",
      total: 1,
      hasMore: false,
      sessions: [
        {
          title: "Repair the Qoder transcript parser",
          projectLabel: "PromptHub",
          projectPath,
          createdAt: Date.parse("2026-08-01T08:00:00.000Z"),
          updatedAt: Date.parse("2026-08-01T08:00:05.000Z"),
          model: null,
          messageCount: 3,
          sourcePath: resolvedTranscriptPath,
          resume: null,
        },
      ],
    });
    await expect(adapter.list(20, 0, "private tool")).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });

    const session = (await adapter.list(20, 0)).sessions[0];
    expect(session.id).toMatch(/^qoder-[a-f0-9]{32}$/);
    const first = await adapter.read(session.id, { limit: 2 });
    expect(first).toMatchObject({
      entries: [
        { role: "user", text: "Repair the Qoder transcript parser" },
        { role: "assistant", text: "Read only the visible conversation." },
      ],
      parseErrors: 0,
      truncated: true,
      nextCursor: expect.any(String),
    });
    const second = await adapter.read(session.id, {
      cursor: first.nextCursor || undefined,
      limit: 2,
    });
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0].text.length).toBe(64 * 1024);
    expect(second.nextCursor).toBeNull();
    expect(second.entries.map((entry) => entry.text).join("\n")).not.toContain(
      "private",
    );

    const service = createAgentSessionService({
      homeDir,
      qoderRootDir: rootPath,
    });
    await expect(
      service.list("qoder", { limit: 20, search: "source-bound" }),
    ).resolves.toMatchObject({
      total: 1,
      adapter: "qoder-transcript-jsonl-v1",
    });
    await expect(
      service.read("qoder", session.id, { limit: 20 }),
    ).resolves.toMatchObject({
      sessionId: session.id,
      entries: expect.any(Array),
    });
  });

  it("paginates the full inventory instead of hiding older sessions", async () => {
    await Promise.all(
      Array.from({ length: 205 }, async (_, index) => {
        const id = `session-${String(index).padStart(4, "0")}`;
        const file = path.join(
          rootPath,
          "projects",
          "project",
          "transcript",
          `${id}.jsonl`,
        );
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(
          file,
          `${JSON.stringify({
            type: "user",
            sessionId: id,
            uuid: `message-${index}`,
            timestamp: index,
            cwd: projectPath,
            message: { role: "user", content: `Session ${index}` },
          })}\n`,
        );
      }),
    );
    const adapter = createQoderSessionAdapter(rootPath);
    await expect(adapter.list(10, 200)).resolves.toMatchObject({
      total: 205,
      hasMore: false,
      sessions: expect.arrayContaining([
        expect.objectContaining({ title: expect.stringMatching(/^Session /) }),
      ]),
    });
  });

  it("skips oversized records without hiding later readable messages", async () => {
    const oversized = {
      type: "progress",
      sessionId: nativeSessionId,
      uuid: "oversized-progress",
      timestamp: "2026-08-01T08:00:00.000Z",
      cwd: projectPath,
      data: { output: "x".repeat(2 * 1024 * 1024) },
    };
    const readable = {
      type: "user",
      sessionId: nativeSessionId,
      uuid: "user-after-oversized",
      timestamp: "2026-08-01T08:00:01.000Z",
      cwd: projectPath,
      message: { role: "user", content: "Keep scanning safely" },
    };
    await fs.writeFile(
      transcriptPath,
      `${JSON.stringify(oversized)}\n${JSON.stringify(readable)}\n`,
    );

    const adapter = createQoderSessionAdapter(rootPath);
    const session = (await adapter.list(20, 0)).sessions[0];
    await expect(adapter.read(session.id)).resolves.toMatchObject({
      parseErrors: 1,
      entries: [{ role: "user", text: "Keep scanning safely" }],
    });
  });

  it("fails closed for malformed, mismatched, symlinked and stale sources", async () => {
    await writeTranscript();
    const adapter = createQoderSessionAdapter(rootPath);
    const session = (await adapter.list(20, 0)).sessions[0];
    const first = await adapter.read(session.id, { limit: 1 });
    await fs.appendFile(transcriptPath, "\n");
    await expect(
      adapter.read(session.id, { cursor: first.nextCursor || undefined }),
    ).rejects.toThrow("AGENT_SESSION_CURSOR_STALE");
    await expect(
      adapter.read(session.id, { cursor: "not-base64" }),
    ).rejects.toThrow("AGENT_SESSION_CURSOR_INVALID");
    await expect(adapter.read(session.id, { limit: 0 })).rejects.toThrow(
      "AGENT_SESSION_DETAIL_REQUEST_INVALID",
    );

    const invalidDir = path.join(rootPath, "projects", "invalid", "transcript");
    await fs.mkdir(invalidDir, { recursive: true });
    await fs.writeFile(path.join(invalidDir, "malformed.jsonl"), "not json\n");
    await fs.writeFile(
      path.join(invalidDir, "mismatch.jsonl"),
      `${JSON.stringify({
        type: "user",
        sessionId: "different-session",
        message: { content: "must not appear" },
      })}\n`,
    );
    const outside = path.join(homeDir, "outside.jsonl");
    await fs.writeFile(outside, "{}\n");
    await fs.symlink(outside, path.join(invalidDir, "linked.jsonl"));

    const result = await adapter.list(20, 0);
    expect(result.total).toBe(1);
    await expect(adapter.read("../escape")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
    await expect(adapter.read("qoder-missing")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );

    const missing = createQoderSessionAdapter(path.join(homeDir, "missing"));
    await expect(missing.list(20, 0)).resolves.toMatchObject({ total: 0 });
    const linkedRoot = path.join(homeDir, "linked-root");
    await fs.symlink(rootPath, linkedRoot);
    await expect(
      createQoderSessionAdapter(linkedRoot).list(20, 0),
    ).rejects.toThrow("AGENT_SESSION_STORE_INVALID");
  });
});
