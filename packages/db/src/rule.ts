import Database from "./adapter";
import { isRuleFileId, isRulePlatformId } from "@prompthub/shared";
import type { RuleRecord, RuleVersionRecord } from "@prompthub/shared";

interface RuleRow {
  id: string;
  scope: "global" | "project";
  platform_id: string;
  platform_name: string;
  platform_icon: string;
  platform_description: string;
  canonical_file_name: string;
  description: string;
  managed_path: string;
  target_path: string;
  project_root_path: string | null;
  sync_status: RuleRecord["syncStatus"];
  current_version: number;
  content_hash: string;
  created_at: number;
  updated_at: number;
}

interface RuleVersionRow {
  id: string;
  rule_id: string;
  version: number;
  file_path: string;
  source: RuleVersionRecord["source"];
  created_at: number;
}

export class RuleDB {
  constructor(protected db: Database.Database) {}

  getAll(): RuleRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM rules ORDER BY scope ASC, updated_at DESC")
      .all() as RuleRow[];
    return rows.map((row) => this.rowToRule(row));
  }

  getById(id: string): RuleRecord | null {
    const row = this.db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as
      | RuleRow
      | undefined;
    return row ? this.rowToRule(row) : null;
  }

  upsert(rule: RuleRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO rules (
          id, scope, platform_id, platform_name, platform_icon, platform_description,
          canonical_file_name, description, managed_path, target_path, project_root_path,
          sync_status, current_version, content_hash, created_at, updated_at
        ) VALUES (
          @id, @scope, @platform_id, @platform_name, @platform_icon, @platform_description,
          @canonical_file_name, @description, @managed_path, @target_path, @project_root_path,
          @sync_status, @current_version, @content_hash, @created_at, @updated_at
        )`,
      )
      .run({
        "@id": rule.id,
        "@scope": rule.scope,
        "@platform_id": rule.platformId,
        "@platform_name": rule.platformName,
        "@platform_icon": rule.platformIcon,
        "@platform_description": rule.platformDescription,
        "@canonical_file_name": rule.canonicalFileName,
        "@description": rule.description,
        "@managed_path": rule.managedPath,
        "@target_path": rule.targetPath,
        "@project_root_path": rule.projectRootPath ?? null,
        "@sync_status": rule.syncStatus,
        "@current_version": rule.currentVersion,
        "@content_hash": rule.contentHash,
        "@created_at": new Date(rule.createdAt).getTime(),
        "@updated_at": new Date(rule.updatedAt).getTime(),
      });
  }

  delete(id: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM rule_versions WHERE rule_id = ?").run(id);
      this.db.prepare("DELETE FROM rules WHERE id = ?").run(id);
    });
    transaction();
  }

  replaceVersions(ruleId: string, versions: RuleVersionRecord[]): void {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM rule_versions WHERE rule_id = ?")
        .run(ruleId);
      const stmt = this.db.prepare(
        `INSERT INTO rule_versions (
          id, rule_id, version, file_path, source, created_at
        ) VALUES (
          @id, @rule_id, @version, @file_path, @source, @created_at
        )`,
      );
      for (const version of versions) {
        stmt.run({
          "@id": version.id,
          "@rule_id": version.ruleId,
          "@version": version.version,
          "@file_path": version.filePath,
          "@source": version.source,
          "@created_at": new Date(version.createdAt).getTime(),
        });
      }
    });
    transaction();
  }

  getVersions(ruleId: string): RuleVersionRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM rule_versions WHERE rule_id = ? ORDER BY version DESC",
      )
      .all(ruleId) as RuleVersionRow[];
    return rows.map((row) => this.rowToRuleVersion(row));
  }

  private rowToRule(row: RuleRow): RuleRecord {
    if (!isRuleFileId(row.id)) {
      throw new Error(`Invalid rule id in database: ${row.id}`);
    }

    if (!isRulePlatformId(row.platform_id)) {
      throw new Error(
        `Invalid rule platform id in database: ${row.platform_id}`,
      );
    }

    return {
      id: row.id,
      scope: row.scope,
      platformId: row.platform_id,
      platformName: row.platform_name,
      platformIcon: row.platform_icon,
      platformDescription: row.platform_description,
      canonicalFileName: row.canonical_file_name,
      description: row.description,
      managedPath: row.managed_path,
      targetPath: row.target_path,
      projectRootPath: row.project_root_path ?? null,
      syncStatus: row.sync_status,
      currentVersion: row.current_version,
      contentHash: row.content_hash,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private rowToRuleVersion(row: RuleVersionRow): RuleVersionRecord {
    if (!isRuleFileId(row.rule_id)) {
      throw new Error(
        `Invalid rule version rule id in database: ${row.rule_id}`,
      );
    }

    return {
      id: row.id,
      ruleId: row.rule_id,
      version: row.version,
      filePath: row.file_path,
      source: row.source,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
