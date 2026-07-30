import { v4 as uuidv4 } from "uuid";
import type {
  AgentSessionIndexListInput,
  AgentSessionIndexListResult,
  AgentSessionIndexRecord,
  AgentSessionIndexStatus,
  AgentSessionScanCommitResult,
  AgentSessionScanRecordInput,
  AgentSessionSource,
  AgentSessionSourceScanStatus,
  CommitAgentSessionScanInput,
  RecordAgentSessionScanFailureInput,
  RegisterAgentSessionSourceInput,
  UpdateAgentSessionAnnotationsInput,
} from "@prompthub/shared";
import Database from "./adapter";

interface AgentSessionSourceRow {
  id: string;
  platform_id: string;
  root_path: string;
  adapter_id: string;
  adapter_version: string;
  enabled: number;
  scan_cursor: string | null;
  last_status: AgentSessionSourceScanStatus;
  last_scanned_at: number | null;
  last_error_code: string | null;
  created_at: number;
  updated_at: number;
}

interface AgentSessionIndexRow {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  project_path: string | null;
  created_at: number | null;
  updated_at: number | null;
  model: string | null;
  message_count: number | null;
  redacted_preview: string | null;
  source_path: string;
  source_mtime_ms: number | null;
  source_size_bytes: number | null;
  source_digest: string | null;
  source_status: AgentSessionIndexStatus;
  tags_json: string;
  note: string | null;
  indexed_at: number;
  annotation_updated_at: number | null;
}

interface NormalizedScanRecord {
  externalId: string;
  title: string;
  projectPath: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  model: string | null;
  messageCount: number | null;
  redactedPreview: string | null;
  sourcePath: string;
  sourceMtimeMs: number | null;
  sourceSizeBytes: number | null;
  sourceDigest: string | null;
  sourceStatus: AgentSessionIndexStatus;
}

const MAX_SOURCE_ROOT_LENGTH = 4096;
const MAX_SOURCE_PATH_LENGTH = 4096;
const MAX_CURSOR_LENGTH = 65_536;
const MAX_PREVIEW_LENGTH = 2048;
const MAX_NOTE_LENGTH = 4096;
const MAX_TAGS = 32;
const MAX_TAG_LENGTH = 128;
const MAX_SCAN_RECORDS = 10_000;
const MAX_BACKUP_SOURCE_ROWS = 128;
const MAX_PAGE_SIZE = 200;
const MAX_OFFSET = 1_000_000;
const SESSION_STATUSES = new Set<AgentSessionIndexStatus>([
  "present",
  "missing",
  "parse-error",
]);

function boundedText(value: string, field: string, maximum: number): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || normalized.includes("\0")) {
    throw new Error(`${field} is invalid`);
  }
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  maximum: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.includes("\0")) {
    throw new Error(`${field} is invalid`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maximum) throw new Error(`${field} is invalid`);
  return normalized;
}

function finiteTimestamp(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite`);
  return value;
}

function nonNegativeTimestamp(
  value: number | null | undefined,
  field: string,
): number | null {
  const normalized = finiteTimestamp(value, field);
  if (
    normalized !== null &&
    (!Number.isSafeInteger(normalized) || normalized < 0)
  ) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return normalized;
}

function nonNegativeInteger(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function normalizeScanRecord(
  record: AgentSessionScanRecordInput,
): NormalizedScanRecord {
  if (!SESSION_STATUSES.has(record.sourceStatus)) {
    throw new Error("sourceStatus is invalid");
  }
  return {
    externalId: boundedText(record.externalId, "externalId", 512),
    title: boundedText(record.title, "title", 1024),
    projectPath: optionalText(
      record.projectPath,
      "projectPath",
      MAX_SOURCE_PATH_LENGTH,
    ),
    createdAt: nonNegativeTimestamp(record.createdAt, "createdAt"),
    updatedAt: nonNegativeTimestamp(record.updatedAt, "updatedAt"),
    model: optionalText(record.model, "model", 512),
    messageCount: nonNegativeInteger(record.messageCount, "messageCount"),
    redactedPreview: optionalText(
      record.redactedPreview,
      "redactedPreview",
      MAX_PREVIEW_LENGTH,
    ),
    sourcePath: boundedText(
      record.sourcePath,
      "sourcePath",
      MAX_SOURCE_PATH_LENGTH,
    ),
    sourceMtimeMs: nonNegativeTimestamp(record.sourceMtimeMs, "sourceMtimeMs"),
    sourceSizeBytes: nonNegativeInteger(
      record.sourceSizeBytes,
      "sourceSizeBytes",
    ),
    sourceDigest: optionalText(record.sourceDigest, "sourceDigest", 256),
    sourceStatus: record.sourceStatus,
  };
}

function normalizeScanRecords(
  records: AgentSessionScanRecordInput[],
): NormalizedScanRecord[] {
  if (!Array.isArray(records)) throw new Error("records must be an array");
  if (records.length > MAX_SCAN_RECORDS) {
    throw new Error(`records exceeds ${MAX_SCAN_RECORDS}`);
  }
  const seen = new Set<string>();
  return records.map((record) => {
    const normalized = normalizeScanRecord(record);
    if (seen.has(normalized.externalId)) {
      throw new Error(`Duplicate externalId: ${normalized.externalId}`);
    }
    seen.add(normalized.externalId);
    return normalized;
  });
}

function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
    throw new Error("tags are invalid");
  }
  const normalized = tags.map((tag) => boundedText(tag, "tag", MAX_TAG_LENGTH));
  return [...new Set(normalized)];
}

function parseTags(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((tag) => typeof tag !== "string")) {
    throw new Error("Invalid session tags in database");
  }
  return parsed;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export class AgentSessionIndexDB {
  constructor(private readonly db: Database.Database) {}

  registerSource(input: RegisterAgentSessionSourceInput): AgentSessionSource {
    const platformId = boundedText(input.platformId, "platformId", 128);
    const rootPath = boundedText(
      input.rootPath,
      "rootPath",
      MAX_SOURCE_ROOT_LENGTH,
    );
    const adapterId = boundedText(input.adapterId, "adapterId", 128);
    const adapterVersion = boundedText(
      input.adapterVersion,
      "adapterVersion",
      128,
    );
    const existing = this.findSource(platformId, rootPath, adapterId);
    const now = existing
      ? Math.max(Date.now(), existing.updatedAt + 1)
      : Date.now();
    if (!existing) {
      const id = uuidv4();
      this.db.run(
        `INSERT INTO agent_session_sources (
          id, platform_id, root_path, adapter_id, adapter_version, enabled,
          last_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'idle', ?, ?)`,
        id,
        platformId,
        rootPath,
        adapterId,
        adapterVersion,
        input.enabled === false ? 0 : 1,
        now,
        now,
      );
      return this.getRequiredSource(id);
    }
    this.db.run(
      `UPDATE agent_session_sources
       SET adapter_version = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
      adapterVersion,
      input.enabled === false ? 0 : 1,
      now,
      existing.id,
    );
    return this.getRequiredSource(existing.id);
  }

  getSource(id: string): AgentSessionSource | null {
    const row = this.db.get(
      "SELECT * FROM agent_session_sources WHERE id = ?",
      boundedText(id, "sourceId", 128),
    ) as AgentSessionSourceRow | undefined;
    return row ? this.sourceFromRow(row) : null;
  }

  listSources(options: { platformId?: string } = {}): AgentSessionSource[] {
    const rows = options.platformId
      ? (this.db.all(
          `SELECT * FROM agent_session_sources
           WHERE platform_id = ?
           ORDER BY updated_at DESC, id ASC`,
          boundedText(options.platformId, "platformId", 128),
        ) as AgentSessionSourceRow[])
      : (this.db.all(
          `SELECT * FROM agent_session_sources
           ORDER BY updated_at DESC, id ASC`,
        ) as AgentSessionSourceRow[]);
    return rows.map((row) => this.sourceFromRow(row));
  }

  listSourcesForBackup(limit = MAX_BACKUP_SOURCE_ROWS): AgentSessionSource[] {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_BACKUP_SOURCE_ROWS
    ) {
      throw new Error(
        `Session source backup limit must be between 1 and ${MAX_BACKUP_SOURCE_ROWS}`,
      );
    }
    const rows = this.db.all(
      `SELECT * FROM agent_session_sources
       ORDER BY updated_at DESC, id ASC
       LIMIT ?`,
      limit + 1,
    ) as AgentSessionSourceRow[];
    if (rows.length > limit) {
      throw new Error(`Session source backup exceeds ${limit}`);
    }
    return rows.map((row) => this.sourceFromRow(row));
  }

  removeSource(id: string): boolean {
    return (
      this.db.run(
        "DELETE FROM agent_session_sources WHERE id = ?",
        boundedText(id, "sourceId", 128),
      ).changes === 1
    );
  }

  commitScan(input: CommitAgentSessionScanInput): AgentSessionScanCommitResult {
    const sourceId = boundedText(input.sourceId, "sourceId", 128);
    const adapterVersion = boundedText(
      input.adapterVersion,
      "adapterVersion",
      128,
    );
    const scannedAt = nonNegativeTimestamp(input.scannedAt, "scannedAt");
    if (scannedAt === null) throw new Error("scannedAt is required");
    if (input.mode !== "full" && input.mode !== "incremental") {
      throw new Error("mode is invalid");
    }
    if (input.status !== "ok" && input.status !== "partial") {
      throw new Error("status is invalid");
    }
    const cursor = optionalText(
      input.scanCursor,
      "scanCursor",
      MAX_CURSOR_LENGTH,
    );
    const records = normalizeScanRecords(input.records);
    this.getRequiredSource(sourceId);

    return this.db.transaction(() => {
      if (input.mode === "full") {
        this.db.run(
          `UPDATE agent_session_index
           SET source_status = 'missing', indexed_at = ?
           WHERE source_id = ?`,
          scannedAt,
          sourceId,
        );
      }
      for (const record of records) {
        this.upsertSession(sourceId, record, scannedAt);
      }
      this.updateSourceAfterScan(
        sourceId,
        adapterVersion,
        cursor,
        input.status,
        scannedAt,
      );
      return {
        source: this.getRequiredSource(sourceId),
        changedCount: records.length,
      };
    })();
  }

  recordScanFailure(
    input: RecordAgentSessionScanFailureInput,
  ): AgentSessionSource {
    const source = this.getRequiredSource(
      boundedText(input.sourceId, "sourceId", 128),
    );
    const scannedAt = nonNegativeTimestamp(input.scannedAt, "scannedAt");
    if (scannedAt === null) throw new Error("scannedAt is required");
    const errorCode = boundedText(input.errorCode, "errorCode", 128);
    if (!/^[A-Z][A-Z0-9_:-]*$/.test(errorCode)) {
      throw new Error("errorCode must be stable");
    }
    const updatedAt = Math.max(Date.now(), source.updatedAt + 1);
    this.db.run(
      `UPDATE agent_session_sources
       SET last_status = 'error', last_scanned_at = ?, last_error_code = ?,
           updated_at = ?
       WHERE id = ?`,
      scannedAt,
      errorCode,
      updatedAt,
      source.id,
    );
    return this.getRequiredSource(source.id);
  }

  getSession(id: string): AgentSessionIndexRecord | null {
    const row = this.db.get(
      "SELECT * FROM agent_session_index WHERE id = ?",
      boundedText(id, "sessionId", 128),
    ) as AgentSessionIndexRow | undefined;
    return row ? this.sessionFromRow(row) : null;
  }

  getSessionByExternalId(
    sourceId: string,
    externalId: string,
  ): AgentSessionIndexRecord | null {
    const row = this.db.get(
      `SELECT * FROM agent_session_index
       WHERE source_id = ? AND external_id = ?`,
      boundedText(sourceId, "sourceId", 128),
      boundedText(externalId, "externalId", 512),
    ) as AgentSessionIndexRow | undefined;
    return row ? this.sessionFromRow(row) : null;
  }

  listSessions(input: AgentSessionIndexListInput): AgentSessionIndexListResult {
    const sourceId = boundedText(input.sourceId, "sourceId", 128);
    const limit = Math.min(
      Math.max(nonNegativeInteger(input.limit, "limit") || 1, 1),
      MAX_PAGE_SIZE,
    );
    const offset = Math.min(
      nonNegativeInteger(input.offset, "offset") || 0,
      MAX_OFFSET,
    );
    const where = ["source_id = ?"];
    const params: unknown[] = [sourceId];
    this.appendStatusFilter(input.statuses, where, params);
    this.appendSearchFilter(input.search, where, params);
    const predicate = where.join(" AND ");
    const totalRow = this.db.get(
      `SELECT COUNT(*) AS count FROM agent_session_index WHERE ${predicate}`,
      ...params,
    ) as { count: number };
    const rows = this.db.all(
      `SELECT * FROM agent_session_index
       WHERE ${predicate}
       ORDER BY COALESCE(updated_at, created_at, 0) DESC, external_id ASC
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ) as AgentSessionIndexRow[];
    return {
      items: rows.map((row) => this.sessionFromRow(row)),
      total: totalRow.count,
      hasMore: offset + rows.length < totalRow.count,
    };
  }

  updateAnnotations(
    id: string,
    input: UpdateAgentSessionAnnotationsInput,
  ): AgentSessionIndexRecord {
    const existing = this.getRequiredSession(boundedText(id, "sessionId", 128));
    const tags = normalizeTags(input.tags);
    const note = optionalText(input.note, "note", MAX_NOTE_LENGTH);
    const annotationUpdatedAt = Math.max(
      Date.now(),
      (existing.annotationUpdatedAt || 0) + 1,
    );
    this.db.run(
      `UPDATE agent_session_index
       SET tags_json = ?, note = ?, annotation_updated_at = ?
       WHERE id = ?`,
      JSON.stringify(tags),
      note,
      annotationUpdatedAt,
      existing.id,
    );
    return this.getRequiredSession(existing.id);
  }

  private findSource(
    platformId: string,
    rootPath: string,
    adapterId: string,
  ): AgentSessionSource | null {
    const row = this.db.get(
      `SELECT * FROM agent_session_sources
       WHERE platform_id = ? AND root_path = ? AND adapter_id = ?`,
      platformId,
      rootPath,
      adapterId,
    ) as AgentSessionSourceRow | undefined;
    return row ? this.sourceFromRow(row) : null;
  }

  private getRequiredSource(id: string): AgentSessionSource {
    const source = this.getSource(id);
    if (!source) throw new Error(`Agent session source not found: ${id}`);
    return source;
  }

  private getRequiredSession(id: string): AgentSessionIndexRecord {
    const session = this.getSession(id);
    if (!session) throw new Error(`Agent session not found: ${id}`);
    return session;
  }

  private updateSourceAfterScan(
    sourceId: string,
    adapterVersion: string,
    cursor: string | null,
    status: "ok" | "partial",
    scannedAt: number,
  ): void {
    const source = this.getRequiredSource(sourceId);
    const updatedAt = Math.max(Date.now(), source.updatedAt + 1);
    this.db.run(
      `UPDATE agent_session_sources
       SET adapter_version = ?, scan_cursor = ?, last_status = ?,
           last_scanned_at = ?, last_error_code = NULL, updated_at = ?
       WHERE id = ?`,
      adapterVersion,
      cursor,
      status,
      scannedAt,
      updatedAt,
      sourceId,
    );
  }

  private upsertSession(
    sourceId: string,
    record: NormalizedScanRecord,
    scannedAt: number,
  ): void {
    this.db.run(
      `INSERT INTO agent_session_index (
        id, source_id, external_id, title, project_path, created_at, updated_at,
        model, message_count, redacted_preview, source_path, source_mtime_ms,
        source_size_bytes, source_digest, source_status, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, external_id) DO UPDATE SET
        title = excluded.title,
        project_path = excluded.project_path,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        model = excluded.model,
        message_count = excluded.message_count,
        redacted_preview = excluded.redacted_preview,
        source_path = excluded.source_path,
        source_mtime_ms = excluded.source_mtime_ms,
        source_size_bytes = excluded.source_size_bytes,
        source_digest = excluded.source_digest,
        source_status = excluded.source_status,
        indexed_at = excluded.indexed_at`,
      uuidv4(),
      sourceId,
      record.externalId,
      record.title,
      record.projectPath,
      record.createdAt,
      record.updatedAt,
      record.model,
      record.messageCount,
      record.redactedPreview,
      record.sourcePath,
      record.sourceMtimeMs,
      record.sourceSizeBytes,
      record.sourceDigest,
      record.sourceStatus,
      scannedAt,
    );
  }

  private appendStatusFilter(
    statuses: AgentSessionIndexStatus[] | undefined,
    where: string[],
    params: unknown[],
  ): void {
    if (statuses === undefined) return;
    if (
      !Array.isArray(statuses) ||
      statuses.length === 0 ||
      statuses.some((status) => !SESSION_STATUSES.has(status))
    ) {
      throw new Error("statuses are invalid");
    }
    const unique = [...new Set(statuses)];
    where.push(`source_status IN (${unique.map(() => "?").join(", ")})`);
    params.push(...unique);
  }

  private appendSearchFilter(
    search: string | undefined,
    where: string[],
    params: unknown[],
  ): void {
    const normalized = optionalText(search, "search", 512);
    if (!normalized) return;
    const query = `%${escapeLike(normalized.toLocaleLowerCase())}%`;
    where.push(
      `(LOWER(title) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(project_path, '')) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(redacted_preview, '')) LIKE ? ESCAPE '\\')`,
    );
    params.push(query, query, query);
  }

  private sourceFromRow(row: AgentSessionSourceRow): AgentSessionSource {
    return {
      id: row.id,
      platformId: row.platform_id,
      rootPath: row.root_path,
      adapterId: row.adapter_id,
      adapterVersion: row.adapter_version,
      enabled: row.enabled === 1,
      scanCursor: row.scan_cursor,
      lastStatus: row.last_status,
      lastScannedAt: row.last_scanned_at,
      lastErrorCode: row.last_error_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private sessionFromRow(row: AgentSessionIndexRow): AgentSessionIndexRecord {
    return {
      id: row.id,
      sourceId: row.source_id,
      externalId: row.external_id,
      title: row.title,
      projectPath: row.project_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      model: row.model,
      messageCount: row.message_count,
      redactedPreview: row.redacted_preview,
      sourcePath: row.source_path,
      sourceMtimeMs: row.source_mtime_ms,
      sourceSizeBytes: row.source_size_bytes,
      sourceDigest: row.source_digest,
      sourceStatus: row.source_status,
      tags: parseTags(row.tags_json),
      note: row.note,
      indexedAt: row.indexed_at,
      annotationUpdatedAt: row.annotation_updated_at,
    };
  }
}
