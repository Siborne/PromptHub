/**
 * @vitest-environment node
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SKILL_PACKAGE_DEPTH,
  MAX_SKILL_PACKAGE_ENTRIES,
  MAX_SKILL_PACKAGE_FILE_BYTES,
  MAX_SKILL_PACKAGE_FILES,
  MAX_SKILL_PACKAGE_TOTAL_BYTES,
  validateMaterializedSkillPackage,
} from "../../../src/main/services/skill-package-validation";

describe("materialized Skill package validation", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-package-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("accepts a bounded package while ignoring internal directories and symlinks", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    await fs.mkdir(path.join(tempDir, "scripts"));
    await fs.writeFile(path.join(tempDir, "scripts", "run.ts"), "run();\n");
    await fs.mkdir(path.join(tempDir, ".git"));
    await fs.writeFile(path.join(tempDir, ".git", "config"), "secret\n");
    await fs.symlink(
      path.join(tempDir, "SKILL.md"),
      path.join(tempDir, "linked.md"),
    );

    await expect(validateMaterializedSkillPackage(tempDir)).resolves.toEqual({
      fileCount: 2,
      totalBytes: 15,
    });
  });

  it("accepts legitimate nested template directories within the package depth budget", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    const nestedDir = path.join(
      tempDir,
      ...Array.from({ length: 12 }, (_, index) => `level-${index}`),
    );
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(nestedDir, "template.md"), "template\n");

    await expect(validateMaterializedSkillPackage(tempDir)).resolves.toEqual({
      fileCount: 2,
      totalBytes: 17,
    });
  });

  it("does not reject ignored dependency files when validating a local Agent source", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    const dependencyDir = path.join(tempDir, "node_modules");
    await fs.mkdir(dependencyDir);
    await Promise.all(
      Array.from({ length: MAX_SKILL_PACKAGE_FILES }, (_, index) =>
        fs.writeFile(path.join(dependencyDir, `${index}.js`), "ignored\n"),
      ),
    );

    await expect(validateMaterializedSkillPackage(tempDir)).resolves.toEqual({
      fileCount: 1,
      totalBytes: 8,
    });
  });

  it("rejects packages missing a regular root SKILL.md", async () => {
    await fs.writeFile(path.join(tempDir, "README.md"), "missing\n");

    await expect(validateMaterializedSkillPackage(tempDir)).rejects.toThrow(
      /root SKILL\.md/,
    );
  });

  it("rejects package inventories beyond the fingerprint walk limit", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    const filesDir = path.join(tempDir, "files");
    await fs.mkdir(filesDir);
    await Promise.all(
      Array.from({ length: MAX_SKILL_PACKAGE_FILES }, (_, index) =>
        fs.writeFile(path.join(filesDir, `${index}.txt`), "x"),
      ),
    );

    await expect(validateMaterializedSkillPackage(tempDir)).rejects.toThrow(
      /too many files/,
    );
  });

  it("rejects oversized files before fingerprinting them into memory", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    const oversized = path.join(tempDir, "large.bin");
    await fs.writeFile(oversized, "x");
    await fs.truncate(oversized, MAX_SKILL_PACKAGE_FILE_BYTES + 1);

    await expect(validateMaterializedSkillPackage(tempDir)).rejects.toThrow(
      /file size limit/,
    );
  });

  it("rejects packages whose directory inventory exceeds the entry limit", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    await Promise.all(
      Array.from({ length: MAX_SKILL_PACKAGE_ENTRIES }, (_, index) =>
        fs.mkdir(path.join(tempDir, `dir-${index}`)),
      ),
    );

    await expect(validateMaterializedSkillPackage(tempDir)).rejects.toThrow(
      /too many filesystem entries/,
    );
  });

  it("rejects packages whose individually valid files exceed the total budget", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    const sparseFileSize = Math.ceil(MAX_SKILL_PACKAGE_TOTAL_BYTES / 6);
    for (let index = 0; index < 6; index += 1) {
      const filePath = path.join(tempDir, `sparse-${index}.bin`);
      await fs.writeFile(filePath, "x");
      await fs.truncate(filePath, sparseFileSize);
    }

    await expect(validateMaterializedSkillPackage(tempDir)).rejects.toThrow(
      /total size limit/,
    );
  });

  it("rejects content deeper than the fingerprint walk can represent", async () => {
    await fs.writeFile(path.join(tempDir, "SKILL.md"), "# Skill\n");
    const deepDir = path.join(
      tempDir,
      ...Array.from(
        { length: MAX_SKILL_PACKAGE_DEPTH + 1 },
        (_, index) => `${index + 1}`,
      ),
    );
    await fs.mkdir(deepDir, { recursive: true });
    await fs.writeFile(path.join(deepDir, "hidden.txt"), "hidden\n");

    await expect(validateMaterializedSkillPackage(tempDir)).rejects.toThrow(
      /directory depth limit/,
    );
  });
});
