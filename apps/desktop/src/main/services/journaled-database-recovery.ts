import fs from "fs";
import path from "path";

import {
  copyStorageInventory,
  createStorageInventory,
  runJournaledStorageRestore,
  writeRuntimeLayoutState,
} from "@prompthub/core";

import Database from "../database/sqlite";
import { migrateLegacyDataLayout } from "./data-layout-migration";

const RESTORE_ENTRY_NAMES = [
  "data",
  "config",
  "secrets",
  "prompthub.db",
  "workspace",
  "skills",
  "images",
  "videos",
  "shortcuts.json",
  "shortcut-mode.json",
];

export interface JournaledDatabaseRecoveryResult {
  success: boolean;
  error?: string;
  backupPath?: string;
}

function readStats(targetPath: string): fs.Stats | null {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function assertRegularDatabase(databasePath: string): void {
  const stats = readStats(databasePath);
  if (!stats?.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Recovery source has no regular database: ${databasePath}`);
  }
  const database = new Database(databasePath, { readOnly: true });
  try {
    const result = database.pragma("quick_check") as Array<{
      quick_check?: unknown;
    }>;
    if (result.length !== 1 || result[0]?.quick_check !== "ok") {
      throw new Error(`Recovery database failed quick_check: ${databasePath}`);
    }
  } finally {
    database.close();
  }
}

function databasePathForRoot(rootPath: string): string | null {
  const canonical = path.join(rootPath, "data", "prompthub.db");
  if (readStats(canonical)?.isFile()) return canonical;
  const legacy = path.join(rootPath, "prompthub.db");
  return readStats(legacy)?.isFile() ? legacy : null;
}

function removeExcludedCandidateEntries(rootPath: string): void {
  for (const entry of [
    "backups",
    "logs",
    "cache",
    ".data-layout-v0.5.5.json",
  ]) {
    fs.rmSync(path.join(rootPath, entry), { recursive: true, force: true });
  }
}

function copyDetachedRoot(sourceRoot: string, destinationRoot: string): number {
  const canonicalDataPath = path.join(sourceRoot, "data");
  const canonicalDataStats = readStats(canonicalDataPath);
  const detachedLayoutEpoch =
    canonicalDataStats?.isDirectory() &&
    !canonicalDataStats.isSymbolicLink() &&
    fs.readdirSync(canonicalDataPath).length > 0
      ? 1
      : 0;
  const inventory = createStorageInventory(sourceRoot, {
    detachedLayoutEpoch,
    includeSecrets: true,
  });
  copyStorageInventory(inventory, destinationRoot);
  return detachedLayoutEpoch;
}

async function normalizeCandidate(
  rootPath: string,
  identityRoot: string,
  operation: string,
): Promise<void> {
  if (!fs.existsSync(path.join(rootPath, "data", "prompthub.db"))) {
    const migration = await migrateLegacyDataLayout(rootPath, operation);
    if (migration.status === "partial-failure") {
      throw new Error(
        `Recovery layout conversion failed: ${migration.failedEntries.join(", ")}`,
      );
    }
  }
  removeExcludedCandidateEntries(rootPath);
  writeRuntimeLayoutState(rootPath, {
    identityRoot,
    lastVerifiedOperation: operation,
  });
}

function replaceCandidateDomain(
  stageRoot: string,
  incomingRoot: string,
  entryName: "data" | "config" | "secrets",
): void {
  const incomingPath = path.join(incomingRoot, entryName);
  if (!fs.existsSync(incomingPath)) return;
  const stagePath = path.join(stageRoot, entryName);
  fs.rmSync(stagePath, { recursive: true, force: true });
  fs.renameSync(incomingPath, stagePath);
}

async function prepareRecoveryCandidate(
  sourcePath: string,
  activeRoot: string,
  stageRoot: string,
): Promise<void> {
  copyDetachedRoot(activeRoot, stageRoot);
  await normalizeCandidate(stageRoot, activeRoot, "pre-recovery-base");

  const sourceStats = readStats(sourcePath);
  if (!sourceStats || sourceStats.isSymbolicLink()) {
    throw new Error(`Recovery source is missing or unsafe: ${sourcePath}`);
  }
  if (sourceStats.isFile()) {
    assertRegularDatabase(sourcePath);
    const targetDatabase = path.join(stageRoot, "data", "prompthub.db");
    fs.rmSync(targetDatabase, { force: true });
    fs.copyFileSync(sourcePath, targetDatabase, fs.constants.COPYFILE_EXCL);
  } else if (sourceStats.isDirectory()) {
    const incomingRoot = `${stageRoot}-incoming`;
    fs.rmSync(incomingRoot, { recursive: true, force: true });
    try {
      copyDetachedRoot(sourcePath, incomingRoot);
      const incomingDatabase = databasePathForRoot(incomingRoot);
      await normalizeCandidate(incomingRoot, activeRoot, "recovery-source");
      if (!incomingDatabase) {
        fs.mkdirSync(path.join(incomingRoot, "data"), { recursive: true });
        fs.copyFileSync(
          path.join(stageRoot, "data", "prompthub.db"),
          path.join(incomingRoot, "data", "prompthub.db"),
        );
      }
      for (const entryName of ["data", "config", "secrets"] as const) {
        replaceCandidateDomain(stageRoot, incomingRoot, entryName);
      }
    } finally {
      fs.rmSync(incomingRoot, { recursive: true, force: true });
    }
  } else {
    throw new Error(`Recovery source has unsupported type: ${sourcePath}`);
  }
  writeRuntimeLayoutState(stageRoot, {
    identityRoot: activeRoot,
    lastVerifiedOperation: "journaled-database-recovery",
  });
}

export async function performJournaledDatabaseRecovery(
  sourcePath: string,
  currentDataPath: string,
): Promise<JournaledDatabaseRecoveryResult> {
  try {
    const restore = await runJournaledStorageRestore({
      activeRoot: currentDataPath,
      entryNames: RESTORE_ENTRY_NAMES,
      prepareCandidate: (stageRoot) =>
        prepareRecoveryCandidate(sourcePath, currentDataPath, stageRoot),
      verifyCandidate: (stageRoot) =>
        assertRegularDatabase(path.join(stageRoot, "data", "prompthub.db")),
      verifyActive: (activeRoot) =>
        assertRegularDatabase(path.join(activeRoot, "data", "prompthub.db")),
    });
    return { success: true, backupPath: restore.recoveryArtifactPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
