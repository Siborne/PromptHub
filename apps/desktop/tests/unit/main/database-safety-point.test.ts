/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseSafetyPoint,
  listDatabaseSafetyPoints,
  pruneDatabaseSafetyPoints,
} from "@prompthub/db";
import DatabaseAdapter from "../../../src/main/database/sqlite";

describe("database safety points", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of tempDirs.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  function enforceWindowsFsyncWriteAccess(): void {
    const descriptorFlags = new Map<number, string | number>();
    const openSync = fs.openSync.bind(fs);
    const closeSync = fs.closeSync.bind(fs);
    const fsyncSync = fs.fsyncSync.bind(fs);

    vi.spyOn(fs, "openSync").mockImplementation((filePath, flags, mode) => {
      const descriptor = openSync(filePath, flags, mode);
      descriptorFlags.set(descriptor, flags);
      return descriptor;
    });
    vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
      descriptorFlags.delete(descriptor);
      closeSync(descriptor);
    });
    vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      if (descriptorFlags.get(descriptor) === "r") {
        const error = new Error(
          "EPERM: operation not permitted, fsync",
        ) as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      }
      fsyncSync(descriptor);
    });
  }

  function createTempDatabase(): {
    dbPath: string;
    db: DatabaseAdapter.Database;
  } {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-safety-point-"),
    );
    tempDirs.push(root);
    const dbPath = path.join(root, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseAdapter(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(
      "CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
    );
    db.run("INSERT INTO records (value) VALUES (?)", "before");
    return { dbPath, db };
  }

  it("creates one SQLite-consistent image while the source connection remains open", () => {
    const { dbPath, db } = createTempDatabase();

    const point = createDatabaseSafetyPoint(dbPath, "pre-migration");
    db.run("INSERT INTO records (value) VALUES (?)", "after");
    db.close();

    expect(point.manifest.files).toHaveLength(1);
    expect(point.manifest.files[0]).toMatchObject({
      name: "database.sqlite",
      sourceSuffix: "",
    });
    const snapshot = new DatabaseAdapter(
      path.join(point.directoryPath, "database.sqlite"),
    );
    expect(snapshot.pragma("quick_check")).toEqual([{ quick_check: "ok" }]);
    expect(snapshot.all("SELECT value FROM records ORDER BY id")).toEqual([
      { value: "before" },
    ]);
    snapshot.close();
  });

  it("flushes the SQLite image through a Windows write-capable handle", () => {
    const { dbPath, db } = createTempDatabase();
    db.close();
    enforceWindowsFsyncWriteAccess();

    expect(() =>
      createDatabaseSafetyPoint(dbPath, "pre-upgrade"),
    ).not.toThrow();
  });

  it("does not list a safety point after its verified image is changed", () => {
    const { dbPath, db } = createTempDatabase();
    db.close();
    const point = createDatabaseSafetyPoint(dbPath, "pre-migration");
    fs.appendFileSync(
      path.join(point.directoryPath, "database.sqlite"),
      "tampered",
    );

    expect(listDatabaseSafetyPoints(dbPath)).toEqual([]);
  });

  it("prunes complete points by count while protecting the requested identity", () => {
    const { dbPath, db } = createTempDatabase();
    db.close();
    const first = createDatabaseSafetyPoint(dbPath, "pre-migration", {
      now: new Date("2026-08-01T00:00:00.000Z"),
      retention: { maxCount: 5, maxAgeMs: 365 * 24 * 60 * 60 * 1000 },
    });
    const second = createDatabaseSafetyPoint(dbPath, "pre-migration", {
      now: new Date("2026-08-02T00:00:00.000Z"),
      retention: { maxCount: 5, maxAgeMs: 365 * 24 * 60 * 60 * 1000 },
    });

    expect(
      pruneDatabaseSafetyPoints(
        dbPath,
        { maxCount: 1, maxAgeMs: 365 * 24 * 60 * 60 * 1000 },
        new Set([first.id]),
        new Date("2026-08-03T00:00:00.000Z").getTime(),
      ),
    ).toEqual([second.id]);
    expect(listDatabaseSafetyPoints(dbPath).map((point) => point.id)).toEqual([
      first.id,
    ]);
  });

  it("rejects fractional count limits without deleting a point", () => {
    const { dbPath, db } = createTempDatabase();
    db.close();
    const point = createDatabaseSafetyPoint(dbPath, "pre-migration");

    expect(() => pruneDatabaseSafetyPoints(dbPath, { maxCount: 1.5 })).toThrow(
      "maxCount must be a positive safe integer",
    );
    expect(listDatabaseSafetyPoints(dbPath).map(({ id }) => id)).toEqual([
      point.id,
    ]);
  });

  it("fails capacity preflight before creating backup directories", () => {
    const { dbPath, db } = createTempDatabase();
    db.close();
    const backupRoot = path.join(path.dirname(path.dirname(dbPath)), "backups");

    expect(() =>
      createDatabaseSafetyPoint(dbPath, "pre-migration", {
        getAvailableBytes: () => 0,
      }),
    ).toThrow("Insufficient space for database safety point");
    expect(fs.existsSync(backupRoot)).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked source database",
    () => {
      const { dbPath, db } = createTempDatabase();
      db.close();
      const linkPath = path.join(path.dirname(dbPath), "linked.db");
      fs.symlinkSync(dbPath, linkPath);

      expect(() =>
        createDatabaseSafetyPoint(linkPath, "pre-migration"),
      ).toThrow("not a regular file");
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked managed backup directory",
    () => {
      const { dbPath, db } = createTempDatabase();
      db.close();
      const root = path.dirname(path.dirname(dbPath));
      const outside = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-safety-point-outside-"),
      );
      tempDirs.push(outside);
      fs.symlinkSync(outside, path.join(root, "backups"));

      expect(() => createDatabaseSafetyPoint(dbPath, "pre-migration")).toThrow(
        "symbolic link in database safety point path",
      );
      expect(fs.readdirSync(outside)).toEqual([]);
    },
  );
});
