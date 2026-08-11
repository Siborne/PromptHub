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

    expect(readRuleResourceBundle(bundlePath).rule.content).toBe("# Rules\n");
    fs.rmSync(getRulesDir(), { recursive: true, force: true });
    ruleDb.reconcileCanonicalWorkspaces();
    const restored = ruleDb.getById("codex-global")!;
    expect(fs.readFileSync(restored.managedPath, "utf8")).toBe("# Rules\n");
    expect(
      fs.readFileSync(ruleDb.getVersions("codex-global")[0].filePath, "utf8"),
    ).toBe("# Rules\n");

    ruleDb.delete("codex-global");
    expect(fs.existsSync(bundlePath)).toBe(false);
  });
});
