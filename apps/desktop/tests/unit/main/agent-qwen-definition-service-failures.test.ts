import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  listQwenDefinitions,
  type QwenDefinitionFileSystem,
} from "../../../src/main/services/agent-qwen-definition-service";

const fsMocks = {
  lstat: vi.fn(),
  open: vi.fn(),
  opendir: vi.fn(),
  realpath: vi.fn(),
};

function directoryStat() {
  return {
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
  };
}

function fileStat(isFile = true) {
  return {
    isDirectory: () => false,
    isFile: () => isFile,
    isSymbolicLink: () => false,
    size: 4,
    mtimeMs: 1,
  };
}

function fileEntry(name: string) {
  return {
    name,
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false,
  };
}

describe("Qwen definition filesystem failures", () => {
  it("contains per-entry filesystem failures and continues scanning", async () => {
    fsMocks.lstat.mockImplementation(async (target: string) => {
      if (
        target.endsWith(`${path.sep}agents`) ||
        target.endsWith(`${path.sep}commands`)
      ) {
        return directoryStat();
      }
      if (target.endsWith("missing.md")) throw new Error("disappeared");
      return fileStat(!target.endsWith("non-file.md"));
    });
    fsMocks.realpath.mockImplementation(async (target: string) => {
      if (target.endsWith("unsafe.md")) return "/outside/unsafe.md";
      return target;
    });
    fsMocks.opendir.mockImplementation(async (target: string) => {
      if (target.endsWith(`${path.sep}agents`)) throw new Error("denied");
      return {
        async *[Symbol.asyncIterator]() {
          yield fileEntry("missing.md");
          yield fileEntry("unsafe.md");
          yield fileEntry("non-file.md");
          yield fileEntry("unreadable.md");
        },
      };
    });
    fsMocks.open.mockRejectedValue(new Error("denied"));

    await expect(
      listQwenDefinitions(
        { rootPath: "/home/test/.qwen", scope: "user" },
        undefined,
        fsMocks as unknown as QwenDefinitionFileSystem,
      ),
    ).resolves.toMatchObject({
      entries: [],
      skippedUnsafe: 5,
      truncated: false,
    });
  });
});
