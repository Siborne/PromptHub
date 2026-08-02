import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createReasonixSessionAdapter } from "../../../src/main/services/agent-session-reasonix";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Reasonix session adapter", () => {
  let homeDir: string;
  let stateRoot: string;
  let projectPath: string;
  let sessionPath: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-reasonix-"));
    stateRoot = path.join(homeDir, ".reasonix-state");
    projectPath = path.join(homeDir, "Projects", "PromptHub");
    sessionPath = path.join(
      stateRoot,
      "projects",
      "-Users-test-Projects-PromptHub",
      "sessions",
      "20260801-120000-reasonix.jsonl",
    );
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.mkdir(projectPath, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeCurrentSession(): Promise<void> {
    await fs.writeFile(
      sessionPath,
      [
        JSON.stringify({ role: "system", content: "private system prompt" }),
        JSON.stringify({
          role: "user",
          content: "stale checkpoint prompt",
          createdAt: 1_775_210_400_000,
        }),
      ].join("\n") + "\n",
    );
    await fs.writeFile(
      `${sessionPath}.meta`,
      JSON.stringify({
        id: "native-reasonix-id",
        created_at: "2026-08-01T12:00:00.000Z",
        updated_at: "2026-08-01T12:05:00.000Z",
        scope: "project",
        workspace_root: projectPath,
        custom_title: "Repair session persistence",
        model: "deepseek-reasoner",
        schema_version: 1,
        turns: 2,
        preview: "Inspect the event log",
      }),
    );
    const eventPath = sessionPath.replace(/\.jsonl$/, ".events.jsonl");
    await fs.writeFile(
      eventPath,
      [
        JSON.stringify({
          schema_version: 1,
          type: "replace",
          revision: 1,
          messages: [
            { role: "system", content: "private system prompt" },
            {
              role: "user",
              content: "Inspect the event log",
              raw_content: "Inspect the event log",
              createdAt: 1_775_210_410_000,
            },
            {
              role: "assistant",
              content: "The checkpoint is not authoritative.",
              reasoning_content: "private reasoning",
              createdAt: 1_775_210_420_000,
            },
            { role: "tool", content: "private tool output" },
          ],
          created_at: "2026-08-01T12:01:00.000Z",
        }),
        JSON.stringify({
          schema_version: 1,
          type: "append",
          revision: 2,
          base_revision: 1,
          message_index: 4,
          messages: [
            {
              role: "user",
              content: "Find the durable replay marker",
              createdAt: 1_775_210_430_000,
            },
            {
              role: "assistant",
              content: `Use the event stream. ${"x".repeat(70_000)}`,
              createdAt: 1_775_210_440_000,
            },
          ],
          created_at: "2026-08-01T12:04:00.000Z",
        }),
        // A torn tail is ignored after the last valid event, matching Reasonix.
        '{"schema_version":1,"type":"append","message_index":6,"mess',
      ].join("\n"),
    );
  }

  it("lists and body-searches project sessions from the current event-log store", async () => {
    await writeCurrentSession();
    const globalSession = path.join(
      stateRoot,
      "sessions",
      "20260731-090000-global.jsonl",
    );
    await fs.mkdir(path.dirname(globalSession), { recursive: true });
    await fs.writeFile(
      globalSession,
      `${JSON.stringify({ role: "user", content: "Global release check" })}\n`,
    );
    await fs.utimes(
      globalSession,
      new Date("2026-07-31T09:00:00.000Z"),
      new Date("2026-07-31T09:00:00.000Z"),
    );

    const adapter = createReasonixSessionAdapter(stateRoot);
    const firstPage = await adapter.list(1, 0);
    expect(firstPage).toMatchObject({
      agentId: "reasonix",
      adapter: "reasonix-events-v1",
      total: 2,
      hasMore: true,
      sessions: [
        {
          title: "Repair session persistence",
          projectLabel: "PromptHub",
          projectPath,
          model: "deepseek-reasoner",
          messageCount: 4,
          sourcePath: sessionPath,
          resume: {
            executable: "reasonix",
            args: ["--resume", sessionPath],
            cwd: projectPath,
          },
        },
      ],
    });
    await expect(
      adapter.list(20, 0, "durable replay marker"),
    ).resolves.toMatchObject({
      total: 1,
      sessions: [{ sourcePath: sessionPath }],
    });
    await expect(
      adapter.list(20, 0, "private reasoning"),
    ).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });
    await expect(
      adapter.list(20, 0, "stale checkpoint prompt"),
    ).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });

    const service = createAgentSessionService({
      homeDir,
      reasonixStateRootDir: stateRoot,
    });
    await expect(
      service.list("reasonix", { limit: 20, search: "event stream" }),
    ).resolves.toMatchObject({ total: 1, adapter: "reasonix-events-v1" });
  });

  it("cursor-pages only visible user and assistant messages", async () => {
    await writeCurrentSession();
    const adapter = createReasonixSessionAdapter(stateRoot);
    const session = (await adapter.list(20, 0)).sessions[0];

    const first = await adapter.read(session.id, { limit: 2 });
    expect(first.entries).toEqual([
      expect.objectContaining({ role: "user", text: "Inspect the event log" }),
      expect.objectContaining({
        role: "assistant",
        text: "The checkpoint is not authoritative.",
      }),
    ]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.parseErrors).toBe(1);

    const second = await adapter.read(session.id, {
      cursor: first.nextCursor || undefined,
      limit: 2,
    });
    expect(second.entries.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(second.entries[1].text.length).toBe(64 * 1024);
    expect(second.truncated).toBe(true);
    expect(second.nextCursor).toBeNull();

    await fs.appendFile(sessionPath.replace(/\.jsonl$/, ".events.jsonl"), "\n");
    await expect(
      adapter.read(session.id, { cursor: first.nextCursor || undefined }),
    ).rejects.toThrow("AGENT_SESSION_CURSOR_STALE");
  });

  it("fails closed for future schemas, malformed checkpoints, and symlinks", async () => {
    const future = path.join(stateRoot, "sessions", "future.jsonl");
    await fs.mkdir(path.dirname(future), { recursive: true });
    await fs.writeFile(
      future,
      `${JSON.stringify({ role: "user", content: "fallback" })}\n`,
    );
    await fs.writeFile(
      future.replace(/\.jsonl$/, ".events.jsonl"),
      `${JSON.stringify({ schema_version: 2, type: "replace", messages: [] })}\n`,
    );
    const malformed = path.join(stateRoot, "sessions", "malformed.jsonl");
    await fs.writeFile(malformed, "not-json\n");
    const outside = path.join(homeDir, "outside.jsonl");
    await fs.writeFile(
      outside,
      `${JSON.stringify({ role: "user", content: "outside" })}\n`,
    );
    await fs.symlink(outside, path.join(stateRoot, "sessions", "linked.jsonl"));

    const adapter = createReasonixSessionAdapter(stateRoot);
    const result = await adapter.list(20, 0);
    expect(result.sessions).toEqual([]);
    expect(result.total).toBe(0);
  });
});
