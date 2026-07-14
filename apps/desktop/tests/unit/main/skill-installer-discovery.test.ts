import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  collectSkillDirs,
  resolveSkillDirFromRepo,
} from "../../../src/main/services/skill-installer-discovery";

let tmpDir: string;

async function writeSkill(
  root: string,
  relativeDirectory: string,
  name: string,
): Promise<string> {
  const directory = path.join(root, relativeDirectory);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "SKILL.md"),
    `---\nname: ${name}\n---\n\n# ${name}\n`,
    "utf8",
  );
  return directory;
}

describe("skill installer discovery", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "skill-discovery-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("discovers nested local skills once when a symlink points back into the tree", async () => {
    const skillDir = await writeSkill(
      tmpDir,
      "catalog/productivity/grill-me",
      "grill-me",
    );
    await fs.symlink(path.join(tmpDir, "catalog"), path.join(tmpDir, "loop"));

    const discovered = await collectSkillDirs(tmpDir);

    expect(discovered).toEqual([skillDir]);
  });

  it("does not discover remote packages through symlinks or ignored generated directories", async () => {
    await writeSkill(tmpDir, "skills/alpha", "alpha");
    await writeSkill(tmpDir, "skills/beta", "beta");
    const ignoredSkill = await writeSkill(
      tmpDir,
      "node_modules/grill-me",
      "grill-me",
    );
    await fs.symlink(ignoredSkill, path.join(tmpDir, "skills", "grill-me"));

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "grill-me" }),
    ).rejects.toThrow(/none matches/i);
  });

  it("discovers supported hidden Agent Skill containers without entering Git internals", async () => {
    const expected = await writeSkill(
      tmpDir,
      ".agents/skills/published",
      "published",
    );
    await writeSkill(tmpDir, ".git/fixtures/published", "published");

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "published" }),
    ).resolves.toBe(expected);
  });

  it("prefers any hidden Agent skills container over an unrelated duplicate example", async () => {
    const expected = await writeSkill(
      tmpDir,
      ".cursor/skills/review",
      "review",
    );
    await writeSkill(tmpDir, "examples/review", "review");

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "review" }),
    ).resolves.toBe(expected);
  });

  it("does not scan remote packages beyond the depth boundary", async () => {
    const segments = Array.from({ length: 10 }, (_, index) => `level-${index}`);
    await writeSkill(tmpDir, path.join(...segments), "too-deep");

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "too-deep" }),
    ).rejects.toThrow(/does not contain/i);
  });

  it("prefers an exact frontmatter match in a standard Skill container over unrelated examples", async () => {
    const expected = await writeSkill(
      tmpDir,
      "skills/productivity/grill-me",
      "grill-me",
    );
    await writeSkill(tmpDir, "examples/grill-me", "grill-me");

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "grill-me" }),
    ).resolves.toBe(expected);
  });

  it("preserves Unicode letters while matching a repository Skill selector", async () => {
    const expected = await writeSkill(tmpDir, "skills/writing", "中文写作");
    await writeSkill(tmpDir, "skills/review", "代码审查");

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "中文写作" }),
    ).resolves.toBe(expected);
  });

  it("rejects equally ranked duplicate frontmatter names instead of choosing arbitrarily", async () => {
    await writeSkill(tmpDir, "skills/category-a/shared", "shared");
    await writeSkill(tmpDir, "skills/category-b/shared", "shared");

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "shared" }),
    ).rejects.toThrow(/multiple skills matching/i);
  });

  it("rejects repositories that exceed the discovery directory budget", async () => {
    await Promise.all(
      Array.from({ length: 1_001 }, (_, index) =>
        fs.mkdir(path.join(tmpDir, `directory-${index}`)),
      ),
    );

    await expect(
      resolveSkillDirFromRepo(tmpDir, { name: "missing" }),
    ).rejects.toThrow(/directory limit/i);
  });
});
