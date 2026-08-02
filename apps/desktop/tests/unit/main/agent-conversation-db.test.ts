/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AgentConversationDB,
  closeDatabase,
  initDatabase,
} from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";

describe("AgentConversationDB", () => {
  let tempDir: string;
  let database: Database.Database;
  let conversations: AgentConversationDB;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-conversations-"),
    );
    database = new Database(path.join(tempDir, "prompthub.db"));
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
    conversations = new AgentConversationDB(database);
  });

  afterEach(() => {
    database.close();
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores only PromptHub metadata and continuation lineage", () => {
    const tables = database
      .prepare(
        `SELECT name, sql FROM sqlite_master
         WHERE type = 'table' AND name LIKE 'agent_conversation_%'
         ORDER BY name`,
      )
      .all() as Array<{ name: string; sql: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "agent_conversation_handoffs",
      "agent_conversation_metadata",
    ]);
    expect(
      tables
        .map((table) => table.sql)
        .join(" ")
        .toLowerCase(),
    ).not.toMatch(/transcript|messages_json|content_json/);
  });

  it("creates, updates, soft-deletes, and restores conversation metadata", () => {
    const created = conversations.upsertMetadata({
      agentId: "claude",
      sessionId: "session-1",
      title: "Release investigation",
      projectId: "project-1",
      projectPath: "/workspace/prompt-hub",
      tags: ["release", "release", " urgent "],
      note: "Check updater logs",
      favorite: true,
    });

    expect(created).toMatchObject({
      agentId: "claude",
      sessionId: "session-1",
      title: "Release investigation",
      projectId: "project-1",
      tags: ["release", "urgent"],
      favorite: true,
      archivedAt: null,
      deletedAt: null,
    });
    expect(
      conversations.listMetadata("claude", ["session-1", "missing"]),
    ).toEqual([created]);

    const updated = conversations.upsertMetadata({
      agentId: "claude",
      sessionId: "session-1",
      title: "Release fix",
      projectId: null,
      projectPath: null,
      tags: [],
      note: null,
      favorite: false,
      archived: true,
    });
    expect(updated).toMatchObject({
      id: created.id,
      title: "Release fix",
      projectId: null,
      tags: [],
      note: null,
      favorite: false,
    });
    expect(updated.archivedAt).toEqual(expect.any(Number));

    const deleted = conversations.softDelete("claude", "session-1");
    expect(deleted.deletedAt).toEqual(expect.any(Number));
    expect(conversations.restore("claude", "session-1").deletedAt).toBeNull();
  });

  it("records a bounded handoff without storing the portable payload", () => {
    const handoff = conversations.createHandoff({
      sourceAgentId: "claude",
      sourceSessionId: "session-1",
      targetAgentId: "codex",
      projectId: "project-1",
      projectPath: "/workspace/prompt-hub",
      transport: "direct",
      payloadDigest: "sha256:abc123",
      status: "planned",
    });

    expect(handoff).toMatchObject({
      sourceAgentId: "claude",
      targetAgentId: "codex",
      payloadDigest: "sha256:abc123",
      status: "planned",
    });
    expect(
      conversations.updateHandoff(handoff.id, {
        status: "launched",
        targetSessionId: "target-session",
      }),
    ).toMatchObject({
      status: "launched",
      targetSessionId: "target-session",
    });
  });

  it("records launch-only handoffs without a copied status", () => {
    const handoff = conversations.createHandoff({
      sourceAgentId: "codex",
      sourceSessionId: "session-2",
      targetAgentId: "antigravity",
      projectPath: "/workspace/prompt-hub",
      transport: "launch",
      payloadDigest: "sha256:def456",
      status: "planned",
    });

    expect(handoff.transport).toBe("launch");
    expect(
      conversations.updateHandoff(handoff.id, { status: "launched" }),
    ).toMatchObject({ transport: "launch", status: "launched" });
  });

  it("rejects malformed identities and oversized user metadata", () => {
    expect(() =>
      conversations.upsertMetadata({
        agentId: "claude\0bad",
        sessionId: "session-1",
        tags: [],
      }),
    ).toThrow("agentId");
    expect(() =>
      conversations.upsertMetadata({
        agentId: "claude",
        sessionId: "session-1",
        tags: Array.from({ length: 65 }, (_, index) => `tag-${index}`),
      }),
    ).toThrow("tags");
    expect(() => conversations.listMetadata("claude", [])).toThrow(
      "sessionIds",
    );
  });
});

describe("Agent conversation projection migration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-conversation-migration-"),
    );
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("adds metadata and lineage tables to an existing database idempotently", () => {
    const dbPath = path.join(tempDir, "prompthub.db");
    const legacy = new Database(dbPath);
    legacy.exec(
      `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
       CREATE TABLE agent_conversation_handoffs (
         id TEXT PRIMARY KEY,
         source_agent_id TEXT NOT NULL,
         source_session_id TEXT NOT NULL,
         target_agent_id TEXT NOT NULL,
         project_id TEXT,
         project_path TEXT,
         transport TEXT NOT NULL CHECK(transport IN ('direct', 'launch-and-copy', 'unavailable')),
         payload_digest TEXT NOT NULL,
         status TEXT NOT NULL CHECK(status IN ('planned', 'launched', 'copied', 'failed')),
         target_session_id TEXT,
         error_code TEXT,
         created_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL
       );
       INSERT INTO agent_conversation_handoffs (
         id, source_agent_id, source_session_id, target_agent_id, project_path,
         transport, payload_digest, status, created_at, updated_at
       ) VALUES (
         'legacy-handoff', 'claude', 'session-1', 'antigravity', '/workspace',
         'launch-and-copy', 'sha256:legacy', 'copied', 1, 2
       );`,
    );
    legacy
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run("preserved", "yes");
    legacy.close();

    const migrated = initDatabase(dbPath);
    expect(
      migrated.get("SELECT value FROM settings WHERE key = ?", "preserved"),
    ).toEqual({ value: "yes" });
    expect(
      migrated.get(
        "SELECT name FROM schema_migrations WHERE name = ?",
        "agent_conversation_projection_v1",
      ),
    ).toEqual({ name: "agent_conversation_projection_v1" });
    expect(
      migrated.get(
        "SELECT name FROM schema_migrations WHERE name = ?",
        "agent_conversation_handoff_launch_v2",
      ),
    ).toEqual({ name: "agent_conversation_handoff_launch_v2" });
    expect(
      migrated.get(
        "SELECT transport, status FROM agent_conversation_handoffs WHERE id = ?",
        "legacy-handoff",
      ),
    ).toEqual({ transport: "launch", status: "launched" });
    expect(
      migrated.get(
        `SELECT COUNT(*) AS count FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('agent_conversation_metadata', 'agent_conversation_handoffs')`,
      ),
    ).toEqual({ count: 2 });

    closeDatabase();
    expect(() => initDatabase(dbPath)).not.toThrow();
  });
});
