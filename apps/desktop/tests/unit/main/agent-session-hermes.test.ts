import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Database from "../../../src/main/database/sqlite";
import { createHermesSessionAdapter } from "../../../src/main/services/agent-session-hermes";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Hermes session adapter", () => {
  let homeDir: string;
  let hermesRoot: string;
  let databasePath: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-hermes-"));
    hermesRoot = path.join(homeDir, ".hermes");
    databasePath = path.join(hermesRoot, "state.db");
    await fs.mkdir(hermesRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeStore(): Promise<void> {
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        model TEXT,
        model_config TEXT,
        system_prompt TEXT,
        parent_session_id TEXT,
        started_at REAL NOT NULL,
        ended_at REAL,
        end_reason TEXT,
        message_count INTEGER DEFAULT 0,
        cwd TEXT,
        git_repo_root TEXT,
        title TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        tool_name TEXT,
        timestamp REAL NOT NULL,
        reasoning TEXT,
        reasoning_content TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );
    `);
    const projectPath = path.join(homeDir, "Projects", "PromptHub");
    const insertSession = database.prepare(`INSERT INTO sessions
      (id, source, model, started_at, ended_at, message_count, cwd, git_repo_root, title)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertSession.run(
      "20260731_100000_abcd1234",
      "cli",
      "qwen3-coder",
      1_775_123_200,
      1_775_123_320,
      5,
      projectPath,
      projectPath,
      "Review PromptHub recovery",
    );
    insertSession.run(
      "20260730_090000_dcba4321",
      "telegram",
      "qwen3-coder",
      1_775_036_400,
      1_775_036_460,
      1,
      null,
      null,
      "Release status",
    );

    const insertMessage = database.prepare(`INSERT INTO messages
      (session_id, role, content, tool_calls, tool_name, timestamp,
       reasoning, reasoning_content, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertMessage.run(
      "20260731_100000_abcd1234",
      "system",
      "private system prompt",
      null,
      null,
      1_775_123_201,
      null,
      null,
      1,
    );
    insertMessage.run(
      "20260731_100000_abcd1234",
      "user",
      JSON.stringify([
        { type: "text", text: "Inspect the rollback checkpoint" },
      ]),
      null,
      null,
      1_775_123_210,
      null,
      null,
      1,
    );
    insertMessage.run(
      "20260731_100000_abcd1234",
      "tool",
      "private tool output",
      JSON.stringify([{ token: "must-not-leak" }]),
      "terminal",
      1_775_123_220,
      null,
      null,
      1,
    );
    insertMessage.run(
      "20260731_100000_abcd1234",
      "assistant",
      `Keep one recovery point. ${"x".repeat(70_000)}`,
      null,
      null,
      1_775_123_230,
      "private chain of thought",
      "private reasoning content",
      1,
    );
    insertMessage.run(
      "20260731_100000_abcd1234",
      "assistant",
      "superseded draft",
      null,
      null,
      1_775_123_240,
      null,
      null,
      0,
    );
    insertMessage.run(
      "20260730_090000_dcba4321",
      "user",
      "Ship the release",
      null,
      null,
      1_775_036_410,
      null,
      null,
      1,
    );
    database.close();
  }

  it("lists and body-searches every readable session from the official store", async () => {
    await writeStore();
    const adapter = createHermesSessionAdapter(hermesRoot);

    const firstPage = await adapter.list(1, 0);
    expect(firstPage).toMatchObject({
      agentId: "hermes",
      adapter: "hermes-state-db-v1",
      total: 2,
      hasMore: true,
      sessions: [
        {
          id: "20260731_100000_abcd1234",
          title: "Review PromptHub recovery",
          projectLabel: "PromptHub",
          projectPath: path.join(homeDir, "Projects", "PromptHub"),
          model: "qwen3-coder",
          messageCount: 2,
          resume: {
            executable: "hermes",
            args: ["--resume", "20260731_100000_abcd1234"],
            cwd: path.join(homeDir, "Projects", "PromptHub"),
          },
        },
      ],
    });
    await expect(adapter.list(1, 1)).resolves.toMatchObject({
      total: 2,
      hasMore: false,
      sessions: [{ id: "20260730_090000_dcba4321" }],
    });
    await expect(adapter.list(20, 0, "recovery point")).resolves.toMatchObject({
      total: 1,
      sessions: [{ id: "20260731_100000_abcd1234" }],
    });
    await expect(adapter.list(20, 0, "must-not-leak")).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });
    await expect(
      adapter.list(20, 0, "private chain of thought"),
    ).resolves.toMatchObject({ total: 0, sessions: [] });

    const service = createAgentSessionService({
      homeDir,
      hermesRootDir: hermesRoot,
    });
    await expect(
      service.list("hermes", { limit: 20, search: "rollback checkpoint" }),
    ).resolves.toMatchObject({
      adapter: "hermes-state-db-v1",
      total: 1,
      sessions: [{ id: "20260731_100000_abcd1234" }],
    });
  });

  it("cursor-pages only active user and assistant text", async () => {
    await writeStore();
    const adapter = createHermesSessionAdapter(hermesRoot);

    const first = await adapter.read("20260731_100000_abcd1234", { limit: 1 });
    expect(first).toMatchObject({
      agentId: "hermes",
      adapter: "hermes-state-db-v1",
      parseErrors: 0,
      truncated: false,
      entries: [
        {
          role: "user",
          text: "Inspect the rollback checkpoint",
          timestamp: 1_775_123_210_000,
        },
      ],
    });
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await adapter.read("20260731_100000_abcd1234", {
      limit: 1,
      cursor: first.nextCursor || undefined,
    });
    expect(second).toMatchObject({
      parseErrors: 0,
      truncated: true,
      nextCursor: null,
      entries: [{ role: "assistant" }],
    });
    expect(second.entries[0]?.text).toMatch(/^Keep one recovery point\. x+$/);
    expect(second.entries[0]?.text.length).toBeLessThanOrEqual(64 * 1024);
    expect(JSON.stringify([first, second])).not.toMatch(
      /private system|private tool|must-not-leak|private chain|superseded/,
    );

    await expect(
      adapter.read("20260730_090000_dcba4321", {
        cursor: first.nextCursor || undefined,
      }),
    ).rejects.toThrow("AGENT_SESSION_CURSOR_INVALID");
  });

  it("fails closed for missing, malformed and symlinked stores", async () => {
    const adapter = createHermesSessionAdapter(hermesRoot);
    await expect(adapter.list(20, 0)).resolves.toMatchObject({
      sessions: [],
      total: 0,
      hasMore: false,
    });
    await expect(adapter.read("missing-session")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );

    await fs.writeFile(databasePath, "not sqlite");
    await expect(adapter.list(20, 0)).rejects.toThrow(
      "AGENT_SESSION_STORE_INVALID",
    );

    await fs.rm(databasePath);
    const outside = path.join(homeDir, "outside.db");
    await fs.writeFile(outside, "not sqlite");
    await fs.symlink(outside, databasePath);
    await expect(adapter.list(20, 0)).rejects.toThrow(
      "AGENT_SESSION_STORE_INVALID",
    );
  });
});
