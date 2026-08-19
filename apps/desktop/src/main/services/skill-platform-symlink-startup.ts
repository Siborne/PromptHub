import path from "node:path";

import { getCacheDir, getDataDir } from "@prompthub/core";
import type { Skill } from "@prompthub/shared/types";

import { SkillDB } from "../database/skill";
import Database from "../database/sqlite";
import { getSupportedPlatforms } from "./skill-installer-platform";
import { getPlatformSkillsDir } from "./skill-installer-utils";
import {
  reconcileManagedSkillSymlinks,
  type ManagedSkillSymlinkPlatform,
  type ManagedSkillSymlinkReconciliationResult,
} from "./skill-platform-symlink-reconciliation";

type SkillIdentity = Pick<Skill, "id" | "name">;

export interface ManagedSkillSymlinkStartupDependencies {
  getManagedSkillsRoot(): string;
  getCanonicalWorkspaceRoot(): string;
  getSkills(database: Database.Database): readonly SkillIdentity[];
  getPlatforms(): readonly ManagedSkillSymlinkPlatform[];
  reconcile: typeof reconcileManagedSkillSymlinks;
  info(message: string): void;
  warn(message: string, error?: unknown): void;
}

function createDefaultDependencies(): ManagedSkillSymlinkStartupDependencies {
  return {
    getManagedSkillsRoot: () => path.join(getDataDir(), "skills"),
    getCanonicalWorkspaceRoot: () =>
      path.join(getCacheDir(), "skill-workspaces"),
    getSkills: (database) => new SkillDB(database).getAll(),
    getPlatforms: () =>
      getSupportedPlatforms().map((platform) => ({
        id: platform.id,
        skillsDir: getPlatformSkillsDir(platform),
      })),
    reconcile: reconcileManagedSkillSymlinks,
    info: (message) => console.info(message),
    warn: (message, error) => console.warn(message, error),
  };
}

export async function reconcileManagedSkillSymlinksOnStartup(
  database: Database.Database,
  dependencies = createDefaultDependencies(),
): Promise<ManagedSkillSymlinkReconciliationResult> {
  try {
    const result = await dependencies.reconcile({
      managedSkillsRoot: dependencies.getManagedSkillsRoot(),
      canonicalWorkspaceRoot: dependencies.getCanonicalWorkspaceRoot(),
      skills: dependencies.getSkills(database),
      platforms: dependencies.getPlatforms(),
    });
    if (result.rebound > 0) {
      dependencies.info(
        `[startup] Rebound ${result.rebound} PromptHub-managed Skill symlink(s) to canonical workspaces`,
      );
    }
    if (result.failed > 0) {
      dependencies.warn(
        `[startup] Failed to reconcile ${result.failed} PromptHub-managed Skill symlink(s)`,
      );
    }
    return result;
  } catch (error) {
    dependencies.warn(
      "[startup] Managed Skill symlink reconciliation failed; existing links were preserved:",
      error,
    );
    return { inspected: 0, rebound: 0, healthy: 0, skipped: 0, failed: 1 };
  }
}
