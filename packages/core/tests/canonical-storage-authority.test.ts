import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
});
