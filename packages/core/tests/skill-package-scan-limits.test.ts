import fs from "fs/promises";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { readRepoSecretScanEntries } from "../src/cli/skill/paths";
import {
  SKILL_SECRET_SCAN_MAX_FILE_BYTES,
  SKILL_SECRET_SCAN_MAX_TOTAL_BYTES,
  SkillPackageScanLimitError,
} from "../src/skills/package-policy";

describe("Skill package secret scan limits", () => {
  const tempDirs: string[] = [];

  async function makePackage(): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-scan-"));
    tempDirs.push(root);
    return root;
  }

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("rejects an oversized text file without returning its contents", async () => {
    const root = await makePackage();
    await fs.writeFile(
      path.join(root, "large.txt"),
      Buffer.alloc(SKILL_SECRET_SCAN_MAX_FILE_BYTES + 1, 0x61),
    );

    const error = await readRepoSecretScanEntries(root).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(SkillPackageScanLimitError);
    expect(error).toMatchObject({
      path: "large.txt",
      limitKind: "file",
      limitBytes: SKILL_SECRET_SCAN_MAX_FILE_BYTES,
    });
    expect(JSON.stringify(error)).not.toContain("aaaa");
  });

  it("enforces a bounded total text budget across the package", async () => {
    const root = await makePackage();
    const chunk = Buffer.alloc(SKILL_SECRET_SCAN_MAX_FILE_BYTES, 0x62);
    for (let index = 0; index < 8; index += 1) {
      await fs.writeFile(path.join(root, `chunk-${index}.txt`), chunk);
    }
    await fs.writeFile(path.join(root, "SKILL.md"), "# Skill", "utf8");

    const error = await readRepoSecretScanEntries(root).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(SkillPackageScanLimitError);
    expect(error).toMatchObject({
      limitKind: "package",
      limitBytes: SKILL_SECRET_SCAN_MAX_TOTAL_BYTES,
    });
  });

  it("skips large binary files after bounded null-byte detection", async () => {
    const root = await makePackage();
    await fs.writeFile(
      path.join(root, "archive.bin"),
      Buffer.alloc(SKILL_SECRET_SCAN_MAX_FILE_BYTES + 1),
    );

    await expect(readRepoSecretScanEntries(root)).resolves.toEqual([]);
  });
});
