import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { Skill } from "@prompthub/shared/types";

import { getErrorCode } from "./skill-installer-internal";
import {
  MAX_PLATFORM_ACTIVATION_RECORDS,
  parsePlatformActivationState,
  PLATFORM_ACTIVATION_STATE_FILE,
} from "./skill-installer-platform";

const MAX_PLATFORM_ACTIVATION_BYTES = 1024 * 1024;

type SkillIdentity = Pick<Skill, "id" | "name">;

export interface ManagedSkillSymlinkPlatform {
  id: string;
  skillsDir: string;
}

export interface ReconcileManagedSkillSymlinksOptions {
  managedSkillsRoot: string;
  canonicalWorkspaceRoot: string;
  skills: readonly SkillIdentity[];
  platforms: readonly ManagedSkillSymlinkPlatform[];
  injectBeforePublish?: (linkPath: string) => void;
  openActivationFile?: typeof fs.open;
}

export interface ManagedSkillSymlinkReconciliationResult {
  inspected: number;
  rebound: number;
  healthy: number;
  skipped: number;
  failed: number;
}

function emptyResult(): ManagedSkillSymlinkReconciliationResult {
  return { inspected: 0, rebound: 0, healthy: 0, skipped: 0, failed: 0 };
}

function isDirectChild(rootPath: string, candidatePath: string): boolean {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  return path.dirname(candidate) === root && candidate !== root;
}

function resolveStoredLinkTarget(
  linkPath: string,
  storedTarget: string,
): string {
  return path.resolve(
    path.isAbsolute(storedTarget)
      ? storedTarget
      : path.join(path.dirname(linkPath), storedTarget),
  );
}

function isLegacyManagedRepoTarget(
  managedSkillsRoot: string,
  targetPath: string,
): boolean {
  return (
    path.basename(targetPath) === "repo" &&
    isDirectChild(managedSkillsRoot, path.dirname(targetPath))
  );
}

async function readBoundedActivationState(
  skillsDir: string,
  openFile: typeof fs.open,
) {
  const rootStats = await fs.lstat(skillsDir).catch(() => null);
  if (!rootStats?.isDirectory()) return null;
  const statePath = path.join(skillsDir, PLATFORM_ACTIVATION_STATE_FILE);
  const stateStats = await fs.lstat(statePath).catch(() => null);
  if (!stateStats?.isFile()) return null;
  const flags = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
  const handle = await openFile(statePath, flags).catch(() => null);
  if (!handle) return null;
  try {
    const buffer = Buffer.alloc(MAX_PLATFORM_ACTIVATION_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_PLATFORM_ACTIVATION_BYTES) return null;
    const parsed = parsePlatformActivationState(
      buffer.subarray(0, bytesRead).toString("utf8"),
    );
    return Object.keys(parsed).length <= MAX_PLATFORM_ACTIVATION_RECORDS
      ? parsed
      : null;
  } finally {
    await handle.close();
  }
}

async function isSafeCanonicalWorkspace(
  canonicalWorkspaceRoot: string,
  workspacePath: string,
): Promise<boolean> {
  if (!isDirectChild(canonicalWorkspaceRoot, workspacePath)) return false;
  const rootStats = await fs.lstat(canonicalWorkspaceRoot).catch(() => null);
  const workspaceStats = await fs.lstat(workspacePath).catch(() => null);
  const skillFileStats = await fs
    .lstat(path.join(workspacePath, "SKILL.md"))
    .catch(() => null);
  return Boolean(
    rootStats?.isDirectory() &&
    workspaceStats?.isDirectory() &&
    skillFileStats?.isFile(),
  );
}

async function replaceManagedSymlink(input: {
  linkPath: string;
  storedTarget: string;
  workspacePath: string;
  injectBeforePublish?: (linkPath: string) => void;
}): Promise<void> {
  const suffix = `prompthub-rebind-${process.pid}-${randomUUID()}`;
  const stagePath = `${input.linkPath}.${suffix}.stage`;
  let stageExists = false;
  try {
    await fs.symlink(input.workspacePath, stagePath, "dir");
    stageExists = true;
    input.injectBeforePublish?.(input.linkPath);
    if ((await fs.readlink(input.linkPath)) !== input.storedTarget) {
      throw new Error("Managed Skill link changed during reconciliation");
    }
    await fs.rename(stagePath, input.linkPath);
    stageExists = false;
  } finally {
    if (stageExists) await fs.rm(stagePath, { force: true });
  }
}

export async function reconcileManagedSkillSymlinks(
  options: ReconcileManagedSkillSymlinksOptions,
): Promise<ManagedSkillSymlinkReconciliationResult> {
  const result = emptyResult();
  const skillsById = new Map(options.skills.map((skill) => [skill.id, skill]));
  for (const platform of options.platforms) {
    const activations = await readBoundedActivationState(
      platform.skillsDir,
      options.openActivationFile ?? fs.open,
    );
    if (!activations) continue;
    for (const [activationName, activation] of Object.entries(activations)) {
      result.inspected += 1;
      const skill = skillsById.get(activation.skillId);
      const linkPath = path.join(platform.skillsDir, activationName);
      if (
        !skill ||
        skill.name !== activation.skillName ||
        activationName !== activation.skillName ||
        !isDirectChild(platform.skillsDir, linkPath)
      ) {
        result.skipped += 1;
        continue;
      }
      const linkStats = await fs.lstat(linkPath).catch(() => null);
      if (!linkStats?.isSymbolicLink()) {
        result.skipped += 1;
        continue;
      }
      const storedTarget = await fs.readlink(linkPath).catch(() => null);
      const workspacePath = path.join(options.canonicalWorkspaceRoot, skill.id);
      const isLegacyManagedTarget = Boolean(
        storedTarget &&
        isLegacyManagedRepoTarget(
          options.managedSkillsRoot,
          resolveStoredLinkTarget(linkPath, storedTarget),
        ),
      );
      if (!isLegacyManagedTarget) {
        try {
          await fs.stat(linkPath);
          result.healthy += 1;
        } catch (error) {
          if (getErrorCode(error) === "ENOENT") result.skipped += 1;
          else result.failed += 1;
        }
        continue;
      }
      if (
        !(await isSafeCanonicalWorkspace(
          options.canonicalWorkspaceRoot,
          workspacePath,
        ))
      ) {
        result.skipped += 1;
        continue;
      }
      try {
        await replaceManagedSymlink({
          linkPath,
          storedTarget: storedTarget!,
          workspacePath,
          injectBeforePublish: options.injectBeforePublish,
        });
        result.rebound += 1;
      } catch {
        result.failed += 1;
      }
    }
  }
  return result;
}
