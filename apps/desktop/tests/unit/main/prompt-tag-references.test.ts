/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DatabaseAdapter, SCHEMA_TABLES, PromptDB } from "@prompthub/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("PromptDB.countTagReferences", () => {
  let tempDir: string;
  let db: PromptDB;
  let dirDb: DatabaseAdapter.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-tag-ref-"));
    dirDb = new DatabaseAdapter(path.join(tempDir, "tags.db"));
    dirDb.exec(SCHEMA_TABLES);
    db = new PromptDB(dirDb);
  });

  afterEach(() => {
    dirDb.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function addPrompt(id: string, tags: string[]): void {
    dirDb
      .prepare(
        `INSERT INTO prompts (id, title, user_prompt, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, id, "content", JSON.stringify(tags), Date.now(), Date.now());
  }

  it("counts only exact array matches and ignores unparseable rows", () => {
    addPrompt("p1", ["ops", "cli"]);
    addPrompt("p2", ["ops"]);
    addPrompt("p3", ["opsx"]);
    dirDb
      .prepare(
        `INSERT INTO prompts (id, title, user_prompt, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run("p4", "p4", "c", "not-json", Date.now(), Date.now());

    expect(db.countTagReferences("ops")).toBe(2);
    expect(db.countTagReferences("opsx")).toBe(1);
    expect(db.countTagReferences("missing")).toBe(0);
  });

  it("returns zero for an empty tag", () => {
    expect(db.countTagReferences("")).toBe(0);
  });
});
