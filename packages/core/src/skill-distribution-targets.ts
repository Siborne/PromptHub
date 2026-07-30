import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { getDataDir } from "./runtime-paths";
import {
  computeRepoDirectoryFingerprintByPath,
  fileExists,
  isPathWithin,
} from "./cli/skill/paths";
import { copyRepoToPlatform, linkRepoToTarget } from "./cli/skill/install";
import { validateSkillName } from "./cli/skill/parse";

export const SHARED_AGENT_SKILLS_TARGET_ID = "agent-skills-global";

export type SharedSkillDistributionMode = "copy" | "symlink";
export type SharedSkillDistributionState =
  | "not-installed"
  | "managed-clean"
  | "managed-modified"
  | "unmanaged-conflict"
  | "receipt-stale"
  | "missing";

interface SharedSkillDistributionReceipt {
  version: 1;
  targetId: typeof SHARED_AGENT_SKILLS_TARGET_ID;
  targetRoot: string;
  targetPath: string;
  skillId: string;
  skillName: string;
  sourcePath: string;
  requestedMode: SharedSkillDistributionMode;
  effectiveMode: SharedSkillDistributionMode;
  installedFingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedSkillDistributionStatus {
  state: SharedSkillDistributionState;
  targetId: typeof SHARED_AGENT_SKILLS_TARGET_ID;
  targetRoot: string;
  targetPath: string;
  effectiveMode?: SharedSkillDistributionMode;
  installedFingerprint?: string;
  currentFingerprint?: string;
}

interface SharedSkillInstallInput extends SharedSkillIdentity {
  sourcePath: string;
  mode: SharedSkillDistributionMode;
}

export interface SharedSkillDistributionService {
  getStatus(input: {
    skillId: string;
    skillName: string;
    targetRoot?: string;
  }): Promise<SharedSkillDistributionStatus>;
  install(
    input: SharedSkillInstallInput,
  ): Promise<SharedSkillDistributionStatus>;
  uninstall(input: {
    skillId: string;
    skillName: string;
    targetRoot?: string;
    expectedFingerprint?: string;
  }): Promise<SharedSkillDistributionStatus>;
}

interface SharedSkillDistributionDeps {
  getDataDir?: () => string;
  getHomeDir?: () => string;
}

interface SharedSkillResolvedPaths {
  receiptPath: string;
  skillName: string;
  targetPath: string;
  targetRoot: string;
}

type SharedSkillIdentity = {
  skillId: string;
  skillName: string;
  targetRoot?: string;
};

function hasControlCharacter(value: string): boolean {
  return /[\0-\x1f\x7f]/u.test(value);
}

function canonicalPath(value: string): string {
  const normalized = path.normalize(path.resolve(value));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function resolveSharedSkillTargetRoot(
  homeDir = os.homedir(),
  override?: string,
): string {
  const resolvedHome = canonicalPath(homeDir);
  const candidate = override ?? path.join(homeDir, ".agents", "skills");
  if (hasControlCharacter(candidate)) {
    throw new Error("Shared Skill target path contains control characters");
  }
  if (!path.isAbsolute(candidate)) {
    throw new Error("Shared Skill target path must be absolute");
  }
  const resolved = canonicalPath(candidate);
  if (resolved === path.parse(resolved).root) {
    throw new Error("Shared Skill target path must not be a filesystem root");
  }
  if (resolved === resolvedHome) {
    throw new Error("Shared Skill target path must not be the user home");
  }
  return resolved;
}

function getReceiptPath(dataDir: string, skillId: string): string {
  return path.join(
    dataDir,
    "skill-distributions",
    "receipts",
    SHARED_AGENT_SKILLS_TARGET_ID,
    `${encodeURIComponent(skillId)}.json`,
  );
}

async function readReceipt(
  receiptPath: string,
): Promise<SharedSkillDistributionReceipt | null> {
  try {
    const value = JSON.parse(
      await fs.readFile(receiptPath, "utf8"),
    ) as SharedSkillDistributionReceipt;
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

async function writeReceiptAtomic(
  receiptPath: string,
  receipt: SharedSkillDistributionReceipt,
): Promise<void> {
  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  const temporaryPath = `${receiptPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(temporaryPath, receiptPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function receiptMatches(
  receipt: SharedSkillDistributionReceipt,
  input: {
    skillId: string;
    skillName: string;
    targetRoot: string;
    targetPath: string;
  },
): boolean {
  return (
    receipt.targetId === SHARED_AGENT_SKILLS_TARGET_ID &&
    receipt.skillId === input.skillId &&
    receipt.skillName === input.skillName &&
    canonicalPath(receipt.targetRoot) === input.targetRoot &&
    canonicalPath(receipt.targetPath) === input.targetPath &&
    isPathWithin(input.targetRoot, input.targetPath)
  );
}

function resolveServicePaths(
  deps: SharedSkillDistributionDeps,
  input: SharedSkillIdentity,
): SharedSkillResolvedPaths {
  const skillName = validateSkillName(input.skillName);
  const targetRoot = resolveSharedSkillTargetRoot(
    (deps.getHomeDir ?? os.homedir)(),
    input.targetRoot,
  );
  const targetPath = canonicalPath(path.join(targetRoot, skillName));
  if (!isPathWithin(targetRoot, targetPath)) {
    throw new Error("Shared Skill target escapes its configured root");
  }
  return {
    skillName,
    targetRoot,
    targetPath,
    receiptPath: getReceiptPath(
      (deps.getDataDir ?? getDataDir)(),
      input.skillId,
    ),
  };
}

async function readSharedSkillStatus(
  input: SharedSkillIdentity,
  resolved: SharedSkillResolvedPaths,
): Promise<SharedSkillDistributionStatus> {
  const receipt = await readReceipt(resolved.receiptPath);
  const targetExists = await fileExists(resolved.targetPath);
  const base = {
    targetId: SHARED_AGENT_SKILLS_TARGET_ID,
    targetRoot: resolved.targetRoot,
    targetPath: resolved.targetPath,
  } as const;
  if (!receipt) {
    return {
      ...base,
      state: targetExists ? "unmanaged-conflict" : "not-installed",
    };
  }
  if (!receiptMatches(receipt, { ...input, ...resolved })) {
    return { ...base, state: "receipt-stale" };
  }
  if (!targetExists) {
    return {
      ...base,
      state: "missing",
      effectiveMode: receipt.effectiveMode,
      installedFingerprint: receipt.installedFingerprint,
    };
  }
  const currentFingerprint = await computeRepoDirectoryFingerprintByPath(
    resolved.targetPath,
  );
  return {
    ...base,
    state:
      currentFingerprint === receipt.installedFingerprint
        ? "managed-clean"
        : "managed-modified",
    effectiveMode: receipt.effectiveMode,
    installedFingerprint: receipt.installedFingerprint,
    currentFingerprint,
  };
}

function assertSharedInstallAllowed(
  status: SharedSkillDistributionStatus,
): void {
  if (
    status.state === "unmanaged-conflict" ||
    status.state === "managed-modified" ||
    status.state === "receipt-stale"
  ) {
    throw new Error(`Shared Skill target is ${status.state}`);
  }
}

async function stageSharedSkill(
  sourcePath: string,
  stagePath: string,
  mode: SharedSkillDistributionMode,
): Promise<string> {
  await fs.rm(stagePath, { recursive: true, force: true });
  if (mode === "symlink") {
    await linkRepoToTarget(sourcePath, stagePath);
  } else {
    await copyRepoToPlatform(sourcePath, stagePath);
  }
  return computeRepoDirectoryFingerprintByPath(stagePath);
}

async function publishSharedSkillStage(
  resolved: SharedSkillResolvedPaths,
  stagePath: string,
  backupPath: string,
  hadTarget: boolean,
  publishReceipt: () => Promise<void>,
): Promise<void> {
  let backedUp = false;
  let published = false;
  let preserveBackup = false;
  try {
    if (hadTarget) {
      await fs.rename(resolved.targetPath, backupPath);
      backedUp = true;
    }
    await fs.rename(stagePath, resolved.targetPath);
    published = true;
    await publishReceipt();
  } catch (error) {
    if (published) {
      await fs.rm(resolved.targetPath, { recursive: true, force: true });
    }
    if (backedUp) {
      if (await fileExists(resolved.targetPath)) {
        preserveBackup = true;
      } else {
        await fs.rename(backupPath, resolved.targetPath);
      }
    }
    throw error;
  } finally {
    await fs
      .rm(stagePath, { recursive: true, force: true })
      .catch(() => undefined);
    if (!preserveBackup) {
      await fs
        .rm(backupPath, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }
}

function buildSharedReceipt(
  input: SharedSkillInstallInput,
  resolved: SharedSkillResolvedPaths,
  sourcePath: string,
  installedFingerprint: string,
  createdAt?: string,
): SharedSkillDistributionReceipt {
  const now = new Date().toISOString();
  return {
    version: 1,
    targetId: SHARED_AGENT_SKILLS_TARGET_ID,
    targetRoot: resolved.targetRoot,
    targetPath: resolved.targetPath,
    skillId: input.skillId,
    skillName: resolved.skillName,
    sourcePath,
    requestedMode: input.mode,
    effectiveMode: input.mode,
    installedFingerprint,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

export function createSharedSkillDistributionService(
  deps: SharedSkillDistributionDeps = {},
): SharedSkillDistributionService {
  const getStatus: SharedSkillDistributionService["getStatus"] = async (
    input,
  ) => readSharedSkillStatus(input, resolveServicePaths(deps, input));

  const install: SharedSkillDistributionService["install"] = async (input) => {
    const resolved = resolveServicePaths(deps, input);
    const status = await readSharedSkillStatus(input, resolved);
    assertSharedInstallAllowed(status);
    const sourcePath = await fs.realpath(path.resolve(input.sourcePath));
    await fs.mkdir(resolved.targetRoot, { recursive: true });
    const realTargetRoot = await fs.realpath(resolved.targetRoot);
    if (
      sourcePath === realTargetRoot ||
      isPathWithin(realTargetRoot, sourcePath)
    ) {
      throw new Error("Shared Skill source must not be inside its target root");
    }
    if (
      sourcePath === realTargetRoot ||
      isPathWithin(sourcePath, realTargetRoot)
    ) {
      throw new Error("Shared Skill target must not be inside its source");
    }
    const nonce = `${process.pid}-${crypto.randomUUID()}`;
    const stagePath = `${resolved.targetPath}.prompthub-stage-${nonce}`;
    const backupPath = `${resolved.targetPath}.prompthub-backup-${nonce}`;
    let installedFingerprint: string;
    try {
      installedFingerprint = await stageSharedSkill(
        sourcePath,
        stagePath,
        input.mode,
      );
    } catch (error) {
      await fs.rm(stagePath, { recursive: true, force: true });
      throw error;
    }
    const previous = await readReceipt(resolved.receiptPath);
    await publishSharedSkillStage(
      resolved,
      stagePath,
      backupPath,
      status.state === "managed-clean",
      () =>
        writeReceiptAtomic(
          resolved.receiptPath,
          buildSharedReceipt(
            input,
            resolved,
            sourcePath,
            installedFingerprint,
            previous?.createdAt,
          ),
        ),
    );
    return getStatus(input);
  };

  const uninstall: SharedSkillDistributionService["uninstall"] = async (
    input,
  ) => {
    const resolved = resolveServicePaths(deps, input);
    const status = await readSharedSkillStatus(input, resolved);
    if (
      status.state === "unmanaged-conflict" ||
      status.state === "receipt-stale"
    ) {
      throw new Error(`Shared Skill target is ${status.state}`);
    }
    if (
      status.state === "managed-modified" &&
      input.expectedFingerprint !== status.currentFingerprint
    ) {
      throw new Error("Shared Skill target is modified");
    }
    if (
      status.state === "managed-clean" ||
      status.state === "managed-modified"
    ) {
      await fs.rm(resolved.targetPath, { recursive: true, force: true });
    }
    if (status.state !== "not-installed") {
      await fs.rm(resolved.receiptPath, { force: true });
    }
    return getStatus(input);
  };

  return { getStatus, install, uninstall };
}

export const sharedSkillDistributionService =
  createSharedSkillDistributionService();
