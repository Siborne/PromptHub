import fs from "fs";
import path from "path";

import {
  copyStorageInventory,
  createStorageInventory,
  runJournaledStorageRestore,
  writeRuntimeLayoutState,
} from "@prompthub/core";
import type { UpgradeBackupRestoreResult } from "@prompthub/shared/types";
import Database from "../database/sqlite";

import {
  getUpgradeBackup,
  pruneUpgradeBackups,
} from "./upgrade-backup";
import { migrateLegacyDataLayout } from "./data-layout-migration";
import { writeRestoreMarker } from "./prompt-workspace";

function ensureLegacyDbCompatibility(currentDataPath: string): void {
  const legacyDbPath = path.join(currentDataPath, "prompthub.db");
  const unifiedDbPath = path.join(currentDataPath, "data", "prompthub.db");

  if (fs.existsSync(unifiedDbPath) && fs.existsSync(legacyDbPath)) {
    fs.rmSync(legacyDbPath, { force: true });
    return;
  }

  if (fs.existsSync(legacyDbPath) && !fs.existsSync(unifiedDbPath)) {
    fs.mkdirSync(path.dirname(unifiedDbPath), { recursive: true });
    fs.renameSync(legacyDbPath, unifiedDbPath);
  }
}

function readLinkSafeStats(targetPath: string): fs.Stats | null {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function verifyRestoreDatabase(rootPath: string): void {
  const databasePath = path.join(rootPath, "data", "prompthub.db");
  const stats = readLinkSafeStats(databasePath);
  if (!stats?.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Restore candidate has no regular database: ${databasePath}`);
  }
  const database = new Database(databasePath, { readOnly: true });
  try {
    const result = database.pragma("quick_check") as Array<{
      quick_check?: unknown;
    }>;
    if (result.length !== 1 || result[0]?.quick_check !== "ok") {
      throw new Error(`Restore candidate database failed quick_check: ${databasePath}`);
    }
  } finally {
    database.close();
  }
}

async function prepareUpgradeRestoreCandidate(
  activeRoot: string,
  backupPath: string,
  stageRoot: string,
  fromVersion: string,
): Promise<void> {
  const canonicalDatabase = path.join(backupPath, "data", "prompthub.db");
  const detachedLayoutEpoch = fs.existsSync(canonicalDatabase) ? 1 : 0;
  const inventory = createStorageInventory(backupPath, {
    detachedLayoutEpoch,
    includeSecrets: true,
  });
  copyStorageInventory(inventory, stageRoot);
  if (detachedLayoutEpoch === 0) {
    const migration = await migrateLegacyDataLayout(stageRoot, fromVersion);
    if (migration.status === "partial-failure") {
      throw new Error(
        `Legacy restore candidate migration failed: ${migration.failedEntries.join(", ")}`,
      );
    }
  }
  ensureLegacyDbCompatibility(stageRoot);
  for (const excludedEntry of ["backups", "logs", "cache"]) {
    fs.rmSync(path.join(stageRoot, excludedEntry), {
      recursive: true,
      force: true,
    });
  }
  fs.rmSync(path.join(stageRoot, ".data-layout-v0.5.5.json"), {
    force: true,
  });
  writeRuntimeLayoutState(stageRoot, {
    identityRoot: activeRoot,
    lastVerifiedOperation: `restore-upgrade-${path.basename(backupPath)}`,
  });
}

export async function restoreFromUpgradeBackupAsync(
  currentDataPath: string,
  backupId: string,
): Promise<UpgradeBackupRestoreResult> {
  if (typeof backupId !== "string" || backupId.trim().length === 0) {
    return {
      success: false,
      needsRestart: false,
      error: "backupId is required",
    };
  }

  if (!fs.existsSync(currentDataPath)) {
    return {
      success: false,
      needsRestart: false,
      error: `Current data path does not exist: ${currentDataPath}`,
    };
  }

  const backupEntry = await getUpgradeBackup(currentDataPath, backupId);
  if (!backupEntry) {
    return {
      success: false,
      needsRestart: false,
      error: `Upgrade backup not found: ${backupId}`,
    };
  }

  try {
    const restore = await runJournaledStorageRestore({
      activeRoot: currentDataPath,
      entryNames: [
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
      ],
      prepareCandidate: (stageRoot) =>
        prepareUpgradeRestoreCandidate(
          currentDataPath,
          backupEntry.backupPath,
          stageRoot,
          backupEntry.manifest.fromVersion,
        ),
      verifyCandidate: verifyRestoreDatabase,
      verifyActive: verifyRestoreDatabase,
    });

    writeRestoreMarker(currentDataPath);

    try {
      await pruneUpgradeBackups(currentDataPath, {
        protectedBackupIds: [backupId],
      });
    } catch (pruneError) {
      console.warn("[upgrade-backup] Failed to prune snapshots after restore:", pruneError);
    }

    return {
      success: true,
      needsRestart: true,
      restoredBackupId: backupId,
      currentStateBackupPath: restore.recoveryArtifactPath,
    };
  } catch (error) {
    return {
      success: false,
      needsRestart: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
