/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupOwnedTemporaryDatabase,
  createOwnedTemporaryDatabasePath,
} from "@prompthub/db";

describe("owned temporary database paths", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates a bounded sibling path without creating the file", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-owned-db-"));
    roots.push(root);
    const label = `a${"b".repeat(22)}`;

    const databasePath = createOwnedTemporaryDatabasePath(root, label);

    expect(path.dirname(databasePath)).toBe(root);
    expect(path.basename(databasePath)).toMatch(
      /^\.a[b]{22}-[0-9a-f-]{36}\.db$/u,
    );
    expect(path.basename(databasePath).length).toBeLessThanOrEqual(64);
    expect(fs.existsSync(databasePath)).toBe(false);
  });

  it.each([
    "",
    "-catalog",
    "Catalog",
    "catalog/escape",
    "catalog\\escape",
    "..",
    `a${"b".repeat(23)}`,
  ])("rejects an unsafe or oversized label: %s", (label) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-owned-db-"));
    roots.push(root);

    expect(() => createOwnedTemporaryDatabasePath(root, label)).toThrow();
  });

  it("removes owned database artifacts without scanning siblings or clients", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-owned-db-"));
    roots.push(root);
    const databasePath = path.join(root, ".catalog-stage-test.db");
    for (const suffix of ["", "-journal", "-shm", "-wal"]) {
      fs.writeFileSync(`${databasePath}${suffix}`, "owned");
    }
    fs.mkdirSync(`${databasePath}.lock`);
    fs.writeFileSync(path.join(`${databasePath}.lock`, "owner"), "lock");
    fs.mkdirSync(`${databasePath}.clients`);
    fs.writeFileSync(path.join(`${databasePath}.clients`, "lease"), "client");
    const siblingPath = path.join(root, "keep.txt");
    fs.writeFileSync(siblingPath, "keep");

    cleanupOwnedTemporaryDatabase(databasePath);

    for (const suffix of ["", "-journal", "-shm", "-wal"]) {
      expect(fs.existsSync(`${databasePath}${suffix}`)).toBe(false);
    }
    expect(fs.existsSync(`${databasePath}.lock`)).toBe(false);
    expect(fs.existsSync(`${databasePath}.clients`)).toBe(true);
    expect(fs.existsSync(siblingPath)).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "removes a lock symlink without following its external target",
    () => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-owned-db-symlink-"),
      );
      roots.push(root);
      const externalRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-owned-db-external-"),
      );
      roots.push(externalRoot);
      const databasePath = path.join(root, ".catalog-stage-test.db");
      const externalKeep = path.join(externalRoot, "keep.txt");
      fs.writeFileSync(externalKeep, "keep");
      fs.symlinkSync(externalRoot, `${databasePath}.lock`, "dir");

      cleanupOwnedTemporaryDatabase(databasePath);

      expect(fs.existsSync(`${databasePath}.lock`)).toBe(false);
      expect(fs.existsSync(externalKeep)).toBe(true);
    },
  );
});
