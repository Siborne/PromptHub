/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AgentSessionIndexDB,
  closeDatabase,
  initDatabase,
  listDatabaseSafetyPoints,
} from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";

describe("AgentSessionIndexDB", () => {
  let tempDir: string;
  let database: Database.Database;
  let index: AgentSessionIndexDB;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-session-index-"),
    );
    database = new Database(path.join(tempDir, "prompthub.db"));
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
    index = new AgentSessionIndexDB(database);
  });

  afterEach(() => {
    database.close();
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function registerSource() {
    return index.registerSource({
      platformId: "codex",
      rootPath: "/Users/test/.codex/sessions",
      adapterId: "codex-jsonl-v1",
      adapterVersion: "1",
      enabled: true,
    });
  }

  it("creates constrained device-local source and index tables", () => {
    const objects = database
      .prepare(
        `SELECT type, name
         FROM sqlite_master
         WHERE name LIKE 'agent_session_%'
            OR name LIKE 'idx_agent_session_%'
         ORDER BY type, name`,
      )
      .all() as Array<{ type: string; name: string }>;

    expect(objects).toEqual(
      expect.arrayContaining([
        { type: "table", name: "agent_session_sources" },
        { type: "table", name: "agent_session_index" },
        { type: "index", name: "idx_agent_session_sources_platform" },
        { type: "index", name: "idx_agent_session_index_source_updated" },
        { type: "index", name: "idx_agent_session_index_source_status" },
      ]),
    );
    const indexColumns = database
      .prepare("PRAGMA table_info(agent_session_index)")
      .all() as Array<{ name: string }>;
    expect(indexColumns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(["content", "body", "transcript"]),
    );
    expect(() =>
      database
        .prepare(
          `INSERT INTO agent_session_sources (
             id, platform_id, root_path, adapter_id, adapter_version, enabled,
             last_status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("invalid", "codex", "/tmp", "adapter", "1", 2, "unknown", 1, 1),
    ).toThrow();
  });

  it("registers one stable source identity and updates public settings", () => {
    const created = registerSource();
    const repeated = index.registerSource({
      platformId: "codex",
      rootPath: "/Users/test/.codex/sessions",
      adapterId: "codex-jsonl-v1",
      adapterVersion: "2",
      enabled: false,
    });

    expect(repeated).toMatchObject({
      id: created.id,
      platformId: "codex",
      adapterVersion: "2",
      enabled: false,
      lastStatus: "idle",
    });
    expect(repeated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(index.listSources({ platformId: "codex" })).toEqual([repeated]);
    expect(index.listSources()).toEqual([repeated]);
    const disabled = index.registerSource({
      platformId: "qwen",
      rootPath: "/Users/test/.qwen/sessions",
      adapterId: "qwen-cli-v1",
      adapterVersion: "1",
      enabled: false,
    });
    expect(disabled.enabled).toBe(false);
    expect(
      index.registerSource({
        platformId: "qwen",
        rootPath: "/Users/test/.qwen/sessions",
        adapterId: "qwen-cli-v1",
        adapterVersion: "2",
        enabled: true,
      }).enabled,
    ).toBe(true);
    expect(() =>
      index.registerSource({
        platformId: "codex",
        rootPath: "bad\0path",
        adapterId: "codex-jsonl-v1",
        adapterVersion: "1",
      }),
    ).toThrow("rootPath");
  });

  it("bounds the device-local source rows exposed to portable backup orchestration", () => {
    const codex = registerSource();
    const claude = index.registerSource({
      platformId: "claude",
      rootPath: "/Users/test/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: false,
    });

    expect(index.listSourcesForBackup(2)).toEqual(
      expect.arrayContaining([codex, claude]),
    );
    expect(() => index.listSourcesForBackup(1)).toThrow(
      "Session source backup exceeds 1",
    );
    for (const invalidLimit of [0, 129, 1.5]) {
      expect(() => index.listSourcesForBackup(invalidLimit)).toThrow(
        "Session source backup limit must be between 1 and 128",
      );
    }
  });

  it("commits full scans atomically and preserves annotations for missing rows", () => {
    const source = registerSource();
    const first = index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scanCursor: "cursor-1",
      scannedAt: 100,
      status: "ok",
      records: [
        {
          externalId: "session-a",
          title: "First session",
          projectPath: "/workspace/a",
          updatedAt: 80,
          messageCount: 4,
          redactedPreview: "safe preview",
          sourcePath: "/Users/test/.codex/sessions/a.jsonl",
          sourceMtimeMs: 90,
          sourceSizeBytes: 1000,
          sourceDigest: "sha256:a",
          sourceStatus: "present",
        },
        {
          externalId: "session-b",
          title: "Second session",
          updatedAt: 70,
          sourcePath: "/Users/test/.codex/sessions/b.jsonl",
          sourceStatus: "present",
        },
      ],
    });
    expect(first.changedCount).toBe(2);
    const sessionA = index.listSessions({
      sourceId: source.id,
      search: "First session",
      limit: 10,
      offset: 0,
    }).items[0]!;
    index.updateAnnotations(sessionA.id, {
      tags: ["review", "重要"],
      note: "keep this note",
    });

    const second = index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "2",
      scanCursor: "cursor-2",
      scannedAt: 200,
      status: "partial",
      records: [
        {
          externalId: "session-b",
          title: "Second session updated",
          updatedAt: 190,
          sourcePath: "/Users/test/.codex/sessions/b.jsonl",
          sourceStatus: "parse-error",
        },
      ],
    });

    expect(second.source).toMatchObject({
      adapterVersion: "2",
      scanCursor: "cursor-2",
      lastStatus: "partial",
      lastScannedAt: 200,
      lastErrorCode: null,
    });
    expect(index.getSession(sessionA.id)).toMatchObject({
      sourceStatus: "missing",
      tags: ["review", "重要"],
      note: "keep this note",
      redactedPreview: "safe preview",
    });
    expect(second.changedCount).toBe(1);
    expect(index.getSessionByExternalId(source.id, "session-b")).toMatchObject({
      title: "Second session updated",
      sourceStatus: "parse-error",
    });
  });

  it("keeps unseen rows present during incremental scans", () => {
    const source = registerSource();
    index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scannedAt: 100,
      status: "ok",
      records: [
        {
          externalId: "old",
          title: "Old",
          sourcePath: "/sessions/old.jsonl",
          sourceStatus: "present",
        },
      ],
    });

    index.commitScan({
      sourceId: source.id,
      mode: "incremental",
      adapterVersion: "1",
      scannedAt: 200,
      status: "ok",
      records: [
        {
          externalId: "new",
          title: "New",
          sourcePath: "/sessions/new.jsonl",
          sourceStatus: "present",
        },
      ],
    });

    expect(
      index.listSessions({ sourceId: source.id, limit: 10, offset: 0 }).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalId: "old",
          sourceStatus: "present",
        }),
        expect.objectContaining({
          externalId: "new",
          sourceStatus: "present",
        }),
      ]),
    );
  });

  it("rolls back invalid scans and records failures without rewriting rows", () => {
    const source = registerSource();
    index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scanCursor: "good",
      scannedAt: 100,
      status: "ok",
      records: [
        {
          externalId: "stable",
          title: "Stable",
          sourcePath: "/sessions/stable.jsonl",
          sourceStatus: "present",
        },
      ],
    });
    const before = index.listSessions({
      sourceId: source.id,
      limit: 10,
      offset: 0,
    });

    expect(() =>
      index.commitScan({
        sourceId: source.id,
        mode: "full",
        adapterVersion: "2",
        scanCursor: "bad",
        scannedAt: 200,
        status: "ok",
        records: [
          {
            externalId: "duplicate",
            title: "One",
            sourcePath: "/sessions/one.jsonl",
            sourceStatus: "present",
          },
          {
            externalId: "duplicate",
            title: "Two",
            sourcePath: "/sessions/two.jsonl",
            sourceStatus: "present",
          },
        ],
      }),
    ).toThrow("Duplicate externalId");

    expect(
      index.listSessions({ sourceId: source.id, limit: 10, offset: 0 }),
    ).toEqual(before);
    expect(index.getSource(source.id)).toMatchObject({
      adapterVersion: "1",
      scanCursor: "good",
      lastStatus: "ok",
    });

    const failed = index.recordScanFailure({
      sourceId: source.id,
      scannedAt: 300,
      errorCode: "SESSION_SCAN_TIMEOUT",
    });
    expect(failed).toMatchObject({
      lastStatus: "error",
      lastScannedAt: 300,
      lastErrorCode: "SESSION_SCAN_TIMEOUT",
    });
    expect(
      index.listSessions({ sourceId: source.id, limit: 10, offset: 0 }),
    ).toEqual(before);
  });

  it("rolls back source and session writes when a persisted row fails", () => {
    const source = registerSource();
    index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scanCursor: "before",
      scannedAt: 100,
      status: "ok",
      records: [
        {
          externalId: "stable",
          title: "Stable",
          sourcePath: "/sessions/stable.jsonl",
          sourceStatus: "present",
        },
      ],
    });
    database.exec(`
      CREATE TRIGGER reject_exploding_session
      BEFORE INSERT ON agent_session_index
      WHEN NEW.external_id = 'explode'
      BEGIN
        SELECT RAISE(ABORT, 'injected session write failure');
      END;
    `);

    expect(() =>
      index.commitScan({
        sourceId: source.id,
        mode: "full",
        adapterVersion: "2",
        scanCursor: "after",
        scannedAt: 200,
        status: "ok",
        records: [
          {
            externalId: "new",
            title: "New",
            sourcePath: "/sessions/new.jsonl",
            sourceStatus: "present",
          },
          {
            externalId: "explode",
            title: "Explode",
            sourcePath: "/sessions/explode.jsonl",
            sourceStatus: "present",
          },
        ],
      }),
    ).toThrow("injected session write failure");

    expect(index.getSource(source.id)).toMatchObject({
      adapterVersion: "1",
      scanCursor: "before",
      lastScannedAt: 100,
    });
    expect(
      index.listSessions({ sourceId: source.id, limit: 10, offset: 0 }).items,
    ).toEqual([
      expect.objectContaining({
        externalId: "stable",
        sourceStatus: "present",
      }),
    ]);
  });

  it("uses literal search, bounded pagination, and cascade deletion", () => {
    const source = registerSource();
    index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scannedAt: 100,
      status: "ok",
      records: Array.from({ length: 205 }, (_, indexValue) => ({
        externalId: `session-${String(indexValue).padStart(3, "0")}`,
        title:
          indexValue === 204
            ? "Literal 100%_complete"
            : `Session ${indexValue}`,
        projectPath: `/workspace/${indexValue}`,
        redactedPreview: indexValue === 203 ? "body-only-preview" : undefined,
        updatedAt: indexValue,
        sourcePath: `/sessions/${indexValue}.jsonl`,
        sourceStatus: "present" as const,
      })),
    });

    const firstPage = index.listSessions({
      sourceId: source.id,
      limit: 500,
      offset: 0,
    });
    expect(firstPage.items).toHaveLength(200);
    expect(firstPage.total).toBe(205);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.items[0]?.externalId).toBe("session-204");

    expect(
      index.listSessions({
        sourceId: source.id,
        search: "100%_complete",
        limit: 10,
        offset: 0,
      }).items,
    ).toEqual([
      expect.objectContaining({
        externalId: "session-204",
        title: "Literal 100%_complete",
      }),
    ]);
    expect(
      index.listSessions({
        sourceId: source.id,
        search: "/WORKSPACE/42",
        limit: 10,
        offset: 0,
      }).items,
    ).toEqual([
      expect.objectContaining({
        externalId: "session-042",
        projectPath: "/workspace/42",
      }),
    ]);
    expect(
      index.listSessions({
        sourceId: source.id,
        search: "body-only-preview",
        limit: 10,
        offset: 0,
      }).items,
    ).toEqual([]);
    expect(
      index.listSessions({
        sourceId: source.id,
        statuses: ["present", "present"],
        limit: 0,
        offset: 0,
      }).items,
    ).toHaveLength(1);

    expect(index.removeSource(source.id)).toBe(true);
    expect(index.getSource(source.id)).toBeNull();
    expect(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM agent_session_index WHERE source_id = ?",
        )
        .get(source.id),
    ).toEqual({ count: 0 });
  });

  it("rejects malformed and oversized metadata before persistence", () => {
    const source = registerSource();
    expect(() =>
      index.commitScan({
        sourceId: source.id,
        mode: "full",
        adapterVersion: "1",
        scannedAt: Number.POSITIVE_INFINITY,
        status: "ok",
        records: [],
      }),
    ).toThrow("scannedAt");
    expect(() =>
      index.commitScan({
        sourceId: source.id,
        mode: "full",
        adapterVersion: "1",
        scannedAt: 1,
        status: "ok",
        records: [
          {
            externalId: "large",
            title: "x".repeat(1025),
            redactedPreview: "body".repeat(1000),
            sourcePath: "/sessions/large.jsonl",
            sourceStatus: "present",
          },
        ],
      }),
    ).toThrow("title");
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM agent_session_index")
        .get(),
    ).toEqual({ count: 0 });
    expect(() =>
      index.commitScan({
        sourceId: source.id,
        mode: "incremental",
        adapterVersion: "1",
        scannedAt: 1,
        status: "ok",
        records: Array.from({ length: 10_001 }, (_, itemIndex) => ({
          externalId: `session-${itemIndex}`,
          title: "Bounded",
          sourcePath: `/sessions/${itemIndex}.jsonl`,
          sourceStatus: "present" as const,
        })),
      }),
    ).toThrow("records exceeds");
  });

  it("fails closed for malformed API inputs and corrupt annotations", () => {
    const source = registerSource();
    const baseRecord = {
      externalId: "boundary",
      title: "Boundary",
      sourcePath: "/sessions/boundary.jsonl",
      sourceStatus: "present" as const,
    };
    const commit = (overrides: Record<string, unknown>) =>
      index.commitScan({
        sourceId: source.id,
        mode: "incremental",
        adapterVersion: "1",
        scannedAt: 1,
        status: "ok",
        records: [baseRecord],
        ...overrides,
      });

    expect(() =>
      index.registerSource({
        platformId: 1 as unknown as string,
        rootPath: "/tmp",
        adapterId: "adapter",
        adapterVersion: "1",
      }),
    ).toThrow("platformId must be a string");
    expect(() =>
      index.registerSource({
        platformId: "codex",
        rootPath: "/tmp",
        adapterId: "adapter",
        adapterVersion: "x".repeat(129),
      }),
    ).toThrow("adapterVersion");
    expect(() =>
      commit({ records: [{ ...baseRecord, projectPath: "bad\0path" }] }),
    ).toThrow("projectPath");
    expect(() =>
      commit({
        records: [
          {
            ...baseRecord,
            model: "   ",
            redactedPreview: "x".repeat(2049),
          },
        ],
      }),
    ).toThrow("redactedPreview");
    expect(() =>
      commit({ records: [{ ...baseRecord, createdAt: -1 }] }),
    ).toThrow("createdAt");
    expect(() =>
      commit({ records: [{ ...baseRecord, messageCount: -1 }] }),
    ).toThrow("messageCount");
    expect(() =>
      commit({ records: [{ ...baseRecord, sourceStatus: "unknown" }] }),
    ).toThrow("sourceStatus");
    expect(() => commit({ records: null })).toThrow("records must be an array");
    expect(() => commit({ scannedAt: undefined })).toThrow(
      "scannedAt is required",
    );
    expect(() => commit({ mode: "unknown" })).toThrow("mode is invalid");
    expect(() => commit({ status: "error" })).toThrow("status is invalid");
    expect(() =>
      index.recordScanFailure({
        sourceId: source.id,
        scannedAt: undefined as unknown as number,
        errorCode: "SESSION_SCAN_FAILED",
      }),
    ).toThrow("scannedAt is required");
    expect(() =>
      index.recordScanFailure({
        sourceId: source.id,
        scannedAt: 1,
        errorCode: "contains secret detail",
      }),
    ).toThrow("errorCode must be stable");
    expect(() =>
      index.listSessions({
        sourceId: source.id,
        statuses: [],
        limit: 10,
        offset: 0,
      }),
    ).toThrow("statuses are invalid");
    expect(() =>
      index.listSessions({
        sourceId: source.id,
        statuses: ["unknown" as never],
        limit: 10,
        offset: 0,
      }),
    ).toThrow("statuses are invalid");
    expect(() =>
      index.listSessions({
        sourceId: source.id,
        statuses: null as never,
        limit: 10,
        offset: 0,
      }),
    ).toThrow("statuses are invalid");
    expect(index.getSource("missing")).toBeNull();
    expect(index.getSession("missing")).toBeNull();
    expect(index.getSessionByExternalId(source.id, "missing")).toBeNull();
    expect(() =>
      index.commitScan({
        sourceId: "missing",
        mode: "full",
        adapterVersion: "1",
        scannedAt: 1,
        status: "ok",
        records: [],
      }),
    ).toThrow("Agent session source not found");
    expect(() =>
      index.updateAnnotations("missing", { tags: [], note: null }),
    ).toThrow("Agent session not found");

    index.commitScan({
      sourceId: source.id,
      mode: "incremental",
      adapterVersion: "1",
      scannedAt: 2,
      status: "ok",
      records: [baseRecord],
    });
    const session = index.getSessionByExternalId(source.id, "boundary")!;
    expect(() =>
      index.updateAnnotations(session.id, {
        tags: Array.from({ length: 33 }, (_, tagIndex) => `tag-${tagIndex}`),
      }),
    ).toThrow("tags are invalid");
    database
      .prepare("UPDATE agent_session_index SET tags_json = ? WHERE id = ?")
      .run("[1]", session.id);
    expect(() => index.getSession(session.id)).toThrow(
      "Invalid session tags in database",
    );
  });
});

describe("Agent session index migration", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-session-migration-"),
    );
    dbPath = path.join(tempDir, "prompthub.db");
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("adds session metadata tables idempotently without changing existing data", () => {
    const legacy = new Database(dbPath);
    legacy.exec(
      "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
    legacy
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run("preserved", "yes");
    legacy.close();

    const migrated = initDatabase(dbPath);
    expect(
      migrated
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get("preserved"),
    ).toEqual({ value: "yes" });
    expect(
      migrated
        .prepare(
          "SELECT name FROM schema_migrations WHERE name = 'agent_session_index_v1'",
        )
        .get(),
    ).toEqual({ name: "agent_session_index_v1" });
    expect(
      migrated
        .prepare(
          `SELECT COUNT(*) AS count
           FROM sqlite_master
           WHERE type = 'table'
             AND name IN ('agent_session_sources', 'agent_session_index')`,
        )
        .get(),
    ).toEqual({ count: 2 });

    closeDatabase();
    initDatabase(dbPath);
    closeDatabase();

    expect(listDatabaseSafetyPoints(dbPath)).toHaveLength(1);
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.startsWith("prompthub.db.backup-")),
    ).toEqual([]);
  });
});
