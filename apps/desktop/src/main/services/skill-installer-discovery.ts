import * as fs from "fs/promises";
import path from "path";
import type {
  ScannedSkill,
  Skill,
  SkillManifest,
} from "@prompthub/shared/types";
import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";
import { sanitizeImportedSkillDraft } from "./skill-import-sanitize";
import { fileExists, getErrorCode } from "./skill-installer-internal";
import { isManagedRepoPath } from "./skill-installer-repo";
import { getPlatformSkillsDir } from "./skill-installer-utils";
import { parseSkillMd } from "./skill-validator";

/** Build the de-duplicated local directories that participate in discovery. */
export function getDefaultSkillScanEntries(
  managedSkillsDir: string,
): Array<{ path: string; platformName: string }> {
  const entries = [{ path: managedSkillsDir, platformName: "PromptHub" }];
  for (const platform of SKILL_PLATFORMS) {
    const resolved = getPlatformSkillsDir(platform);
    if (!entries.some((entry) => entry.path === resolved)) {
      entries.push({ path: resolved, platformName: platform.name });
    }
  }
  return entries;
}

/** Read the optional manifest without hiding permission, I/O, or JSON errors. */
export async function readSkillManifest(dir: string): Promise<SkillManifest> {
  const manifestPath = path.join(dir, "manifest.json");
  let content: string;
  try {
    content = await fs.readFile(manifestPath, "utf-8");
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") return {};
    throw new Error(
      `Failed to read manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const skill = sanitizeImportedSkillDraft(parsed, { defaultTags: [] });
    return {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      author: skill.author,
      tags: skill.tags.length > 0 ? skill.tags : undefined,
      instructions: skill.instructions,
    };
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse manifest.json in ${dir}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function normalizeSkillLookupValue(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getChildDirectories(scanPath: string): Promise<string[]> {
  const entries = await fs.readdir(scanPath, { withFileTypes: true });
  const directories: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const candidate = path.join(scanPath, entry.name);
    if (entry.isDirectory()) {
      directories.push(candidate);
      continue;
    }
    if (entry.isSymbolicLink()) {
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isDirectory()) directories.push(candidate);
    }
  }
  return directories;
}

async function collectNestedSkillDirs(baseDir: string): Promise<string[]> {
  try {
    const result: string[] = [];
    for (const nestedDir of await getChildDirectories(baseDir)) {
      if (await fileExists(path.join(nestedDir, "SKILL.md"))) {
        result.push(nestedDir);
      }
    }
    return result;
  } catch (error) {
    console.warn(`Failed reading skill directory: ${baseDir}, skipping`, error);
    return [];
  }
}

/** Discover flat and one-level category-nested Skill directories. */
export async function collectSkillDirs(scanPath: string): Promise<string[]> {
  if (!(await fileExists(scanPath))) return [];
  const result = (await fileExists(path.join(scanPath, "SKILL.md")))
    ? [scanPath]
    : [];
  for (const baseDir of await getChildDirectories(scanPath)) {
    if (await fileExists(path.join(baseDir, "SKILL.md"))) {
      result.push(baseDir);
    } else {
      result.push(...(await collectNestedSkillDirs(baseDir)));
    }
  }
  return result;
}

export async function getScannedSkillInstallMetadata(
  skillFolderPath: string,
): Promise<{
  installMode: ScannedSkill["installMode"];
  symlinkTargetPath?: string;
  isPromptHubManagedLink?: boolean;
}> {
  const stat = await fs.lstat(skillFolderPath).catch(() => null);
  if (!stat?.isSymbolicLink()) return { installMode: "copy" };
  const rawTarget = await fs.readlink(skillFolderPath).catch(() => null);
  const symlinkTargetPath = rawTarget
    ? path.isAbsolute(rawTarget)
      ? rawTarget
      : path.resolve(path.dirname(skillFolderPath), rawTarget)
    : undefined;
  const isPromptHubManagedLink = symlinkTargetPath
    ? await isManagedRepoPath(symlinkTargetPath).catch(() => false)
    : false;
  return {
    installMode: "symlink",
    symlinkTargetPath,
    isPromptHubManagedLink,
  };
}

export async function resolveSingleSkillDirFromRepo(
  repoDir: string,
): Promise<string> {
  const skillDirs = await collectSkillDirs(repoDir);
  if (skillDirs.length === 0) {
    throw new Error("Repository does not contain a SKILL.md file.");
  }
  if (skillDirs.length > 1) {
    throw new Error(
      "Repository contains multiple skills. Import it as a local skill folder instead.",
    );
  }
  return skillDirs[0];
}

function getCandidateSkillNames(skillDir: string): string[] {
  return [path.basename(skillDir), path.basename(path.dirname(skillDir))].map(
    normalizeSkillLookupValue,
  );
}

async function directoryMatchesSkill(
  skillDir: string,
  targetNames: Set<string>,
): Promise<boolean> {
  const content = await fs
    .readFile(path.join(skillDir, "SKILL.md"), "utf-8")
    .catch(() => "");
  const parsedName = normalizeSkillLookupValue(
    parseSkillMd(content)?.frontmatter.name,
  );
  return [parsedName, ...getCandidateSkillNames(skillDir)].some((name) =>
    targetNames.has(name),
  );
}

export async function resolveSkillDirFromRepo(
  repoDir: string,
  skill: Pick<Skill, "name" | "logical_name" | "variant_key">,
): Promise<string> {
  const skillDirs = await collectSkillDirs(repoDir);
  if (skillDirs.length <= 1) return resolveSingleSkillDirFromRepo(repoDir);
  const targetNames = new Set(
    [skill.name, skill.logical_name, skill.variant_key]
      .map(normalizeSkillLookupValue)
      .filter(Boolean),
  );
  const matches: string[] = [];
  for (const skillDir of skillDirs) {
    if (await directoryMatchesSkill(skillDir, targetNames))
      matches.push(skillDir);
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(
      `Repository contains multiple skills matching "${skill.name}". Specify a skill directory.`,
    );
  }
  throw new Error(
    `Repository contains multiple skills, but none matches "${skill.name}". Specify a skill directory.`,
  );
}
