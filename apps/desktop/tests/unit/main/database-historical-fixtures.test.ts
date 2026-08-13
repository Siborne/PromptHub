/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CURRENT_DATABASE_SCHEMA_VERSION,
  DATABASE_MIGRATION_MANIFEST,
  FolderDB,
  PromptDB,
  closeDatabase,
  initDatabase,
  listDatabaseSafetyPoints,
} from "@prompthub/db";
import {
  collectPromptCanonicalGraph,
  validatePromptCanonicalGraphSnapshot,
} from "@prompthub/core/prompt-canonical-export";
import {
  createHistoricalDatabaseFixture,
  HISTORICAL_DATABASE_FIXTURES,
} from "../../fixtures/historical-databases";
import Database from "../../../src/main/database/sqlite";

describe("historical database compatibility fixtures", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    closeDatabase();
    for (const directory of tempDirs.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  for (const descriptor of HISTORICAL_DATABASE_FIXTURES) {
    it(`adopts ${descriptor.tag} without losing prompt or skill history`, () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `prompthub-${descriptor.version}-fixture-`),
      );
      tempDirs.push(tempDir);
      const dbPath = createHistoricalDatabaseFixture(tempDir, descriptor);

      const database = initDatabase(dbPath);
      expect(
        database.get(
          "SELECT current_version FROM prompts WHERE id = ?",
          "prompt-history",
        ),
      ).toEqual({ current_version: 4 });
      expect(
        database.all(
          `SELECT version, user_prompt
           FROM prompt_versions
           WHERE prompt_id = ?
           ORDER BY version ASC`,
          "prompt-history",
        ),
      ).toEqual([
        { version: 1, user_prompt: "Version 1" },
        { version: 2, user_prompt: "Version 2" },
        { version: 3, user_prompt: "Version 3" },
        { version: 4, user_prompt: "Version 4" },
      ]);
      expect(
        database.get(
          "SELECT content FROM skills WHERE id = ?",
          "skill-history",
        ),
      ).toEqual({ content: "# Historical skill" });
      expect(database.pragma("user_version")).toEqual([
        { user_version: CURRENT_DATABASE_SCHEMA_VERSION },
      ]);
      expect(
        database.get(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
          "canonical_resources",
        ),
      ).toEqual({ name: "canonical_resources" });
      expect(
        database.all(
          `SELECT migration_id, name, checksum
           FROM database_migration_history
           ORDER BY migration_id ASC`,
        ),
      ).toEqual(
        DATABASE_MIGRATION_MANIFEST.map(({ migrationId, name, checksum }) => ({
          migration_id: migrationId,
          name,
          checksum,
        })),
      );
      closeDatabase();

      const safetyPoints = listDatabaseSafetyPoints(dbPath);
      expect(safetyPoints).toHaveLength(1);
      expect(safetyPoints[0].manifest.reason).toBe("pre-migration");

      initDatabase(dbPath);
      closeDatabase();
      expect(listDatabaseSafetyPoints(dbPath)).toHaveLength(1);

      const reopened = new Database(dbPath, { readOnly: true });
      expect(reopened.pragma("quick_check")).toEqual([{ quick_check: "ok" }]);
      reopened.close();
    });
  }

  it("repairs prompts whose historical version chain is empty", () => {
    const descriptor = HISTORICAL_DATABASE_FIXTURES.find(
      (fixture) => fixture.version === "0.5.2",
    )!;
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-empty-prompt-version-fixture-"),
    );
    tempDirs.push(tempDir);
    const dbPath = createHistoricalDatabaseFixture(tempDir, descriptor);
    const legacy = new Database(dbPath);
    const timestamp = Date.UTC(2026, 0, 2);

    legacy.run(
      `INSERT INTO prompts (
         id, title, system_prompt, user_prompt, variables, tags,
         current_version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      "prompt-zero-version",
      "Zero version prompt",
      "System zero",
      "User zero",
      '[{"name":"topic","type":"text","required":false,"defaultValue":"history"}]',
      '["history"]',
      0,
      timestamp,
      timestamp,
    );
    legacy.run(
      `INSERT INTO prompts (
         id, title, user_prompt, variables, tags,
         current_version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      "prompt-missing-version-row",
      "Missing version row",
      "User one",
      "[]",
      "[]",
      1,
      timestamp + 1,
      timestamp + 1,
    );
    legacy.run(
      `INSERT OR IGNORE INTO schema_migrations (name, applied_at)
       VALUES (?, ?)`,
      "fix_prompt_current_version_v1",
      timestamp,
    );
    legacy.close();

    const database = initDatabase(dbPath);
    expect(
      database.all(
        `SELECT id, current_version
         FROM prompts
         WHERE id IN (?, ?)
         ORDER BY id ASC`,
        "prompt-zero-version",
        "prompt-missing-version-row",
      ),
    ).toEqual([
      { id: "prompt-missing-version-row", current_version: 1 },
      { id: "prompt-zero-version", current_version: 1 },
    ]);
    expect(
      database.all(
        `SELECT prompt_id, version, system_prompt, user_prompt, variables, created_at
         FROM prompt_versions
         WHERE prompt_id IN (?, ?)
         ORDER BY prompt_id ASC`,
        "prompt-zero-version",
        "prompt-missing-version-row",
      ),
    ).toEqual([
      {
        prompt_id: "prompt-missing-version-row",
        version: 1,
        system_prompt: null,
        user_prompt: "User one",
        variables: "[]",
        created_at: timestamp + 1,
      },
      {
        prompt_id: "prompt-zero-version",
        version: 1,
        system_prompt: "System zero",
        user_prompt: "User zero",
        variables:
          '[{"name":"topic","type":"text","required":false,"defaultValue":"history"}]',
        created_at: timestamp,
      },
    ]);
    validatePromptCanonicalGraphSnapshot(
      collectPromptCanonicalGraph(
        new PromptDB(database),
        new FolderDB(database),
        database,
      ),
    );
    closeDatabase();

    const reopened = initDatabase(dbPath);
    expect(
      reopened.get(
        `SELECT COUNT(*) AS count
         FROM prompt_versions
         WHERE prompt_id IN (?, ?)`,
        "prompt-zero-version",
        "prompt-missing-version-row",
      ),
    ).toEqual({ count: 2 });
  });
});
