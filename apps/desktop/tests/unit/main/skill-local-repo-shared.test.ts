import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  getPreferredLocalRepoPathForSkill: vi.fn(),
  isManagedRepoPath: vi.fn(),
  materializeManagedRepoSymlink: vi.fn(),
  saveContentToLocalRepoBySkillId: vi.fn(),
  saveToLocalRepoBySkillId: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: {
    stat: mocks.stat,
  },
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: {
    getPreferredLocalRepoPathForSkill: mocks.getPreferredLocalRepoPathForSkill,
    isManagedRepoPath: mocks.isManagedRepoPath,
    materializeManagedRepoSymlink: mocks.materializeManagedRepoSymlink,
    saveContentToLocalRepoBySkillId: mocks.saveContentToLocalRepoBySkillId,
    saveToLocalRepoBySkillId: mocks.saveToLocalRepoBySkillId,
  },
}));

import {
  ensureLocalRepoPath,
  resolveRepoPath,
} from "../../../src/main/ipc/skill/shared";

function createDirectoryStat() {
  return { isDirectory: () => true };
}

function createDb(skill: Record<string, unknown>) {
  return {
    getById: vi.fn().mockReturnValue(skill),
    update: vi.fn(),
  };
}

describe("skill local repo shared path resolution", () => {
  beforeEach(() => {
    mocks.stat.mockReset();
    mocks.getPreferredLocalRepoPathForSkill.mockReset();
    mocks.isManagedRepoPath.mockReset();
    mocks.materializeManagedRepoSymlink.mockReset();
    mocks.saveContentToLocalRepoBySkillId.mockReset();
    mocks.saveToLocalRepoBySkillId.mockReset();

    mocks.getPreferredLocalRepoPathForSkill.mockReturnValue(
      "/managed/linked/repo",
    );
    mocks.isManagedRepoPath.mockImplementation(async (repoPath: string) =>
      repoPath.startsWith("/managed/"),
    );
    mocks.materializeManagedRepoSymlink.mockResolvedValue(undefined);
    mocks.saveContentToLocalRepoBySkillId.mockResolvedValue(
      "/managed/linked/repo",
    );
    mocks.saveToLocalRepoBySkillId.mockResolvedValue("/managed/linked/repo");
  });

  it("preserves an existing external local_repo_path when it points to a directory", async () => {
    const db = createDb({
      id: "skill-linked",
      name: "linked",
      local_repo_path: "/external/linked",
      instructions: "# Cached",
    });
    mocks.stat.mockImplementation(async (repoPath: string) => {
      if (repoPath === "/external/linked") {
        return createDirectoryStat();
      }
      throw new Error(`missing ${repoPath}`);
    });

    await expect(
      ensureLocalRepoPath(db as never, "skill-linked"),
    ).resolves.toBe("/external/linked");
    await expect(resolveRepoPath(db as never, "skill-linked")).resolves.toBe(
      "/external/linked",
    );

    expect(mocks.saveToLocalRepoBySkillId).not.toHaveBeenCalled();
    expect(mocks.saveContentToLocalRepoBySkillId).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does not materialize stale DB content when an external linked repo is missing", async () => {
    const db = createDb({
      id: "skill-linked",
      name: "linked",
      local_repo_path: "/external/missing",
      instructions: "# Cached",
    });
    mocks.stat.mockRejectedValue(new Error("missing"));

    await expect(
      ensureLocalRepoPath(db as never, "skill-linked"),
    ).resolves.toBeNull();

    expect(mocks.saveToLocalRepoBySkillId).not.toHaveBeenCalled();
    expect(mocks.saveContentToLocalRepoBySkillId).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
