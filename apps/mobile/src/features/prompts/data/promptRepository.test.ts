import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import {
  initMobileDatabase,
  MOBILE_DATABASE_VERSION,
} from "../../../storage/mobileSchema";
import { createPromptRepository } from "./promptRepositoryCore";

interface NodeStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}

interface NodeDatabase {
  close(): void;
  exec(source: string): void;
  prepare(source: string): NodeStatement;
}

const DatabaseSync = createRequire(import.meta.url)("node:sqlite")
  .DatabaseSync as new (path: string) => NodeDatabase;

function adaptDatabase(database: NodeDatabase) {
  return {
    exec: async (source: string) => database.exec(source),
    getFirst: async (source: string, params: unknown[] = []) =>
      database.prepare(source).get(...params),
    getAll: async (source: string) => database.prepare(source).all(),
    run: async (source: string, params: unknown[]) =>
      database.prepare(source).run(...params),
  };
}

async function createDatabase() {
  const database = new DatabaseSync(":memory:");
  const adapter = adaptDatabase(database);
  await initMobileDatabase(adapter);
  return { adapter, database };
}

describe("mobile Prompt persistence", () => {
  it("creates, reads, updates, and deletes Prompt rows in SQLite", async () => {
    const { adapter, database } = await createDatabase();
    const repository = createPromptRepository(() => adapter);

    await repository.create({
      id: "prompt-1",
      title: "Review code",
      description: "Find correctness risks",
      systemPrompt: "Act as a reviewer",
      userPrompt: "Review this patch",
      tags: ["review", "code"],
      isFavorite: true,
    });

    expect(await repository.getById("prompt-1")).toMatchObject({
      title: "Review code",
      tags: ["review", "code"],
      isFavorite: true,
    });

    await repository.update("prompt-1", {
      title: "Review release",
      isFavorite: false,
    });
    expect(await repository.list()).toEqual([
      expect.objectContaining({
        id: "prompt-1",
        title: "Review release",
        isFavorite: false,
      }),
    ]);

    await repository.delete("prompt-1");
    expect(await repository.getById("prompt-1")).toBeNull();
    database.close();
  });

  it("adopts an existing unversioned mobile table without deleting rows", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT,
        user_prompt TEXT NOT NULL,
        variables TEXT,
        tags TEXT,
        is_favorite INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO prompts (
        id, title, user_prompt, tags, created_at, updated_at
      ) VALUES ('legacy', 'Legacy', 'Keep me', '[]', 1, 1);
    `);

    await initMobileDatabase(adaptDatabase(database));

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: MOBILE_DATABASE_VERSION,
    });
    expect(
      database.prepare("SELECT title FROM prompts WHERE id = 'legacy'").get(),
    ).toEqual({ title: "Legacy" });
    database.close();
  });

  it("normalizes malformed and incompatible persisted metadata", async () => {
    const { adapter, database } = await createDatabase();
    const insert = database.prepare(
      `INSERT INTO prompts (
          id, title, user_prompt, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insert.run("broken", "Broken tags", "Body", "not-json", 1, 1);
    insert.run("object", "Object tags", "Body", "{}", 1, 2);
    insert.run("mixed", "Mixed tags", "Body", '["tag", 2]', 1, 3);
    insert.run("empty", "Empty metadata", "Body", null, 1, 4);
    const repository = createPromptRepository(() => adapter);

    expect((await repository.getById("broken"))?.tags).toEqual([]);
    expect((await repository.getById("object"))?.tags).toEqual([]);
    expect((await repository.getById("mixed"))?.tags).toEqual([]);
    expect(await repository.getById("empty")).toMatchObject({
      description: undefined,
      systemPrompt: undefined,
      tags: [],
    });
    database.close();
  });

  it("stores optional Prompt fields as null without changing their public shape", async () => {
    const { adapter, database } = await createDatabase();
    const repository = createPromptRepository(() => adapter);

    await repository.create({
      id: "minimal",
      title: "Minimal",
      userPrompt: "Body",
      tags: [],
      isFavorite: false,
    });
    await repository.update("minimal", {
      title: "Minimal updated",
      isFavorite: true,
    });

    expect(await repository.getById("minimal")).toMatchObject({
      title: "Minimal updated",
      description: undefined,
      systemPrompt: undefined,
      isFavorite: true,
    });
    database.close();
  });

  it("rejects updates for missing Prompt rows", async () => {
    const { adapter, database } = await createDatabase();
    const repository = createPromptRepository(() => adapter);

    await expect(
      repository.update("missing", { title: "No row" }),
    ).rejects.toThrow("Prompt not found: missing");
    database.close();
  });

  it("rejects future schema versions without modifying the database", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA user_version = 99");

    await expect(initMobileDatabase(adaptDatabase(database))).rejects.toThrow(
      "Unsupported mobile database version: 99",
    );
    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 99,
    });
    database.close();
  });

  it("rolls back schema initialization failures", async () => {
    const commands: string[] = [];
    const database = {
      getFirst: async () => ({ user_version: 0 }),
      exec: async (source: string) => {
        commands.push(source);
        if (source.includes("CREATE TABLE")) throw new Error("disk full");
      },
    };

    await expect(initMobileDatabase(database)).rejects.toThrow("disk full");
    expect(commands[0]).toBe("BEGIN");
    expect(commands.at(-1)).toBe("ROLLBACK");
  });

  it("reports both initialization and rollback failures", async () => {
    const database = {
      getFirst: async () => ({ user_version: 0 }),
      exec: async (source: string) => {
        if (source.includes("CREATE TABLE")) throw new Error("disk full");
        if (source === "ROLLBACK") throw new Error("rollback failed");
      },
    };

    await expect(initMobileDatabase(database)).rejects.toMatchObject({
      message: "Mobile database initialization and rollback failed",
      errors: [
        expect.objectContaining({ message: "disk full" }),
        expect.objectContaining({ message: "rollback failed" }),
      ],
    });
  });

  it("initializes a database when the version pragma returns no row", async () => {
    const commands: string[] = [];
    await initMobileDatabase({
      getFirst: async () => null,
      exec: async (source) => {
        commands.push(source);
      },
    });

    expect(commands[0]).toBe("BEGIN");
    expect(commands.at(-1)).toBe("COMMIT");
  });
});
