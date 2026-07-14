import * as fs from "fs/promises";
import path from "path";
import type {
  ScannedSkill,
  Skill,
  SkillManifest,
} from "@prompthub/shared/types";
import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";
import { shouldIgnoreSkillDirectoryEntry } from "@prompthub/shared/utils/skill-identity";
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
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const MAX_SKILL_DISCOVERY_DEPTH = 8;
const MAX_SKILL_DISCOVERY_DIRECTORIES = 1_000;

interface SkillDirectoryDiscoveryOptions {
  followSymlinks: boolean;
  tolerateReadErrors: boolean;
}

async function getChildDirectories(
  scanPath: string,
  followSymlinks: boolean,
): Promise<string[]> {
  const entries = await fs.readdir(scanPath, { withFileTypes: true });
  const directories: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(scanPath, entry.name);
    if (entry.isDirectory()) {
      directories.push(candidate);
      continue;
    }
    if (followSymlinks && entry.isSymbolicLink()) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) directories.push(candidate);
      } catch (error: unknown) {
        console.warn(
          `Failed resolving skill symlink: ${candidate}, skipping`,
          error,
        );
      }
    }
  }
  return directories.sort((left, right) => left.localeCompare(right));
}

async function readChildDirectories(
  directory: string,
  options: SkillDirectoryDiscoveryOptions,
): Promise<string[]> {
  try {
    return await getChildDirectories(directory, options.followSymlinks);
  } catch (error: unknown) {
    if (!options.tolerateReadErrors) throw error;
    console.warn(
      `Failed reading skill directory: ${directory}, skipping`,
      error,
    );
    return [];
  }
}

async function resolveDirectoryIdentity(
  directory: string,
  tolerateReadErrors: boolean,
): Promise<string | null> {
  try {
    return await fs.realpath(directory);
  } catch (error: unknown) {
    if (!tolerateReadErrors) throw error;
    console.warn(
      `Failed resolving skill directory: ${directory}, skipping`,
      error,
    );
    return null;
  }
}

async function collectSkillDirsWithin(
  scanPath: string,
  options: SkillDirectoryDiscoveryOptions,
): Promise<string[]> {
  if (!(await fileExists(scanPath))) return [];
  const result = (await fileExists(path.join(scanPath, "SKILL.md")))
    ? [scanPath]
    : [];
  const pending = [{ directory: scanPath, depth: 0 }];
  const scanIdentity = await resolveDirectoryIdentity(
    scanPath,
    options.tolerateReadErrors,
  );
  if (!scanIdentity) return result;
  const visitedDirectories = new Set([scanIdentity]);
  let cursor = 0;
  let inspectedDirectories = 0;
  while (cursor < pending.length) {
    const current = pending[cursor++];
    if (current.depth >= MAX_SKILL_DISCOVERY_DEPTH) continue;
    for (const child of await readChildDirectories(
      current.directory,
      options,
    )) {
      const relativePath = path.relative(scanPath, child);
      if (shouldIgnoreSkillDirectoryEntry(relativePath)) continue;
      const identity = await resolveDirectoryIdentity(
        child,
        options.tolerateReadErrors,
      );
      if (!identity || visitedDirectories.has(identity)) continue;
      visitedDirectories.add(identity);
      inspectedDirectories += 1;
      if (inspectedDirectories > MAX_SKILL_DISCOVERY_DIRECTORIES) {
        throw new Error("Skill discovery exceeded the directory limit");
      }
      if (await fileExists(path.join(child, "SKILL.md"))) result.push(child);
      else pending.push({ directory: child, depth: current.depth + 1 });
    }
  }
  return result;
}

/** Discover Skill packages recursively within a bounded local source tree. */
export async function collectSkillDirs(scanPath: string): Promise<string[]> {
  return collectSkillDirsWithin(scanPath, {
    followSymlinks: true,
    tolerateReadErrors: true,
  });
}

/** Discover Skill packages in a cloned repository without following links. */
export async function collectSkillDirsFromRepo(
  scanPath: string,
): Promise<string[]> {
  return collectSkillDirsWithin(scanPath, {
    followSymlinks: false,
    tolerateReadErrors: false,
  });
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
  const skillDirs = await collectSkillDirsFromRepo(repoDir);
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
  return [normalizeSkillLookupValue(path.basename(skillDir))];
}

interface SkillDirectoryMatch {
  directory: string;
  priority: number;
}

const STANDARD_SKILLS_PREFIXES = ["skills", "data/skills"];

function pathUsesPrefix(relativePath: string, prefix: string): boolean {
  return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
}

function isHiddenAgentSkillsPath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  const skillsIndex = parts.lastIndexOf("skills");
  return (
    parts[0]?.startsWith(".") === true &&
    skillsIndex >= 1 &&
    skillsIndex < parts.length - 1
  );
}

function getSkillDirectoryPriority(repoDir: string, skillDir: string): number {
  const relativePath = path
    .relative(repoDir, skillDir)
    .replace(/\\/g, "/")
    .toLocaleLowerCase();
  if (!relativePath) return 0;
  if (
    STANDARD_SKILLS_PREFIXES.some((prefix) =>
      pathUsesPrefix(relativePath, prefix),
    )
  ) {
    return 1;
  }
  if (isHiddenAgentSkillsPath(relativePath)) {
    return 2;
  }
  return 3;
}

async function getParsedSkillName(skillDir: string): Promise<string> {
  const content = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf-8");
  return normalizeSkillLookupValue(parseSkillMd(content)?.frontmatter.name);
}

function selectRankedSkillMatch(
  repoDir: string,
  matches: string[],
  displayName: string,
): string | null {
  if (matches.length === 0) return null;
  const ranked: SkillDirectoryMatch[] = matches.map((directory) => ({
    directory,
    priority: getSkillDirectoryPriority(repoDir, directory),
  }));
  const bestPriority = Math.min(...ranked.map((match) => match.priority));
  const bestMatches = ranked.filter((match) => match.priority === bestPriority);
  if (bestMatches.length === 1) return bestMatches[0].directory;
  throw new Error(
    `Repository contains multiple skills matching "${displayName}". Specify a skill directory.`,
  );
}

async function findMatchingSkillDirectories(
  skillDirs: string[],
  targetNames: Set<string>,
): Promise<{ frontmatter: string[]; directory: string[] }> {
  const frontmatter: string[] = [];
  const directory: string[] = [];
  for (const candidate of skillDirs) {
    const parsedName = await getParsedSkillName(candidate);
    if (parsedName && targetNames.has(parsedName)) {
      frontmatter.push(candidate);
      continue;
    }
    if (
      getCandidateSkillNames(candidate).some((name) => targetNames.has(name))
    ) {
      directory.push(candidate);
    }
  }
  return { frontmatter, directory };
}

async function resolveMatchingSkillDir(
  repoDir: string,
  skillDirs: string[],
  skill: Pick<Skill, "name" | "logical_name" | "variant_key">,
): Promise<string> {
  const targetNames = new Set(
    [skill.name, skill.logical_name, skill.variant_key]
      .map(normalizeSkillLookupValue)
      .filter(Boolean),
  );
  const matches = await findMatchingSkillDirectories(skillDirs, targetNames);
  const frontmatterMatch = selectRankedSkillMatch(
    repoDir,
    matches.frontmatter,
    skill.name,
  );
  if (frontmatterMatch) return frontmatterMatch;
  const directoryMatch = selectRankedSkillMatch(
    repoDir,
    matches.directory,
    skill.name,
  );
  if (directoryMatch) return directoryMatch;
  throw new Error(
    `Repository contains multiple skills or a mismatched package, but none matches "${skill.name}". Specify a skill directory.`,
  );
}

/** Resolve an exact selector without accepting an unrelated single package. */
export async function resolveSkillDirBySelectorFromRepo(
  repoDir: string,
  skillName: string,
): Promise<string> {
  const skillDirs = await collectSkillDirsFromRepo(repoDir);
  if (skillDirs.length === 0) {
    throw new Error("Repository does not contain a SKILL.md file.");
  }
  return resolveMatchingSkillDir(repoDir, skillDirs, { name: skillName });
}

export async function resolveSkillDirFromRepo(
  repoDir: string,
  skill: Pick<Skill, "name" | "logical_name" | "variant_key">,
): Promise<string> {
  const skillDirs = await collectSkillDirsFromRepo(repoDir);
  if (skillDirs.length <= 1) return resolveSingleSkillDirFromRepo(repoDir);
  return resolveMatchingSkillDir(repoDir, skillDirs, skill);
}
