/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import DatabaseAdapter from "../../../src/main/database/sqlite";
import {
  closeDatabase,
  initDatabase as initDesktopDatabase,
} from "../../../src/main/database";
import {
  configureRuntimePaths,
  resetRuntimePaths,
} from "../../../src/main/runtime-paths";
import { initDatabase as initSharedDatabase } from "@prompthub/db";

function createLegacySkillSchema(dbPath: string): DatabaseAdapter.Database {
  const db = new DatabaseAdapter(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT,
      mcp_config TEXT,
      protocol_type TEXT DEFAULT 'mcp',
      version TEXT,
      author TEXT,
      tags TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_lower
    ON skills(LOWER(name));
  `);
  return db;
}

function createDatabaseWithFreelistMismatch(dbPath: string): void {
  const db = new DatabaseAdapter(dbPath);
  db.exec(`
    CREATE TABLE keeper (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE churn (id INTEGER PRIMARY KEY, payload BLOB NOT NULL);
    INSERT INTO keeper (value) VALUES ('preserved');
    WITH RECURSIVE counter(value) AS (
      SELECT 1
      UNION ALL
      SELECT value + 1 FROM counter WHERE value < 64
    )
    INSERT INTO churn (payload) SELECT randomblob(4096) FROM counter;
    DELETE FROM churn;
  `);
  expect(
    (db.pragma("freelist_count") as Array<{ freelist_count: number }>)[0]
      .freelist_count,
  ).toBeGreaterThan(0);
  db.close();

  const bytes = fs.readFileSync(dbPath);
  expect(bytes.readUInt32BE(32)).toBeGreaterThan(0);
  bytes.writeUInt32BE(0, 36);
  fs.writeFileSync(dbPath, bytes);
}

function createDatabaseWithIndexMismatch(dbPath: string): void {
  const database = new DatabaseAdapter(dbPath);
  database.exec(
    "CREATE TABLE keeper (id TEXT PRIMARY KEY, value TEXT); CREATE INDEX idx_keeper_value ON keeper(value);",
  );
  for (let index = 0; index < 20; index += 1) {
    database.run(
      "INSERT INTO keeper (id, value) VALUES (?, ?)",
      `id${index}`,
      `v${index}`,
    );
  }
  const indexRow = database.get(
    "SELECT rootpage FROM sqlite_master WHERE type = 'index' AND name = 'idx_keeper_value'",
  ) as { rootpage: number };
  database.close();

  const bytes = fs.readFileSync(dbPath);
  const pageSize = bytes.readUInt16BE(16) || 65_536;
  const pageOffset = (indexRow.rootpage - 1) * pageSize;
  expect(bytes[pageOffset]).toBe(10);
  expect(bytes.readUInt16BE(pageOffset + 3)).toBe(20);
  bytes.writeUInt16BE(19, pageOffset + 3);
  bytes[pageOffset + 7] = 7;
  fs.writeFileSync(dbPath, bytes);
}

describe("database migration locking regression", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("auto-finalizes one-shot statements through adapter helpers", () => {
    const db = new DatabaseAdapter(":memory:");

    db.exec("CREATE TABLE demo (id INTEGER PRIMARY KEY, name TEXT)");
    db.run("INSERT INTO demo (name) VALUES (?)", "first");

    expect(db.get("SELECT name FROM demo WHERE id = ?", 1)).toEqual({
      name: "first",
    });
    expect(db.all("SELECT name FROM demo ORDER BY id ASC")).toEqual([
      { name: "first" },
    ]);

    expect(() => db.run("DROP TABLE demo")).not.toThrow();

    db.close();
  });

  it("drops the legacy skills name index during migration without hitting table locks", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-migration-"),
    );
    tempDirs.push(tempDir);

    const dbPath = path.join(tempDir, "prompthub.db");
    const legacyDb = createLegacySkillSchema(dbPath);
    const now = Date.now();
    legacyDb.run(
      "INSERT INTO skills (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      "skill-1",
      "Writer",
      now,
      now,
    );
    legacyDb.close();

    const migratedDb = initSharedDatabase(dbPath);

    const droppedIndex = migratedDb.get(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_skills_name_lower'",
    );
    const sourceIndex = migratedDb.get(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_skills_source_id'",
    );
    const migrationRow = migratedDb.get(
      "SELECT name FROM schema_migrations WHERE name = ?",
      "drop_skill_name_unique_v2",
    );
    const backupFiles = fs
      .readdirSync(tempDir)
      .filter((entry) => entry.startsWith("prompthub.db.backup-"));

    expect(droppedIndex).toBeNull();
    expect(sourceIndex).toEqual({ name: "idx_skills_source_id" });
    expect(migrationRow).toEqual({ name: "drop_skill_name_unique_v2" });
    expect(backupFiles).toHaveLength(1);
  });

  it("does not create pre-migration backups when the schema is already current", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-current-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");

    initSharedDatabase(dbPath);
    closeDatabase();
    initSharedDatabase(dbPath);
    closeDatabase();

    const backupFiles = fs
      .readdirSync(tempDir)
      .filter((entry) => entry.startsWith("prompthub.db.backup-"));

    expect(backupFiles).toEqual([]);
  });

  it("repairs a freelist-only integrity mismatch before migrations without losing rows", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-freelist-repair-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    createDatabaseWithFreelistMismatch(dbPath);

    const db = initSharedDatabase(dbPath);

    expect(db.pragma("quick_check")).toEqual([{ quick_check: "ok" }]);
    expect(db.get("SELECT value FROM keeper WHERE id = 1")).toEqual({
      value: "preserved",
    });
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.includes(".integrity-backup-")),
    ).toHaveLength(1);
  });

  it("repairs index-only entry mismatches before migrations without losing rows", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-index-repair-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    createDatabaseWithIndexMismatch(dbPath);

    const db = initSharedDatabase(dbPath);

    expect(db.pragma("quick_check")).toEqual([{ quick_check: "ok" }]);
    expect(db.get("SELECT COUNT(*) AS count FROM keeper")).toEqual({
      count: 20,
    });
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.includes(".integrity-backup-")),
    ).toHaveLength(1);
  });

  it("stops before migration when the required backup cannot be created", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-backup-gate-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const legacyDb = new DatabaseAdapter(dbPath);
    legacyDb.exec("CREATE TABLE keeper (id INTEGER PRIMARY KEY, value TEXT)");
    legacyDb.close();
    const copySpy = vi.spyOn(fs, "copyFileSync").mockImplementation(() => {
      throw new Error("disk full");
    });

    try {
      expect(() => initSharedDatabase(dbPath)).toThrow("disk full");
      const probe = new DatabaseAdapter(dbPath);
      expect(
        probe.get(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompts'",
        ),
      ).toBeNull();
      probe.close();
    } finally {
      copySpy.mockRestore();
    }
  });

  it("fails closed without rewriting databases that have unsupported corruption", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-unsupported-corruption-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const db = new DatabaseAdapter(dbPath);
    db.exec("CREATE TABLE keeper (id INTEGER PRIMARY KEY, value TEXT)");
    db.close();
    const original = fs.readFileSync(dbPath);
    const corrupted = Buffer.from(original);
    corrupted[0] = 0;
    fs.writeFileSync(dbPath, corrupted);

    expect(() => initSharedDatabase(dbPath)).toThrow();
    expect(fs.readFileSync(dbPath)).toEqual(corrupted);
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.includes(".integrity-backup-")),
    ).toEqual([]);
  });

  it("does not report clearing a stale lock when no lock exists", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-no-lock-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    initSharedDatabase(dbPath);
    closeDatabase();

    expect(
      logSpy.mock.calls.some(([message]) =>
        String(message).includes("[DB] Cleared stale lock"),
      ),
    ).toBe(false);
  });

  it("recovers an ownerless legacy lock during Desktop startup", () => {
    const userDataPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-desktop-legacy-lock-"),
    );
    tempDirs.push(userDataPath);
    const dbPath = path.join(userDataPath, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    initSharedDatabase(dbPath);
    closeDatabase();
    fs.mkdirSync(`${dbPath}.lock`);
    configureRuntimePaths({ userDataPath });

    expect(() => initDesktopDatabase()).not.toThrow();
    expect(fs.existsSync(`${dbPath}.lock`)).toBe(false);
  });
});
