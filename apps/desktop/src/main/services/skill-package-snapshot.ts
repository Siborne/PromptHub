import { createHash } from "crypto";
import type { SkillPackageSnapshot } from "@prompthub/shared/types";
import {
  MAX_SKILL_PACKAGE_DIFF_TEXT_FILE_BYTES,
  MAX_SKILL_PACKAGE_DIFF_TOTAL_TEXT_BYTES,
} from "@prompthub/shared/constants/skill-package";
import { computeSkillPackageFingerprintV1Sync } from "@prompthub/shared/utils/skill-source-update";
import { readLocalRepoFileBuffersByPath } from "./skill-installer-repo";
import { validateMaterializedSkillPackage } from "./skill-package-validation";

function decodePreviewText(data: Uint8Array): string | null {
  if (data.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return null;
  }
}

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function buildSnapshotFiles(
  files: Awaited<ReturnType<typeof readLocalRepoFileBuffersByPath>>,
): NonNullable<SkillPackageSnapshot["files"]> {
  let remainingTextBytes = MAX_SKILL_PACKAGE_DIFF_TOTAL_TEXT_BYTES;
  return [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => {
      const sizeBytes = file.data.byteLength;
      const contentHash = sha256(file.data);
      const text = decodePreviewText(file.data);
      if (text === null) {
        return {
          path: file.path,
          sizeBytes,
          contentHash,
          kind: "binary" as const,
        };
      }
      const canIncludeContent =
        sizeBytes <= MAX_SKILL_PACKAGE_DIFF_TEXT_FILE_BYTES &&
        sizeBytes <= remainingTextBytes;
      if (canIncludeContent) remainingTextBytes -= sizeBytes;
      return {
        path: file.path,
        sizeBytes,
        contentHash,
        kind: "text" as const,
        ...(canIncludeContent ? { content: text } : { contentTruncated: true }),
      };
    });
}

/** Read content and fingerprint from one already validated package inventory. */
export async function readSkillPackageSnapshotFromValidatedDirectory(
  skillDirectory: string,
): Promise<SkillPackageSnapshot> {
  const files = await readLocalRepoFileBuffersByPath(skillDirectory);
  const skillMarkdown = files.find(
    (file) => file.path.replace(/\\/g, "/").toLowerCase() === "skill.md",
  );
  if (!skillMarkdown) {
    throw new Error("Skill package must contain a root SKILL.md file");
  }
  return {
    content: Buffer.from(skillMarkdown.data).toString("utf-8"),
    directoryFingerprint:
      computeSkillPackageFingerprintV1Sync(files).fingerprint,
    scope: "package",
    files: buildSnapshotFiles(files),
  };
}

/** Validate an external directory before reading its package snapshot. */
export async function readValidatedSkillPackageSnapshot(
  skillDirectory: string,
): Promise<SkillPackageSnapshot> {
  await validateMaterializedSkillPackage(skillDirectory);
  return readSkillPackageSnapshotFromValidatedDirectory(skillDirectory);
}
