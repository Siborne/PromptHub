import fs from "node:fs/promises";
import path from "node:path";

import type {
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import Database from "../database/sqlite";
import {
  boundedSessionText,
  isPathInside,
  isSafeSessionId,
  isSessionRecord,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "hermes-state-db-v1";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const MAX_VISIBLE_TEXT = 64 * 1024;

const VISIBLE_CONTENT_SQL = `CASE
  WHEN json_valid(m.content) AND json_type(m.content) = 'array' THEN
    (SELECT group_concat(
       COALESCE(json_extract(part.value, '$.text'),
                json_extract(part.value, '$.content'),
                CASE WHEN json_type(part.value) = 'text' THEN part.value END),
       char(10)) FROM json_each(m.content) part)
  WHEN json_valid(m.content) AND json_type(m.content) = 'object' THEN
    COALESCE(json_extract(m.content, '$.text'),
             json_extract(m.content, '$.content'))
  WHEN json_valid(m.content) AND json_type(m.content) = 'text' THEN
    json_extract(m.content, '$')
  ELSE m.content END`;

interface HermesSessionRow {
  id?: unknown;
  title?: unknown;
  model?: unknown;
  started_at?: unknown;
  updated_at?: unknown;
  message_count?: unknown;
  cwd?: unknown;
  git_repo_root?: unknown;
  size_bytes?: unknown;
}

interface HermesMessageRow {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
  content_truncated?: unknown;
}

function isMissing(error: unknown): boolean {
  return isSessionRecord(error) && "code" in error && error.code === "ENOENT";
}

function detailPageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  }
  return limit;
}

function validProjectPath(value: unknown): string | null {
  const candidate = sessionString(value);
  return candidate && path.isAbsolute(candidate) && !candidate.includes("\0")
    ? candidate
    : null;
}

function parseSession(
  value: unknown,
  sourcePath: string,
): AgentSessionMetadata | null {
  if (!isSessionRecord(value)) return null;
  const row = value as HermesSessionRow;
  const id = sessionString(row.id);
  if (!id || !isSafeSessionId(id)) return null;
  const projectPath =
    validProjectPath(row.git_repo_root) || validProjectPath(row.cwd);
  const messageCount =
    typeof row.message_count === "number" && row.message_count >= 0
      ? row.message_count
      : null;
  return {
    id,
    title: boundedSessionText(row.title) || id,
    projectLabel: projectPath
      ? path.basename(projectPath) || projectPath
      : null,
    projectPath,
    createdAt: sessionTimestamp(row.started_at),
    updatedAt: sessionTimestamp(row.updated_at),
    model: sessionString(row.model),
    messageCount,
    sizeBytes:
      typeof row.size_bytes === "number" ? Math.max(0, row.size_bytes) : null,
    sourcePath,
    resume: {
      executable: "hermes",
      args: ["--resume", id],
      ...(projectPath ? { cwd: projectPath } : {}),
    },
  };
}

function parseMessage(value: unknown): AgentSessionEntry | null {
  if (!isSessionRecord(value)) return null;
  const row = value as HermesMessageRow;
  const id = typeof row.id === "number" ? row.id : null;
  const role = sessionString(row.role)?.toLocaleLowerCase();
  const text = boundedSessionText(row.content);
  if (id === null || !text || (role !== "user" && role !== "assistant")) {
    return null;
  }
  return {
    id: String(id),
    role,
    timestamp: sessionTimestamp(row.timestamp),
    text,
  };
}

async function resolveStore(rootPath: string): Promise<string | null> {
  const candidate = path.join(rootPath, "state.db");
  const stat = await fs.lstat(candidate).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  const [realRoot, realStore] = await Promise.all([
    fs.realpath(rootPath),
    fs.realpath(candidate),
  ]);
  if (!isPathInside(realRoot, realStore)) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  return realStore;
}

function tableColumns(database: Database.Database, table: string): Set<string> {
  return new Set(
    database
      .all(`PRAGMA table_info("${table}")`)
      .flatMap((row) =>
        isSessionRecord(row) && typeof row.name === "string" ? [row.name] : [],
      ),
  );
}

function validateSchema(database: Database.Database): void {
  const sessions = tableColumns(database, "sessions");
  const messages = tableColumns(database, "messages");
  const requiredSessions = [
    "id",
    "source",
    "model",
    "started_at",
    "cwd",
    "git_repo_root",
    "title",
  ];
  const requiredMessages = [
    "id",
    "session_id",
    "role",
    "content",
    "timestamp",
    "reasoning",
    "active",
  ];
  if (
    requiredSessions.some((column) => !sessions.has(column)) ||
    requiredMessages.some((column) => !messages.has(column))
  ) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
}

async function sourceRevision(sourcePath: string): Promise<string> {
  const stats = await Promise.all(
    [sourcePath, `${sourcePath}-wal`].map(async (candidate) => {
      const stat = await fs.stat(candidate).catch(() => null);
      return stat ? `${stat.size}:${stat.mtimeMs}` : "missing";
    }),
  );
  return stats.join(":");
}

async function withStore<T>(
  rootPath: string,
  empty: T,
  operation: (
    database: Database.Database,
    sourcePath: string,
    revision: string,
  ) => T,
): Promise<T> {
  const sourcePath = await resolveStore(rootPath);
  if (!sourcePath) return empty;
  const revision = await sourceRevision(sourcePath);
  let database: Database.Database;
  try {
    database = new Database(sourcePath, { readOnly: true });
    validateSchema(database);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AGENT_SESSION_STORE_INVALID"
    ) {
      throw error;
    }
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  try {
    return operation(database, sourcePath, revision);
  } finally {
    database.close();
  }
}

function sessionWhere(search?: string): { sql: string; args: string[] } {
  const query = search?.trim().toLocaleLowerCase();
  if (!query) return { sql: "", args: [] };
  return {
    sql: `WHERE instr(lower(COALESCE(s.title, '')), ?) > 0
       OR instr(lower(COALESCE(s.id, '')), ?) > 0
       OR instr(lower(COALESCE(s.cwd, '')), ?) > 0
       OR instr(lower(COALESCE(s.git_repo_root, '')), ?) > 0
       OR EXISTS (
         SELECT 1 FROM messages m
          WHERE m.session_id = s.id
            AND m.active = 1
            AND lower(m.role) IN ('user', 'assistant')
            AND instr(lower(COALESCE(${VISIBLE_CONTENT_SQL}, '')), ?) > 0
       )`,
    args: [query, query, query, query, query],
  };
}

function readListPage(
  database: Database.Database,
  sourcePath: string,
  limit: number,
  offset: number,
  search?: string,
): { sessions: AgentSessionMetadata[]; total: number } {
  const where = sessionWhere(search);
  const totalRow = database.get(
    `SELECT COUNT(*) AS total FROM sessions s ${where.sql}`,
    ...where.args,
  );
  const rows = database.all(
    `SELECT s.id, s.title, s.model, s.started_at,
            COALESCE(s.ended_at,
              (SELECT MAX(m.timestamp) FROM messages m
                WHERE m.session_id = s.id AND m.active = 1),
              s.started_at) AS updated_at,
            s.cwd, s.git_repo_root,
            (SELECT COUNT(*) FROM messages m
              WHERE m.session_id = s.id AND m.active = 1
                AND lower(m.role) IN ('user', 'assistant')
                AND trim(COALESCE(${VISIBLE_CONTENT_SQL}, '')) <> '') AS message_count,
            length(CAST(COALESCE(s.id, '') AS BLOB))
              + length(CAST(COALESCE(s.title, '') AS BLOB))
              + length(CAST(COALESCE(s.model, '') AS BLOB))
              + length(CAST(COALESCE(s.cwd, '') AS BLOB))
              + length(CAST(COALESCE(s.git_repo_root, '') AS BLOB))
              + COALESCE((SELECT SUM(
                  length(CAST(COALESCE(m.content, '') AS BLOB))
                  + length(CAST(COALESCE(m.tool_calls, '') AS BLOB))
                  + length(CAST(COALESCE(m.reasoning, '') AS BLOB))
                  + length(CAST(COALESCE(m.reasoning_content, '') AS BLOB))
                ) FROM messages m WHERE m.session_id = s.id), 0)
              AS size_bytes
       FROM sessions s ${where.sql}
      ORDER BY updated_at DESC, s.started_at DESC, s.id DESC
      LIMIT ? OFFSET ?`,
    ...where.args,
    limit,
    offset,
  ) as unknown[];
  const total =
    isSessionRecord(totalRow) && typeof totalRow.total === "number"
      ? totalRow.total
      : 0;
  return {
    total,
    sessions: rows
      .map((row) => parseSession(row, sourcePath))
      .filter((row): row is AgentSessionMetadata => Boolean(row)),
  };
}

function encodeCursor(
  sessionId: string,
  lastId: number,
  revision: string,
): string {
  return Buffer.from(
    JSON.stringify({ v: 1, sessionId, lastId, revision }),
  ).toString("base64url");
}

function decodeCursor(
  cursor: string | undefined,
  sessionId: string,
  revision: string,
): number {
  if (!cursor) return 0;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  if (
    !isSessionRecord(value) ||
    value.v !== 1 ||
    value.sessionId !== sessionId ||
    !Number.isSafeInteger(value.lastId) ||
    (value.lastId as number) < 0 ||
    typeof value.revision !== "string"
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  if (value.revision !== revision) {
    throw new Error("AGENT_SESSION_CURSOR_STALE");
  }
  return value.lastId as number;
}

function readDetail(
  database: Database.Database,
  sessionId: string,
  input: AgentSessionDetailPageInput,
  revision: string,
): AgentSessionDetail {
  if (!database.get("SELECT id FROM sessions WHERE id = ?", sessionId)) {
    throw new Error("AGENT_SESSION_NOT_FOUND");
  }
  const start = decodeCursor(input.cursor, sessionId, revision);
  const limit = detailPageSize(input);
  const rows = database.all(
    `WITH visible_message AS (
       SELECT m.id, m.role, m.timestamp, ${VISIBLE_CONTENT_SQL} AS content
         FROM messages m
        WHERE m.session_id = ? AND m.id > ? AND m.active = 1
          AND lower(m.role) IN ('user', 'assistant')
     )
     SELECT id, role, substr(content, 1, ?) AS content, timestamp,
            length(content) > ? AS content_truncated
       FROM visible_message WHERE trim(COALESCE(content, '')) <> ''
      ORDER BY id ASC LIMIT ?`,
    sessionId,
    start,
    MAX_VISIBLE_TEXT,
    MAX_VISIBLE_TEXT,
    limit + 1,
  ) as unknown[];
  const pageRows = rows.slice(0, limit);
  const entries = pageRows
    .map(parseMessage)
    .filter((entry): entry is AgentSessionEntry => Boolean(entry));
  const last = pageRows.at(-1) as HermesMessageRow | undefined;
  const lastId = typeof last?.id === "number" ? last.id : start;
  return {
    agentId: "hermes",
    adapter: ADAPTER,
    sessionId,
    entries,
    parseErrors: pageRows.length - entries.length,
    truncated: pageRows.some(
      (row) => isSessionRecord(row) && row.content_truncated === 1,
    ),
    nextCursor:
      rows.length > limit ? encodeCursor(sessionId, lastId, revision) : null,
  };
}

export function createHermesSessionAdapter(rootPath: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const page = await withStore(
        rootPath,
        { sessions: [], total: 0 } as {
          sessions: AgentSessionMetadata[];
          total: number;
        },
        (database, sourcePath) =>
          readListPage(database, sourcePath, limit, offset, search),
      );
      return {
        agentId: "hermes",
        adapter: ADAPTER,
        sessions: page.sessions,
        total: page.total,
        hasMore: page.total > offset + limit,
      };
    },

    async read(
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionId)) {
        throw new Error("AGENT_SESSION_ID_INVALID");
      }
      const detail = await withStore<AgentSessionDetail | null>(
        rootPath,
        null,
        (database, _sourcePath, revision) =>
          readDetail(database, sessionId, input, revision),
      );
      if (!detail) throw new Error("AGENT_SESSION_NOT_FOUND");
      return detail;
    },

    async delete(sessionId: string): Promise<void> {
      if (!isSafeSessionId(sessionId)) {
        throw new Error("AGENT_SESSION_ID_INVALID");
      }
      const sourcePath = await resolveStore(rootPath);
      if (!sourcePath) throw new Error("AGENT_SESSION_NOT_FOUND");
      const database = new Database(sourcePath);
      try {
        validateSchema(database);
        const remove = database.transaction(() => {
          const exists = database.get(
            "SELECT id FROM sessions WHERE id = ? LIMIT 1",
            sessionId,
          );
          if (!exists) throw new Error("AGENT_SESSION_NOT_FOUND");
          database
            .prepare("DELETE FROM messages WHERE session_id = ?")
            .run(sessionId);
          database.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
        });
        remove();
      } finally {
        database.close();
      }
    },
  };
}
