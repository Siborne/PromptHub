/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "../../../src/main/database/sqlite";

import {
  getLastRunVersionMarkerPath,
  runUpgradeBackupStartupTasks,
} from "../../../src/main/services/upgrade-backup-startup";
import {
  createUpgradeDataSnapshot,
  getLegacyUpgradeBackupRoot,
  getUpgradeBackupRoot,
  listUpgradeBackups,
} from "../../../src/main/services/upgrade-backup";

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function seedUserData(userDataPath: string): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(path.join(userDataPath, "prompthub.db"), "db-bytes");
  fs.mkdirSync(path.join(userDataPath, "workspace"), { recursive: true });
  fs.writeFileSync(
    path.join(userDataPath, "workspace", "prompt-1.md"),
    "prompt",
  );
}

function seedLockedCanonicalDatabase(
  userDataPath: string,
  ownerPid: number,
): string {
  const databasePath = path.join(userDataPath, "data", "prompthub.db");
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.exec("CREATE TABLE snapshot_marker (value TEXT NOT NULL)");
  database.exec("INSERT INTO snapshot_marker (value) VALUES ('preserved')");
  database.close();

  fs.mkdirSync(`${databasePath}.lock`, { recursive: true });
  fs.mkdirSync(`${databasePath}.clients`, { recursive: true });
  fs.writeFileSync(
    path.join(`${databasePath}.clients`, `${ownerPid}.json`),
    JSON.stringify({ pid: ownerPid, registeredAt: new Date().toISOString() }),
    "utf8",
  );
  return databasePath;
}

describe("upgrade-backup-startup", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = makeTmpDir("upgrade-backup-startup-");
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("treats the first launch as marker-only and does not create a snapshot", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    seedUserData(userDataPath);

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.5.4");

    expect(result.status).toBe("first-run");
    expect(result.previousVersion).toBeNull();
    expect(result.snapshot).toBeNull();

    const marker = JSON.parse(
      fs.readFileSync(getLastRunVersionMarkerPath(userDataPath), "utf8"),
    ) as { version: string };
    expect(marker.version).toBe("0.5.4");
    expect(fs.existsSync(getUpgradeBackupRoot(userDataPath))).toBe(true);
    expect(
      await fs.promises.readdir(getUpgradeBackupRoot(userDataPath)),
    ).toEqual(
      expect.arrayContaining([".legacy-migrated", ".last-run-version.json"]),
    );
  });

  it("creates a snapshot when the current version is newer than the last run version", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    seedUserData(userDataPath);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.5.3",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.5.4");

    expect(result.status).toBe("snapshot-created");
    expect(result.previousVersion).toBe("0.5.3");
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.manifest.fromVersion).toBe("0.5.3");
    expect(result.snapshot?.manifest.toVersion).toBe("0.5.4");
    expect(
      result.snapshot?.backupPath.startsWith(
        getUpgradeBackupRoot(userDataPath),
      ),
    ).toBe(true);

    const marker = JSON.parse(
      fs.readFileSync(getLastRunVersionMarkerPath(userDataPath), "utf8"),
    ) as { version: string };
    expect(marker.version).toBe("0.5.4");
  });

  it("recovers a stale registered lock before capturing the upgrade database image", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    const stalePid = 2_147_483_647;
    const databasePath = seedLockedCanonicalDatabase(userDataPath, stalePid);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.5.9",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await runUpgradeBackupStartupTasks(
      userDataPath,
      "0.6.0-beta.1",
    );

    expect(result.status).toBe("snapshot-created");
    expect(fs.existsSync(`${databasePath}.lock`)).toBe(false);
    expect(
      fs.existsSync(path.join(`${databasePath}.clients`, `${stalePid}.json`)),
    ).toBe(false);
    const snapshotDatabase = new Database(
      path.join(result.snapshot!.backupPath, "data", "prompthub.db"),
      { readOnly: true },
    );
    expect(snapshotDatabase.get("SELECT value FROM snapshot_marker")).toEqual({
      value: "preserved",
    });
    snapshotDatabase.close();
  });

  it("preserves a live owner lock and leaves the upgrade marker unchanged", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    const databasePath = seedLockedCanonicalDatabase(userDataPath, process.pid);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.5.9",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await runUpgradeBackupStartupTasks(
      userDataPath,
      "0.6.0-beta.1",
    );

    expect(result.status).toBe("snapshot-failed");
    expect(result.snapshotError).toContain("live-client");
    expect(fs.existsSync(`${databasePath}.lock`)).toBe(true);
    const marker = JSON.parse(
      fs.readFileSync(getLastRunVersionMarkerPath(userDataPath), "utf8"),
    ) as { version: string };
    expect(marker.version).toBe("0.5.9");
  });

  it("does not create a snapshot when relaunching the same version", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    seedUserData(userDataPath);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.5.4",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.5.4");

    expect(result.status).toBe("not-an-upgrade");
    expect(result.snapshot).toBeNull();
  });

  it("reuses a modern install-time snapshot for the exact first-start transition", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    const databasePath = path.join(userDataPath, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    database.exec("CREATE TABLE snapshot_marker (value TEXT NOT NULL)");
    database.exec("INSERT INTO snapshot_marker (value) VALUES ('preserved')");
    database.close();
    await runUpgradeBackupStartupTasks(userDataPath, "0.6.0");
    const installSnapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: "0.6.0",
      toVersion: "0.6.1",
    });

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.6.1");

    expect(result.status).toBe("snapshot-reused");
    expect(result.snapshot?.backupId).toBe(installSnapshot.backupId);
    expect(await listUpgradeBackups(userDataPath)).toHaveLength(1);
  });

  it("does not reuse a transition snapshot older than the last-run marker", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    const databasePath = path.join(userDataPath, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    database.exec("CREATE TABLE snapshot_marker (value TEXT NOT NULL)");
    database.close();
    await runUpgradeBackupStartupTasks(userDataPath, "0.6.0");
    const staleSnapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: "0.6.0",
      toVersion: "0.6.1",
    });
    await runUpgradeBackupStartupTasks(userDataPath, "0.6.0");

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.6.1");

    expect(result.status).toBe("snapshot-created");
    expect(result.snapshot?.backupId).not.toBe(staleSnapshot.backupId);
    expect(await listUpgradeBackups(userDataPath)).toHaveLength(2);
  });

  it("refuses an older writer before migration and leaves the marker unchanged", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    seedUserData(userDataPath);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.6.0-beta.1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    await expect(
      runUpgradeBackupStartupTasks(userDataPath, "0.5.9"),
    ).rejects.toThrow(
      "was last opened by newer PromptHub version 0.6.0-beta.1",
    );

    const marker = JSON.parse(
      fs.readFileSync(getLastRunVersionMarkerPath(userDataPath), "utf8"),
    ) as { version: string };
    expect(marker.version).toBe("0.6.0-beta.1");
    expect(
      fs.existsSync(
        path.join(getUpgradeBackupRoot(userDataPath), ".legacy-migrated"),
      ),
    ).toBe(false);
  });

  it("uses prerelease ordering when protecting a stable-version data root", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    seedUserData(userDataPath);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.6.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    await expect(
      runUpgradeBackupStartupTasks(userDataPath, "0.6.0-beta.2"),
    ).rejects.toThrow("was last opened by newer PromptHub version 0.6.0");
  });

  it("treats empty userData as a non-fatal no-op and still advances the marker", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.5.3",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.5.4");

    expect(result.status).toBe("user-data-empty");
    expect(result.snapshot).toBeNull();

    const marker = JSON.parse(
      fs.readFileSync(getLastRunVersionMarkerPath(userDataPath), "utf8"),
    ) as { version: string };
    expect(marker.version).toBe("0.5.4");
  });

  it("migrates legacy sibling backups before evaluating the version jump", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    seedUserData(userDataPath);
    fs.mkdirSync(getUpgradeBackupRoot(userDataPath), { recursive: true });
    fs.writeFileSync(
      getLastRunVersionMarkerPath(userDataPath),
      JSON.stringify({
        version: "0.5.3",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const legacyRoot = getLegacyUpgradeBackupRoot(userDataPath);
    const legacyCreatedAt = new Date().toISOString();
    const legacyBackupId = `v0.5.2-${legacyCreatedAt.replace(/[:.]/g, "-")}`;
    const legacyBackup = path.join(legacyRoot, legacyBackupId);
    fs.mkdirSync(legacyBackup, { recursive: true });
    fs.writeFileSync(path.join(legacyBackup, "prompthub.db"), "legacy-db");
    fs.writeFileSync(
      path.join(legacyBackup, "backup-manifest.json"),
      JSON.stringify({
        kind: "prompthub-upgrade-backup",
        createdAt: legacyCreatedAt,
        version: "0.5.2",
        sourcePath: userDataPath,
        copiedItems: ["prompthub.db"],
        platform: process.platform,
      }),
      "utf8",
    );

    const result = await runUpgradeBackupStartupTasks(userDataPath, "0.5.4");

    expect(result.migration.migrated).toBe(1);
    expect(result.status).toBe("snapshot-created");
    expect(
      fs.existsSync(
        path.join(getUpgradeBackupRoot(userDataPath), legacyBackupId),
      ),
    ).toBe(true);
    expect(fs.existsSync(legacyBackup)).toBe(false);
  });
});
