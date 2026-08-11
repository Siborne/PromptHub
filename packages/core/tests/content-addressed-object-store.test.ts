import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readContentAddressedObject,
  storeContentAddressedObject,
} from "../src/content-addressed-object-store";

const roots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-objects-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("content addressed object store", () => {
  it("publishes one immutable object and deduplicates identical bytes", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "durable bytes", "utf8");
    const objectsRoot = path.join(root, "objects");
    const expectedHash = crypto
      .createHash("sha256")
      .update("durable bytes")
      .digest("hex");

    const first = storeContentAddressedObject(objectsRoot, source);
    const second = storeContentAddressedObject(objectsRoot, source, {
      expectedHash,
    });

    expect(first).toEqual(second);
    expect(first.hash).toBe(expectedHash);
    expect(first.relativePath).toBe(
      `sha256/${expectedHash.slice(0, 2)}/${expectedHash}`,
    );
    expect(readContentAddressedObject(objectsRoot, expectedHash)).toEqual({
      hash: expectedHash,
      size: Buffer.byteLength("durable bytes"),
      path: first.path,
    });
    expect(
      fs
        .readdirSync(path.dirname(first.path))
        .filter((name) => name !== expectedHash),
    ).toEqual([]);
  });

  it("rejects wrong hashes, symlink sources, and corrupt existing objects", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "original", "utf8");
    const objectsRoot = path.join(root, "objects");
    expect(() =>
      storeContentAddressedObject(objectsRoot, source, {
        expectedHash: "a".repeat(64),
      }),
    ).toThrow(/expected hash/u);

    const link = path.join(root, "link.bin");
    fs.symlinkSync(source, link);
    expect(() => storeContentAddressedObject(objectsRoot, link)).toThrow(
      /regular file/u,
    );

    const stored = storeContentAddressedObject(objectsRoot, source);
    fs.writeFileSync(stored.path, "corrupt", "utf8");
    expect(() => storeContentAddressedObject(objectsRoot, source)).toThrow(
      /existing object/u,
    );
    expect(() => readContentAddressedObject(objectsRoot, stored.hash)).toThrow(
      /object/u,
    );
  });

  it("enforces size limits and cleans failed publication stages", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "12345", "utf8");
    const objectsRoot = path.join(root, "objects");

    expect(() =>
      storeContentAddressedObject(objectsRoot, source, { maxBytes: 4 }),
    ).toThrow(/byte limit/u);
    expect(fs.existsSync(objectsRoot)).toBe(false);
    expect(() => readContentAddressedObject(objectsRoot, "bad")).toThrow(
      /hash/u,
    );
    expect(() =>
      storeContentAddressedObject(objectsRoot, source, { maxBytes: 0 }),
    ).toThrow(/byte limit is invalid/u);
    expect(() =>
      storeContentAddressedObject(objectsRoot, source, {
        expectedHash: "invalid",
      }),
    ).toThrow(/hash is invalid/u);
    expect(() => storeContentAddressedObject(objectsRoot, root)).toThrow(
      /regular file/u,
    );
    expect(() =>
      storeContentAddressedObject(objectsRoot, path.join(root, "missing")),
    ).toThrow(/not readable/u);
  });

  it("detects source mutation and cleans the private stage", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "before", "utf8");
    const objectsRoot = path.join(root, "objects");
    const originalRead = fs.readSync;
    let reads = 0;
    vi.spyOn(fs, "readSync").mockImplementation((...args) => {
      reads += 1;
      if (reads === 3) fs.writeFileSync(source, "after!", "utf8");
      return originalRead(...args);
    });

    expect(() => storeContentAddressedObject(objectsRoot, source)).toThrow(
      /source changed/u,
    );
    expect(
      fs
        .readdirSync(path.join(objectsRoot, "sha256"), { recursive: true })
        .filter((name) => String(name).includes(".stage-")),
    ).toEqual([]);
  });

  it("aborts when a source grows beyond the limit during copy", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "1234", "utf8");
    const originalRead = fs.readSync;
    let reads = 0;
    vi.spyOn(fs, "readSync").mockImplementation((...args) => {
      reads += 1;
      if (reads === 3) fs.writeFileSync(source, "12345", "utf8");
      return originalRead(...args);
    });

    expect(() =>
      storeContentAddressedObject(path.join(root, "objects"), source, {
        maxBytes: 4,
      }),
    ).toThrow(/byte limit exceeded/u);
  });

  it("handles a concurrent identical publisher and rejects publication errors", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "same", "utf8");
    const objectsRoot = path.join(root, "objects");
    const originalLink = fs.linkSync;
    vi.spyOn(fs, "linkSync").mockImplementationOnce((stage, target) => {
      originalLink(stage, target);
      const error = new Error("exists") as NodeJS.ErrnoException;
      error.code = "EEXIST";
      throw error;
    });
    expect(storeContentAddressedObject(objectsRoot, source).size).toBe(4);

    const otherSource = path.join(root, "other.bin");
    fs.writeFileSync(otherSource, "other", "utf8");
    vi.spyOn(fs, "linkSync").mockImplementationOnce(() => {
      const error = new Error("denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    });
    expect(() => storeContentAddressedObject(objectsRoot, otherSource)).toThrow(
      /denied/u,
    );
  });

  it("rejects descriptor replacement races and bounded reads", () => {
    const root = createRoot();
    const source = path.join(root, "source.bin");
    fs.writeFileSync(source, "12345", "utf8");
    const objectsRoot = path.join(root, "objects");
    const stored = storeContentAddressedObject(objectsRoot, source);
    expect(() =>
      readContentAddressedObject(objectsRoot, stored.hash, { maxBytes: 4 }),
    ).toThrow(/existing object is invalid/u);

    vi.spyOn(fs, "fstatSync").mockReturnValueOnce({
      isFile: () => false,
    } as fs.Stats);
    expect(() => storeContentAddressedObject(objectsRoot, source)).toThrow(
      /regular file/u,
    );
  });
});
