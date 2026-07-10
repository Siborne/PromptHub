import fs from "fs";
import os from "os";
import path from "path";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { fileURLToPath } from "url";

import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "@prompthub/core";
import { acquireDatabaseClientLease } from "@prompthub/db/database-client-lock";
import { closeDatabase, initDatabase, PromptDB } from "@prompthub/db";

function createFixture(): { root: string; dbPath: string } {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-db-lock-test-"),
  );
  return { root, dbPath: path.join(root, "prompthub.db") };
}

function writeLease(dbPath: string, pid: number, content?: string): void {
  const clientsDir = `${dbPath}.clients`;
  fs.mkdirSync(clientsDir, { recursive: true });
  fs.writeFileSync(
    path.join(clientsDir, `${pid}.json`),
    content ?? JSON.stringify({ pid, registeredAt: new Date().toISOString() }),
    "utf8",
  );
}

function waitForOutput(
  child: ChildProcessWithoutNullStreams,
  expected: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes(expected)) {
        resolve();
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (!output.includes(expected)) {
        reject(new Error(`Child exited ${code}: ${output}`));
      }
    });
  });
}

function collectChildOutput(
  child: ChildProcessWithoutNullStreams,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.once("error", reject);
    child.once("exit", (code) => {
      code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout));
    });
  });
}

function spawnLockClient(dbPath: string, mode: "writer" | "reader") {
  const cliRoot = fileURLToPath(new URL("../", import.meta.url));
  const fixture = fileURLToPath(
    new URL("./fixtures/database-lock-client.ts", import.meta.url),
  );
  return spawn(process.execPath, ["--import", "tsx", fixture, dbPath, mode], {
    cwd: cliRoot,
  });
}

describe("database client lock coordination", () => {
  const roots: string[] = [];

  afterEach(() => {
    closeDatabase();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves a writer lock owned by another live PromptHub client", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    fs.mkdirSync(`${fixture.dbPath}.lock`);
    writeLease(fixture.dbPath, 42);

    const lease = acquireDatabaseClientLease(fixture.dbPath, {
      pid: 7,
      isProcessAlive: (pid) => pid === 42,
      registerExitHandler: false,
    });

    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);
    expect(fs.existsSync(`${fixture.dbPath}.clients/42.json`)).toBe(true);
    lease.release();
  });

  it("preserves a live registered writer during legacy lock recovery", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    fs.mkdirSync(`${fixture.dbPath}.lock`);
    writeLease(fixture.dbPath, 42);

    const lease = acquireDatabaseClientLease(fixture.dbPath, {
      pid: 7,
      isProcessAlive: (pid) => pid === 42,
      recoverUnregisteredLock: true,
      registerExitHandler: false,
    });

    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);
    lease.release();
  });

  it("recovers an orphan lock and prunes dead or malformed leases", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    fs.mkdirSync(`${fixture.dbPath}.lock`);
    writeLease(fixture.dbPath, 42);
    writeLease(fixture.dbPath, 99, "not-json");
    writeLease(fixture.dbPath, 100, JSON.stringify({ pid: 101 }));

    const lease = acquireDatabaseClientLease(fixture.dbPath, {
      pid: 7,
      isProcessAlive: () => false,
      registerExitHandler: false,
    });

    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.clients/42.json`)).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.clients/99.json`)).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.clients/100.json`)).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.clients/7.json`)).toBe(true);
    lease.release();
    lease.release();
    expect(fs.existsSync(`${fixture.dbPath}.clients/7.json`)).toBe(false);
  });

  it("preserves a lock with no registered owner for mixed-version safety", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    fs.mkdirSync(`${fixture.dbPath}.lock`);

    const lease = acquireDatabaseClientLease(fixture.dbPath, {
      pid: 7,
      isProcessAlive: () => false,
      registerExitHandler: false,
    });

    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);
    lease.release();
  });

  it("preserves a lock when unknown lease metadata cannot be pruned", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    fs.mkdirSync(`${fixture.dbPath}.lock`);
    fs.mkdirSync(`${fixture.dbPath}.clients`, { recursive: true });
    fs.mkdirSync(`${fixture.dbPath}.clients/unknown-entry`);

    const lease = acquireDatabaseClientLease(fixture.dbPath, {
      pid: 7,
      isProcessAlive: () => false,
      registerExitHandler: false,
    });

    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);
    expect(fs.existsSync(`${fixture.dbPath}.clients/unknown-entry`)).toBe(true);
    lease.release();
  });

  it("rolls back its registration when lease scanning fails", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    writeLease(fixture.dbPath, 42);

    expect(() =>
      acquireDatabaseClientLease(fixture.dbPath, {
        pid: 7,
        isProcessAlive: () => {
          throw new Error("process probe failed");
        },
        registerExitHandler: false,
      }),
    ).toThrow("process probe failed");
    expect(fs.existsSync(`${fixture.dbPath}.clients/7.json`)).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.clients/42.json`)).toBe(true);
  });

  it("uses one process exit listener for multiple database leases", () => {
    const first = createFixture();
    const second = createFixture();
    roots.push(first.root, second.root);
    const listenerCount = process.listenerCount("exit");

    const firstLease = acquireDatabaseClientLease(first.dbPath);
    const secondLease = acquireDatabaseClientLease(second.dbPath);

    expect(process.listenerCount("exit")).toBe(listenerCount + 1);
    firstLease.release();
    expect(process.listenerCount("exit")).toBe(listenerCount + 1);
    secondLease.release();
    expect(process.listenerCount("exit")).toBe(listenerCount);
  });

  it("cleans up its lease when database initialization fails", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    fs.writeFileSync(fixture.dbPath, "not a sqlite database", "utf8");
    const listenerCount = process.listenerCount("exit");

    expect(() => initDatabase(fixture.dbPath)).toThrow();

    expect(fs.existsSync(`${fixture.dbPath}.clients/${process.pid}.json`)).toBe(
      false,
    );
    expect(process.listenerCount("exit")).toBe(listenerCount);
  });

  it("registers normal clients and configures a bounded busy timeout", () => {
    const fixture = createFixture();
    roots.push(fixture.root);

    const database = initDatabase(fixture.dbPath);

    expect(database.pragma("busy_timeout")).toEqual([{ timeout: 5000 }]);
    expect(fs.existsSync(`${fixture.dbPath}.clients/${process.pid}.json`)).toBe(
      true,
    );
    closeDatabase();
    expect(fs.existsSync(`${fixture.dbPath}.clients/${process.pid}.json`)).toBe(
      false,
    );
  });

  it("releases write locks after prepared statement operations", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const database = initDatabase(fixture.dbPath);
    const promptDb = new PromptDB(database);

    promptDb.create({ title: "lease regression", userPrompt: "body" });

    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(false);
    closeDatabase();
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(false);
    expect(() => initDatabase(fixture.dbPath)).not.toThrow();
  });

  it("keeps reusable statements functional without retaining writer locks", () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const database = initDatabase(fixture.dbPath);
    database.exec("CREATE TABLE statement_stress (value INTEGER NOT NULL)");
    const insert = database.prepare(
      "INSERT INTO statement_stress (value) VALUES (?)",
    );

    const insertMany = database.transaction(() => {
      for (let value = 0; value < 500; value += 1) {
        insert.run(value);
      }
    });
    insertMany();

    expect(
      database.prepare("SELECT COUNT(*) AS count FROM statement_stress").get(),
    ).toEqual({ count: 500 });
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(false);
  });

  it("serializes real overlapping writers across processes", async () => {
    const fixture = createFixture();
    roots.push(fixture.root);
    const writer = spawnLockClient(fixture.dbPath, "writer");
    const writerCompletion = collectChildOutput(writer);
    await waitForOutput(writer, "writer-ready");

    const reader = spawnLockClient(fixture.dbPath, "reader");
    let readerOpened = false;
    reader.stdout.on("data", (chunk) => {
      readerOpened ||= chunk.toString().includes('{"result":"opened"');
    });
    const readerCompletion = collectChildOutput(reader);
    await waitForOutput(reader, "reader-opening");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(readerOpened).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);

    writer.stdin.end("release\n");
    const [readerOutput] = await Promise.all([
      readerCompletion,
      writerCompletion,
    ]);
    const resultLine = readerOutput
      .trim()
      .split("\n")
      .find((line) => line.startsWith('{"result"'));

    expect(resultLine).toBeDefined();
    expect(JSON.parse(resultLine as string)).toMatchObject({
      result: "opened",
    });
  }, 20_000);

  for (const message of [
    "database is locked",
    "database table is locked",
    "SQLITE_BUSY",
  ]) {
    it(`returns an actionable conflict for ${message}`, async () => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const exitCode = await runCli(
        ["prompt", "list"],
        {
          stdout: (output) => stdout.push(output),
          stderr: (output) => stderr.push(output),
        },
        undefined,
        {
          initDatabase: () => {
            throw new Error(message);
          },
          closeDatabase: () => undefined,
        },
      );

      expect(exitCode).toBe(4);
      expect(stdout).toEqual([]);
      expect(JSON.parse(stderr.join("\n"))).toMatchObject({
        error: {
          code: "DATABASE_BUSY",
          exitCode: 4,
        },
      });
    });
  }

  it("does not misclassify corruption as a lock conflict", async () => {
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["prompt", "list"],
      { stdout: () => undefined, stderr: (output) => stderr.push(output) },
      undefined,
      {
        initDatabase: () => {
          throw new Error("database disk image is malformed");
        },
        closeDatabase: () => undefined,
      },
    );

    expect(exitCode).toBe(10);
    expect(JSON.parse(stderr.join("\n")).error.code).toBe("INTERNAL_ERROR");
  });
});
