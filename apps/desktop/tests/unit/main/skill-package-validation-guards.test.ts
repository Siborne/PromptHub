/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lstat: vi.fn(),
  readdir: vi.fn(),
  realpath: vi.fn(),
  stat: vi.fn(),
  isPathWithin: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  lstat: mocks.lstat,
  readdir: mocks.readdir,
  realpath: mocks.realpath,
  stat: mocks.stat,
}));

vi.mock("../../../src/main/services/skill-installer-internal", () => ({
  isPathWithin: mocks.isPathWithin,
}));

vi.mock("../../../src/main/services/skill-installer-repo", () => ({
  isInternalSkillRepoEntry: vi.fn(() => false),
}));

import { validateMaterializedSkillPackage } from "../../../src/main/services/skill-package-validation";

function createDirent(options: { directory?: boolean; file?: boolean }) {
  return {
    name: "entry.bin",
    isDirectory: () => Boolean(options.directory),
    isFile: () => Boolean(options.file),
    isSymbolicLink: () => false,
  };
}

describe("materialized Skill package defensive guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lstat.mockResolvedValue({ isFile: () => true });
    mocks.realpath.mockImplementation(async (value: string) => value);
    mocks.stat.mockResolvedValue({ size: 1 });
    mocks.isPathWithin.mockReturnValue(true);
  });

  it("rejects an entry whose canonical path leaves the package", async () => {
    mocks.readdir.mockResolvedValue([createDirent({ file: true })]);
    mocks.isPathWithin.mockReturnValue(false);

    await expect(validateMaterializedSkillPackage("/package")).rejects.toThrow(
      /resolves outside/,
    );
  });

  it("rejects unsupported filesystem entry types", async () => {
    mocks.readdir.mockResolvedValue([createDirent({})]);

    await expect(validateMaterializedSkillPackage("/package")).rejects.toThrow(
      /unsupported filesystem entry/,
    );
  });
});
