/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { listRecoveryArtifacts } from "@prompthub/core";
import {
  createDatabaseSafetyPoint,
  listDatabaseSafetyPoints,
} from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { getDataLayoutMigrationMarkerPath } from "../../../src/main/services/data-layout-migration";
import {
  runManagedBackupRetention,
  runManagedBackupRetentionAtStartup,
} from "../../../src/main/services/managed-backup-retention";
import {
  createUpgradeDataSnapshot,
  getUpgradeBackupRoot,
  listUpgradeBackups,
} from "../../../src/main/services/upgrade-backup";

describe("managed backup retention", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function createRoot(): { root: string; dbPath: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "managed-retention-"));
    roots.push(root);
    const dbPath = path.join(root, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const database = new Database(dbPath);
    database.exec(
      "CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
    );
    database.exec("INSERT INTO records (value) VALUES ('active')");
    database.close();
    return { root, dbPath };
  }

  function createRecoveryArtifact(
    root: string,
    id: string,
    createdAt: string,
    payloadBytes: number,
    pinnedReason?: string,
  ): void {
    const artifactPath = path.join(root, "backups", "recovery", id);
    fs.mkdirSync(path.join(artifactPath, "root", "data"), { recursive: true });
    fs.writeFileSync(
      path.join(artifactPath, "root", "data", "payload.bin"),
      Buffer.alloc(payloadBytes, 1),
    );
    fs.writeFileSync(
      path.join(artifactPath, "manifest.json"),
      JSON.stringify({
        formatVersion: 1,
        kind: "storage-restore-recovery-artifact",
        state: "complete",
        id,
        operationId: id,
        artifactType: "pre-restore-state",
        sourceRoot: root,
        createdAt,
        validatedAt: createdAt,
        ...(pinnedReason ? { pinnedReason } : {}),
      }),
    );
  }

  it("keeps the newest valid point in every family even above the byte budget", async () => {
    const { root, dbPath } = createRoot();
    const oldUpgrade = await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.9",
      toVersion: "0.6.0",
      now: new Date("2026-08-01T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    const newUpgrade = await createUpgradeDataSnapshot(root, {
      fromVersion: "0.6.0",
      toVersion: "0.6.1",
      now: new Date("2026-08-20T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    createRecoveryArtifact(
      root,
      "recovery-old",
      "2026-08-02T00:00:00.000Z",
      32,
    );
    createRecoveryArtifact(
      root,
      "recovery-new",
      "2026-08-21T00:00:00.000Z",
      32,
    );
    const oldDatabase = createDatabaseSafetyPoint(dbPath, "pre-migration", {
      now: new Date("2026-08-03T00:00:00.000Z"),
      retention: { maxCount: 10 },
    });
    const newDatabase = createDatabaseSafetyPoint(dbPath, "pre-recovery", {
      now: new Date("2026-08-22T00:00:00.000Z"),
      retention: { maxCount: 10 },
    });
    const invalidPath = path.join(
      getUpgradeBackupRoot(root),
      "manifest-less-history",
    );
    fs.mkdirSync(invalidPath);
    fs.writeFileSync(path.join(invalidPath, "user-file.txt"), "untouched");

    const result = await runManagedBackupRetention(root, {
      maxManagedBytes: 1,
      maxEntries: 8,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(result.kept).toEqual({
      upgrade: [newUpgrade.backupId],
      recovery: ["recovery-new"],
      database: [newDatabase.id],
    });
    expect(result.removed.upgrade).toContain(oldUpgrade.backupId);
    expect(result.removed.recovery).toContain("recovery-old");
    expect(result.removed.database).toContain(oldDatabase.id);
    expect(
      (await listUpgradeBackups(root)).map(({ backupId }) => backupId),
    ).toEqual([newUpgrade.backupId]);
    expect(listRecoveryArtifacts(root).map(({ id }) => id)).toEqual([
      "recovery-new",
    ]);
    expect(listDatabaseSafetyPoints(dbPath).map(({ id }) => id)).toEqual([
      newDatabase.id,
    ]);
    expect(
      fs.readFileSync(path.join(invalidPath, "user-file.txt"), "utf8"),
    ).toBe("untouched");
  });

  it("protects pinned recovery and an incomplete layout migration reference", async () => {
    const { root } = createRoot();
    const referenced = await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.8-pre-layout-migration",
      toVersion: "0.5.8",
      now: new Date("2026-07-01T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    const newest = await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.9",
      toVersion: "0.6.0",
      now: new Date("2026-08-20T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    fs.writeFileSync(
      getDataLayoutMigrationMarkerPath(root),
      JSON.stringify({
        version: "0.5.5",
        migratedAt: "2026-07-01T00:00:00.000Z",
        movedEntries: [],
        failedEntries: ["skills"],
        backupId: referenced.backupId,
      }),
    );
    createRecoveryArtifact(
      root,
      "pinned-recovery",
      "2026-06-01T00:00:00.000Z",
      32,
      "manual-investigation",
    );
    createRecoveryArtifact(
      root,
      "newest-recovery",
      "2026-08-21T00:00:00.000Z",
      32,
    );

    const result = await runManagedBackupRetention(root, {
      maxManagedBytes: 1,
      maxEntries: 3,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(result.kept.upgrade).toEqual(
      expect.arrayContaining([referenced.backupId, newest.backupId]),
    );
    expect(result.kept.recovery).toEqual(
      expect.arrayContaining(["pinned-recovery", "newest-recovery"]),
    );
  });

  it.each([
    ["completed marker", { failedEntries: [] }],
    ["marker without a backup id", { failedEntries: ["skills"] }],
  ])(
    "does not protect an upgrade point referenced by a %s",
    async (_name, marker) => {
      const { root } = createRoot();
      const old = await createUpgradeDataSnapshot(root, {
        fromVersion: "0.5.8",
        toVersion: "0.5.9",
        now: new Date("2026-07-01T00:00:00.000Z"),
        skipRetentionPrune: true,
      });
      const newest = await createUpgradeDataSnapshot(root, {
        fromVersion: "0.5.9",
        toVersion: "0.6.0",
        now: new Date("2026-08-20T00:00:00.000Z"),
        skipRetentionPrune: true,
      });
      fs.writeFileSync(
        getDataLayoutMigrationMarkerPath(root),
        JSON.stringify({
          ...marker,
          backupId: marker.failedEntries.length ? undefined : old.backupId,
        }),
      );

      const result = await runManagedBackupRetention(root, {
        maxManagedBytes: 1,
        now: new Date("2026-08-25T00:00:00.000Z"),
      });

      expect(result.kept.upgrade).toEqual([newest.backupId]);
      expect(result.removed.upgrade).toEqual([old.backupId]);
    },
  );

  it("keeps recent optional history within budget and removes expired history", async () => {
    const { root } = createRoot();
    createRecoveryArtifact(root, "expired", "2026-06-01T00:00:00.000Z", 32);
    createRecoveryArtifact(root, "recent", "2026-08-20T00:00:00.000Z", 32);
    createRecoveryArtifact(root, "newest", "2026-08-24T00:00:00.000Z", 32);

    const result = await runManagedBackupRetention(root, {
      maxManagedBytes: 1024 * 1024,
      maxEntries: 8,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(result.kept.recovery).toEqual(["newest", "recent"]);
    expect(result.removed.recovery).toEqual(["expired"]);
  });

  it("rejects invalid policy limits before deleting managed points", async () => {
    const { root } = createRoot();
    createRecoveryArtifact(root, "preserved", "2026-08-24T00:00:00.000Z", 32);

    await expect(
      runManagedBackupRetention(root, { maxEntries: 0 }),
    ).rejects.toThrow("maxEntries must be a positive safe integer");
    expect(listRecoveryArtifacts(root).map(({ id }) => id)).toEqual([
      "preserved",
    ]);
  });

  it.each([
    ["depth", { maxActiveScanDepth: 1 }, "Active storage exceeds depth limit"],
    [
      "entries",
      { maxActiveScanEntries: 1 },
      "Active storage exceeds entry limit",
    ],
  ] as const)(
    "fails closed when active storage exceeds the %s limit",
    async (_name, limits, message) => {
      const { root } = createRoot();
      await expect(runManagedBackupRetention(root, limits)).rejects.toThrow(
        message,
      );
    },
  );

  it("surfaces unexpected database stat failures before planning deletion", async () => {
    const { root, dbPath } = createRoot();
    const originalLstat = fs.lstatSync.bind(fs);
    const lstatSpy = vi.spyOn(fs, "lstatSync").mockImplementation((target) => {
      if (path.resolve(String(target)) === path.resolve(dbPath)) {
        const error = new Error(
          "database stat denied",
        ) as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return originalLstat(target);
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const report = vi.fn();
      await expect(
        runManagedBackupRetentionAtStartup(root, report),
      ).resolves.toBeNull();
      expect(report).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        "[startup] managed backup retention failed:",
        expect.objectContaining({ message: "database stat denied" }),
      );
    } finally {
      lstatSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("treats an invalid managed timestamp as oldest optional history", async () => {
    const { root } = createRoot();
    const invalidDate = await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.8",
      toVersion: "0.5.9",
      now: new Date("2026-07-01T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.9",
      toVersion: "0.6.0",
      now: new Date("2026-08-20T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    const manifestPath = path.join(
      invalidDate.backupPath,
      "backup-manifest.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      createdAt: string;
    };
    manifest.createdAt = "not-a-date";
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = await runManagedBackupRetention(root, {
      maxManagedBytes: 1,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(result.removed.upgrade).toContain(invalidDate.backupId);
  });

  it.each([new Error("upgrade cleanup blocked"), "upgrade cleanup blocked"])(
    "keeps a failed family in the reported result when pruning throws %s",
    async (failure) => {
      const { root } = createRoot();
      const old = await createUpgradeDataSnapshot(root, {
        fromVersion: "0.5.8",
        toVersion: "0.5.9",
        now: new Date("2026-07-01T00:00:00.000Z"),
        skipRetentionPrune: true,
      });
      const newest = await createUpgradeDataSnapshot(root, {
        fromVersion: "0.5.9",
        toVersion: "0.6.0",
        now: new Date("2026-08-20T00:00:00.000Z"),
        skipRetentionPrune: true,
      });
      const originalRm = fs.promises.rm.bind(fs.promises);
      const rmSpy = vi
        .spyOn(fs.promises, "rm")
        .mockImplementation(async (target, options) => {
          if (String(target).includes(old.backupId)) throw failure;
          return await originalRm(target, options);
        });

      try {
        const result = await runManagedBackupRetention(root, {
          maxManagedBytes: 1,
          now: new Date("2026-08-25T00:00:00.000Z"),
        });

        expect(result.errors).toEqual(["upgrade: upgrade cleanup blocked"]);
        expect(result.removed.upgrade).toEqual([]);
        expect(result.kept.upgrade).toEqual([newest.backupId, old.backupId]);
      } finally {
        rmSpy.mockRestore();
      }
    },
  );

  it("reports the cleanup plan without deleting files in dry-run mode", async () => {
    const { root } = createRoot();
    createRecoveryArtifact(root, "old", "2026-06-01T00:00:00.000Z", 32);
    createRecoveryArtifact(root, "new", "2026-08-24T00:00:00.000Z", 32);

    const result = await runManagedBackupRetention(root, {
      dryRun: true,
      maxManagedBytes: 1,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(result.removed.recovery).toEqual(["old"]);
    expect(result.afterBytes).toBeLessThan(result.beforeBytes);
    expect(listRecoveryArtifacts(root).map(({ id }) => id)).toEqual([
      "new",
      "old",
    ]);
  });

  it.skipIf(process.platform === "win32")(
    "does not follow symbolic links while measuring active durable bytes",
    async () => {
      const { root } = createRoot();
      const externalPath = path.join(
        root,
        "..",
        `${path.basename(root)}-external.bin`,
      );
      roots.push(externalPath);
      fs.writeFileSync(externalPath, Buffer.alloc(1024 * 1024, 1));
      fs.symlinkSync(externalPath, path.join(root, "data", "external.bin"));

      const result = await runManagedBackupRetention(root, { dryRun: true });

      expect(result.activeBytes).toBeLessThan(1024 * 1024);
      expect(fs.statSync(externalPath).size).toBe(1024 * 1024);
    },
  );

  it("ignores an oversized layout marker instead of trusting its backup id", async () => {
    const { root } = createRoot();
    const old = await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.8",
      toVersion: "0.5.9",
      now: new Date("2026-07-01T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    await createUpgradeDataSnapshot(root, {
      fromVersion: "0.5.9",
      toVersion: "0.6.0",
      now: new Date("2026-08-20T00:00:00.000Z"),
      skipRetentionPrune: true,
    });
    fs.writeFileSync(
      getDataLayoutMigrationMarkerPath(root),
      JSON.stringify({
        backupId: old.backupId,
        failedEntries: ["skills"],
      }).padEnd(65 * 1024, " "),
    );

    const result = await runManagedBackupRetention(root, {
      maxManagedBytes: 1,
      now: new Date("2026-08-25T00:00:00.000Z"),
    });

    expect(result.removed.upgrade).toContain(old.backupId);
  });

  it("does not count standalone database recovery copies as active data", async () => {
    const { root } = createRoot();
    fs.writeFileSync(
      path.join(root, "data", "prompthub.db.backup-before-0.5.3.db"),
      Buffer.alloc(1024 * 1024, 1),
    );

    const result = await runManagedBackupRetention(root, { dryRun: true });

    expect(result.activeBytes).toBeLessThan(1024 * 1024);
  });

  it("returns an empty idempotent plan when no managed points exist", async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "managed-retention-empty-"),
    );
    roots.push(root);
    fs.mkdirSync(path.join(root, "data"), { recursive: true });

    const report = vi.fn();
    const result = await runManagedBackupRetentionAtStartup(
      root,
      report,
      true,
      { now: new Date("2026-08-25T00:00:00.000Z") },
    );

    expect(result?.kept).toEqual({ upgrade: [], recovery: [], database: [] });
    expect(result?.removed).toEqual({
      upgrade: [],
      recovery: [],
      database: [],
    });
    expect(report).toHaveBeenCalledWith({
      event: "startup:managed_backup_retention",
      ...result,
    });
  });

  it("skips the startup scan when no upgrade or layout safety point was created", async () => {
    const { root } = createRoot();
    const report = vi.fn();

    await expect(
      runManagedBackupRetentionAtStartup(root, report, false),
    ).resolves.toBeNull();
    expect(report).not.toHaveBeenCalled();
  });
});
