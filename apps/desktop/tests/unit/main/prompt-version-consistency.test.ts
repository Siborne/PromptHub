/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DatabaseAdapter,
  SCHEMA_TABLES,
  repairPromptVersionConsistency,
} from "@prompthub/db";
import type Database from "@prompthub/db";

describe("repairPromptVersionConsistency", () => {
  let tempDir: string;
  let database: DatabaseAdapter.Database;

  function insertPrompt(
    overrides: Partial<{ id: string; current_version: number }> = {},
  ): void {
    const { id = `prompt-${Math.random()}` } = overrides;
    database
      .prepare(
        `INSERT INTO prompts (
          id, visibility, prompt_type, title, user_prompt, variables, tags,
          current_version, created_at, updated_at
        ) VALUES (?, 'private', 'text', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        "title",
        `content-of-${id}`,
        JSON.stringify([]),
        JSON.stringify([]),
        overrides.current_version ?? 0,
        Date.now(),
        Date.now(),
      );
  }

  function insertVersion(promptId: string, version: number): void {
    database
      .prepare(
        `INSERT INTO prompt_versions (
          id, prompt_id, version, user_prompt, variables, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `${promptId}-v${version}`,
        promptId,
        version,
        `v${version}-content`,
        JSON.stringify([]),
        Date.now(),
      );
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-version-consistency-"),
    );
    const dbPath = path.join(tempDir, "test.db");
    database = new DatabaseAdapter(dbPath);
    database.exec(SCHEMA_TABLES);
  });

  afterEach(() => {
    database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function allPrompts() {
    return database
      .prepare("SELECT id, current_version FROM prompts")
      .all() as Array<{ id: string; current_version: number }>;
  }

  it("converges current_version to the stored maximum when the pointer is stale or missing for prompts with history", () => {
    insertPrompt({ id: "ahead", current_version: 3 });
    insertVersion("ahead", 1);
    insertVersion("ahead", 2);

    const result = repairPromptVersionConsistency(database);

    expect(result.repairedPromptIds).toContain("ahead");
    const row = database
      .prepare("SELECT current_version FROM prompts WHERE id = ?")
      .get("ahead") as { current_version: number };
    expect(row.current_version).toBe(2);
    const count = database
      .prepare("SELECT COUNT(*) AS n FROM prompt_versions WHERE prompt_id = ?")
      .get("ahead") as { n: number };
    expect(count.n).toBe(2);
  });

  it("creates a v1 snapshot from the current prompt row when a prompt has content but no version rows", () => {
    insertPrompt({ id: "fresh", current_version: 0 });

    const result = repairPromptVersionConsistency(database);

    expect(result.createdInitialVersionPromptIds).toContain("fresh");
    const row = database
      .prepare("SELECT current_version FROM prompts WHERE id = ?")
      .get("fresh") as { current_version: number };
    expect(row.current_version).toBe(1);
    const version = database
      .prepare("SELECT * FROM prompt_versions WHERE prompt_id = ?")
      .get("fresh") as { version: number; user_prompt: string };
    expect(version.version).toBe(1);
    expect(version.user_prompt).toBe("content-of-fresh");
  });

  it("leaves healthy prompts untouched and reports no repair for them", () => {
    insertPrompt({ id: "ok", current_version: 2 });
    insertVersion("ok", 1);
    insertVersion("ok", 2);

    const result = repairPromptVersionConsistency(database);

    expect(result.repairedPromptIds).toEqual([]);
    expect(result.createdInitialVersionPromptIds).toEqual([]);
    const row = database
      .prepare("SELECT current_version FROM prompts WHERE id = ?")
      .get("ok") as { current_version: number };
    expect(row.current_version).toBe(2);
  });

  it("is idempotent and never fabricates a newer version than stored history", () => {
    insertPrompt({ id: "repeat", current_version: 9 });
    insertVersion("repeat", 1);

    const first = repairPromptVersionConsistency(database);
    const second = repairPromptVersionConsistency(database);

    expect(first.repairedPromptIds).toContain("repeat");
    expect(second.repairedPromptIds).toEqual([]);
    const row = allPrompts().find((p) => p.id === "repeat");
    expect(row?.current_version).toBe(1);
  });
});
