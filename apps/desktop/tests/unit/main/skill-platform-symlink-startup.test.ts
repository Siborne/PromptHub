/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcile: vi.fn(),
  skills: [{ id: "skill-1", name: "design-system" }],
}));

vi.mock("@prompthub/core", () => ({
  getCacheDir: () => "/active/cache",
  getDataDir: () => "/active/data",
}));

vi.mock("../../../src/main/database/skill", () => ({
  SkillDB: class {
    getAll() {
      return mocks.skills;
    }
  },
}));

vi.mock("../../../src/main/services/skill-installer-platform", () => ({
  getSupportedPlatforms: () => [{ id: "codex", name: "Codex" }],
}));

vi.mock("../../../src/main/services/skill-installer-utils", () => ({
  getPlatformSkillsDir: (platform: { id: string }) =>
    `/agents/${platform.id}/skills`,
}));

vi.mock(
  "../../../src/main/services/skill-platform-symlink-reconciliation",
  () => ({ reconcileManagedSkillSymlinks: mocks.reconcile }),
);

import { reconcileManagedSkillSymlinksOnStartup } from "../../../src/main/services/skill-platform-symlink-startup";

afterEach(() => {
  vi.restoreAllMocks();
  mocks.reconcile.mockReset();
});

describe("managed Skill symlink default startup wiring", () => {
  it("loads canonical roots, current Skills, and configured platform paths", async () => {
    mocks.reconcile.mockResolvedValue({
      inspected: 1,
      rebound: 1,
      healthy: 0,
      skipped: 0,
      failed: 1,
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      reconcileManagedSkillSymlinksOnStartup({} as never),
    ).resolves.toMatchObject({ rebound: 1, failed: 1 });
    expect(mocks.reconcile).toHaveBeenCalledWith({
      managedSkillsRoot: "/active/data/skills",
      canonicalWorkspaceRoot: "/active/cache/skill-workspaces",
      skills: mocks.skills,
      platforms: [{ id: "codex", skillsDir: "/agents/codex/skills" }],
    });
    expect(info).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("fails closed without aborting startup when reconciliation throws", async () => {
    const failure = new Error("reconciliation failed");
    mocks.reconcile.mockRejectedValue(failure);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      reconcileManagedSkillSymlinksOnStartup({} as never),
    ).resolves.toEqual({
      inspected: 0,
      rebound: 0,
      healthy: 0,
      skipped: 0,
      failed: 1,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("existing links were preserved"),
      failure,
    );
  });
});
