/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DatabaseAdapter from "../../../src/main/database/sqlite";

import {
  createUpgradeDataSnapshot,
  getUpgradeBackupRoot,
  listUpgradeBackups,
  MAX_UPGRADE_BACKUP_SNAPSHOTS,
} from "../../../src/main/services/upgrade-backup";
import { restoreFromUpgradeBackupAsync } from "../../../src/main/services/upgrade-backup-restore";

function makeTmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeTestDatabase(databasePath: string, value: string): void {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
  const database = new DatabaseAdapter(databasePath);
  database.exec("CREATE TABLE restore_marker (value TEXT NOT NULL)");
  database.prepare("INSERT INTO restore_marker (value) VALUES (?)").run(value);
  database.close();
}

function readTestDatabase(databasePath: string): string {
  const database = new DatabaseAdapter(databasePath, { readOnly: true });
  try {
    return (database.get("SELECT value FROM restore_marker") as { value: string }).value;
  } finally {
    database.close();
  }
}

describe("upgrade-backup-restore", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = makeTmpDir("upgrade-backup-restore-");
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("replaces current userData content while preserving the backups root", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });
    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "old-db");
    fs.writeFileSync(path.join(userDataPath, "shortcut-mode.json"), '{"mode":"old"}');
    fs.mkdirSync(path.join(userDataPath, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(userDataPath, "workspace", "prompt-1.md"), "old prompt");

    const snapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: "0.5.3",
      toVersion: "0.5.4",
    });

    // Mutate current state after snapshot so restore has something to roll back.
    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "new-db");
    fs.rmSync(path.join(userDataPath, "workspace"), { recursive: true, force: true });
    fs.mkdirSync(path.join(userDataPath, "images"), { recursive: true });
    fs.writeFileSync(path.join(userDataPath, "images", "new.png"), "png");

    const result = await restoreFromUpgradeBackupAsync(
      userDataPath,
      snapshot.backupId,
    );

    expect(result.success).toBe(true);
    expect(result.needsRestart).toBe(true);
    expect(result.currentStateBackupPath).toBeTruthy();

    expect(readTestDatabase(path.join(userDataPath, "data", "prompthub.db"))).toBe(
      "old-db",
    );
    expect(
      fs.readFileSync(path.join(userDataPath, "data", "prompt-1.md"), "utf8"),
    ).toBe("old prompt");
    expect(fs.existsSync(path.join(userDataPath, "images"))).toBe(false);

    // The backups root must still exist because both the source snapshot and
    // the insurance backup live there.
    const backupRoot = getUpgradeBackupRoot(userDataPath);
    expect(fs.existsSync(backupRoot)).toBe(true);
    expect(
      result.currentStateBackupPath?.startsWith(
        path.join(userDataPath, "backups", "recovery"),
      ),
    ).toBe(true);
  });

  it("returns an error for an unknown backup id", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });

    const result = await restoreFromUpgradeBackupAsync(
      userDataPath,
      "v0.5.3-unknown",
    );

    expect(result).toEqual({
      success: false,
      needsRestart: false,
      error: "Upgrade backup not found: v0.5.3-unknown",
    });
  });

  it("ignores runtime cache directories during restore", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });
    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "old-db");

    const snapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: "0.5.3",
      toVersion: "0.5.4",
    });

    fs.mkdirSync(path.join(userDataPath, "DawnGraphiteCache"), { recursive: true });
    fs.writeFileSync(
      path.join(userDataPath, "DawnGraphiteCache", "data_0"),
      "live-cache",
    );

    const result = await restoreFromUpgradeBackupAsync(
      userDataPath,
      snapshot.backupId,
    );

    expect(result.success).toBe(true);
    expect(
      fs.readFileSync(path.join(userDataPath, "DawnGraphiteCache", "data_0"), "utf8"),
    ).toBe("live-cache");
  });

  it("moves a legacy root database into data/prompthub.db during restore", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });
    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "old-db");

    const snapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: "0.5.6",
      toVersion: "0.5.7",
    });

    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "new-db");

    const result = await restoreFromUpgradeBackupAsync(
      userDataPath,
      snapshot.backupId,
    );

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(userDataPath, "prompthub.db"))).toBe(false);
    expect(
      readTestDatabase(path.join(userDataPath, "data", "prompthub.db")),
    ).toBe("old-db");
  });

  it("rolls back to the insurance snapshot when restore fails mid-flight", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });
    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "old-db");
    fs.writeFileSync(path.join(userDataPath, "shortcut-mode.json"), '{"mode":"old"}');

    const snapshot = await createUpgradeDataSnapshot(userDataPath, {
      fromVersion: "0.5.3",
      toVersion: "0.5.4",
    });

    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "new-db");
    fs.writeFileSync(path.join(userDataPath, "shortcut-mode.json"), '{"mode":"new"}');

    fs.writeFileSync(
      path.join(snapshot.backupPath, "prompthub.db"),
      Buffer.alloc(8192, 0xff),
    );

    const result = await restoreFromUpgradeBackupAsync(
      userDataPath,
      snapshot.backupId,
    );

    expect(result.success).toBe(false);
    expect(result.needsRestart).toBe(false);
    expect(result.error).toMatch(/database|sqlite|malformed|file is not/i);
    expect(readTestDatabase(path.join(userDataPath, "prompthub.db"))).toBe("new-db");
    expect(
      fs.readFileSync(path.join(userDataPath, "shortcut-mode.json"), "utf8"),
    ).toBe('{"mode":"new"}');
  });

  it("rejects symlinks inside a backup snapshot and rolls back current data", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    const backupId = "v0.5.1-2026-01-01T00-00-00-000Z";
    const backupPath = path.join(getUpgradeBackupRoot(userDataPath), backupId);
    const externalPath = path.join(tmpBase, "outside-restore-secret.txt");
    fs.mkdirSync(path.join(userDataPath, "data"), { recursive: true });
    writeTestDatabase(
      path.join(userDataPath, "data", "prompthub.db"),
      "current-db",
    );
    fs.mkdirSync(path.join(userDataPath, "workspace"), { recursive: true });
    fs.writeFileSync(
      path.join(userDataPath, "workspace", "current.md"),
      "current prompt",
    );
    fs.mkdirSync(path.join(backupPath, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(backupPath, "workspace", "safe.md"), "safe prompt");
    fs.writeFileSync(externalPath, "external secret");
    fs.symlinkSync(
      externalPath,
      path.join(backupPath, "workspace", "linked-secret.md"),
      "file",
    );
    fs.writeFileSync(
      path.join(backupPath, "backup-manifest.json"),
      JSON.stringify({
        kind: "prompthub-upgrade-backup",
        schemaVersion: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        fromVersion: "0.5.1",
        sourcePath: userDataPath,
        copiedItems: ["workspace"],
        platform: process.platform,
      }),
      "utf8",
    );

    const result = await restoreFromUpgradeBackupAsync(userDataPath, backupId);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/symbolic link/i);
    expect(
      fs.readFileSync(path.join(userDataPath, "workspace", "current.md"), "utf8"),
    ).toBe("current prompt");
    expect(
      fs.existsSync(path.join(userDataPath, "workspace", "linked-secret.md")),
    ).toBe(false);
    expect(fs.readFileSync(externalPath, "utf8")).toBe("external secret");
  });

  it("prunes old snapshots after restore while keeping source and insurance backups", async () => {
    const userDataPath = path.join(tmpBase, "PromptHub");
    fs.mkdirSync(userDataPath, { recursive: true });
    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "seed-db");

    const snapshots = [] as Array<{ backupId: string }>;
    for (let index = 0; index < MAX_UPGRADE_BACKUP_SNAPSHOTS - 1; index += 1) {
      const snapshot = await createUpgradeDataSnapshot(userDataPath, {
        fromVersion: `0.5.${index}`,
      });
      snapshots.push(snapshot);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    writeTestDatabase(path.join(userDataPath, "prompthub.db"), "latest-db");

    const restoreTarget = snapshots[0];
    const result = await restoreFromUpgradeBackupAsync(userDataPath, restoreTarget.backupId);

    expect(result.success).toBe(true);
    const backups = await listUpgradeBackups(userDataPath);
    expect(backups.length).toBeLessThanOrEqual(MAX_UPGRADE_BACKUP_SNAPSHOTS);
    expect(backups.some((entry) => entry.backupId === restoreTarget.backupId)).toBe(true);
    expect(fs.existsSync(result.currentStateBackupPath!)).toBe(true);
    expect(result.currentStateBackupPath).toContain(
      path.join("backups", "recovery"),
    );
  });
});
