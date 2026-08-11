/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
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
import {
  acquireDatabaseMigrationIntent,
  DatabaseMigrationBusyError,
  getCurrentDatabaseSchemaInvariants,
  initDatabase as initSharedDatabase,
  listDatabaseSafetyPoints,
} from "@prompthub/db";

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

function listManagedDatabaseSafetyPoints(dbPath: string): string[] {
  return listDatabaseSafetyPoints(dbPath).map((point) => point.directoryPath);
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

  it("derives immutable legacy identities and final invariants from one manifest", () => {
    const invariants = getCurrentDatabaseSchemaInvariants();
    expect(
      new Set(invariants.legacyMigrations.map((entry) => entry.migrationId))
        .size,
    ).toBe(invariants.legacyMigrations.length);
    expect(
      new Set(invariants.legacyMigrations.map((entry) => entry.name)).size,
    ).toBe(invariants.legacyMigrations.length);
    expect(
      invariants.legacyMigrations.every((entry) =>
        /^[a-f0-9]{64}$/u.test(entry.checksum),
      ),
    ).toBe(true);
    expect(invariants.tables).toContain("canonical_resources");
    expect(invariants.indexes).toContain(
      "idx_canonical_resources_type_updated",
    );
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

  it("acquires one finite path-scoped migration leader and returns a typed busy error", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-migration-intent-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const leader = acquireDatabaseMigrationIntent(dbPath, {
      pid: 101,
      token: "1".repeat(32),
      isProcessAlive: () => true,
    });
    let clock = 0;

    expect(() =>
      acquireDatabaseMigrationIntent(dbPath, {
        pid: 202,
        token: "2".repeat(32),
        timeoutMs: 3,
        retryIntervalMs: 1,
        now: () => clock,
        sleep: (milliseconds) => {
          clock += milliseconds;
        },
        isProcessAlive: () => true,
      }),
    ).toThrow(DatabaseMigrationBusyError);
    try {
      acquireDatabaseMigrationIntent(dbPath, {
        pid: 202,
        token: "2".repeat(32),
        timeoutMs: 0,
        isProcessAlive: () => true,
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "DATABASE_MIGRATION_BUSY" });
    }

    leader.release();
    expect(fs.existsSync(leader.intentPath)).toBe(false);
  });

  it("recovers a stale migration owner but refuses malformed or unsafe intents", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-stale-intent-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const stale = acquireDatabaseMigrationIntent(dbPath, {
      pid: 101,
      token: "a".repeat(32),
      isProcessAlive: () => true,
    });
    const recovered = acquireDatabaseMigrationIntent(dbPath, {
      pid: 202,
      token: "b".repeat(32),
      isProcessAlive: (pid) => pid === 202,
    });
    stale.release();
    expect(fs.existsSync(recovered.intentPath)).toBe(true);
    recovered.release();

    fs.writeFileSync(`${dbPath}.migration-intent.json`, "{}", "utf8");
    expect(() => acquireDatabaseMigrationIntent(dbPath)).toThrow(
      "malformed or unsafe",
    );
    fs.rmSync(`${dbPath}.migration-intent.json`, { force: true });

    fs.mkdirSync(`${dbPath}.migration-intent.json`);
    expect(() => acquireDatabaseMigrationIntent(dbPath)).toThrow(
      "malformed or unsafe",
    );
  });

  it("refuses destructive migration while another registered client is alive", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-live-migration-client-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    createLegacySkillSchema(dbPath).close();
    const child = spawn(
      process.execPath,
      ["-e", "process.stdout.write('ready\\n'); setInterval(() => {}, 1000)"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.stdout.once("data", () => resolve());
    });
    const clientsPath = `${dbPath}.clients`;
    fs.mkdirSync(clientsPath);
    fs.writeFileSync(
      path.join(clientsPath, `${child.pid}.json`),
      JSON.stringify({
        pid: child.pid,
        registeredAt: new Date().toISOString(),
      }),
      "utf8",
    );

    try {
      expect(() => initSharedDatabase(dbPath)).toThrow(
        "requires all other clients to close",
      );
      expect(fs.existsSync(`${dbPath}.migration-intent.json`)).toBe(false);
      const probe = new DatabaseAdapter(dbPath);
      expect(
        probe.get(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompts'",
        ),
      ).toBeNull();
      probe.close();
    } finally {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
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
    const safetyPoints = listManagedDatabaseSafetyPoints(dbPath);

    expect(droppedIndex).toBeNull();
    expect(sourceIndex).toEqual({ name: "idx_skills_source_id" });
    expect(migrationRow).toEqual({ name: "drop_skill_name_unique_v2" });
    expect(safetyPoints).toHaveLength(1);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(safetyPoints[0], "manifest.json"), "utf8"),
      ),
    ).toMatchObject({
      formatVersion: 1,
      kind: "database-safety-point",
      reason: "pre-migration",
      state: "complete",
    });
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.startsWith("prompthub.db.backup-")),
    ).toEqual([]);
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

    expect(listManagedDatabaseSafetyPoints(dbPath)).toEqual([]);
  });

  it("creates a safety point when the handoff launch migration marker is missing", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-handoff-marker-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    initSharedDatabase(dbPath);
    closeDatabase();

    const current = new DatabaseAdapter(dbPath);
    current.run(
      "DELETE FROM schema_migrations WHERE name = ?",
      "agent_conversation_handoff_launch_v2",
    );
    current.close();

    initSharedDatabase(dbPath);
    closeDatabase();

    expect(listManagedDatabaseSafetyPoints(dbPath)).toHaveLength(1);
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
    const safetyPoints = listManagedDatabaseSafetyPoints(dbPath);
    expect(safetyPoints).toHaveLength(1);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(safetyPoints[0], "manifest.json"), "utf8"),
      ),
    ).toMatchObject({ reason: "integrity-repair", state: "complete" });
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.includes(".integrity-backup-")),
    ).toEqual([]);
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
    expect(listManagedDatabaseSafetyPoints(dbPath)).toHaveLength(1);
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.includes(".integrity-backup-")),
    ).toEqual([]);
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
    const originalExec = DatabaseAdapter.prototype.exec;
    const vacuumSpy = vi
      .spyOn(DatabaseAdapter.prototype, "exec")
      .mockImplementation(function (sql: string) {
        if (sql.startsWith("VACUUM INTO")) {
          throw new Error("disk full");
        }
        return originalExec.call(this, sql);
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
      vacuumSpy.mockRestore();
    }
  });

  it("rejects a database from a newer catalog version before rewriting it", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-newer-version-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const futureDb = new DatabaseAdapter(dbPath);
    futureDb.exec("CREATE TABLE keeper (id INTEGER PRIMARY KEY, value TEXT)");
    futureDb.pragma("user_version = 999");
    futureDb.close();
    const before = fs.readFileSync(dbPath);

    expect(() => initSharedDatabase(dbPath)).toThrow(
      "newer database schema version",
    );
    expect(fs.readFileSync(dbPath)).toEqual(before);
    expect(listManagedDatabaseSafetyPoints(dbPath)).toEqual([]);
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked database before compatibility inspection",
    () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-db-symlink-"),
      );
      tempDirs.push(tempDir);
      const dbPath = path.join(tempDir, "prompthub.db");
      initSharedDatabase(dbPath);
      closeDatabase();
      const linkPath = path.join(tempDir, "linked.db");
      fs.symlinkSync(dbPath, linkPath);

      expect(() => initSharedDatabase(linkPath)).toThrow(
        "Database path is not a regular file",
      );
    },
  );

  it("rejects tampered migration history before creating a new safety point", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-checksum-mismatch-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const currentDb = initSharedDatabase(dbPath);
    currentDb.run(
      "UPDATE database_migration_history SET checksum = ? WHERE migration_id = ?",
      "tampered",
      1,
    );
    closeDatabase();
    const before = fs.readFileSync(dbPath);

    expect(() => initSharedDatabase(dbPath)).toThrow(
      "migration checksum mismatch",
    );
    expect(fs.readFileSync(dbPath)).toEqual(before);
    expect(listManagedDatabaseSafetyPoints(dbPath)).toEqual([]);
  });

  it("rolls back every structural migration when finalization fails", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-atomic-rollback-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    createLegacySkillSchema(dbPath).close();

    expect(() =>
      initSharedDatabase(dbPath, {
        beforeMigrationCommit: () => {
          throw new Error("injected finalization failure");
        },
      }),
    ).toThrow("injected finalization failure");

    const probe = new DatabaseAdapter(dbPath);
    expect(
      probe.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompts'",
      ),
    ).toBeNull();
    expect(
      probe.get(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_skills_name_lower'",
      ),
    ).toEqual({ name: "idx_skills_name_lower" });
    expect(probe.pragma("user_version")).toEqual([{ user_version: 0 }]);
    probe.close();
    expect(listManagedDatabaseSafetyPoints(dbPath)).toHaveLength(1);
  });

  it("rolls back representative DDL, data, destructive, and history statement failures", () => {
    const failureCases = [
      "ALTER TABLE skills ADD COLUMN source_url",
      "UPDATE skills SET original_tags = tags",
      "DROP INDEX IF EXISTS idx_skills_name_lower",
      "INSERT INTO database_migration_history",
    ];
    const originalRun = DatabaseAdapter.prototype.run;

    for (const sqlFragment of failureCases) {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-db-statement-rollback-"),
      );
      tempDirs.push(tempDir);
      const dbPath = path.join(tempDir, "prompthub.db");
      createLegacySkillSchema(dbPath).close();
      let injected = false;
      const runSpy = vi
        .spyOn(DatabaseAdapter.prototype, "run")
        .mockImplementation(function (sql: string, ...params: unknown[]) {
          const normalizedSql = sql.replace(/\s+/gu, " ").trim();
          if (!injected && normalizedSql.includes(sqlFragment)) {
            injected = true;
            throw new Error(`injected statement failure: ${sqlFragment}`);
          }
          return originalRun.call(this, sql, ...params);
        });

      try {
        expect(() => initSharedDatabase(dbPath)).toThrow(
          `injected statement failure: ${sqlFragment}`,
        );
      } finally {
        runSpy.mockRestore();
      }

      expect(injected, sqlFragment).toBe(true);
      const probe = new DatabaseAdapter(dbPath);
      expect(
        probe.get(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompts'",
        ),
        sqlFragment,
      ).toBeNull();
      expect(
        probe.get(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_skills_name_lower'",
        ),
        sqlFragment,
      ).toEqual({ name: "idx_skills_name_lower" });
      expect(probe.pragma("user_version"), sqlFragment).toEqual([
        { user_version: 0 },
      ]);
      probe.close();
      expect(listManagedDatabaseSafetyPoints(dbPath), sqlFragment).toHaveLength(
        1,
      );
    }
  });

  it("retains the safety point and releases leadership when post-commit verification fails", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-post-commit-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    createLegacySkillSchema(dbPath).close();

    expect(() =>
      initSharedDatabase(dbPath, {
        afterMigrationCommit: () => {
          throw new Error("injected post-commit failure");
        },
      }),
    ).toThrow("injected post-commit failure");

    expect(listManagedDatabaseSafetyPoints(dbPath)).toHaveLength(1);
    expect(fs.existsSync(`${dbPath}.migration-intent.json`)).toBe(false);
    expect(() => initSharedDatabase(dbPath)).not.toThrow();
  });

  it("fails post-migration verification when a required index is removed", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-post-index-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");

    expect(() =>
      initSharedDatabase(dbPath, {
        afterMigrationCommit: () => {
          const committed = new DatabaseAdapter(dbPath);
          committed.exec("DROP INDEX idx_canonical_resources_type_updated");
          committed.close();
        },
      }),
    ).toThrow("Post-migration index is missing");
    expect(fs.existsSync(`${dbPath}.migration-intent.json`)).toBe(false);
  });

  it("keeps shared migrations host-neutral when local repositories are unresolved", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-db-host-reconciliation-"),
    );
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, "prompthub.db");
    const legacy = createLegacySkillSchema(dbPath);
    legacy.run(
      "INSERT INTO skills (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      "skill-1",
      "Writer",
      Date.now(),
      Date.now(),
    );
    legacy.close();

    expect(() => initSharedDatabase(dbPath)).not.toThrow();
    closeDatabase();

    const probe = new DatabaseAdapter(dbPath);
    expect(
      probe.get("SELECT local_repo_path FROM skills WHERE id = ?", "skill-1"),
    ).toEqual({ local_repo_path: null });
    expect(
      probe.get(
        "SELECT name FROM schema_migrations WHERE name = ?",
        "backfill_local_repo_path_v1",
      ),
    ).toEqual({ name: "backfill_local_repo_path_v1" });
    probe.close();
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

    initDesktopDatabase();
    expect(fs.existsSync(`${dbPath}.lock`)).toBe(false);
    expect(listManagedDatabaseSafetyPoints(dbPath)).toHaveLength(0);
    expect(
      fs
        .readdirSync(path.dirname(dbPath))
        .filter((entry) => entry.includes(".backup-before-0.5.3.")),
    ).toEqual([]);
  });
});
