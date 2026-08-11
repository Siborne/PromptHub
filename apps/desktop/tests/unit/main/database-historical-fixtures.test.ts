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
  closeDatabase,
  initDatabase,
  listDatabaseSafetyPoints,
} from "@prompthub/db";
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
});
