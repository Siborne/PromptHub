/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import DatabaseAdapter from "../../../src/main/database/sqlite";
import { reconcileDesktopSkillRepoPaths } from "../../../src/main/services/skill-repo-reconciliation";

describe("desktop skill repository reconciliation", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-skill-reconcile-"));
    roots.push(root);
    const database = new DatabaseAdapter(path.join(root, "prompthub.db"));
    database.exec(`
      CREATE TABLE skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_url TEXT,
        local_repo_path TEXT
      )
    `);
    database.run(
      "INSERT INTO skills (id, name, source_url) VALUES (?, ?, ?)",
      "skill-1",
      "writer",
      null,
    );
    return {
      root,
      database,
      markerPath: path.join(
        root,
        "data",
        "operations",
        "migrations",
        "desktop-skill-repo-v1.json",
      ),
    };
  }

  it("publishes one verified idempotent host-stage marker", () => {
    const { root, database, markerPath } = fixture();
    const repoPath = path.join(root, "data", "skills", "writer");
    fs.mkdirSync(repoPath, { recursive: true });
    const resolver = vi.fn(() => repoPath);

    expect(
      reconcileDesktopSkillRepoPaths(database, markerPath, resolver),
    ).toEqual({ status: "completed", reconciled: 1, unresolved: 0 });
    expect(
      database.get("SELECT local_repo_path FROM skills WHERE id = ?", "skill-1"),
    ).toEqual({ local_repo_path: repoPath });
    expect(JSON.parse(fs.readFileSync(markerPath, "utf8"))).toEqual(
      expect.objectContaining({
        kind: "prompthub-desktop-skill-repo-reconciliation",
        version: 1,
        state: "complete",
        reconciled: 1,
        unresolved: 0,
      }),
    );

    expect(
      reconcileDesktopSkillRepoPaths(database, markerPath, resolver),
    ).toEqual({ status: "already-complete", reconciled: 1, unresolved: 0 });
    expect(resolver).toHaveBeenCalledTimes(1);
    database.close();
  });

  it("keeps the committed marker when Windows rejects directory fsync", () => {
    const { database, markerPath } = fixture();
    const fsyncSync = fs.fsyncSync.bind(fs);
    vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      if (fs.fstatSync(descriptor).isDirectory()) {
        throw Object.assign(new Error("operation not permitted, fsync"), {
          code: "EPERM",
        });
      }
      fsyncSync(descriptor);
    });

    expect(
      reconcileDesktopSkillRepoPaths(database, markerPath, () => null),
    ).toEqual({ status: "completed", reconciled: 0, unresolved: 1 });
    expect(fs.existsSync(markerPath)).toBe(true);
    database.close();
  });

  it("leaves data and the completion marker unchanged when resolution fails", () => {
    const { database, markerPath } = fixture();

    expect(() =>
      reconcileDesktopSkillRepoPaths(database, markerPath, () => {
        throw new Error("scan failed");
      }),
    ).toThrow("scan failed");
    expect(
      database.get("SELECT local_repo_path FROM skills WHERE id = ?", "skill-1"),
    ).toEqual({ local_repo_path: null });
    expect(fs.existsSync(markerPath)).toBe(false);
    database.close();
  });

  it("rejects unsafe resolver output without publishing partial state", () => {
    const { root, database, markerPath } = fixture();
    const target = path.join(root, "external");
    const link = path.join(root, "linked-skill");
    fs.mkdirSync(target);
    fs.symlinkSync(target, link, "dir");

    expect(() =>
      reconcileDesktopSkillRepoPaths(database, markerPath, () => link),
    ).toThrow(/unsafe skill repository path/i);
    expect(fs.existsSync(markerPath)).toBe(false);
    database.close();
  });
});
