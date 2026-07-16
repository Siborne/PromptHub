import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "@prompthub/core";

function makeRoot(roots: string[]): {
  root: string;
  userData: string;
  dbPath: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-doctor-"));
  roots.push(root);
  const userData = path.join(root, "user-data");
  const dbPath = path.join(userData, "data", "prompthub.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return { root, userData, dbPath };
}

async function execDoctor(
  args: string[],
  userData: string,
  action = "database-lock",
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const initDatabase = vi.fn(() => {
    throw new Error("doctor must not initialize SQLite");
  });
  const exitCode = await runCli(
    ["--data-dir", userData, "doctor", action, ...args],
    {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    },
    undefined,
    { initDatabase, closeDatabase: () => undefined },
  );
  return {
    exitCode,
    stdout,
    stderr,
    json: stdout.length > 0 ? JSON.parse(stdout.join("\n")) : undefined,
    error: stderr.length > 0 ? JSON.parse(stderr.join("\n")) : undefined,
    initDatabase,
  };
}

describe("database lock doctor", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports an absent lock without opening SQLite", async () => {
    const fixture = makeRoot(roots);

    const result = await execDoctor([], fixture.userData);
    const recovery = await execDoctor(["--recover"], fixture.userData);

    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({ status: "absent", recovered: false });
    expect(recovery.exitCode).toBe(0);
    expect(recovery.json).toMatchObject({ status: "absent", recovered: false });
    expect(result.initDatabase).not.toHaveBeenCalled();
    expect(recovery.initDatabase).not.toHaveBeenCalled();
  });

  it("rejects unsupported doctor actions without opening SQLite", async () => {
    const fixture = makeRoot(roots);

    const result = await execDoctor([], fixture.userData, "unknown-action");

    expect(result.exitCode).toBe(2);
    expect(result.error.error.code).toBe("USAGE_ERROR");
    expect(result.initDatabase).not.toHaveBeenCalled();
  });

  it("recovers an ordinary ownerless lock only when explicitly requested", async () => {
    const fixture = makeRoot(roots);
    fs.mkdirSync(`${fixture.dbPath}.lock`);

    const inspection = await execDoctor([], fixture.userData);
    expect(inspection.json).toMatchObject({
      status: "recoverable",
      recovered: false,
    });
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);

    const recovery = await execDoctor(["--recover"], fixture.userData);
    expect(recovery.exitCode).toBe(0);
    expect(recovery.json).toMatchObject({
      status: "recovered",
      recovered: true,
    });
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(false);
    expect(recovery.initDatabase).not.toHaveBeenCalled();
  });

  it("prunes malformed and stale regular leases during explicit recovery", async () => {
    const fixture = makeRoot(roots);
    fs.mkdirSync(`${fixture.dbPath}.lock`);
    fs.mkdirSync(`${fixture.dbPath}.clients`);
    fs.writeFileSync(
      path.join(`${fixture.dbPath}.clients`, "broken.json"),
      "not-json",
      "utf8",
    );
    fs.writeFileSync(
      path.join(`${fixture.dbPath}.clients`, "999999.json"),
      JSON.stringify({ pid: 999999, registeredAt: "2026-01-01T00:00:00Z" }),
      "utf8",
    );

    const inspection = await execDoctor([], fixture.userData);
    expect(inspection.json).toMatchObject({
      status: "recoverable",
      staleEntries: expect.arrayContaining(["999999.json", "broken.json"]),
    });

    const recovery = await execDoctor(["--recover"], fixture.userData);
    expect(recovery.exitCode).toBe(0);
    expect(recovery.json.status).toBe("recovered");
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(false);
    expect(fs.existsSync(`${fixture.dbPath}.clients`)).toBe(false);
  });

  it("refuses recovery while a registered client is alive", async () => {
    const fixture = makeRoot(roots);
    fs.mkdirSync(`${fixture.dbPath}.lock`);
    fs.mkdirSync(`${fixture.dbPath}.clients`);
    fs.writeFileSync(
      path.join(`${fixture.dbPath}.clients`, `${process.pid}.json`),
      JSON.stringify({
        pid: process.pid,
        registeredAt: new Date().toISOString(),
      }),
      "utf8",
    );

    const result = await execDoctor(["--recover"], fixture.userData);

    expect(result.exitCode).toBe(4);
    expect(result.error).toMatchObject({
      error: {
        code: "DATABASE_LOCK_RECOVERY_BLOCKED",
        details: { reason: "live-client" },
      },
    });
    expect(fs.existsSync(`${fixture.dbPath}.lock`)).toBe(true);
  });

  it("refuses unknown lease entries and unsafe lock path types", async () => {
    const unknown = makeRoot(roots);
    fs.mkdirSync(`${unknown.dbPath}.lock`);
    fs.mkdirSync(path.join(`${unknown.dbPath}.clients`, "unknown"), {
      recursive: true,
    });

    const unknownResult = await execDoctor(["--recover"], unknown.userData);
    expect(unknownResult.exitCode).toBe(4);
    expect(unknownResult.error.error.details.reason).toBe("unknown-client");

    if (process.platform !== "win32") {
      const unsafe = makeRoot(roots);
      fs.symlinkSync(unsafe.root, `${unsafe.dbPath}.lock`, "dir");

      const unsafeResult = await execDoctor(["--recover"], unsafe.userData);
      expect(unsafeResult.exitCode).toBe(4);
      expect(unsafeResult.error.error.details.reason).toBe("unsafe-lock");
      expect(fs.lstatSync(`${unsafe.dbPath}.lock`).isSymbolicLink()).toBe(true);
    }
  });

  it("refuses non-directory lock and client paths", async () => {
    const unsafeLock = makeRoot(roots);
    fs.writeFileSync(`${unsafeLock.dbPath}.lock`, "do-not-delete", "utf8");

    const lockResult = await execDoctor(["--recover"], unsafeLock.userData);
    expect(lockResult.exitCode).toBe(4);
    expect(lockResult.error.error.details.reason).toBe("unsafe-lock");
    expect(fs.readFileSync(`${unsafeLock.dbPath}.lock`, "utf8")).toBe(
      "do-not-delete",
    );

    const unsafeClients = makeRoot(roots);
    fs.mkdirSync(`${unsafeClients.dbPath}.lock`);
    fs.writeFileSync(
      `${unsafeClients.dbPath}.clients`,
      "unknown-owner",
      "utf8",
    );

    const clientsResult = await execDoctor(
      ["--recover"],
      unsafeClients.userData,
    );
    expect(clientsResult.exitCode).toBe(4);
    expect(clientsResult.error.error.details.reason).toBe("unknown-client");
    expect(fs.readFileSync(`${unsafeClients.dbPath}.clients`, "utf8")).toBe(
      "unknown-owner",
    );
  });
});
