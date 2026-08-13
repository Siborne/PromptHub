import fs from "node:fs";
import path from "node:path";

import { RuleDB as BaseRuleDB, type DatabaseAdapter } from "@prompthub/db";
import type {
  RuleFileContent,
  RuleFileId,
  RuleRecord,
  RuleVersionRecord,
  RuleVersionSnapshot,
} from "@prompthub/shared/types";

import {
  publishCanonicalEntries,
  recoverCanonicalEntryPublication,
} from "./canonical-entry-publication";
import { encodeCanonicalResourceDirectory } from "./canonical-resource-path";
import {
  materializeRuleResourceBundle,
  readRuleResourceBundle,
} from "./rule-resource-schema";
import {
  RULE_META_FILE_NAME,
  RULE_VERSION_INDEX_FILE_NAME,
  encodeRuleId,
  ruleGroupForKnownId,
  type StoredRuleMeta,
  type StoredRuleVersionIndexEntry,
} from "./rules-workspace-support";
import {
  getDataDir,
  getRulesDir,
  getRuntimeStorageContext,
  getUserDataPath,
} from "./runtime-paths";

const OPERATION_KEY = "rule-library";
const reconciledRuleDatabases = new WeakSet<DatabaseAdapter.Database>();

interface RuleSnapshot {
  rule: RuleRecord | null;
  versions: RuleVersionRecord[];
}

function bundlePath(ruleId: string): string {
  return path.join(
    getDataDir(),
    "rules",
    encodeCanonicalResourceDirectory(ruleId),
  );
}

function managedPath(record: RuleRecord): string {
  return record.scope === "project"
    ? path.join(
        getRulesDir(),
        "projects",
        encodeCanonicalResourceDirectory(record.id.slice("project:".length)),
        record.canonicalFileName,
      )
    : path.join(
        getRulesDir(),
        "global",
        record.platformId,
        record.canonicalFileName,
      );
}

function versionDirectory(ruleId: RuleFileId): string {
  return path.join(getRulesDir(), ".versions", encodeRuleId(ruleId));
}

function readVersionSnapshots(
  versions: readonly RuleVersionRecord[],
): RuleVersionSnapshot[] {
  return [...versions]
    .sort((left, right) => left.version - right.version)
    .map((version) => ({
      id: version.id,
      savedAt: version.createdAt,
      source: version.source,
      content: fs.readFileSync(version.filePath, "utf8"),
    }));
}

function toRuleContent(
  record: RuleRecord,
  versions: readonly RuleVersionRecord[],
): RuleFileContent {
  const snapshots = readVersionSnapshots(versions);
  const content = fs.readFileSync(record.managedPath, "utf8");
  return {
    id: record.id,
    platformId: record.platformId,
    platformName: record.platformName,
    platformIcon: record.platformIcon,
    platformDescription: record.platformDescription,
    name: record.canonicalFileName,
    description: record.description,
    path: record.targetPath,
    exists: true,
    group: ruleGroupForKnownId(record.id),
    managedPath: record.managedPath,
    targetPath: record.targetPath,
    projectRootPath: record.projectRootPath,
    syncStatus: record.syncStatus,
    content,
    versions: snapshots,
  };
}

function publishRule(
  record: RuleRecord,
  versions: readonly RuleVersionRecord[],
): void {
  if (versions.length === 0) return;
  const targetPath = bundlePath(record.id);
  const current = fs.existsSync(targetPath)
    ? readRuleResourceBundle(targetPath)
    : null;
  publishCanonicalEntries({
    rootPath: getUserDataPath(),
    operationKey: OPERATION_KEY,
    entries: [
      {
        targetPath,
        prepare(stagePath) {
          materializeRuleResourceBundle({
            bundlePath: stagePath,
            rule: toRuleContent(record, versions),
            writePolicy: {
              mode: "create",
              revision: (current?.bundleManifest.revision ?? 0) + 1,
            },
          });
        },
      },
    ],
    verify() {
      const restored = readRuleResourceBundle(targetPath).rule;
      const expected = toRuleContent(record, versions);
      if (
        restored.content !== expected.content ||
        JSON.stringify(restored.versions) !== JSON.stringify(expected.versions)
      )
        throw new Error("Canonical Rule publication verification failed");
    },
  });
}

function deleteRuleBundle(ruleId: string): void {
  recoverCanonicalEntryPublication(getUserDataPath(), OPERATION_KEY);
  const targetPath = bundlePath(ruleId);
  if (fs.existsSync(targetPath)) {
    publishCanonicalEntries({
      rootPath: getUserDataPath(),
      operationKey: OPERATION_KEY,
      entries: [{ targetPath, delete: true }],
    });
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function hydrateWorkspace(
  record: RuleRecord,
  resource = readRuleResourceBundle(bundlePath(record.id)),
): { managedPath: string; versions: RuleVersionRecord[] } {
  const targetManagedPath = managedPath(record);
  const containerPath = path.dirname(targetManagedPath);
  const stagePath = `${containerPath}.stage-${process.pid}`;
  fs.rmSync(stagePath, { recursive: true, force: true });
  fs.mkdirSync(stagePath, { recursive: true, mode: 0o700 });
  try {
    const stagedManagedPath = path.join(stagePath, record.canonicalFileName);
    fs.writeFileSync(stagedManagedPath, resource.rule.content, {
      encoding: "utf8",
      mode: 0o600,
    });
    const meta: StoredRuleMeta = {
      id: record.id,
      scope: record.scope,
      platformId: record.platformId,
      platformName: record.platformName,
      platformIcon: record.platformIcon,
      platformDescription: record.platformDescription,
      canonicalFileName: record.canonicalFileName,
      description: record.description,
      managedPath: targetManagedPath,
      targetPath: record.targetPath,
      projectRootPath: record.projectRootPath,
      syncStatus: record.syncStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    writeJson(path.join(stagePath, RULE_META_FILE_NAME), meta);
    fs.rmSync(containerPath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(containerPath), { recursive: true, mode: 0o700 });
    fs.renameSync(stagePath, containerPath);
  } finally {
    fs.rmSync(stagePath, { recursive: true, force: true });
  }

  const versionDir = versionDirectory(record.id);
  const versionStage = `${versionDir}.stage-${process.pid}`;
  fs.rmSync(versionStage, { recursive: true, force: true });
  fs.mkdirSync(versionStage, { recursive: true, mode: 0o700 });
  const versionRecords: RuleVersionRecord[] = [];
  const index: StoredRuleVersionIndexEntry[] = [];
  try {
    for (const [position, version] of resource.rule.versions.entries()) {
      const fileName = `${String(position + 1).padStart(4, "0")}.md`;
      const finalFilePath = path.join(versionDir, fileName);
      fs.writeFileSync(path.join(versionStage, fileName), version.content, {
        encoding: "utf8",
        mode: 0o600,
      });
      index.push({
        id: version.id,
        savedAt: version.savedAt,
        source: version.source,
        fileName,
      });
      versionRecords.push({
        id: version.id,
        ruleId: record.id,
        version: position + 1,
        filePath: finalFilePath,
        source: version.source,
        createdAt: version.savedAt,
      });
    }
    writeJson(path.join(versionStage, RULE_VERSION_INDEX_FILE_NAME), index);
    fs.rmSync(versionDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(versionDir), { recursive: true, mode: 0o700 });
    fs.renameSync(versionStage, versionDir);
  } finally {
    fs.rmSync(versionStage, { recursive: true, force: true });
  }
  return { managedPath: targetManagedPath, versions: versionRecords };
}

export class CanonicalRuleDB extends BaseRuleDB {
  private pending = new Map<string, RuleSnapshot>();

  constructor(db: DatabaseAdapter.Database) {
    super(db);
  }

  private canonical(): boolean {
    return getRuntimeStorageContext().localAuthority === "canonical-files";
  }

  private snapshot(ruleId: string): RuleSnapshot {
    return { rule: super.getById(ruleId), versions: super.getVersions(ruleId) };
  }

  private restore(snapshot: RuleSnapshot, ruleId: string): void {
    super.delete(ruleId);
    if (snapshot.rule) {
      super.upsert(snapshot.rule);
      super.replaceVersions(ruleId, snapshot.versions);
      if (fs.existsSync(bundlePath(ruleId))) {
        const hydrated = hydrateWorkspace(snapshot.rule);
        this.db
          .prepare("UPDATE rules SET managed_path = ? WHERE id = ?")
          .run(hydrated.managedPath, ruleId);
        super.replaceVersions(ruleId, hydrated.versions);
      }
    }
  }

  override upsert(rule: RuleRecord): void {
    if (this.canonical() && !this.pending.has(rule.id))
      this.pending.set(rule.id, this.snapshot(rule.id));
    super.upsert(rule);
  }

  override replaceVersions(
    ruleId: string,
    versions: RuleVersionRecord[],
  ): void {
    if (!this.canonical()) return super.replaceVersions(ruleId, versions);
    const before = this.pending.get(ruleId) ?? this.snapshot(ruleId);
    try {
      super.replaceVersions(ruleId, versions);
      const record = super.getById(ruleId);
      if (record) publishRule(record, super.getVersions(ruleId));
      this.pending.delete(ruleId);
    } catch (error) {
      this.pending.delete(ruleId);
      this.restore(before, ruleId);
      throw error;
    }
  }

  override delete(id: string): void {
    if (!this.canonical()) return super.delete(id);
    const before = this.snapshot(id);
    try {
      super.delete(id);
      deleteRuleBundle(id);
      if (before.rule)
        fs.rmSync(path.dirname(managedPath(before.rule)), {
          recursive: true,
          force: true,
        });
      if (before.rule)
        fs.rmSync(versionDirectory(before.rule.id), {
          recursive: true,
          force: true,
        });
    } catch (error) {
      this.restore(before, id);
      throw error;
    }
  }

  reconcileCanonicalWorkspaces(): void {
    if (!this.canonical() || reconciledRuleDatabases.has(this.db)) return;
    try {
      for (const record of super.getAll()) {
        if (!fs.existsSync(bundlePath(record.id))) continue;
        const hydrated = hydrateWorkspace(record);
        this.db.transaction(() => {
          this.db
            .prepare("UPDATE rules SET managed_path = ? WHERE id = ?")
            .run(hydrated.managedPath, record.id);
          super.replaceVersions(record.id, hydrated.versions);
        })();
      }
      reconciledRuleDatabases.add(this.db);
    } catch (error) {
      reconciledRuleDatabases.delete(this.db);
      throw error;
    }
  }
}
