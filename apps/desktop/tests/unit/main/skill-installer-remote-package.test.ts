/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillSafetyReport } from "@prompthub/shared/types";

const mocks = vi.hoisted(() => ({
  mkdtemp: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  initSkillsDir: vi.fn(),
  fileExists: vi.fn(),
  isPathWithin: vi.fn(),
  resolveSingleSkillDirFromRepo: vi.fn(),
  resolveSkillDirFromRepo: vi.fn(),
  readLocalRepoFileBuffersByPath: vi.fn(),
  copyRepoByPathToDirectory: vi.fn(),
  saveToLocalRepoBySkillId: vi.fn(),
  fetchRemoteBytes: vi.fn(),
  gitClone: vi.fn(),
  validateMaterializedSkillPackage: vi.fn(),
  extractSkillZipArchive: vi.fn(),
  assertStagedRemoteSkillPackageSafe: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  mkdtemp: mocks.mkdtemp,
  readFile: mocks.readFile,
  rm: mocks.rm,
}));

vi.mock("../../../src/main/services/skill-installer-internal", () => ({
  initSkillsDir: mocks.initSkillsDir,
  getSkillsDirAccessor: () => "/skills",
  fileExists: mocks.fileExists,
  isPathWithin: mocks.isPathWithin,
}));

vi.mock("../../../src/main/services/skill-installer-discovery", () => ({
  resolveSingleSkillDirFromRepo: mocks.resolveSingleSkillDirFromRepo,
  resolveSkillDirFromRepo: mocks.resolveSkillDirFromRepo,
}));

vi.mock("../../../src/main/services/skill-installer-repo", () => ({
  readLocalRepoFileBuffersByPath: mocks.readLocalRepoFileBuffersByPath,
  copyRepoByPathToDirectory: mocks.copyRepoByPathToDirectory,
}));

vi.mock("../../../src/main/services/skill-installer-replacement", () => ({
  saveToLocalRepoBySkillId: mocks.saveToLocalRepoBySkillId,
}));

vi.mock("../../../src/main/services/skill-installer-remote", () => ({
  fetchRemoteBytes: mocks.fetchRemoteBytes,
}));

vi.mock("../../../src/main/services/skill-installer-utils", () => ({
  gitClone: mocks.gitClone,
}));

vi.mock("../../../src/main/services/skill-package-validation", () => ({
  validateMaterializedSkillPackage: mocks.validateMaterializedSkillPackage,
}));

vi.mock("../../../src/main/services/skill-archive-extractor", () => ({
  extractSkillZipArchive: mocks.extractSkillZipArchive,
}));

vi.mock("../../../src/main/services/skill-update-safety", () => ({
  assertStagedRemoteSkillPackageSafe: mocks.assertStagedRemoteSkillPackageSafe,
}));

import {
  getRemoteGitSkillPackageFingerprint,
  getRemoteGitSkillPackageSnapshot,
  getRemoteZipSkillPackageSnapshot,
  saveRemoteGitSkillPackage,
  saveRemoteZipSkillPackage,
  type RemotePackageSkill,
} from "../../../src/main/services/skill-installer-remote-package";

const safeReport: SkillSafetyReport = {
  level: "safe",
  summary: "Safe",
  findings: [],
  recommendedAction: "allow",
  scannedAt: 1,
  checkedFileCount: 1,
  scanMethod: "preflight",
};

function createRemoteSkill(
  overrides: Partial<RemotePackageSkill> = {},
): RemotePackageSkill {
  return {
    id: "skill-writer",
    name: "writer",
    source_id: undefined,
    source_url: "https://gitea.example.com/team/skills",
    source_directory: undefined,
    ...overrides,
  };
}

describe("remote Skill package adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mkdtemp.mockImplementation(async (prefix: string) => `${prefix}op`);
    mocks.readFile.mockResolvedValue("# Writer\n\nFrom private Gitea\n");
    mocks.rm.mockResolvedValue(undefined);
    mocks.initSkillsDir.mockResolvedValue(undefined);
    mocks.fileExists.mockResolvedValue(true);
    mocks.isPathWithin.mockReturnValue(true);
    mocks.resolveSingleSkillDirFromRepo.mockResolvedValue("/clone/skill");
    mocks.resolveSkillDirFromRepo.mockResolvedValue("/clone/skill");
    mocks.readLocalRepoFileBuffersByPath.mockResolvedValue([
      { path: "SKILL.md", data: Buffer.from("# Writer\n") },
    ]);
    mocks.copyRepoByPathToDirectory.mockResolvedValue("/target/repo");
    mocks.saveToLocalRepoBySkillId.mockResolvedValue("/managed/repo");
    mocks.fetchRemoteBytes.mockResolvedValue(new Uint8Array([1]));
    mocks.gitClone.mockResolvedValue(undefined);
    mocks.validateMaterializedSkillPackage.mockResolvedValue({
      fileCount: 1,
      totalBytes: 9,
    });
    mocks.extractSkillZipArchive.mockResolvedValue(undefined);
    mocks.assertStagedRemoteSkillPackageSafe.mockResolvedValue(safeReport);
  });

  it("rejects malformed Git repository URLs before creating staging", async () => {
    await expect(
      saveRemoteGitSkillPackage(createRemoteSkill(), {
        repoUrl: "not-a-repository",
      }),
    ).rejects.toThrow(/Invalid git repository URL/);
    await expect(
      getRemoteGitSkillPackageFingerprint({ repoUrl: "not-a-repository" }),
    ).rejects.toThrow(/Invalid git repository URL/);
    expect(mocks.mkdtemp).not.toHaveBeenCalled();
  });

  it("builds fallback Git identity and persists to the managed repo", async () => {
    const result = await saveRemoteGitSkillPackage(createRemoteSkill(), {
      repoUrl: "https://gitea.example.com/team/skills",
    });

    expect(result).toBe("/managed/repo");
    expect(mocks.resolveSkillDirFromRepo).toHaveBeenCalled();
    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "git:gitea.example.com/team/skills@default:.",
      }),
    );
    expect(mocks.rm).toHaveBeenCalled();
  });

  it("redacts credentials from fallback Git review identity", async () => {
    await saveRemoteGitSkillPackage(createRemoteSkill(), {
      repoUrl: "https://alice:secret@gitea.example.com/team/skills",
    });

    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "git:gitea.example.com/team/skills@default:.",
      }),
    );
    const scanInput =
      mocks.assertStagedRemoteSkillPackageSafe.mock.calls[0]?.[0];
    expect(scanInput?.sourceKey).not.toContain("alice");
    expect(scanInput?.sourceKey).not.toContain("secret");
    expect(scanInput?.sourceKey).not.toContain("private-token");
    expect(scanInput?.sourceUrl).toBe("https://gitea.example.com/team/skills");
  });

  it("uses the exact source id for Git package review", async () => {
    await saveRemoteGitSkillPackage(
      createRemoteSkill({ source_id: " exact-git-source " }),
      { repoUrl: "https://gitea.example.com/team/skills" },
    );

    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: "exact-git-source" }),
    );
  });

  it("keeps package validation active when content safety scanning is disabled", async () => {
    mocks.assertStagedRemoteSkillPackageSafe.mockResolvedValueOnce(undefined);

    await saveRemoteGitSkillPackage(createRemoteSkill(), {
      repoUrl: "https://gitea.example.com/team/skills",
      safetyScan: { mode: "disabled" },
    });

    expect(mocks.validateMaterializedSkillPackage).toHaveBeenCalledTimes(1);
    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        safetyScan: { mode: "disabled" },
      }),
    );
  });

  it("uses an explicit or source fallback directory and target staging root", async () => {
    const onSafetyReport = vi.fn();
    const result = await saveRemoteGitSkillPackage(
      createRemoteSkill({ source_directory: "/skills/writer/" }),
      {
        repoUrl: "https://gitea.example.com/team/skills",
        branch: "main",
        directory: " ",
        targetRootDir: "/target",
        onSafetyReport,
      },
    );

    expect(result).toBe("/target/repo");
    expect(mocks.fileExists).toHaveBeenCalledWith(
      expect.stringMatching(/skills\/writer\/SKILL\.md$/),
    );
    expect(mocks.copyRepoByPathToDirectory).toHaveBeenCalledWith(
      expect.stringMatching(/skills\/writer$/),
      "repo",
      "/target",
      { ifExists: "error" },
    );
    expect(onSafetyReport).toHaveBeenCalledWith(safeReport);
  });

  it("rejects a requested Git directory without SKILL.md", async () => {
    mocks.fileExists.mockResolvedValue(false);

    await expect(
      saveRemoteGitSkillPackage(createRemoteSkill(), {
        repoUrl: "https://gitea.example.com/team/skills",
        directory: "missing",
      }),
    ).rejects.toThrow(/SKILL\.md not found/);
    expect(mocks.rm).toHaveBeenCalled();
  });

  it("rejects a requested Git directory that escapes the cloned repository", async () => {
    mocks.isPathWithin.mockReturnValue(false);

    await expect(
      saveRemoteGitSkillPackage(createRemoteSkill(), {
        repoUrl: "https://gitea.example.com/team/skills",
        directory: "../outside",
      }),
    ).rejects.toThrow(/Path traversal detected/);
    expect(mocks.fileExists).not.toHaveBeenCalled();
    expect(mocks.rm).toHaveBeenCalled();
  });

  it.each(["explicit", "auto"] as const)(
    "fingerprints a cloned Git package using the $case directory",
    async (directoryMode) => {
      mocks.rm.mockRejectedValueOnce(new Error("cleanup deferred"));
      const result = await getRemoteGitSkillPackageFingerprint({
        repoUrl: "https://gitea.example.com/team/skills",
        ...(directoryMode === "explicit" ? { directory: "writer" } : {}),
      });

      expect(result).toMatch(/^[a-f0-9]{64}$/);
      expect(
        directoryMode === "explicit"
          ? mocks.fileExists
          : mocks.resolveSingleSkillDirFromRepo,
      ).toHaveBeenCalled();
    },
  );

  it("returns SKILL.md and the package fingerprint from one validated Git snapshot", async () => {
    const result = await getRemoteGitSkillPackageSnapshot({
      repoUrl: "http://192.168.10.20/team/skills",
      branch: "main",
      directory: "tools/writer",
    });

    expect(result).toEqual(
      expect.objectContaining({
        content: "# Writer\n",
        directoryFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        resolvedDirectory: "tools/writer",
      }),
    );
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.gitClone).toHaveBeenCalledTimes(1);
    expect(mocks.validateMaterializedSkillPackage).toHaveBeenCalledTimes(1);
    expect(mocks.rm).toHaveBeenCalled();
  });

  it("keeps Git staging alive until the asynchronous snapshot read completes", async () => {
    let resolveFiles:
      | ((files: Array<{ path: string; data: Buffer }>) => void)
      | undefined;
    mocks.readLocalRepoFileBuffersByPath.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFiles = resolve;
        }),
    );

    const snapshotPromise = getRemoteGitSkillPackageSnapshot({
      repoUrl: "https://gitea.example.com/team/skills",
      directory: "tools/writer",
    });
    await vi.waitFor(() =>
      expect(mocks.readLocalRepoFileBuffersByPath).toHaveBeenCalled(),
    );
    expect(mocks.rm).not.toHaveBeenCalled();

    resolveFiles?.([{ path: "SKILL.md", data: Buffer.from("# Writer\n") }]);
    await expect(snapshotPromise).resolves.toMatchObject({
      content: "# Writer\n",
    });
    expect(mocks.rm).toHaveBeenCalled();
  });

  it("returns content and fingerprint from one extracted ZIP snapshot", async () => {
    const fetchArchive = vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9]));

    const result = await getRemoteZipSkillPackageSnapshot(
      { zipUrl: "https://example.com/writer.zip" },
      fetchArchive,
    );

    expect(result).toEqual(
      expect.objectContaining({
        content: "# Writer\n",
        directoryFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(fetchArchive).toHaveBeenCalledTimes(1);
    expect(mocks.extractSkillZipArchive).toHaveBeenCalledTimes(1);
    expect(mocks.resolveSingleSkillDirFromRepo).toHaveBeenCalledTimes(1);
    expect(mocks.validateMaterializedSkillPackage).toHaveBeenCalledTimes(1);
    expect(mocks.rm).toHaveBeenCalled();
  });

  it("sanitizes a URL-derived Zip identity and uses the default fetcher", async () => {
    mocks.rm.mockRejectedValueOnce(new Error("cleanup deferred"));
    const result = await saveRemoteZipSkillPackage(createRemoteSkill(), {
      zipUrl:
        "https://user:secret@example.com/writer.zip?token=secret#fragment",
    });

    expect(result).toBe("/managed/repo");
    expect(mocks.fetchRemoteBytes).toHaveBeenCalledWith(
      "https://user:secret@example.com/writer.zip?token=secret#fragment",
    );
    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "zip:https://example.com/writer.zip",
      }),
    );
  });

  it("falls back to Skill identity for a non-URL Zip source", async () => {
    const onSafetyReport = vi.fn();
    await saveRemoteZipSkillPackage(
      createRemoteSkill(),
      { zipUrl: "custom-package", onSafetyReport },
      vi.fn().mockResolvedValue(new Uint8Array([2])),
    );

    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: "zip:skill:skill-writer" }),
    );
    expect(onSafetyReport).toHaveBeenCalledWith(safeReport);
  });

  it("uses an exact source id for Zip review and rejects empty package URLs", async () => {
    await saveRemoteZipSkillPackage(
      createRemoteSkill({ source_id: " exact-source " }),
      { zipUrl: "https://example.com/writer.zip" },
      vi.fn().mockResolvedValue(new Uint8Array([3])),
    );
    expect(mocks.assertStagedRemoteSkillPackageSafe).toHaveBeenCalledWith(
      expect.objectContaining({ sourceKey: "exact-source" }),
    );

    await expect(
      saveRemoteZipSkillPackage(createRemoteSkill(), { zipUrl: "  " }),
    ).rejects.toThrow(/URL is required/);
  });
});
