import * as fs from "fs/promises";
import path from "path";
import type { Skill } from "@prompthub/shared/types";
import {
  fileExists,
  getErrorCode,
  getSkillsDirAccessor,
} from "./skill-installer-internal";
import {
  copyMaterializedSkillDirectory,
  getManagedContainerPathForSkill,
  initializeManagedVariantContainer,
} from "./skill-installer-repo";

type ManagedSkillIdentity = Pick<
  Skill,
  | "id"
  | "name"
  | "source_id"
  | "source_url"
  | "directory_fingerprint"
  | "logical_name"
  | "variant_key"
>;

export interface ManagedRepoReplacement {
  repoPath: string;
  recovery: {
    repoPath: string;
    backupPath?: string;
    hadOriginal: boolean;
  };
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

type ManagedRepoReplacementState = {
  repoDir: string;
  stagingDir: string;
  backupDir: string;
  hadOriginal: boolean;
  status: "pending" | "committed" | "rolled-back";
};

async function commitReplacement(
  state: ManagedRepoReplacementState,
): Promise<void> {
  if (state.status !== "pending") return;
  if (state.hadOriginal) {
    await fs.rm(state.backupDir, { recursive: true, force: true });
  }
  state.status = "committed";
}

async function rollbackReplacement(
  state: ManagedRepoReplacementState,
): Promise<void> {
  if (state.status !== "pending") return;
  await fs.rm(state.repoDir, { recursive: true, force: true });
  if (state.hadOriginal) {
    await fs.rename(state.backupDir, state.repoDir);
  }
  await fs.rm(state.stagingDir, { recursive: true, force: true });
  state.status = "rolled-back";
}

async function moveStagedRepoIntoPlace(
  state: ManagedRepoReplacementState,
): Promise<void> {
  if (state.hadOriginal) {
    await fs.rename(state.repoDir, state.backupDir);
  }
  try {
    await fs.rename(state.stagingDir, state.repoDir);
  } catch (error) {
    if (state.hadOriginal) {
      await fs.rename(state.backupDir, state.repoDir).catch(() => {});
    }
    throw error;
  }
}

async function assertSourceDirectory(sourceDir: string): Promise<void> {
  const sourceStat = await fs.stat(sourceDir).catch((error: unknown) => {
    if (getErrorCode(error) === "ENOENT") {
      throw new Error(
        `Invalid sourceDir: directory does not exist: ${sourceDir}`,
      );
    }
    throw error;
  });
  if (!sourceStat.isDirectory()) {
    throw new Error(`Invalid sourceDir: not a directory: ${sourceDir}`);
  }
}

async function lstatIfPresent(targetPath: string) {
  return fs.lstat(targetPath).catch((error: unknown) => {
    if (getErrorCode(error) === "ENOENT") return null;
    throw error;
  });
}

async function assertSafeManagedTarget(containerDir: string): Promise<void> {
  const skillsDir = path.resolve(getSkillsDirAccessor());
  const resolvedContainer = path.resolve(containerDir);
  if (path.dirname(resolvedContainer) !== skillsDir) {
    throw new Error(
      "Managed Skill container must be a direct child of skillsDir",
    );
  }
  const containerStat = await lstatIfPresent(resolvedContainer);
  if (containerStat?.isSymbolicLink()) {
    throw new Error("Refusing to replace a symlinked managed container");
  }
  const repoStat = await lstatIfPresent(path.join(resolvedContainer, "repo"));
  if (repoStat?.isSymbolicLink()) {
    throw new Error("Refusing to replace a symlinked managed repository");
  }
  if (!containerStat) return;
  const realSkillsDir = await fs.realpath(skillsDir);
  const realContainer = await fs.realpath(resolvedContainer);
  if (path.dirname(realContainer) !== realSkillsDir) {
    throw new Error("Managed Skill container resolves outside skillsDir");
  }
}

async function createReplacementState(
  skill: ManagedSkillIdentity,
): Promise<{ containerDir: string; state: ManagedRepoReplacementState }> {
  const containerDir = await getManagedContainerPathForSkill(skill);
  await assertSafeManagedTarget(containerDir);
  const repoDir = path.join(containerDir, "repo");
  const suffix = `${Date.now()}-${process.pid}`;
  return {
    containerDir,
    state: {
      repoDir,
      stagingDir: `${repoDir}.staging-${suffix}`,
      backupDir: `${repoDir}.old-${suffix}`,
      hadOriginal: await fileExists(repoDir),
      status: "pending",
    },
  };
}

function getRecovery(
  state: ManagedRepoReplacementState,
): ManagedRepoReplacement["recovery"] {
  return {
    repoPath: state.repoDir,
    ...(state.hadOriginal ? { backupPath: state.backupDir } : {}),
    hadOriginal: state.hadOriginal,
  };
}

async function applyReplacement(
  skill: ManagedSkillIdentity,
  containerDir: string,
  sourceDir: string,
  state: ManagedRepoReplacementState,
): Promise<void> {
  await initializeManagedVariantContainer(skill, containerDir);
  await fs.rm(state.stagingDir, { recursive: true, force: true });
  await fs.rm(state.backupDir, { recursive: true, force: true });
  try {
    await copyMaterializedSkillDirectory(sourceDir, state.stagingDir);
    await moveStagedRepoIntoPlace(state);
  } catch (error) {
    await fs
      .rm(state.stagingDir, { recursive: true, force: true })
      .catch(() => {});
    throw error;
  }
}

/** Journal first, then start a filesystem replacement that remains reversible. */
export async function beginManagedRepoReplacement(
  skill: ManagedSkillIdentity,
  sourceDir: string,
  beforeApply?: (recovery: ManagedRepoReplacement["recovery"]) => Promise<void>,
): Promise<ManagedRepoReplacement> {
  await assertSourceDirectory(sourceDir);
  const { containerDir, state } = await createReplacementState(skill);
  const recovery = getRecovery(state);
  await beforeApply?.(recovery);
  await applyReplacement(skill, containerDir, sourceDir, state);
  return {
    repoPath: state.repoDir,
    recovery,
    commit: () => commitReplacement(state),
    rollback: () => rollbackReplacement(state),
  };
}

export async function saveToLocalRepoBySkillId(
  skillOrId: string | ManagedSkillIdentity,
  sourceDir: string,
  _mode: "copy" | "symlink" = "copy",
): Promise<string> {
  const skill =
    typeof skillOrId === "string"
      ? ({ id: skillOrId, name: skillOrId } as ManagedSkillIdentity)
      : skillOrId;
  const replacement = await beginManagedRepoReplacement(skill, sourceDir);
  try {
    await replacement.commit();
    return replacement.repoPath;
  } catch (error) {
    await replacement.rollback().catch(() => {});
    throw error;
  }
}
