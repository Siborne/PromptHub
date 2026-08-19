import fs from "fs";
import path from "path";
import { app, ipcMain } from "electron";

import { applyStorageRootChange, classifyStorageRoot } from "@prompthub/core";
import Database from "../database/sqlite";
import {
  getStorageOperationControlDirectory,
  writeConfiguredDataPath,
} from "../data-path";
import { verifyDataRootDatabase } from "./storage-database-inspection";

type DataPathChangeAction = "migrate" | "switch" | "overwrite";

interface DataPathSummary {
  promptCount: number;
  folderCount: number;
  skillCount: number;
  available: boolean;
  error?: string;
}

export interface DataPathChangeIpcOptions {
  closeDatabase: () => void;
  getDatabase: () => Database.Database | null;
  reopenDatabase: () => void;
  scheduleRelaunch: (delayMs?: number) => void;
}

function getObjectNumberValue(source: unknown, key: string): number {
  if (!source || typeof source !== "object") return 0;
  const value = Reflect.get(source, key);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function databaseTableExists(
  database: Database.Database,
  tableName: string,
): boolean {
  const row = database
    .prepare(
      "SELECT 1 AS exists_flag FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(tableName);
  return getObjectNumberValue(row, "exists_flag") === 1;
}

function countDatabaseTable(
  database: Database.Database,
  tableName: string,
): number {
  if (!databaseTableExists(database, tableName)) return 0;
  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get();
  return getObjectNumberValue(row, "count");
}

function summarizeDatabase(database: Database.Database): DataPathSummary {
  return {
    promptCount: countDatabaseTable(database, "prompts"),
    folderCount: countDatabaseTable(database, "folders"),
    skillCount: countDatabaseTable(database, "skills"),
    available: true,
  };
}

function summarizeDataPath(
  targetPath: string,
  getDatabase: () => Database.Database | null,
): DataPathSummary {
  const resolvedTargetPath = path.resolve(targetPath);
  const currentPath = path.resolve(app.getPath("userData"));
  try {
    const currentDatabase = getDatabase();
    if (currentDatabase && resolvedTargetPath === currentPath) {
      return summarizeDatabase(currentDatabase);
    }
    const databasePath = classifyStorageRoot(resolvedTargetPath).databasePath;
    if (!databasePath || !fs.existsSync(databasePath)) {
      return {
        promptCount: 0,
        folderCount: 0,
        skillCount: 0,
        available: false,
      };
    }
    const database = new Database(databasePath, { readOnly: true });
    try {
      return summarizeDatabase(database);
    } finally {
      database.close();
    }
  } catch (error) {
    return {
      promptCount: 0,
      folderCount: 0,
      skillCount: 0,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sensitiveDataPathTarget(resolvedNewPath: string): string | null {
  const sensitiveRoots = [
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/var",
    "/tmp",
    "/System",
    "/Library",
    "C:\\Windows",
    "C:\\Program Files",
  ];
  const candidate = path.resolve(resolvedNewPath);
  return (
    sensitiveRoots.find((root) => {
      const relative = path.relative(path.resolve(root), candidate);
      return (
        relative === "" ||
        (relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative))
      );
    }) ?? null
  );
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const resolvedParent = path.resolve(parentPath);
  const resolvedChild = path.resolve(childPath);
  return (
    resolvedChild !== resolvedParent &&
    resolvedChild.startsWith(`${resolvedParent}${path.sep}`)
  );
}

async function applyDataPathChange(
  newPath: string,
  action: DataPathChangeAction,
  options: DataPathChangeIpcOptions,
) {
  if (typeof newPath !== "string" || newPath.trim().length === 0) {
    return {
      success: false,
      error: "data path change requires a non-empty newPath string",
    };
  }
  const currentPath = app.getPath("userData");
  const resolvedTargetPath = path.resolve(newPath);
  if (path.resolve(currentPath) === resolvedTargetPath) {
    return {
      success: true,
      message: "Data directory is already current",
      newPath: resolvedTargetPath,
      needsRestart: false,
    };
  }
  const sensitiveRoot = sensitiveDataPathTarget(resolvedTargetPath);
  if (sensitiveRoot) {
    return {
      success: false,
      error: `Cannot use system directory as data directory: ${resolvedTargetPath}`,
    };
  }
  if (action !== "switch" && isPathInside(currentPath, resolvedTargetPath)) {
    return {
      success: false,
      error:
        "Cannot migrate data into a child directory of the current data directory",
    };
  }

  let databaseClosed = false;
  try {
    if (action !== "switch") {
      options.closeDatabase();
      databaseClosed = true;
    }
    const result = await applyStorageRootChange({
      action,
      sourceRoot: currentPath,
      targetRoot: resolvedTargetPath,
      controlDirectory: getStorageOperationControlDirectory(
        app.getPath("appData"),
      ),
      publishBootPointer: (rootPath) =>
        writeConfiguredDataPath(app.getPath("appData"), rootPath),
      verifyDatabase: verifyDataRootDatabase,
      includeSecrets: true,
    });
    options.scheduleRelaunch(500);
    return {
      success: true,
      message:
        action === "switch"
          ? "Data directory switched"
          : `Successfully migrated ${result.copiedFiles} files`,
      newPath: resolvedTargetPath,
      needsRestart: true,
      backupPath: result.recoveryArtifactPath,
    };
  } catch (error) {
    if (databaseClosed) {
      try {
        options.reopenDatabase();
      } catch (reopenError) {
        console.error(
          "[DataPath] Failed to reopen source database:",
          reopenError,
        );
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function registerDataPathChangeIPC(
  options: DataPathChangeIpcOptions,
): void {
  ipcMain.handle(
    "data:previewDataPathChange",
    async (_event, newPath: string) => {
      if (typeof newPath !== "string" || newPath.trim().length === 0) {
        return {
          success: false,
          error:
            "data:previewDataPathChange requires a non-empty newPath string",
        };
      }
      const currentPath = app.getPath("userData");
      const targetPath = path.resolve(newPath);
      const classification = classifyStorageRoot(targetPath);
      if (
        classification.kind === "invalid" ||
        classification.kind === "mixed"
      ) {
        return {
          success: false,
          error:
            classification.reason ??
            `Cannot use ${classification.kind} data directory: ${targetPath}`,
        };
      }
      if (classification.kind === "unknown") {
        return {
          success: false,
          error: `Target is a non-empty directory not owned by PromptHub: ${classification.unknownEntries.join(", ")}`,
        };
      }
      const isCurrentPath = path.resolve(currentPath) === targetPath;
      const hasPromptHubData =
        classification.kind === "canonical" || classification.kind === "legacy";
      return {
        success: true,
        targetPath,
        currentPath,
        exists: classification.kind !== "missing",
        hasPromptHubData,
        isCurrentPath,
        markers: classification.databasePath
          ? [{ name: path.relative(targetPath, classification.databasePath) }]
          : [],
        currentSummary: summarizeDataPath(currentPath, options.getDatabase),
        targetSummary: summarizeDataPath(targetPath, options.getDatabase),
        recommendedAction: isCurrentPath
          ? "switch"
          : hasPromptHubData
            ? "switch"
            : "migrate",
      };
    },
  );

  ipcMain.handle(
    "data:applyDataPathChange",
    async (_event, params: { newPath?: unknown; action?: unknown }) => {
      const newPath = typeof params?.newPath === "string" ? params.newPath : "";
      const action: DataPathChangeAction =
        params?.action === "switch" ||
        params?.action === "overwrite" ||
        params?.action === "migrate"
          ? params.action
          : "migrate";
      return applyDataPathChange(newPath, action, options);
    },
  );

  ipcMain.handle("data:migrate", async (_event, newPath: string) =>
    applyDataPathChange(newPath, "migrate", options),
  );
}
