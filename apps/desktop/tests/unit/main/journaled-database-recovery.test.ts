/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import Database from "../../../src/main/database/sqlite";
import { performJournaledDatabaseRecovery } from "../../../src/main/services/journaled-database-recovery";

describe("journaled database recovery", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function createRoot(name: string, value: string): string {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
    roots.push(base);
    const databasePath = path.join(base, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    database.exec("CREATE TABLE marker (value TEXT NOT NULL)");
    database.prepare("INSERT INTO marker (value) VALUES (?)").run(value);
    database.close();
    return base;
  }

  function readMarker(root: string): string {
    const database = new Database(path.join(root, "data", "prompthub.db"), {
      readOnly: true,
    });
    try {
      return (database.get("SELECT value FROM marker") as { value: string }).value;
    } finally {
      database.close();
    }
  }

  it("publishes a recovered directory as one verified state", async () => {
    const active = createRoot("prompthub-active", "before");
    const source = createRoot("prompthub-source", "after");
    fs.mkdirSync(path.join(active, "config"));
    fs.writeFileSync(path.join(active, "config", "app.json"), "active-config");
    fs.mkdirSync(path.join(source, "data", "assets"), { recursive: true });
    fs.writeFileSync(path.join(source, "data", "assets", "image.bin"), "image");

    const result = await performJournaledDatabaseRecovery(source, active);

    expect(result.success).toBe(true);
    expect(readMarker(active)).toBe("after");
    expect(fs.readFileSync(path.join(active, "data", "assets", "image.bin"), "utf8")).toBe(
      "image",
    );
    expect(fs.readFileSync(path.join(active, "config", "app.json"), "utf8")).toBe(
      "active-config",
    );
    expect(result.backupPath).toContain(path.join("backups", "recovery"));
    expect(readMarker(path.join(result.backupPath!, "root"))).toBe("before");
  });

  it("recovers a standalone database while retaining canonical file domains", async () => {
    const active = createRoot("prompthub-active-file", "before");
    const sourceRoot = createRoot("prompthub-source-file", "after");
    const sourceDatabase = path.join(sourceRoot, "data", "prompthub.db");
    fs.mkdirSync(path.join(active, "data", "skills", "skill-1"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(active, "data", "skills", "skill-1", "SKILL.md"), "skill");

    const result = await performJournaledDatabaseRecovery(sourceDatabase, active);

    expect(result.success).toBe(true);
    expect(readMarker(active)).toBe("after");
    expect(
      fs.readFileSync(path.join(active, "data", "skills", "skill-1", "SKILL.md"), "utf8"),
    ).toBe("skill");
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symlink in the incoming durable tree before publication",
    async () => {
      const active = createRoot("prompthub-active-link", "before");
      const source = createRoot("prompthub-source-link", "after");
      const outside = path.join(source, "outside.txt");
      fs.writeFileSync(outside, "outside");
      fs.symlinkSync(outside, path.join(source, "data", "linked.txt"));

      const result = await performJournaledDatabaseRecovery(source, active);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/symbolic link/i);
      expect(readMarker(active)).toBe("before");
      expect(fs.readFileSync(outside, "utf8")).toBe("outside");
    },
  );
});
