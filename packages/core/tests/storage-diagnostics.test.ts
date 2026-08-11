import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getStorageDiagnostic } from "../src/storage-diagnostics";
import { getStorageRootOperationJournalPath } from "../src/storage-root-operation";
import { writeRuntimeLayoutState } from "../src/runtime-storage-context";

describe("storage diagnostics", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports the exact canonical path, operation state, recovery inventory, and omissions", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-diagnostic-"),
    );
    roots.push(root);
    fs.mkdirSync(path.join(root, "data", "operations", "migrations"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, "data", "prompthub.db"), "database");
    fs.writeFileSync(
      path.join(
        root,
        "data",
        "operations",
        "migrations",
        "renderer-persistence-v1.json",
      ),
      "{}",
    );
    fs.writeFileSync(
      path.join(
        root,
        "data",
        "operations",
        "migrations",
        "desktop-skill-repo-v1.json",
      ),
      "{}",
    );
    writeRuntimeLayoutState(root);
    const artifact = path.join(root, "backups", "recovery", "artifact-1");
    fs.mkdirSync(path.join(artifact, "root"), { recursive: true });
    fs.writeFileSync(path.join(artifact, "root", "payload"), "payload");
    fs.writeFileSync(
      path.join(artifact, "manifest.json"),
      JSON.stringify({
        formatVersion: 1,
        kind: "storage-root-recovery-artifact",
        state: "complete",
        id: "artifact-1",
        operationId: "artifact-1",
        artifactType: "overwritten-root",
        sourceRoot: root,
        targetRoot: root,
        createdAt: "2026-08-11T00:00:00.000Z",
        validatedAt: "2026-08-11T00:00:00.000Z",
      }),
    );

    const diagnostic = getStorageDiagnostic(root, {
      inspectDatabase: () => ({
        userVersion: 3,
        migrationCount: 3,
        quickCheck: "ok",
      }),
    });

    expect(diagnostic.root).toMatchObject({
      activePath: root,
      layoutEpoch: 1,
      layoutState: "published",
    });
    expect(diagnostic.database).toMatchObject({
      path: path.join(root, "data", "prompthub.db"),
      exists: true,
      userVersion: 3,
      migrationCount: 3,
      quickCheck: "ok",
    });
    expect(diagnostic.recovery).toMatchObject({
      count: 1,
      artifactTypes: { "overwritten-root": 1 },
    });
    expect(diagnostic.rendererPersistence).toEqual({
      migrationComplete: true,
      indexedDbMigrationComplete: false,
    });
    expect(diagnostic.hostReconciliation).toEqual({
      desktopSkillRepoComplete: true,
    });
    expect(diagnostic.portableOmissions).toContain("secrets");
    expect(JSON.stringify(diagnostic)).not.toContain("payload");
  });

  it("reports an inferred empty root without invoking database inspection", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-diagnostic-empty-"),
    );
    roots.push(root);
    fs.mkdirSync(
      path.join(
        root,
        "data",
        "operations",
        "migrations",
        "renderer-persistence-v1.json",
      ),
      { recursive: true },
    );
    const inspectDatabase = vi.fn();

    const diagnostic = getStorageDiagnostic(root, { inspectDatabase });

    expect(diagnostic.root.layoutState).toBe("inferred");
    expect(diagnostic.database).toMatchObject({
      exists: false,
      sizeBytes: 0,
      userVersion: null,
      quickCheck: "unavailable",
    });
    expect(inspectDatabase).not.toHaveBeenCalled();
  });

  it("reports a durable root-operation journal without exposing its paths", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-diagnostic-journal-"),
    );
    const control = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-diagnostic-control-"),
    );
    roots.push(root, control);
    const journalPath = getStorageRootOperationJournalPath(control);
    fs.mkdirSync(path.dirname(journalPath), { recursive: true });
    fs.writeFileSync(
      journalPath,
      JSON.stringify({
        formatVersion: 1,
        kind: "prompthub-storage-root-operation",
        operationId: "root-change-1",
        action: "migrate",
        state: "prepared",
        sourceRoot: "/private/source",
        targetRoot: "/private/target",
        stagePath: "/private/.target.prompthub-stage-root-change-1",
        priorPath: "/private/.target.prompthub-prior-root-change-1",
        sourceDigest: null,
        createdAt: "2026-08-12T00:00:00.000Z",
        updatedAt: "2026-08-12T00:00:00.000Z",
      }),
    );

    const diagnostic = getStorageDiagnostic(root, {
      controlDirectory: control,
    });

    expect(diagnostic.operations.rootChange).toEqual({
      operationId: "root-change-1",
      action: "migrate",
      state: "prepared",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("/private/source");
  });

  it("fails closed when a diagnostic path cannot be inspected", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-diagnostic-error-"),
    );
    roots.push(root);
    const databasePath = path.join(root, "data", "prompthub.db");
    const originalLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      if (path.resolve(String(target)) === databasePath) {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      }
      return originalLstat(target, options as never);
    });

    expect(() => getStorageDiagnostic(root)).toThrow("denied");
  });
});
