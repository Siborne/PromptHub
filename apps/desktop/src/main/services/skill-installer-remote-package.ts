import * as fs from "fs/promises";
import * as path from "path";
import type {
  SkillPackageSnapshot,
  Skill,
  SkillSafetyReport,
} from "@prompthub/shared/types";
import { parseGitRepo } from "@prompthub/shared/utils/git-repo";
import { computeSkillPackageFingerprintV1Sync } from "@prompthub/shared/utils/skill-source-update";
import { sanitizeSkillPackageSourceUrl } from "@prompthub/core/skills/package-operation";
import { extractSkillZipArchive } from "./skill-archive-extractor";
import {
  resolveSkillDirBySelectorFromRepo,
  resolveSingleSkillDirFromRepo,
  resolveSkillDirFromRepo,
} from "./skill-installer-discovery";
import {
  fileExists,
  getSkillsDirAccessor,
  initSkillsDir,
  isPathWithin,
} from "./skill-installer-internal";
import {
  copyRepoByPathToDirectory,
  readLocalRepoFileBuffersByPath,
} from "./skill-installer-repo";
import { saveToLocalRepoBySkillId } from "./skill-installer-replacement";
import { fetchRemoteBytes } from "./skill-installer-remote";
import { gitClone } from "./skill-installer-utils";
import {
  assertStagedRemoteSkillPackageSafe,
  type RemoteSkillPackageSafetyScanOptions,
} from "./skill-update-safety";
import { validateMaterializedSkillPackage } from "./skill-package-validation";
import { readSkillPackageSnapshotFromValidatedDirectory } from "./skill-package-snapshot";

export type RemotePackageSkill = Pick<
  Skill,
  | "id"
  | "name"
  | "source_id"
  | "source_url"
  | "source_directory"
  | "directory_fingerprint"
  | "logical_name"
  | "variant_key"
>;

export interface RemoteGitPackageOptions {
  repoUrl: string;
  branch?: string;
  directory?: string;
  skillName?: string;
  safetyScan?: RemoteSkillPackageSafetyScanOptions;
  approvedPackageFingerprint?: string;
  targetRootDir?: string;
  onSafetyReport?: (report: SkillSafetyReport) => void;
}

export interface RemoteZipPackageOptions {
  zipUrl: string;
  safetyScan?: RemoteSkillPackageSafetyScanOptions;
  approvedPackageFingerprint?: string;
  targetRootDir?: string;
  onSafetyReport?: (report: SkillSafetyReport) => void;
}

export interface RemoteZipSnapshotOptions {
  zipUrl: string;
}

function buildRemoteGitSourceKey(
  skill: RemotePackageSkill,
  repo: NonNullable<ReturnType<typeof parseGitRepo>>,
  branch?: string,
  directory?: string,
  skillName?: string,
): string {
  if (skill.source_id?.trim()) return skill.source_id.trim();
  const repository = sanitizeSkillPackageSourceUrl(repo.repositoryUrl)
    .replace(/^https?:\/\//u, "")
    .replace(/\/$/u, "");
  return `git:${repository}@${branch?.trim() || "default"}:${directory?.trim() || skillName?.trim() || "."}`;
}

function buildRemoteZipSourceKey(
  skill: RemotePackageSkill,
  zipUrl: string,
): string {
  if (skill.source_id?.trim()) return skill.source_id.trim();
  try {
    const url = new URL(zipUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `zip:${url.toString()}`;
  } catch {
    return `zip:skill:${skill.id}`;
  }
}

function parseRequiredGitRepo(repoUrl: string) {
  const parsedRepo = parseGitRepo(repoUrl);
  if (!parsedRepo) {
    throw new Error(
      "Invalid git repository URL: must be https://<host>/{owner}/{repo} or git@<host>:{owner}/{repo}.git",
    );
  }
  return parsedRepo;
}

function normalizeDirectory(value?: string | null): string | undefined {
  return value?.trim().replace(/^\/+|\/+$/g, "") || undefined;
}

async function resolveExplicitSkillDirectory(
  repoDir: string,
  requestedDirectory: string,
): Promise<string> {
  const candidateDir = path.resolve(repoDir, requestedDirectory);
  if (!isPathWithin(repoDir, candidateDir)) {
    throw new Error(
      "Path traversal detected: skill directory is outside repository",
    );
  }
  if (!(await fileExists(path.join(candidateDir, "SKILL.md")))) {
    throw new Error(`SKILL.md not found in directory: ${requestedDirectory}`);
  }
  return candidateDir;
}

async function resolveGitSkillDirectory(
  repoDir: string,
  skill: RemotePackageSkill,
  requestedDirectory?: string,
  skillName?: string,
): Promise<string> {
  if (requestedDirectory) {
    return resolveExplicitSkillDirectory(repoDir, requestedDirectory);
  }
  const selector = skillName?.trim();
  return selector
    ? resolveSkillDirBySelectorFromRepo(repoDir, selector)
    : resolveSkillDirFromRepo(repoDir, skill);
}

async function computePackageFingerprint(skillDir: string): Promise<string> {
  const files = await readLocalRepoFileBuffersByPath(skillDir);
  return computeSkillPackageFingerprintV1Sync(files).fingerprint;
}

async function persistStagedPackage(
  skill: RemotePackageSkill,
  skillDir: string,
  targetRootDir?: string,
): Promise<string> {
  if (targetRootDir) {
    return copyRepoByPathToDirectory(skillDir, "repo", targetRootDir, {
      ifExists: "error",
    });
  }
  return saveToLocalRepoBySkillId(skill, skillDir, "copy");
}

/** Clone, validate, review, and materialize one Git-backed Skill package. */
export async function saveRemoteGitSkillPackage(
  skill: RemotePackageSkill,
  options: RemoteGitPackageOptions,
): Promise<string> {
  await initSkillsDir();
  const parsedRepo = parseRequiredGitRepo(options.repoUrl);
  const tempRoot = await fs.mkdtemp(
    path.join(getSkillsDirAccessor(), ".remote-import-"),
  );
  const repoDir = path.join(tempRoot, `${parsedRepo.owner}-${parsedRepo.repo}`);

  try {
    await gitClone(parsedRepo.cloneUrl, repoDir, options.branch);
    const requestedDirectory =
      normalizeDirectory(options.directory) ??
      normalizeDirectory(skill.source_directory);
    const skillDir = await resolveGitSkillDirectory(
      repoDir,
      skill,
      requestedDirectory,
      options.skillName,
    );
    await validateMaterializedSkillPackage(skillDir);
    const packageFingerprint = await computePackageFingerprint(skillDir);
    const safetyReport = await assertStagedRemoteSkillPackageSafe({
      skill,
      skillDir,
      sourceUrl: sanitizeSkillPackageSourceUrl(options.repoUrl),
      safetyScan: options.safetyScan,
      packageFingerprint,
      approvedPackageFingerprint: options.approvedPackageFingerprint,
      sourceKey: buildRemoteGitSourceKey(
        skill,
        parsedRepo,
        options.branch,
        requestedDirectory,
        options.skillName,
      ),
    });
    options.onSafetyReport?.(safetyReport);
    return await persistStagedPackage(skill, skillDir, options.targetRootDir);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

/** Clone and fingerprint a complete Git-backed Skill package. */
export async function getRemoteGitSkillPackageFingerprint(options: {
  repoUrl: string;
  branch?: string;
  directory?: string;
  skillName?: string;
}): Promise<string | undefined> {
  return withRemoteGitSkillPackage(options, computePackageFingerprint);
}

async function resolveSnapshotSkillDirectory(
  repoDir: string,
  options: Pick<RemoteGitPackageOptions, "directory" | "skillName">,
): Promise<string> {
  const requestedDirectory = normalizeDirectory(options.directory);
  if (requestedDirectory) {
    return resolveExplicitSkillDirectory(repoDir, requestedDirectory);
  }
  const skillName = options.skillName?.trim();
  return skillName
    ? resolveSkillDirBySelectorFromRepo(repoDir, skillName)
    : resolveSingleSkillDirFromRepo(repoDir);
}

async function withRemoteGitSkillPackage<T>(
  options: Pick<
    RemoteGitPackageOptions,
    "repoUrl" | "branch" | "directory" | "skillName"
  >,
  readSnapshot: (skillDir: string, repoDir: string) => Promise<T>,
): Promise<T> {
  await initSkillsDir();
  const parsedRepo = parseRequiredGitRepo(options.repoUrl);
  const tempRoot = await fs.mkdtemp(
    path.join(getSkillsDirAccessor(), ".remote-fingerprint-"),
  );
  const repoDir = path.join(tempRoot, `${parsedRepo.owner}-${parsedRepo.repo}`);

  try {
    await gitClone(parsedRepo.cloneUrl, repoDir, options.branch);
    const skillDir = await resolveSnapshotSkillDirectory(repoDir, options);
    await validateMaterializedSkillPackage(skillDir);
    return await readSnapshot(skillDir, repoDir);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

/** Clone once and return the exact entry content plus complete package hash. */
export async function getRemoteGitSkillPackageSnapshot(
  options: Pick<
    RemoteGitPackageOptions,
    "repoUrl" | "branch" | "directory" | "skillName"
  >,
): Promise<SkillPackageSnapshot> {
  return withRemoteGitSkillPackage(options, async (skillDir, repoDir) => {
    const snapshot =
      await readSkillPackageSnapshotFromValidatedDirectory(skillDir);
    const relativeDirectory = path
      .relative(repoDir, skillDir)
      .split(path.sep)
      .join("/");
    return {
      ...snapshot,
      resolvedDirectory: relativeDirectory || ".",
    };
  });
}

async function withRemoteZipSkillPackage<T>(
  options: RemoteZipSnapshotOptions,
  fetchArchive: (url: string) => Promise<Uint8Array>,
  resolveSkillDirectory: (extractDir: string) => Promise<string>,
  readPackage: (skillDir: string, zipUrl: string) => Promise<T>,
): Promise<T> {
  await initSkillsDir();
  const zipUrl = options.zipUrl?.trim();
  if (!zipUrl) throw new Error("Remote skill package URL is required");
  const tempRoot = await fs.mkdtemp(
    path.join(getSkillsDirAccessor(), ".remote-zip-"),
  );
  const extractDir = path.join(tempRoot, "package");

  try {
    await extractSkillZipArchive(await fetchArchive(zipUrl), extractDir);
    const skillDir = await resolveSkillDirectory(extractDir);
    await validateMaterializedSkillPackage(skillDir);
    return await readPackage(skillDir, zipUrl);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

/** Download and return one exact ZIP package snapshot. */
export async function getRemoteZipSkillPackageSnapshot(
  options: RemoteZipSnapshotOptions,
  fetchArchive: (url: string) => Promise<Uint8Array> = fetchRemoteBytes,
): Promise<SkillPackageSnapshot> {
  return withRemoteZipSkillPackage(
    options,
    fetchArchive,
    resolveSingleSkillDirFromRepo,
    async (skillDir) =>
      readSkillPackageSnapshotFromValidatedDirectory(skillDir),
  );
}

/** Download, validate, review, and materialize one ZIP-backed Skill package. */
export async function saveRemoteZipSkillPackage(
  skill: RemotePackageSkill,
  options: RemoteZipPackageOptions,
  fetchArchive: (url: string) => Promise<Uint8Array> = fetchRemoteBytes,
): Promise<string> {
  return withRemoteZipSkillPackage(
    options,
    fetchArchive,
    (extractDir) => resolveSkillDirFromRepo(extractDir, skill),
    async (skillDir, zipUrl) => {
      const packageFingerprint = await computePackageFingerprint(skillDir);
      const safetyReport = await assertStagedRemoteSkillPackageSafe({
        skill,
        skillDir,
        sourceUrl: sanitizeSkillPackageSourceUrl(zipUrl),
        safetyScan: options.safetyScan,
        packageFingerprint,
        approvedPackageFingerprint: options.approvedPackageFingerprint,
        sourceKey: buildRemoteZipSourceKey(skill, zipUrl),
      });
      options.onSafetyReport?.(safetyReport);
      return await persistStagedPackage(skill, skillDir, options.targetRootDir);
    },
  );
}
