import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Database from "../../../src/main/database/sqlite";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Cherry Studio Agent session adapter", () => {
  let homeDir: string;
  let cherryRoot: string;
  let databasePath: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-cherry-"));
    cherryRoot = path.join(homeDir, "CherryStudio");
    databasePath = path.join(cherryRoot, "Data", "agents.db");
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeStore(): Promise<void> {
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        agent_type TEXT,
        agent_id TEXT,
        name TEXT,
        description TEXT,
        accessible_paths TEXT,
        instructions TEXT,
        model TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        created_at TEXT,
        updated_at TEXT,
        agent_session_id TEXT
      );
    `);
    database
      .prepare(
        `INSERT INTO sessions
        (id, name, description, accessible_paths, model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "cherry-session-1",
        "Review PromptHub release",
        "Release review",
        JSON.stringify([path.join(homeDir, "Projects", "PromptHub")]),
        "claude-sonnet-4-5",
        "2026-07-30T10:00:00.000Z",
        "2026-07-30T10:02:00.000Z",
      );
    const insert = database.prepare(`INSERT INTO session_messages
      (session_id, role, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)`);
    insert.run(
      "cherry-session-1",
      "user",
      "Inspect the rollback checkpoint",
      JSON.stringify({ token: "must-not-leak" }),
      "2026-07-30T10:00:30.000Z",
    );
    insert.run(
      "cherry-session-1",
      "tool",
      "private tool payload",
      null,
      "2026-07-30T10:00:40.000Z",
    );
    insert.run(
      "cherry-session-1",
      "assistant",
      JSON.stringify({ text: "Keep one recovery point." }),
      null,
      "2026-07-30T10:01:00.000Z",
    );
    database.close();
  }

  async function writeCurrentStore(): Promise<string> {
    const currentPath = path.join(cherryRoot, "Data", "cherrystudio.sqlite");
    const database = new Database(currentPath);
    database.exec(`
      CREATE TABLE agent_workspace (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL
      );
      CREATE TABLE agent_session (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        workspace_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE agent_session_message (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        data TEXT NOT NULL,
        searchable_text TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        model_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    const projectPath = path.join(homeDir, "Projects", "LatestCherry");
    database
      .prepare("INSERT INTO agent_workspace (id, name, path) VALUES (?, ?, ?)")
      .run("workspace-1", "LatestCherry", projectPath);
    database
      .prepare(
        `INSERT INTO agent_session
          (id, name, description, workspace_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "019c-current-session",
        "Current Cherry session",
        "Official v2 schema",
        "workspace-1",
        Date.parse("2026-07-31T10:00:00.000Z"),
        Date.parse("2026-07-31T10:02:00.000Z"),
      );
    const insert = database.prepare(`INSERT INTO agent_session_message
      (id, session_id, role, data, searchable_text, status, model_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const longVisibleAnswer = `Visible current answer ${"x".repeat(70_000)}`;
    insert.run(
      "019c-user-message",
      "019c-current-session",
      "user",
      JSON.stringify({
        parts: [{ type: "text", text: "Inspect current data" }],
      }),
      "Inspect current data",
      "success",
      null,
      Date.parse("2026-07-31T10:00:30.000Z"),
      Date.parse("2026-07-31T10:00:30.000Z"),
    );
    insert.run(
      "019c-assistant-message",
      "019c-current-session",
      "assistant",
      JSON.stringify({
        parts: [
          { type: "reasoning", text: "private chain" },
          { type: "tool-call", input: { token: "must-not-leak" } },
          { type: "text", text: longVisibleAnswer },
        ],
      }),
      `private chain\n${longVisibleAnswer}`,
      "success",
      "claude-sonnet-4-5",
      Date.parse("2026-07-31T10:01:00.000Z"),
      Date.parse("2026-07-31T10:01:00.000Z"),
    );
    database.close();
    return currentPath;
  }

  it("prefers the current official database and exposes only visible text parts", async () => {
    await writeStore();
    const currentPath = await writeCurrentStore();
    const service = createAgentSessionService({
      homeDir,
      cherryStudioRootDir: cherryRoot,
    });

    const listed = await service.list("cherry-studio", {
      limit: 20,
      search: "visible current answer",
    });
    expect(listed).toMatchObject({
      adapter: "cherry-agent-session-db-v2",
      total: 1,
      sessions: [
        {
          id: "019c-current-session",
          title: "Current Cherry session",
          projectLabel: "LatestCherry",
          projectPath: path.join(homeDir, "Projects", "LatestCherry"),
          model: "claude-sonnet-4-5",
          messageCount: 2,
          sourcePath: await fs.realpath(currentPath),
          resume: null,
        },
      ],
    });

    const detail = await service.read("cherry-studio", "019c-current-session");
    expect(detail).toMatchObject({
      adapter: "cherry-agent-session-db-v2",
      parseErrors: 0,
      nextCursor: null,
      truncated: true,
    });
    expect(detail.entries[0]).toMatchObject({
      role: "user",
      text: "Inspect current data",
    });
    expect(detail.entries[1]).toMatchObject({
      role: "assistant",
      text: expect.stringMatching(/^Visible current answer x+$/),
    });
    expect(detail.entries[1]?.text.length).toBeLessThanOrEqual(64 * 1024);
    expect(JSON.stringify(detail)).not.toContain("private chain");
    expect(JSON.stringify(detail)).not.toContain("must-not-leak");
    expect(listed.sessions[0]).toMatchObject({
      sizeBytes: expect.any(Number),
      nativeDeleteSupported: true,
    });

    await service.delete("cherry-studio", "019c-current-session");
    await expect(
      service.read("cherry-studio", "019c-current-session"),
    ).rejects.toThrow("AGENT_SESSION_NOT_FOUND");
    expect((await fs.stat(currentPath)).isFile()).toBe(true);
  });

  it("lists, searches and cursor-pages visible Agent messages read-only", async () => {
    await writeStore();
    const sourcePath = await fs.realpath(databasePath);
    const service = createAgentSessionService({
      homeDir,
      cherryStudioRootDir: cherryRoot,
    });
    const projectPath = path.join(homeDir, "Projects", "PromptHub");

    await expect(
      service.list("cherry-studio", { limit: 20, search: "recovery point" }),
    ).resolves.toEqual({
      agentId: "cherry-studio",
      adapter: "cherry-agent-session-db-v1",
      sessions: [
        {
          id: "cherry-session-1",
          title: "Review PromptHub release",
          projectLabel: "PromptHub",
          projectPath,
          createdAt: Date.parse("2026-07-30T10:00:00.000Z"),
          updatedAt: Date.parse("2026-07-30T10:02:00.000Z"),
          model: "claude-sonnet-4-5",
          messageCount: 2,
          sizeBytes: expect.any(Number),
          nativeDeleteSupported: true,
          sourcePath,
          resume: null,
        },
      ],
      total: 1,
      hasMore: false,
    });

    const first = await service.read("cherry-studio", "cherry-session-1", {
      limit: 1,
    });
    expect(first).toMatchObject({
      entries: [{ role: "user", text: "Inspect the rollback checkpoint" }],
      nextCursor: expect.any(String),
      truncated: false,
    });
    await expect(
      service.read("cherry-studio", "cherry-session-1", {
        cursor: first.nextCursor!,
        limit: 1,
      }),
    ).resolves.toMatchObject({
      entries: [{ role: "assistant", text: "Keep one recovery point." }],
      nextCursor: null,
      parseErrors: 0,
    });

    const stalePage = await service.read("cherry-studio", "cherry-session-1", {
      limit: 1,
    });
    const writable = new Database(databasePath);
    writable
      .prepare(
        `INSERT INTO session_messages
          (session_id, role, content, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run(
        "cherry-session-1",
        "assistant",
        "External update",
        "2026-07-30T10:03:00.000Z",
      );
    writable.close();
    await expect(
      service.read("cherry-studio", "cherry-session-1", {
        cursor: stalePage.nextCursor!,
        limit: 1,
      }),
    ).rejects.toThrow("AGENT_SESSION_CURSOR_STALE");

    const readOnly = new Database(databasePath, { readOnly: true });
    expect(readOnly.get("SELECT COUNT(*) AS total FROM sessions")).toEqual({
      total: 1,
    });
    readOnly.close();
  });

  it("returns an empty list for a missing store and fails closed on invalid stores", async () => {
    const missing = createAgentSessionService({
      homeDir,
      cherryStudioRootDir: cherryRoot,
    });
    await expect(
      missing.list("cherry-studio", { limit: 20 }),
    ).resolves.toMatchObject({ sessions: [], total: 0 });

    const incompletePath = path.join(cherryRoot, "Data", "cherrystudio.sqlite");
    const incomplete = new Database(incompletePath);
    incomplete.exec(`
      CREATE TABLE agent_session (id TEXT PRIMARY KEY);
      CREATE TABLE agent_session_message (id TEXT PRIMARY KEY);
    `);
    incomplete.close();
    await expect(missing.list("cherry-studio", { limit: 20 })).rejects.toThrow(
      "AGENT_SESSION_STORE_INVALID",
    );
    await fs.rm(incompletePath);

    await fs.writeFile(databasePath, "not sqlite");
    await expect(missing.list("cherry-studio", { limit: 20 })).rejects.toThrow(
      "AGENT_SESSION_STORE_INVALID",
    );

    await fs.rm(databasePath);
    const outside = path.join(homeDir, "outside.db");
    await fs.writeFile(outside, "not sqlite");
    await fs.symlink(outside, databasePath);
    await expect(missing.list("cherry-studio", { limit: 20 })).rejects.toThrow(
      "AGENT_SESSION_STORE_INVALID",
    );
    await expect(missing.read("cherry-studio", "../escape")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
  });

  it("closes the opened store when schema validation fails", async () => {
    const incompletePath = path.join(cherryRoot, "Data", "cherrystudio.sqlite");
    const incomplete = new Database(incompletePath);
    incomplete.exec("CREATE TABLE unrelated (id TEXT PRIMARY KEY)");
    incomplete.close();
    const close = vi.spyOn(Database.prototype, "close");

    await expect(
      createAgentSessionService({
        homeDir,
        cherryStudioRootDir: cherryRoot,
      }).list("cherry-studio", { limit: 20 }),
    ).rejects.toThrow("AGENT_SESSION_STORE_INVALID");
    expect(close).toHaveBeenCalledOnce();
  });
});
