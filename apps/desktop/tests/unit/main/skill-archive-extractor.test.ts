/**
 * @vitest-environment node
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractSkillZipArchive } from "../../../src/main/services/skill-archive-extractor";
import {
  MAX_SKILL_PACKAGE_FILE_BYTES,
  MAX_SKILL_PACKAGE_FILES,
} from "../../../src/main/services/skill-package-validation";

describe("Skill Zip extraction", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-zip-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("extracts normalized bounded files", async () => {
    const archive = zipSync({
      "SKILL.md": strToU8("# Skill\n"),
      "scripts/run.ts": strToU8("run();\n"),
      ".git/config": strToU8("ignored\n"),
    });

    await extractSkillZipArchive(archive, tempDir);

    await expect(
      fs.readFile(path.join(tempDir, "SKILL.md"), "utf8"),
    ).resolves.toBe("# Skill\n");
    await expect(fs.stat(path.join(tempDir, ".git"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects traversal and case-insensitive duplicate paths", async () => {
    const traversal = zipSync({
      "../outside.txt": strToU8("outside"),
      "SKILL.md": strToU8("# Skill\n"),
    });
    const duplicate = zipSync({
      "SKILL.md": strToU8("# One\n"),
      "skill.md": strToU8("# Two\n"),
    });

    await expect(extractSkillZipArchive(traversal, tempDir)).rejects.toThrow(
      /Path traversal detected/,
    );
    await expect(extractSkillZipArchive(duplicate, tempDir)).rejects.toThrow(
      /duplicate path/i,
    );
  });

  it("rejects oversized decompressed entries before extraction", async () => {
    const archive = zipSync(
      {
        "SKILL.md": strToU8("# Skill\n"),
        "large.bin": new Uint8Array(MAX_SKILL_PACKAGE_FILE_BYTES + 1),
      },
      { level: 9 },
    );

    await expect(extractSkillZipArchive(archive, tempDir)).rejects.toThrow(
      /file size limit/,
    );
  });

  it("rejects archive inventories beyond the package file limit", async () => {
    const files: Record<string, Uint8Array> = {
      "SKILL.md": strToU8("# Skill\n"),
    };
    for (let index = 0; index < MAX_SKILL_PACKAGE_FILES; index += 1) {
      files[`files/${index}.txt`] = strToU8("x");
    }

    await expect(
      extractSkillZipArchive(zipSync(files), tempDir),
    ).rejects.toThrow(/too many files/);
  });

  it("rejects over-deep paths before writing archive entries", async () => {
    const archive = zipSync({
      "SKILL.md": strToU8("# Skill\n"),
      "a/b/c/d/e/f/g.txt": strToU8("too deep"),
    });

    await expect(extractSkillZipArchive(archive, tempDir)).rejects.toThrow(
      /depth limit/,
    );
    await expect(fs.stat(path.join(tempDir, "a"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
