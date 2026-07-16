import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  writeJsonFileAtomic,
  writeJsonFileAtomicExclusive,
} from "./atomic-json-file.js";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-atomic-json-"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("atomic JSON writers", () => {
  it("writes replaceable and immutable JSON files", () => {
    const tempDir = createTempDir();
    const replaceablePath = path.join(tempDir, "replaceable.json");
    const immutablePath = path.join(tempDir, "immutable.json");

    try {
      writeJsonFileAtomic(replaceablePath, { revision: 1 });
      writeJsonFileAtomic(replaceablePath, { revision: 2 });
      writeJsonFileAtomicExclusive(immutablePath, { revision: 1 });

      expect(JSON.parse(fs.readFileSync(replaceablePath, "utf8"))).toEqual({
        revision: 2,
      });
      expect(JSON.parse(fs.readFileSync(immutablePath, "utf8"))).toEqual({
        revision: 1,
      });
      expect(() =>
        writeJsonFileAtomicExclusive(immutablePath, { revision: 2 }),
      ).toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("removes a temporary file when a replace operation fails", () => {
    const tempDir = createTempDir();
    const filePath = path.join(tempDir, "replace-failure.json");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("rename failed");
    });

    try {
      expect(() => writeJsonFileAtomic(filePath, { value: 1 })).toThrow(
        "rename failed",
      );
      expect(fs.readdirSync(tempDir)).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves the original replace error when temporary cleanup also fails", () => {
    const tempDir = createTempDir();
    const filePath = path.join(tempDir, "replace-cleanup-failure.json");
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("rename failed");
    });
    vi.spyOn(fs, "rmSync").mockImplementation(() => {
      throw new Error("cleanup failed");
    });

    try {
      expect(() => writeJsonFileAtomic(filePath, { value: 1 })).toThrow(
        "rename failed",
      );
    } finally {
      vi.restoreAllMocks();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("closes an open descriptor and removes the temp file after write failure", () => {
    const tempDir = createTempDir();
    const filePath = path.join(tempDir, "exclusive-write-failure.json");
    const originalWrite = fs.writeFileSync.bind(fs);
    vi.spyOn(fs, "writeFileSync").mockImplementation(((
      target: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ) => {
      if (typeof target === "number") {
        throw new Error("write failed");
      }
      return originalWrite(target, ...(args as [string, BufferEncoding]));
    }) as typeof fs.writeFileSync);

    try {
      expect(() =>
        writeJsonFileAtomicExclusive(filePath, { value: 1 }),
      ).toThrow("write failed");
      expect(fs.readdirSync(tempDir)).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves a close failure when the cleanup close also fails", () => {
    const tempDir = createTempDir();
    const filePath = path.join(tempDir, "exclusive-close-failure.json");
    const originalClose = fs.closeSync.bind(fs);
    let closeCall = 0;
    vi.spyOn(fs, "closeSync").mockImplementation((fileDescriptor) => {
      closeCall += 1;
      if (closeCall === 1) {
        originalClose(fileDescriptor);
        throw new Error("close failed");
      }
      return originalClose(fileDescriptor);
    });

    try {
      expect(() =>
        writeJsonFileAtomicExclusive(filePath, { value: 1 }),
      ).toThrow("close failed");
      expect(fs.readdirSync(tempDir)).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves a durability failure even when rollback cleanup fails", () => {
    const tempDir = createTempDir();
    const filePath = path.join(tempDir, "exclusive-durability-failure.json");
    let fsyncCall = 0;
    vi.spyOn(fs, "fsyncSync").mockImplementation(() => {
      fsyncCall += 1;
      if (fsyncCall === 2) {
        throw new Error("directory fsync failed");
      }
    });
    vi.spyOn(fs, "rmSync").mockImplementation(() => {
      throw new Error("rollback cleanup failed");
    });

    try {
      expect(() =>
        writeJsonFileAtomicExclusive(filePath, { value: 1 }),
      ).toThrow("directory fsync failed");
    } finally {
      vi.restoreAllMocks();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("skips directory fsync on Windows while retaining exclusive writes", () => {
    const tempDir = createTempDir();
    const filePath = path.join(tempDir, "exclusive-windows.json");
    const platformDescriptor = Object.getOwnPropertyDescriptor(
      process,
      "platform",
    )!;
    Object.defineProperty(process, "platform", {
      ...platformDescriptor,
      value: "win32",
    });

    try {
      writeJsonFileAtomicExclusive(filePath, { value: 1 });
      expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual({
        value: 1,
      });
    } finally {
      Object.defineProperty(process, "platform", platformDescriptor);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
