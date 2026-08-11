import fs from "fs";
import path from "path";

import Database from "../database/sqlite";

function numberValue(source: unknown, key: string): number {
  if (!source || typeof source !== "object") return 0;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function verifyDataRootDatabase(databasePath: string): void {
  const stats = fs.lstatSync(databasePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(
      `PromptHub database is not a regular file: ${databasePath}`,
    );
  }
  const database = new Database(databasePath, { readOnly: true });
  try {
    const rows = database.pragma("quick_check") as Array<{
      quick_check?: unknown;
    }>;
    if (rows.length !== 1 || rows[0]?.quick_check !== "ok") {
      throw new Error(`PromptHub database quick_check failed: ${databasePath}`);
    }
  } finally {
    database.close();
  }
}

export function verifyRestoredStorageRoot(rootPath: string): void {
  verifyDataRootDatabase(path.join(rootPath, "data", "prompthub.db"));
}

export function inspectStorageDatabase(
  databasePath: string,
  activeDatabase: Database.Database | null,
  activeDatabasePath: string,
) {
  const useActive =
    activeDatabase !== null &&
    path.resolve(databasePath) === path.resolve(activeDatabasePath);
  const database = useActive
    ? activeDatabase
    : new Database(databasePath, { readOnly: true });
  try {
    const versions = database.pragma("user_version") as Array<{
      user_version?: unknown;
    }>;
    const checks = database.pragma("quick_check") as Array<{
      quick_check?: unknown;
    }>;
    const hasHistory = database
      .prepare(
        "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'database_migration_history'",
      )
      .get() as { present?: unknown } | undefined;
    const migrationCount =
      hasHistory?.present === 1
        ? numberValue(
            database
              .prepare(
                "SELECT COUNT(*) AS count FROM database_migration_history",
              )
              .get(),
            "count",
          )
        : 0;
    return {
      userVersion:
        typeof versions[0]?.user_version === "number"
          ? versions[0].user_version
          : null,
      migrationCount,
      quickCheck:
        checks.length === 1 && checks[0]?.quick_check === "ok"
          ? ("ok" as const)
          : ("failed" as const),
    };
  } catch {
    return {
      userVersion: null,
      migrationCount: null,
      quickCheck: "failed" as const,
    };
  } finally {
    if (!useActive) database.close();
  }
}
