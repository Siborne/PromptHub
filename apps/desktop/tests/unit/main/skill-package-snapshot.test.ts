/**
 * @vitest-environment node
 */
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { computeSkillPackageFingerprintV1Sync } from "@prompthub/shared/utils/skill-source-update";
import { readValidatedSkillPackageSnapshot } from "../../../src/main/services/skill-package-snapshot";

const tempRoots: string[] = [];

async function createTempSkill(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skill-snapshot-"));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, "references"), { recursive: true });
  await fs.writeFile(path.join(root, "SKILL.md"), "# Writer\n", "utf-8");
  await fs.writeFile(
    path.join(root, "references", "guide.md"),
    "Use the guide\n",
    "utf-8",
  );
  await fs.writeFile(
    path.join(root, "references", "asset.bin"),
    Buffer.from([0, 255, 1, 2]),
  );
  return root;
}

function sha256(content: Uint8Array | string): string {
  return createHash("sha256").update(content).digest("hex");
}

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Skill package snapshot", () => {
  it("reads entry content and fingerprints the same validated file set", async () => {
    const root = await createTempSkill();
    const snapshot = await readValidatedSkillPackageSnapshot(root);
    const expected = computeSkillPackageFingerprintV1Sync([
      { path: "SKILL.md", data: Buffer.from("# Writer\n") },
      {
        path: "references/guide.md",
        data: Buffer.from("Use the guide\n"),
      },
      {
        path: "references/asset.bin",
        data: Buffer.from([0, 255, 1, 2]),
      },
    ]).fingerprint;

    expect(snapshot).toEqual({
      content: "# Writer\n",
      directoryFingerprint: expected,
      scope: "package",
      files: [
        {
          path: "references/asset.bin",
          sizeBytes: 4,
          contentHash: sha256(Buffer.from([0, 255, 1, 2])),
          kind: "binary",
        },
        {
          path: "references/guide.md",
          sizeBytes: 14,
          contentHash: sha256("Use the guide\n"),
          kind: "text",
          content: "Use the guide\n",
        },
        {
          path: "SKILL.md",
          sizeBytes: 9,
          contentHash: sha256("# Writer\n"),
          kind: "text",
          content: "# Writer\n",
        },
      ],
    });
  });

  it("rejects a directory without a root SKILL.md", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skill-snapshot-"));
    tempRoots.push(root);
    await fs.writeFile(path.join(root, "README.md"), "# Missing\n", "utf-8");

    await expect(readValidatedSkillPackageSnapshot(root)).rejects.toThrow(
      /root SKILL\.md/,
    );
  });
});
