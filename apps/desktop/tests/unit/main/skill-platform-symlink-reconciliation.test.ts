/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { reconcileManagedSkillSymlinks } from "../../../src/main/services/skill-platform-symlink-reconciliation";
import { reconcileManagedSkillSymlinksOnStartup } from "../../../src/main/services/skill-platform-symlink-startup";

const roots: string[] = [];
const skill = { id: "skill-1", name: "design-system" };

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-link-reconcile-"));
  roots.push(root);
  const managedSkillsRoot = path.join(root, "data", "skills");
  const canonicalWorkspaceRoot = path.join(root, "cache", "skill-workspaces");
  const platformSkillsDir = path.join(root, "agent", "skills");
  const workspace = path.join(canonicalWorkspaceRoot, skill.id);
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, "SKILL.md"), "# Design system\n");
  fs.mkdirSync(platformSkillsDir, { recursive: true });
  return {
    root,
    managedSkillsRoot,
    canonicalWorkspaceRoot,
    platformSkillsDir,
    workspace,
  };
}

function writeActivations(
  platformSkillsDir: string,
  value: unknown = {
    [skill.name]: { skillId: skill.id, skillName: skill.name },
  },
): void {
  fs.writeFileSync(
    path.join(platformSkillsDir, ".prompthub-platform-activations.json"),
    `${JSON.stringify(value)}\n`,
  );
}

function createLegacyLink(
  platformSkillsDir: string,
  managedSkillsRoot: string,
): { linkPath: string; legacyTarget: string } {
  const linkPath = path.join(platformSkillsDir, skill.name);
  const legacyTarget = path.join(
    managedSkillsRoot,
    "design-system--12345678",
    "repo",
  );
  fs.symlinkSync(legacyTarget, linkPath, "dir");
  return { linkPath, legacyTarget };
}

function reconcileOptions(fixture: ReturnType<typeof createFixture>) {
  return {
    managedSkillsRoot: fixture.managedSkillsRoot,
    canonicalWorkspaceRoot: fixture.canonicalWorkspaceRoot,
    skills: [skill],
    platforms: [{ id: "codex", skillsDir: fixture.platformSkillsDir }] as const,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("managed Skill symlink reconciliation", () => {
  it("rebinds an activated legacy managed link and is idempotent", async () => {
    const fixture = createFixture();
    writeActivations(fixture.platformSkillsDir);
    const { linkPath, legacyTarget } = createLegacyLink(
      fixture.platformSkillsDir,
      fixture.managedSkillsRoot,
    );
    fs.mkdirSync(legacyTarget, { recursive: true });
    fs.writeFileSync(path.join(legacyTarget, "SKILL.md"), "# Stale copy\n");
    fs.rmSync(linkPath);
    fs.symlinkSync(
      path.relative(path.dirname(linkPath), legacyTarget),
      linkPath,
      "dir",
    );

    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ inspected: 1, rebound: 1, failed: 0 });
    expect(fs.readlinkSync(linkPath)).toBe(fixture.workspace);
    expect(fs.readFileSync(path.join(linkPath, "SKILL.md"), "utf8")).toBe(
      "# Design system\n",
    );

    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ inspected: 1, rebound: 0, healthy: 1 });
  });

  it("does not adopt an external dangling link or overwrite non-link content", async () => {
    const fixture = createFixture();
    writeActivations(fixture.platformSkillsDir);
    const linkPath = path.join(fixture.platformSkillsDir, skill.name);
    const externalTarget = path.join(fixture.root, "external", "missing");
    fs.symlinkSync(externalTarget, linkPath, "dir");

    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ rebound: 0, skipped: 1, failed: 0 });
    expect(fs.readlinkSync(linkPath)).toBe(externalTarget);

    fs.rmSync(linkPath);
    fs.mkdirSync(linkPath);
    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ rebound: 0, skipped: 1, failed: 0 });
    expect(fs.lstatSync(linkPath).isDirectory()).toBe(true);

    fs.rmSync(linkPath, { recursive: true });
    fs.symlinkSync(linkPath, linkPath, "dir");
    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ rebound: 0, failed: 1 });
  });

  it("requires exact activation identity and a safe canonical workspace", async () => {
    const fixture = createFixture();
    const { linkPath, legacyTarget } = createLegacyLink(
      fixture.platformSkillsDir,
      fixture.managedSkillsRoot,
    );
    writeActivations(fixture.platformSkillsDir, {
      [skill.name]: { skillId: "other-id", skillName: skill.name },
    });

    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ rebound: 0, skipped: 1 });
    expect(fs.readlinkSync(linkPath)).toBe(legacyTarget);

    writeActivations(fixture.platformSkillsDir);
    fs.rmSync(fixture.workspace, { recursive: true, force: true });
    const externalWorkspace = path.join(fixture.root, "external-workspace");
    fs.mkdirSync(externalWorkspace);
    fs.writeFileSync(path.join(externalWorkspace, "SKILL.md"), "# External\n");
    fs.symlinkSync(externalWorkspace, fixture.workspace, "dir");

    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
    ).resolves.toMatchObject({ rebound: 0, skipped: 1 });
    expect(fs.readlinkSync(linkPath)).toBe(legacyTarget);

    const escapedSkill = { id: "../escaped", name: skill.name };
    const escapedWorkspace = path.join(
      fixture.canonicalWorkspaceRoot,
      escapedSkill.id,
    );
    fs.mkdirSync(escapedWorkspace, { recursive: true });
    fs.writeFileSync(path.join(escapedWorkspace, "SKILL.md"), "# Escaped\n");
    writeActivations(fixture.platformSkillsDir, {
      [skill.name]: {
        skillId: escapedSkill.id,
        skillName: escapedSkill.name,
      },
    });
    await expect(
      reconcileManagedSkillSymlinks({
        ...reconcileOptions(fixture),
        skills: [escapedSkill],
      }),
    ).resolves.toMatchObject({ rebound: 0, skipped: 1 });
  });

  it("rejects unsafe, malformed, oversized, and unbounded activation state", async () => {
    const fixtures = Array.from({ length: 5 }, () => createFixture());
    for (const fixture of fixtures) {
      createLegacyLink(fixture.platformSkillsDir, fixture.managedSkillsRoot);
    }
    const [symlinked, malformed, oversized, unbounded, stateDirectory] =
      fixtures;
    const externalState = path.join(symlinked.root, "external-state.json");
    fs.writeFileSync(externalState, JSON.stringify({}));
    fs.symlinkSync(
      externalState,
      path.join(
        symlinked.platformSkillsDir,
        ".prompthub-platform-activations.json",
      ),
    );
    fs.writeFileSync(
      path.join(
        malformed.platformSkillsDir,
        ".prompthub-platform-activations.json",
      ),
      "{invalid",
    );
    fs.writeFileSync(
      path.join(
        oversized.platformSkillsDir,
        ".prompthub-platform-activations.json",
      ),
      "x".repeat(1024 * 1024 + 1),
    );
    writeActivations(
      unbounded.platformSkillsDir,
      Object.fromEntries(
        Array.from({ length: 513 }, (_, index) => [
          `skill-${index}`,
          { skillId: `id-${index}`, skillName: `skill-${index}` },
        ]),
      ),
    );
    fs.mkdirSync(
      path.join(
        stateDirectory.platformSkillsDir,
        ".prompthub-platform-activations.json",
      ),
    );

    for (const fixture of fixtures) {
      await expect(
        reconcileManagedSkillSymlinks(reconcileOptions(fixture)),
      ).resolves.toMatchObject({ inspected: 0, rebound: 0 });
    }

    const missingRoot = createFixture();
    fs.rmSync(missingRoot.platformSkillsDir, { recursive: true, force: true });
    await expect(
      reconcileManagedSkillSymlinks(reconcileOptions(missingRoot)),
    ).resolves.toMatchObject({ inspected: 0, rebound: 0 });

    const openFailure = createFixture();
    createLegacyLink(
      openFailure.platformSkillsDir,
      openFailure.managedSkillsRoot,
    );
    writeActivations(openFailure.platformSkillsDir);
    await expect(
      reconcileManagedSkillSymlinks({
        ...reconcileOptions(openFailure),
        openActivationFile: async () => {
          throw new Error("open failed");
        },
      }),
    ).resolves.toMatchObject({ inspected: 0, rebound: 0 });
  });

  it("restores the original dangling link when staged replacement fails", async () => {
    const fixture = createFixture();
    writeActivations(fixture.platformSkillsDir);
    const { linkPath, legacyTarget } = createLegacyLink(
      fixture.platformSkillsDir,
      fixture.managedSkillsRoot,
    );

    await expect(
      reconcileManagedSkillSymlinks({
        ...reconcileOptions(fixture),
        injectBeforePublish: () => {
          throw new Error("injected publication failure");
        },
      }),
    ).resolves.toMatchObject({ rebound: 0, failed: 1 });
    expect(fs.readlinkSync(linkPath)).toBe(legacyTarget);
    expect(
      fs
        .readdirSync(fixture.platformSkillsDir)
        .filter((entry) => entry.includes("prompthub-rebind")),
    ).toEqual([]);
  });

  it("does not overwrite a link changed concurrently before publication", async () => {
    const fixture = createFixture();
    writeActivations(fixture.platformSkillsDir);
    const { linkPath } = createLegacyLink(
      fixture.platformSkillsDir,
      fixture.managedSkillsRoot,
    );
    const replacementTarget = path.join(fixture.root, "replacement-target");
    fs.mkdirSync(replacementTarget);

    await expect(
      reconcileManagedSkillSymlinks({
        ...reconcileOptions(fixture),
        injectBeforePublish: (candidate) => {
          fs.rmSync(candidate);
          fs.symlinkSync(replacementTarget, candidate, "dir");
        },
      }),
    ).resolves.toMatchObject({ rebound: 0, failed: 1 });
    expect(fs.readlinkSync(linkPath)).toBe(replacementTarget);
    expect(
      fs
        .readdirSync(fixture.platformSkillsDir)
        .filter((entry) => entry.includes("prompthub-rebind")),
    ).toEqual([]);
  });
});

describe("managed Skill symlink startup", () => {
  it("loads startup inputs and emits one bounded reconciliation summary", async () => {
    const fixture = createFixture();
    const result = {
      inspected: 2,
      rebound: 1,
      healthy: 0,
      skipped: 0,
      failed: 1,
    };
    const reconcile = vi.fn().mockResolvedValue(result);
    const info = vi.fn();
    const warn = vi.fn();

    await expect(
      reconcileManagedSkillSymlinksOnStartup({} as never, {
        getManagedSkillsRoot: () => fixture.managedSkillsRoot,
        getCanonicalWorkspaceRoot: () => fixture.canonicalWorkspaceRoot,
        getSkills: () => [skill],
        getPlatforms: () => [
          { id: "codex", skillsDir: fixture.platformSkillsDir },
        ],
        reconcile,
        info,
        warn,
      }),
    ).resolves.toEqual(result);
    expect(reconcile).toHaveBeenCalledWith({
      managedSkillsRoot: fixture.managedSkillsRoot,
      canonicalWorkspaceRoot: fixture.canonicalWorkspaceRoot,
      skills: [skill],
      platforms: [{ id: "codex", skillsDir: fixture.platformSkillsDir }],
    });
    expect(info).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("keeps startup usable when reconciliation setup fails", async () => {
    const failure = new Error("catalog unavailable");
    const warn = vi.fn();

    await expect(
      reconcileManagedSkillSymlinksOnStartup({} as never, {
        getManagedSkillsRoot: () => "/managed",
        getCanonicalWorkspaceRoot: () => "/canonical",
        getSkills: () => {
          throw failure;
        },
        getPlatforms: () => [],
        reconcile: vi.fn(),
        info: vi.fn(),
        warn,
      }),
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
