import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCanonicalStorageAuthorityPath,
  readCanonicalStorageAuthority,
  resolveRuntimeStorageContext,
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "../src";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-canonical-authority-"),
  );
  roots.push(value);
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const value of roots.splice(0)) {
    fs.rmSync(value, { recursive: true, force: true });
  }
});

describe("canonical storage authority", () => {
  it("keeps SQLite authority until a verified canonical marker is published", () => {
    const activeRoot = root();
    writeRuntimeLayoutState(activeRoot);
    expect(readCanonicalStorageAuthority(activeRoot)).toBeNull();
    expect(resolveRuntimeStorageContext(activeRoot).localAuthority).toBe(
      "database-catalog",
    );
  });

  it("publishes and reloads file-first authority for the bound root", () => {
    const activeRoot = root();
    writeRuntimeLayoutState(activeRoot);
    const marker = writeCanonicalStorageAuthority(activeRoot, {
      consistencyId: "a".repeat(64),
      operationId: "authority-1",
      now: new Date("2026-08-12T00:00:00.000Z"),
    });

    expect(readCanonicalStorageAuthority(activeRoot)).toEqual(marker);
    expect(resolveRuntimeStorageContext(activeRoot)).toMatchObject({
      localAuthority: "canonical-files",
      authorityStatePath: getCanonicalStorageAuthorityPath(activeRoot),
    });
  });

  it("rejects copied, malformed, future, and symbolic-link markers", () => {
    const sourceRoot = root();
    const targetRoot = root();
    writeRuntimeLayoutState(sourceRoot);
    writeCanonicalStorageAuthority(sourceRoot, {
      consistencyId: "b".repeat(64),
      operationId: "authority-2",
    });
    fs.mkdirSync(path.join(targetRoot, "data"), { recursive: true });
    fs.copyFileSync(
      getCanonicalStorageAuthorityPath(sourceRoot),
      getCanonicalStorageAuthorityPath(targetRoot),
    );
    expect(() => readCanonicalStorageAuthority(targetRoot)).toThrow(
      "root identity mismatch",
    );

    const markerPath = getCanonicalStorageAuthorityPath(targetRoot);
    fs.writeFileSync(markerPath, '{"version":2}\n', "utf8");
    expect(() => readCanonicalStorageAuthority(targetRoot)).toThrow(
      "newer authority marker",
    );

    fs.rmSync(markerPath);
    const outside = path.join(targetRoot, "outside.json");
    fs.writeFileSync(outside, "{}\n", "utf8");
    fs.symlinkSync(outside, markerPath);
    expect(() => readCanonicalStorageAuthority(targetRoot)).toThrow(
      "authority marker path is unsafe",
    );
  });

  it("rejects invalid JSON and invalid marker fields", () => {
    const activeRoot = root();
    const markerPath = getCanonicalStorageAuthorityPath(activeRoot);
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, "{", "utf8");
    expect(() => readCanonicalStorageAuthority(activeRoot)).toThrow(
      "authority marker is invalid",
    );

    fs.writeFileSync(markerPath, "{}\n", "utf8");
    expect(() => readCanonicalStorageAuthority(activeRoot)).toThrow(
      "authority marker is invalid",
    );
    expect(() =>
      writeCanonicalStorageAuthority(activeRoot, {
        consistencyId: "invalid",
        operationId: "authority-3",
      }),
    ).toThrow("authority marker is invalid");
    expect(() =>
      writeCanonicalStorageAuthority(activeRoot, {
        consistencyId: "c".repeat(64),
        operationId: "unsafe operation/id",
      }),
    ).toThrow("authority marker is invalid");
  });

  it("binds a staged marker to its eventual active root", () => {
    const stagingRoot = root();
    const identityRoot = root();

    const marker = writeCanonicalStorageAuthority(stagingRoot, {
      consistencyId: "d".repeat(64),
      operationId: "authority-stage",
      identityRoot,
    });

    expect(
      readCanonicalStorageAuthority(stagingRoot, { identityRoot }),
    ).toEqual(marker);
    expect(() => readCanonicalStorageAuthority(stagingRoot)).toThrow(
      "root identity mismatch",
    );
  });

  it("rejects unsafe roots and data directories", () => {
    const unsafeRoot = root();
    fs.rmSync(unsafeRoot, { recursive: true });
    fs.writeFileSync(unsafeRoot, "not-a-directory", "utf8");
    expect(() =>
      writeCanonicalStorageAuthority(unsafeRoot, {
        consistencyId: "e".repeat(64),
        operationId: "unsafe-root",
      }),
    ).toThrow("authority root is unsafe");

    const unsafeData = root();
    fs.writeFileSync(path.join(unsafeData, "data"), "not-a-directory", "utf8");
    expect(() =>
      writeCanonicalStorageAuthority(unsafeData, {
        consistencyId: "f".repeat(64),
        operationId: "unsafe-data",
      }),
    ).toThrow("authority data path is unsafe");
  });

  it("creates the data directory and tolerates an unavailable directory fsync", () => {
    const activeRoot = root();
    const dataPath = path.join(activeRoot, "data");
    const originalOpen = fs.openSync.bind(fs);
    vi.spyOn(fs, "openSync").mockImplementation((target, flags, mode) => {
      if (path.resolve(String(target)) === dataPath) {
        throw Object.assign(new Error("directory fsync unavailable"), {
          code: "EINVAL",
        });
      }
      return originalOpen(target, flags, mode);
    });

    expect(
      writeCanonicalStorageAuthority(activeRoot, {
        consistencyId: "1".repeat(64),
        operationId: "no-directory-fsync",
      }),
    ).toMatchObject({ operationId: "no-directory-fsync" });
    expect(fs.statSync(dataPath).isDirectory()).toBe(true);
  });

  it("removes its temporary marker when atomic publication fails", () => {
    const activeRoot = root();
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("rename failed");
    });

    expect(() =>
      writeCanonicalStorageAuthority(activeRoot, {
        consistencyId: "2".repeat(64),
        operationId: "rename-failure",
      }),
    ).toThrow("rename failed");
    expect(
      fs
        .readdirSync(path.join(activeRoot, "data"))
        .some((entry) => entry.includes(".tmp-")),
    ).toBe(false);
  });
});
