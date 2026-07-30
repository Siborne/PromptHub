/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createSharedSkillDistributionService,
  resolveSharedSkillTargetRoot,
} from "@prompthub/core";

describe("shared global skill distribution", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function createFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "shared-skills-"));
    tempRoots.push(root);
    const homeDir = path.join(root, "home");
    const dataDir = path.join(root, "data");
    const sourcePath = path.join(root, "source", "writer");
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.writeFileSync(
      path.join(sourcePath, "SKILL.md"),
      "---\nname: writer\n---\nWrite clearly.",
      "utf8",
    );
    const service = createSharedSkillDistributionService({
      getDataDir: () => dataDir,
      getHomeDir: () => homeDir,
    });
    return { dataDir, homeDir, root, service, sourcePath };
  }

  it("resolves the shared target without shell expansion and rejects unsafe roots", () => {
    const { homeDir } = createFixture();
    expect(resolveSharedSkillTargetRoot(homeDir)).toBe(
      path.join(homeDir, ".agents", "skills"),
    );
    expect(() => resolveSharedSkillTargetRoot(homeDir, homeDir)).toThrow(
      /home/i,
    );
    expect(() => resolveSharedSkillTargetRoot(homeDir, "relative/path")).toThrow(
      /absolute/i,
    );
    expect(() =>
      resolveSharedSkillTargetRoot(homeDir, `${homeDir}\0escape`),
    ).toThrow(/control/i);
  });

  it("owns copy installs, detects modification, and removes only confirmed content", async () => {
    const { homeDir, service, sourcePath } = createFixture();
    const installed = await service.install({
      skillId: "skill-1",
      skillName: "writer",
      sourcePath,
      mode: "copy",
    });
    expect(installed.state).toBe("managed-clean");
    expect(installed.targetPath).toBe(
      path.join(homeDir, ".agents", "skills", "writer"),
    );

    fs.appendFileSync(path.join(installed.targetPath, "SKILL.md"), "\nChanged");
    const modified = await service.getStatus({
      skillId: "skill-1",
      skillName: "writer",
    });
    expect(modified.state).toBe("managed-modified");

    await expect(
      service.uninstall({ skillId: "skill-1", skillName: "writer" }),
    ).rejects.toThrow(/modified/i);
    expect(fs.existsSync(installed.targetPath)).toBe(true);

    const removed = await service.uninstall({
      skillId: "skill-1",
      skillName: "writer",
      expectedFingerprint: modified.currentFingerprint,
    });
    expect(removed.state).toBe("not-installed");
    expect(fs.existsSync(installed.targetPath)).toBe(false);
    expect(fs.existsSync(sourcePath)).toBe(true);
  });

  it("refuses an unmanaged target and unlinks a managed symlink without deleting source", async () => {
    const { homeDir, service, sourcePath } = createFixture();
    const targetPath = path.join(homeDir, ".agents", "skills", "writer");
    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(targetPath, "SKILL.md"), "unmanaged", "utf8");

    await expect(
      service.install({
        skillId: "skill-1",
        skillName: "writer",
        sourcePath,
        mode: "copy",
      }),
    ).rejects.toThrow(/unmanaged/i);

    fs.rmSync(targetPath, { recursive: true, force: true });
    const installed = await service.install({
      skillId: "skill-1",
      skillName: "writer",
      sourcePath,
      mode: "symlink",
    });
    expect(installed.effectiveMode).toBe("symlink");
    expect(fs.lstatSync(targetPath).isSymbolicLink()).toBe(true);

    await service.uninstall({ skillId: "skill-1", skillName: "writer" });
    expect(fs.existsSync(targetPath)).toBe(false);
    expect(fs.existsSync(sourcePath)).toBe(true);
  });

  it("rejects a managed source nested under the shared target root", async () => {
    const { homeDir, service } = createFixture();
    const sourcePath = path.join(
      homeDir,
      ".agents",
      "skills",
      "source-skill",
    );
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.writeFileSync(
      path.join(sourcePath, "SKILL.md"),
      "---\nname: source-skill\n---\nSource",
      "utf8",
    );

    await expect(
      service.install({
        skillId: "skill-1",
        skillName: "writer",
        sourcePath,
        mode: "copy",
      }),
    ).rejects.toThrow(/source.*target root/i);
    expect(
      fs.existsSync(path.join(homeDir, ".agents", "skills", "writer")),
    ).toBe(false);
  });

  it("rejects a symlinked target root that resolves inside the source", async () => {
    const { root, service, sourcePath } = createFixture();
    const realTargetRoot = path.join(sourcePath, "shared-target");
    const linkedTargetRoot = path.join(root, "linked-target");
    fs.mkdirSync(realTargetRoot, { recursive: true });
    fs.symlinkSync(realTargetRoot, linkedTargetRoot, "dir");

    await expect(
      service.install({
        skillId: "skill-1",
        skillName: "writer",
        sourcePath,
        targetRoot: linkedTargetRoot,
        mode: "copy",
      }),
    ).rejects.toThrow(/target.*source/i);
    expect(
      fs.readdirSync(realTargetRoot, { withFileTypes: true }),
    ).toHaveLength(0);
  });
});
