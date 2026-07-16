import fs from "fs/promises";

import type { SkillDB } from "@prompthub/db";
import type {
  Skill,
  SkillLocalFileTreeEntry,
  SkillVersion,
} from "@prompthub/shared/types";

import type { CliContext } from "./types";
import { normalizeExistingPath, walkRepoDir } from "./skill/paths";

export function countSkillFiles(entries: SkillLocalFileTreeEntry[]): number {
  return entries.filter((entry) => !entry.isDirectory).length;
}

export function summarizeSkill(skill: Skill | null, fileCount?: number) {
  if (!skill) {
    return null;
  }
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    currentVersion: skill.currentVersion,
    directoryFingerprint: skill.directory_fingerprint,
    ...(fileCount !== undefined && { fileCount }),
  };
}

export function summarizeSkillVersion(
  version: SkillVersion | null,
  directoryFingerprint?: string,
) {
  if (!version) {
    return null;
  }
  return {
    id: version.id,
    skillId: version.skillId,
    version: version.version,
    note: version.note,
    createdAt: version.createdAt,
    directoryFingerprint,
    fileCount: version.filesSnapshot?.length ?? (version.content ? 1 : 0),
  };
}

export async function skillOutputPayload(
  context: CliContext,
  _skillDb: SkillDB,
  skill: Skill | null,
) {
  if (context.detail === "full" || !skill) {
    return skill;
  }

  const fallbackCount = skill.instructions || skill.content ? 1 : 0;
  if (!skill.local_repo_path) {
    return summarizeSkill(skill, fallbackCount);
  }

  try {
    const stat = await fs.stat(skill.local_repo_path);
    if (!stat.isDirectory()) {
      return summarizeSkill(skill, fallbackCount);
    }
    const files = await walkRepoDir<SkillLocalFileTreeEntry>({
      baseDir: skill.local_repo_path,
      realBasePath: await normalizeExistingPath(skill.local_repo_path),
      onEntry: async ({ relativePath, isDirectory }) => ({
        path: relativePath,
        isDirectory,
      }),
    });
    return summarizeSkill(skill, countSkillFiles(files));
  } catch {
    return summarizeSkill(skill, fallbackCount);
  }
}
