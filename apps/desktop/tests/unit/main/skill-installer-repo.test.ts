/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  cp: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  lstat: vi.fn(),
  rm: vi.fn(),
  symlink: vi.fn(),
  rename: vi.fn(),
  readdir: vi.fn(),
  realpath: vi.fn(async (value: string) => value),
}));

const internalMocks = vi.hoisted(() => ({
  getSkillsDirAccessor: vi.fn(() => "/prompthub/skills"),
  initSkillsDir: vi.fn().mockResolvedValue(undefined),
  fileExists: vi.fn().mockResolvedValue(false),
  getErrorCode: vi.fn((error: unknown) =>
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code
      : undefined,
  ),
  isPathWithin: vi.fn(() => true),
  normalizeExistingPath: vi.fn(async (value: string) => value),
  resolveRepoBasePath: vi.fn(async (basePath: string) => ({
    resolvedBasePath: basePath,
    realBasePath: basePath,
  })),
  resolveRepoTargetPath: vi.fn(
    async (basePath: string, relativePath: string) => ({
      fullPath: `${basePath}/${relativePath}`,
      realBasePath: basePath,
    }),
  ),
  validateRelativePath: vi.fn(),
  validateSkillName: vi.fn(),
}));

vi.mock("fs/promises", () => fsMocks);

vi.mock("../../../src/main/services/skill-installer-internal", () => ({
  getSkillsDirAccessor: internalMocks.getSkillsDirAccessor,
  initSkillsDir: internalMocks.initSkillsDir,
  fileExists: internalMocks.fileExists,
  getErrorCode: internalMocks.getErrorCode,
  isPathWithin: internalMocks.isPathWithin,
  normalizeExistingPath: internalMocks.normalizeExistingPath,
  resolveRepoBasePath: internalMocks.resolveRepoBasePath,
  resolveRepoTargetPath: internalMocks.resolveRepoTargetPath,
  validateRelativePath: internalMocks.validateRelativePath,
  validateSkillName: internalMocks.validateSkillName,
}));

import {
  getManagedContainerPathForSkill,
  getPreferredLocalRepoContainerPathForSkill,
  getPreferredLocalRepoPathForSkill,
  getLocalRepoContainerPathForSkillId,
  getLocalRepoPathForSkillId,
  saveContentToLocalRepoBySkillId,
} from "../../../src/main/services/skill-installer-repo";
import {
  beginManagedRepoReplacement,
  saveToLocalRepoBySkillId,
} from "../../../src/main/services/skill-installer-replacement";

describe("skill-installer-repo variant container", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    internalMocks.fileExists.mockResolvedValue(false);
    fsMocks.stat.mockResolvedValue({ isDirectory: () => true });
    fsMocks.lstat.mockResolvedValue({ isSymbolicLink: () => false });
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.cp.mockResolvedValue(undefined);
    fsMocks.readFile.mockResolvedValue("");
    fsMocks.writeFile.mockResolvedValue(undefined);
    fsMocks.rm.mockResolvedValue(undefined);
    fsMocks.symlink.mockResolvedValue(undefined);
    fsMocks.rename.mockResolvedValue(undefined);
  });

  it("stores managed repos inside a stable variant container", () => {
    expect(getLocalRepoContainerPathForSkillId("skill-1")).toBe(
      "/prompthub/skills/skill-1",
    );
    expect(getLocalRepoPathForSkillId("skill-1")).toBe(
      "/prompthub/skills/skill-1/repo",
    );
  });

  it("prefers human-readable managed container names with a short stable suffix", () => {
    expect(
      getPreferredLocalRepoContainerPathForSkill({
        id: "8ee7f899-b267-4aea-9037-86f0ba1da1bc",
        name: "clouddrive2-cli",
        source_id: "source-clouddrive2-main",
      }),
    ).toBe("/prompthub/skills/clouddrive2-cli--3c7d25c0");
    expect(
      getPreferredLocalRepoPathForSkill({
        id: "8ee7f899-b267-4aea-9037-86f0ba1da1bc",
        name: "clouddrive2-cli",
        source_id: "source-clouddrive2-main",
      }),
    ).toBe("/prompthub/skills/clouddrive2-cli--3c7d25c0/repo");
  });

  it("reuses a legacy managed container when local_repo_path already points to it", async () => {
    internalMocks.fileExists.mockImplementationOnce(
      async (targetPath: string) => targetPath === "/prompthub/skills/skill-1",
    );

    await expect(
      getManagedContainerPathForSkill({
        id: "skill-1",
        name: "writer",
        source_id: "source-writer-main",
        local_repo_path: "/prompthub/skills/skill-1/repo",
      }),
    ).resolves.toBe("/prompthub/skills/skill-1");
  });

  it("uses a longer readable suffix when the preferred short suffix container belongs to another variant", async () => {
    internalMocks.fileExists.mockImplementation(
      async (targetPath: string) =>
        targetPath === "/prompthub/skills/writer--7dc211f6",
    );
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({
        logicalName: "writer",
        variantKey: "writer--7dc211f6",
        sourceId: "source-writer-stable",
      }),
    );

    await expect(
      getManagedContainerPathForSkill({
        id: "skill-dev",
        name: "writer",
        source_id: "source-writer-main",
      }),
    ).resolves.toBe("/prompthub/skills/writer--7dc211f6e9ce");
  });

  it("writes fallback container metadata with the actual longer variant key", async () => {
    internalMocks.fileExists.mockImplementation(
      async (targetPath: string) =>
        targetPath === "/prompthub/skills/writer--7dc211f6",
    );
    fsMocks.readFile.mockResolvedValue(
      JSON.stringify({
        logicalName: "writer",
        variantKey: "writer--7dc211f6",
        sourceId: "source-writer-stable",
      }),
    );

    await saveContentToLocalRepoBySkillId(
      {
        id: "skill-dev",
        name: "writer",
        source_id: "source-writer-main",
      },
      "# Writer dev\n",
    );

    expect(fsMocks.mkdir).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6e9ce",
      { recursive: true },
    );
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6e9ce/.prompthub/source.json",
      expect.stringContaining('"variantKey": "writer--7dc211f6e9ce"'),
      "utf-8",
    );
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6e9ce/repo/SKILL.md",
      "# Writer dev\n",
      "utf-8",
    );
  });

  it("writes SKILL.md into the repo subdirectory and sidecar metadata into .prompthub", async () => {
    await saveContentToLocalRepoBySkillId(
      {
        id: "skill-1",
        name: "writer",
        source_id: "source-writer-main",
      },
      "# Writer\n",
    );

    expect(fsMocks.mkdir).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6",
      { recursive: true },
    );
    expect(fsMocks.mkdir).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6/.prompthub",
      { recursive: true },
    );
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6/repo/SKILL.md",
      "# Writer\n",
      "utf-8",
    );
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6/.prompthub/source.json",
      expect.stringContaining('"logicalName": "writer"'),
      "utf-8",
    );
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6/.prompthub/variant.json",
      expect.stringContaining('"repoMode": "copy"'),
      "utf-8",
    );
  });

  it("materializes requested symlink mode inside the managed data repo", async () => {
    await saveToLocalRepoBySkillId(
      {
        id: "skill-1",
        name: "writer",
        source_id: "source-writer-main",
      },
      "/external/writer",
      "symlink",
    );

    expect(fsMocks.symlink).not.toHaveBeenCalled();
    expect(fsMocks.cp).toHaveBeenCalledWith(
      "/external/writer",
      expect.stringMatching(
        /^\/prompthub\/skills\/writer--7dc211f6\/repo\.staging-/,
      ),
      expect.objectContaining({
        recursive: true,
        filter: expect.any(Function),
      }),
    );
    expect(fsMocks.rename).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/prompthub\/skills\/writer--7dc211f6\/repo\.staging-/,
      ),
      "/prompthub/skills/writer--7dc211f6/repo",
    );
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6/.prompthub/variant.json",
      expect.stringContaining('"repoMode": "copy"'),
      "utf-8",
    );
  });

  it("keeps the previous repo recoverable until a replacement is committed", async () => {
    internalMocks.fileExists.mockImplementation(async (targetPath: string) =>
      targetPath.endsWith("/repo"),
    );
    const replacement = await beginManagedRepoReplacement(
      {
        id: "skill-1",
        name: "writer",
        source_id: "source-writer-main",
      },
      "/staged/writer",
    );

    const backupRename = fsMocks.rename.mock.calls.find(
      ([from]) => from === "/prompthub/skills/writer--7dc211f6/repo",
    );
    expect(backupRename?.[1]).toMatch(/repo\.old-/);
    fsMocks.rm.mockClear();
    expect(fsMocks.rm).not.toHaveBeenCalledWith(backupRename?.[1], {
      recursive: true,
      force: true,
    });

    await replacement.commit();

    expect(fsMocks.rm).toHaveBeenCalledWith(backupRename?.[1], {
      recursive: true,
      force: true,
    });
  });

  it("records recovery intent before mutating the managed container", async () => {
    internalMocks.fileExists.mockImplementation(async (targetPath: string) =>
      targetPath.endsWith("/repo"),
    );
    const beforeApply = vi.fn(async (recovery) => {
      expect(recovery).toMatchObject({
        repoPath: "/prompthub/skills/writer--7dc211f6/repo",
        hadOriginal: true,
      });
      expect(fsMocks.mkdir).not.toHaveBeenCalled();
      expect(fsMocks.writeFile).not.toHaveBeenCalled();
      expect(fsMocks.cp).not.toHaveBeenCalled();
      expect(fsMocks.rename).not.toHaveBeenCalled();
    });

    await beginManagedRepoReplacement(
      {
        id: "skill-1",
        name: "writer",
        source_id: "source-writer-main",
      },
      "/staged/writer",
      beforeApply,
    );

    expect(beforeApply).toHaveBeenCalledTimes(1);
    expect(fsMocks.mkdir).toHaveBeenCalled();
    expect(fsMocks.cp).toHaveBeenCalled();
    expect(fsMocks.rename).toHaveBeenCalled();
  });

  it("rejects a symlinked managed container before writing recovery intent", async () => {
    internalMocks.fileExists.mockResolvedValue(true);
    fsMocks.lstat.mockImplementation(async (targetPath: string) => ({
      isSymbolicLink: () => targetPath.endsWith("writer--7dc211f6"),
    }));
    const beforeApply = vi.fn();

    await expect(
      beginManagedRepoReplacement(
        {
          id: "skill-1",
          name: "writer",
          source_id: "source-writer-main",
        },
        "/staged/writer",
        beforeApply,
      ),
    ).rejects.toThrow(/symlinked managed container/i);

    expect(beforeApply).not.toHaveBeenCalled();
    expect(fsMocks.mkdir).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
    expect(fsMocks.rename).not.toHaveBeenCalled();
  });

  it("restores the previous repo when a pending replacement rolls back", async () => {
    internalMocks.fileExists.mockImplementation(async (targetPath: string) =>
      targetPath.endsWith("/repo"),
    );
    const replacement = await beginManagedRepoReplacement(
      {
        id: "skill-1",
        name: "writer",
        source_id: "source-writer-main",
      },
      "/staged/writer",
    );
    const backupPath = fsMocks.rename.mock.calls.find(
      ([from]) => from === "/prompthub/skills/writer--7dc211f6/repo",
    )?.[1];

    await replacement.rollback();

    expect(fsMocks.rm).toHaveBeenCalledWith(
      "/prompthub/skills/writer--7dc211f6/repo",
      { recursive: true, force: true },
    );
    expect(fsMocks.rename).toHaveBeenCalledWith(
      backupPath,
      "/prompthub/skills/writer--7dc211f6/repo",
    );
  });
});
