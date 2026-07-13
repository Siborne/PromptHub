import * as fs from "fs/promises";
import path from "path";
import {
  MAX_SKILL_PACKAGE_DEPTH,
  MAX_SKILL_PACKAGE_ENTRIES,
  MAX_SKILL_PACKAGE_FILE_BYTES,
  MAX_SKILL_PACKAGE_FILES,
  MAX_SKILL_PACKAGE_TOTAL_BYTES,
} from "@prompthub/shared/constants/skill-package";
import { isPathWithin } from "./skill-installer-internal";
import { isInternalSkillRepoEntry } from "./skill-installer-repo";

export {
  MAX_SKILL_PACKAGE_DEPTH,
  MAX_SKILL_PACKAGE_ENTRIES,
  MAX_SKILL_PACKAGE_FILE_BYTES,
  MAX_SKILL_PACKAGE_FILES,
  MAX_SKILL_PACKAGE_TOTAL_BYTES,
} from "@prompthub/shared/constants/skill-package";

export interface SkillPackageInventory {
  fileCount: number;
  totalBytes: number;
}

type InventoryState = SkillPackageInventory & { entryCount: number };

async function assertRootSkillMarkdown(rootDir: string): Promise<void> {
  const skillMd = path.join(rootDir, "SKILL.md");
  const stat = await fs.lstat(skillMd).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error("Skill package must contain a regular root SKILL.md file");
  }
}

function assertEntryBudget(state: InventoryState): void {
  state.entryCount += 1;
  if (state.entryCount > MAX_SKILL_PACKAGE_ENTRIES) {
    throw new Error("Skill package contains too many filesystem entries");
  }
}

async function inspectFile(
  fullPath: string,
  state: InventoryState,
): Promise<void> {
  const stat = await fs.stat(fullPath);
  state.fileCount += 1;
  if (state.fileCount > MAX_SKILL_PACKAGE_FILES) {
    throw new Error("Skill package contains too many files");
  }
  if (stat.size > MAX_SKILL_PACKAGE_FILE_BYTES) {
    throw new Error("Skill package file size limit exceeded");
  }
  state.totalBytes += stat.size;
  if (state.totalBytes > MAX_SKILL_PACKAGE_TOTAL_BYTES) {
    throw new Error("Skill package total size limit exceeded");
  }
}

async function inspectDirectory(
  rootDir: string,
  realRootDir: string,
  currentDir: string,
  depth: number,
  state: InventoryState,
): Promise<void> {
  if (depth > MAX_SKILL_PACKAGE_DEPTH) {
    throw new Error("Skill package directory depth limit exceeded");
  }
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);
    if (isInternalSkillRepoEntry(relativePath)) continue;
    assertEntryBudget(state);
    if (entry.isSymbolicLink()) continue;
    const realPath = await fs.realpath(fullPath);
    if (!isPathWithin(realRootDir, realPath)) {
      throw new Error("Skill package entry resolves outside the package root");
    }
    if (entry.isDirectory()) {
      await inspectDirectory(rootDir, realRootDir, fullPath, depth + 1, state);
    } else if (entry.isFile()) {
      await inspectFile(fullPath, state);
    } else {
      throw new Error("Skill package contains an unsupported filesystem entry");
    }
  }
}

/** Validate that fingerprinting and copying can represent the complete package. */
export async function validateMaterializedSkillPackage(
  packageDir: string,
): Promise<SkillPackageInventory> {
  const rootDir = path.resolve(packageDir);
  await assertRootSkillMarkdown(rootDir);
  const state: InventoryState = { fileCount: 0, totalBytes: 0, entryCount: 0 };
  await inspectDirectory(
    rootDir,
    await fs.realpath(rootDir),
    rootDir,
    0,
    state,
  );
  return { fileCount: state.fileCount, totalBytes: state.totalBytes };
}
