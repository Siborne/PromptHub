import fs from "fs";
import path from "path";
import { recoverDatabaseClientLock } from "@prompthub/db";
import { compareVersions } from "../../utils/version";

import {
  createUpgradeDataSnapshot,
  findReusableUpgradeSnapshot,
  getUpgradeBackupRoot,
  type MigrateLegacyResult,
  migrateLegacyUpgradeBackups,
  type UpgradeBackupSnapshot,
} from "./upgrade-backup";

const LAST_RUN_VERSION_FILE = ".last-run-version.json";

interface LastRunVersionRecord {
  version: string;
  updatedAt: string;
}

export interface UpgradeBackupStartupResult {
  migration: MigrateLegacyResult;
  previousVersion: string | null;
  currentVersion: string;
  snapshot: UpgradeBackupSnapshot | null;
  snapshotError: string | null;
  status:
    | "first-run"
    | "not-an-upgrade"
    | "snapshot-created"
    | "snapshot-reused"
    | "user-data-empty"
    | "user-data-missing"
    | "snapshot-failed";
}

export function compareAppVersions(a: string, b: string): number {
  return compareVersions(a, b);
}

export function getLastRunVersionMarkerPath(userDataPath: string): string {
  return path.join(getUpgradeBackupRoot(userDataPath), LAST_RUN_VERSION_FILE);
}

async function readLastRunVersion(
  userDataPath: string,
): Promise<{ version: string; updatedAt: string | null } | null> {
  const markerPath = getLastRunVersionMarkerPath(userDataPath);
  try {
    if (!fs.existsSync(markerPath)) {
      return null;
    }

    const parsed = JSON.parse(
      await fs.promises.readFile(markerPath, "utf8"),
    ) as Partial<LastRunVersionRecord>;
    if (
      typeof parsed.version !== "string" ||
      parsed.version.trim().length === 0
    ) {
      return null;
    }

    return {
      version: parsed.version,
      updatedAt:
        typeof parsed.updatedAt === "string" &&
        Number.isFinite(Date.parse(parsed.updatedAt))
          ? parsed.updatedAt
          : null,
    };
  } catch {
    return null;
  }
}

async function writeLastRunVersion(
  userDataPath: string,
  version: string,
): Promise<void> {
  const markerPath = getLastRunVersionMarkerPath(userDataPath);
  const payload: LastRunVersionRecord = {
    version,
    updatedAt: new Date().toISOString(),
  };

  await fs.promises.mkdir(path.dirname(markerPath), { recursive: true });
  await fs.promises.writeFile(
    markerPath,
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

function recoverUpgradeSnapshotDatabaseLock(userDataPath: string): void {
  const canonicalDatabase = path.join(userDataPath, "data", "prompthub.db");
  const legacyDatabase = path.join(userDataPath, "prompthub.db");
  const databasePath = fs.existsSync(canonicalDatabase)
    ? canonicalDatabase
    : fs.existsSync(legacyDatabase)
      ? legacyDatabase
      : null;
  if (!databasePath) return;

  const recovery = recoverDatabaseClientLock(databasePath);
  if (recovery.status === "blocked") {
    throw new Error(
      `Database lock cannot be recovered before upgrade snapshot: ${recovery.reason ?? "unknown-client"}`,
    );
  }
}

export async function runUpgradeBackupStartupTasks(
  userDataPath: string,
  currentVersion: string,
): Promise<UpgradeBackupStartupResult> {
  const lastRun = await readLastRunVersion(userDataPath);
  const previousVersion = lastRun?.version ?? null;
  if (
    previousVersion &&
    compareAppVersions(currentVersion, previousVersion) < 0
  ) {
    throw new Error(
      `This data was last opened by newer PromptHub version ${previousVersion}. ` +
        `Version ${currentVersion} will not modify it.`,
    );
  }
  const migration = await migrateLegacyUpgradeBackups(userDataPath);

  if (!previousVersion) {
    await writeLastRunVersion(userDataPath, currentVersion);
    return {
      migration,
      previousVersion: null,
      currentVersion,
      snapshot: null,
      snapshotError: null,
      status: "first-run",
    };
  }

  if (compareAppVersions(previousVersion, currentVersion) === 0) {
    await writeLastRunVersion(userDataPath, currentVersion);
    return {
      migration,
      previousVersion,
      currentVersion,
      snapshot: null,
      snapshotError: null,
      status: "not-an-upgrade",
    };
  }

  if (lastRun?.updatedAt) {
    const reusable = await findReusableUpgradeSnapshot(userDataPath, {
      fromVersion: previousVersion,
      toVersion: currentVersion,
      createdAfter: lastRun.updatedAt,
    });
    if (reusable) {
      await writeLastRunVersion(userDataPath, currentVersion);
      return {
        migration,
        previousVersion,
        currentVersion,
        snapshot: reusable,
        snapshotError: null,
        status: "snapshot-reused",
      };
    }
  }

  try {
    recoverUpgradeSnapshotDatabaseLock(userDataPath);
    const snapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: previousVersion,
      toVersion: currentVersion,
    });
    await writeLastRunVersion(userDataPath, currentVersion);
    return {
      migration,
      previousVersion,
      currentVersion,
      snapshot,
      snapshotError: null,
      status: "snapshot-created",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/user data path is empty/i.test(message)) {
      await writeLastRunVersion(userDataPath, currentVersion);
      return {
        migration,
        previousVersion,
        currentVersion,
        snapshot: null,
        snapshotError: null,
        status: "user-data-empty",
      };
    }

    if (/user data path does not exist/i.test(message)) {
      await writeLastRunVersion(userDataPath, currentVersion);
      return {
        migration,
        previousVersion,
        currentVersion,
        snapshot: null,
        snapshotError: null,
        status: "user-data-missing",
      };
    }

    return {
      migration,
      previousVersion,
      currentVersion,
      snapshot: null,
      snapshotError: message,
      status: "snapshot-failed",
    };
  }
}
