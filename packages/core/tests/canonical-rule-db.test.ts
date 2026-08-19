import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DatabaseAdapter, SCHEMA } from "@prompthub/db";
import type { RuleRecord, RuleVersionRecord } from "@prompthub/shared/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CanonicalRuleDB } from "../src/canonical-rule-db";
import { readRuleResourceBundle } from "../src/rule-resource-schema";
import {
  configureRuntimePaths,
  getRulesDir,
  resetRuntimePaths,
} from "../src/runtime-paths";
import {
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "../src";

describe("canonical Rule database adapter", () => {
  let root: string;
  let database: DatabaseAdapter.Database;
  let ruleDb: CanonicalRuleDB;
  let managedPath: string;
  let versionPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-canonical-rule-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "e".repeat(64),
      operationId: "canonical-rule-test",
    });
    database = new DatabaseAdapter(":memory:");
    database.exec(SCHEMA);
    ruleDb = new CanonicalRuleDB(database);
    managedPath = path.join(getRulesDir(), "global", "codex", "AGENTS.md");
    versionPath = path.join(
      getRulesDir(),
      ".versions",
      "codex-global",
      "0001.md",
    );
    fs.mkdirSync(path.dirname(managedPath), { recursive: true });
    fs.mkdirSync(path.dirname(versionPath), { recursive: true });
    fs.writeFileSync(managedPath, "# Rules\n");
    fs.writeFileSync(versionPath, "# Rules\n");
  });

  afterEach(() => {
    database.close();
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  function record(): RuleRecord {
    return {
      id: "codex-global",
      scope: "global",
      platformId: "codex",
      platformName: "Codex",
      platformIcon: "Terminal",
      platformDescription: "Codex rules",
      canonicalFileName: "AGENTS.md",
      description: "Global rules",
      managedPath,
      targetPath: path.join(root, "target", "AGENTS.md"),
      syncStatus: "target-missing",
      currentVersion: 1,
      contentHash: crypto
        .createHash("sha256")
        .update("# Rules\n")
        .digest("hex"),
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
    };
  }

  function versions(): RuleVersionRecord[] {
    return [
      {
        id: "version-1",
        ruleId: "codex-global",
        version: 1,
        filePath: versionPath,
        source: "create",
        createdAt: "2026-08-12T00:00:00.000Z",
      },
    ];
  }

  it("publishes Rule DB synchronization and rebuilds its cache workspace", () => {
    ruleDb.upsert(record());
    ruleDb.replaceVersions("codex-global", versions());
    const bundlePath = path.join(root, "data", "rules", "codex-global");

    expect(readRuleResourceBundle(bundlePath).rule).toMatchObject({
      content: "# Rules\n",
    });
    expect(readRuleResourceBundle(bundlePath).rule.targetPath).toBeUndefined();
    const initialRevision =
      readRuleResourceBundle(bundlePath).bundleManifest.revision;
    ruleDb.upsert(record());
    ruleDb.replaceVersions("codex-global", versions());
    expect(readRuleResourceBundle(bundlePath).bundleManifest.revision).toBe(
      initialRevision,
    );
    fs.rmSync(getRulesDir(), { recursive: true, force: true });
    ruleDb.reconcileCanonicalWorkspaces();
    const restored = ruleDb.getById("codex-global")!;
    expect(fs.readFileSync(restored.managedPath, "utf8")).toBe("# Rules\n");
    expect(
      fs.readFileSync(ruleDb.getVersions("codex-global")[0].filePath, "utf8"),
    ).toBe("# Rules\n");

    const inFlightWritePath = path.join(
      path.dirname(restored.managedPath),
      "._rule.json.in-flight.tmp",
    );
    fs.writeFileSync(inFlightWritePath, "pending");
    new CanonicalRuleDB(database).reconcileCanonicalWorkspaces();
    expect(fs.readFileSync(inFlightWritePath, "utf8")).toBe("pending");

    ruleDb.delete("codex-global");
    expect(fs.existsSync(bundlePath)).toBe(false);
  });

  it("recovers an older project placement from the file workspace during catalog rebuild", () => {
    const projectRootPath = path.join(root, "project");
    const targetPath = path.join(projectRootPath, "AGENTS.md");
    const legacyContainer = path.join(getRulesDir(), "projects", "docs__docs");
    const projectManagedPath = path.join(legacyContainer, "AGENTS.md");
    const projectVersionPath = path.join(
      getRulesDir(),
      ".versions",
      "project%3Adocs",
      "0001.md",
    );
    fs.mkdirSync(path.dirname(projectVersionPath), { recursive: true });
    fs.mkdirSync(legacyContainer, { recursive: true });
    fs.writeFileSync(projectManagedPath, "# Project\n");
    fs.writeFileSync(projectVersionPath, "# Project\n");
    const projectRecord: RuleRecord = {
      ...record(),
      id: "project:docs",
      scope: "project",
      platformId: "workspace",
      platformName: "Docs",
      canonicalFileName: "AGENTS.md",
      managedPath: projectManagedPath,
      targetPath,
      projectRootPath,
    };
    const projectVersions: RuleVersionRecord[] = [
      {
        ...versions()[0],
        id: "project-version-1",
        ruleId: "project:docs",
        filePath: projectVersionPath,
      },
    ];
    ruleDb.upsert(projectRecord);
    ruleDb.replaceVersions(projectRecord.id, projectVersions);
    fs.writeFileSync(
      path.join(legacyContainer, "_rule.json"),
      `${JSON.stringify({ ...projectRecord, managedPath: projectManagedPath })}\n`,
    );
    database
      .prepare(
        "UPDATE rules SET target_path = '', project_root_path = NULL WHERE id = ?",
      )
      .run(projectRecord.id);

    ruleDb.reconcileCanonicalWorkspaces();

    expect(ruleDb.getById(projectRecord.id)).toMatchObject({
      targetPath,
      projectRootPath,
    });
  });

  it("hydrates the compatibility version index newest first", () => {
    const versionDir = path.dirname(versionPath);
    const history = [
      ["version-1", "2026-08-10T00:00:00.000Z", "# Version 1\n"],
      ["version-2", "2026-08-11T00:00:00.000Z", "# Version 2\n"],
      ["version-3", "2026-08-12T00:00:00.000Z", "# Version 3\n"],
    ] as const;
    const records = history.map(([id, createdAt, content], index) => {
      const filePath = path.join(
        versionDir,
        `${String(index + 1).padStart(4, "0")}.md`,
      );
      fs.writeFileSync(filePath, content);
      return {
        id,
        ruleId: "codex-global" as const,
        version: index + 1,
        filePath,
        source: index === 0 ? ("create" as const) : ("manual-save" as const),
        createdAt,
      };
    });
    fs.writeFileSync(managedPath, "# Version 3\n");
    ruleDb.upsert({ ...record(), currentVersion: 3 });
    ruleDb.replaceVersions("codex-global", records);
    fs.rmSync(getRulesDir(), { recursive: true, force: true });

    ruleDb.reconcileCanonicalWorkspaces();

    const index = JSON.parse(
      fs.readFileSync(
        path.join(getRulesDir(), ".versions", "codex-global", "index.json"),
        "utf8",
      ),
    ) as Array<{ id: string }>;
    expect(index.map((entry) => entry.id)).toEqual([
      "version-3",
      "version-2",
      "version-1",
    ]);
  });
});
