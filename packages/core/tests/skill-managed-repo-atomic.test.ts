import fs from "fs/promises";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { saveRepo } from "../src/cli/skill/install";
import {
  configureRuntimePaths,
  getSkillsDir,
  resetRuntimePaths,
} from "../src/runtime-paths";

describe("managed Skill repo replacement", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    resetRuntimePaths();
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("preserves the previous managed copy when staging fails", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-atomic-"));
    tempDirs.push(root);
    configureRuntimePaths({ userDataPath: path.join(root, "user-data") });

    const sourceDir = path.join(root, "source");
    const destinationDir = path.join(getSkillsDir(), "atomic-skill");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(destinationDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "SKILL.md"), "# New", "utf8");
    await fs.writeFile(path.join(destinationDir, "SKILL.md"), "# Old", "utf8");
    vi.spyOn(fs, "cp").mockRejectedValueOnce(new Error("copy failed"));

    await expect(saveRepo("atomic-skill", sourceDir)).rejects.toThrow(
      "copy failed",
    );
    await expect(
      fs.readFile(path.join(destinationDir, "SKILL.md"), "utf8"),
    ).resolves.toBe("# Old");
    await expect(fs.readdir(getSkillsDir())).resolves.toEqual(["atomic-skill"]);
  });
});
