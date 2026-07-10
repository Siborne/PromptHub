import fs from "fs";
import path from "path";
import { PassThrough } from "stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import { closeDatabase, resetRuntimePaths } from "@prompthub/core";

import { execCli, makeTempRoot, withDataDir } from "./helpers/cli-harness";

function createSkillPackage(root: string, skillName: string): string {
  const skillDir = path.join(root, skillName);
  fs.mkdirSync(path.join(skillDir, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      `description: ${skillName} description`,
      "version: 1.0.0",
      "author: CLI Test",
      "---",
      "",
      `# ${skillName}`,
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(path.join(skillDir, "assets", "helper.txt"), "helper v1");
  return skillDir;
}

describe("CLI project Skill installation", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("installs, skips, and overwrites a My Skills package in a project", async () => {
    const root = makeTempRoot(tempDirs);
    const originalCwd = process.cwd();
    const skillDir = createSkillPackage(root, "project-writer");
    const projectRoot = path.join(root, "project");
    fs.mkdirSync(projectRoot, { recursive: true });

    const installRes = await execCli([
      ...withDataDir(root),
      "skill",
      "install",
      skillDir,
    ]);
    expect(installRes.exitCode).toBe(0);

    try {
      process.chdir(projectRoot);
      const resolvedProjectRoot = fs.realpathSync(projectRoot);
      const projectInstallRes = await execCli([
        ...withDataDir(root),
        "skill",
        "project-install",
        "project-writer",
      ]);
      expect(projectInstallRes.exitCode).toBe(0);
      expect(projectInstallRes.json).toMatchObject({
        status: "installed",
        skillName: "project-writer",
        projectRoot: resolvedProjectRoot,
        targetRootDir: path.join(resolvedProjectRoot, ".agents", "skills"),
        mode: "copy",
        forced: false,
      });

      const targetFile = path.join(
        projectRoot,
        ".agents",
        "skills",
        "project-writer",
        "assets",
        "helper.txt",
      );
      expect(fs.readFileSync(targetFile, "utf8")).toBe("helper v1");

      fs.writeFileSync(targetFile, "local edit", "utf8");
      const skippedRes = await execCli([
        ...withDataDir(root),
        "skill",
        "project-install",
        "project-writer",
      ]);
      expect(skippedRes.exitCode).toBe(0);
      expect(skippedRes.json.status).toBe("skipped");
      expect(fs.readFileSync(targetFile, "utf8")).toBe("local edit");

      const forcedRes = await execCli([
        ...withDataDir(root),
        "skill",
        "project-install",
        "project-writer",
        "--force",
      ]);
      expect(forcedRes.exitCode).toBe(0);
      expect(forcedRes.json).toMatchObject({ status: "updated", forced: true });
      expect(fs.readFileSync(targetFile, "utf8")).toBe("helper v1");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("selects a project Skill interactively when no identifier is provided", async () => {
    const root = makeTempRoot(tempDirs);
    const projectRoot = path.join(root, "interactive-project");
    fs.mkdirSync(projectRoot, { recursive: true });

    for (const skillName of ["alpha-skill", "beta-skill"]) {
      const installRes = await execCli([
        ...withDataDir(root),
        "skill",
        "install",
        createSkillPackage(root, skillName),
      ]);
      expect(installRes.exitCode).toBe(0);
    }

    const stdin = new PassThrough();
    stdin.end("1\n");
    const result = await execCli(
      [
        ...withDataDir(root),
        "skill",
        "project-install",
        "--project",
        projectRoot,
      ],
      undefined,
      { stdin, isInteractive: true },
    );

    expect(result.exitCode).toBe(0);
    expect(result.joinedStderr).toContain("选择要安装到项目的 Skill");
    expect(result.json.status).toBe("installed");
    expect(
      fs.existsSync(
        path.join(
          projectRoot,
          ".agents",
          "skills",
          result.json.skillName,
          "SKILL.md",
        ),
      ),
    ).toBe(true);
  });

  it("supports fuzzy project Skill selection and rejects ambiguous matches", async () => {
    const root = makeTempRoot(tempDirs);
    const projectRoot = path.join(root, "fuzzy-project");
    fs.mkdirSync(projectRoot, { recursive: true });

    for (const skillName of ["writer-alpha", "writer-beta"]) {
      const installRes = await execCli([
        ...withDataDir(root),
        "skill",
        "install",
        createSkillPackage(root, skillName),
      ]);
      expect(installRes.exitCode).toBe(0);
    }

    const uniqueRes = await execCli([
      ...withDataDir(root),
      "skill",
      "project-install",
      "alpha",
      "--project",
      projectRoot,
    ]);
    expect(uniqueRes.exitCode).toBe(0);
    expect(uniqueRes.json.skillName).toBe("writer-alpha");

    const ambiguousRes = await execCli([
      ...withDataDir(root),
      "skill",
      "project-install",
      "writer",
      "--project",
      projectRoot,
    ]);
    expect(ambiguousRes.exitCode).toBe(4);
    expect(ambiguousRes.errorJson.error.code).toBe("CONFLICT");
    expect(ambiguousRes.errorJson.error.details.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "writer-alpha" }),
        expect.objectContaining({ name: "writer-beta" }),
      ]),
    );
  });
});
