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

const CURRENT_ADAPTER = "cherry-agent-session-db-v2";
const LEGACY_ADAPTER = "cherry-agent-session-db-v1";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;

type CherryStoreSchema = "current" | "legacy";

interface CherryStore {
  adapter: string;
  schema: CherryStoreSchema;
  sourcePath: string;
}

interface CherrySessionRow {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  accessible_paths?: unknown;
  workspace_path?: unknown;
  model?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  message_count?: unknown;
  size_bytes?: unknown;
}

interface CherryMessageRow {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  created_at?: unknown;
  content_truncated?: unknown;
}

function isMissing(error: unknown): boolean {
  return isSessionRecord(error) && "code" in error && error.code === "ENOENT";
}

function pageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  }
  return limit;
}

function parseProjectPath(value: unknown): string | null {
  const raw = sessionString(value);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return (
      parsed.find(
        (item): item is string =>
          typeof item === "string" &&
          path.isAbsolute(item) &&
          !item.includes("\0"),
      ) || null
    );
  } catch {
    return null;
  }
}

function parseContent(value: unknown): string {
  const raw = sessionString(value);
  if (!raw) return "";
  try {
    return boundedSessionText(JSON.parse(raw));
  } catch {
    return boundedSessionText(raw);
  }
}

function parseSession(
  value: unknown,
  sourcePath: string,
): AgentSessionMetadata | null {
  if (!isSessionRecord(value)) return null;
  const row = value as CherrySessionRow;
  const id = sessionString(row.id);
  if (!id || !isSafeSessionId(id)) return null;
  const projectPath =
    parseProjectPath(row.accessible_paths) ||
    (path.isAbsolute(sessionString(row.workspace_path) || "")
      ? sessionString(row.workspace_path)
      : null);
  const count =
    typeof row.message_count === "number" && row.message_count > 0
      ? row.message_count
      : null;
  return {
    id,
    title:
      boundedSessionText(row.name) || boundedSessionText(row.description) || id,
    projectLabel: projectPath
      ? path.basename(projectPath) || projectPath
      : null,
    projectPath,
    createdAt: sessionTimestamp(row.created_at),
    updatedAt: sessionTimestamp(row.updated_at),
    model: sessionString(row.model),
    messageCount: count,
    sizeBytes:
      typeof row.size_bytes === "number" ? Math.max(0, row.size_bytes) : null,
    sourcePath,
    resume: null,
  };
}

async function safeStoreFile(
  rootPath: string,
  candidate: string,
): Promise<string | null> {
  const stat = await fs.lstat(candidate).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(rootPath),
    fs.realpath(candidate),
  ]);
  if (!isPathInside(realRoot, realCandidate)) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  return realCandidate;
}

async function resolveStore(rootPath: string): Promise<CherryStore | null> {
  const current = await safeStoreFile(
    rootPath,
    path.join(rootPath, "Data", "cherrystudio.sqlite"),
  );
  if (current) {
    return {
      adapter: CURRENT_ADAPTER,
      schema: "current",
      sourcePath: current,
    };
  }
  const legacy = await safeStoreFile(
    rootPath,
    path.join(rootPath, "Data", "agents.db"),
  );
  return legacy
    ? { adapter: LEGACY_ADAPTER, schema: "legacy", sourcePath: legacy }
    : null;
}

function validateSchema(
  database: Database.Database,
  schema: CherryStoreSchema,
): void {
  const expected =
    schema === "current"
      ? ["agent_session", "agent_session_message", "agent_workspace"]
      : ["sessions", "session_messages"];
  const rows = database.all(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const names = new Set(
    rows.flatMap((row) =>
      isSessionRecord(row) && typeof row.name === "string" ? [row.name] : [],
    ),
  );
  if (expected.some((name) => !names.has(name))) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
}

async function withStore<T>(
  rootPath: string,
  empty: T,
  operation: (
    database: Database.Database,
    store: CherryStore,
    revision: string,
  ) => T,
): Promise<T> {
  const store = await resolveStore(rootPath);
  if (!store) return empty;
  const stat = await fs.stat(store.sourcePath);
  const revision = `${stat.size}:${stat.mtimeMs}`;
  let database: Database.Database;
  try {
    database = new Database(store.sourcePath, { readOnly: true });
    validateSchema(database, store.schema);
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
    return operation(database, store, revision);
  } finally {
    database.close();
  }
}

function currentSessionWhere(search?: string): {
  sql: string;
  args: string[];
} {
  const query = search?.trim().toLocaleLowerCase();
  if (!query) return { sql: "", args: [] };
  return {
    sql: `WHERE instr(lower(COALESCE(s.name, '')), ?) > 0
       OR instr(lower(COALESCE(s.description, '')), ?) > 0
       OR instr(lower(COALESCE(w.path, '')), ?) > 0
       OR EXISTS (
         SELECT 1 FROM agent_session_message m,
           json_each(CASE WHEN json_valid(m.data)
             THEN json_extract(m.data, '$.parts') ELSE '[]' END) part
         WHERE m.session_id = s.id
           AND lower(m.role) IN ('user', 'assistant')
           AND json_extract(part.value, '$.type') = 'text'
           AND instr(lower(COALESCE(json_extract(part.value, '$.text'), '')), ?) > 0
       )`,
    args: [query, query, query, query],
  };
}

function readCurrentListPage(
  database: Database.Database,
  sourcePath: string,
  limit: number,
  offset: number,
  search?: string,
): { sessions: AgentSessionMetadata[]; total: number } {
  const where = currentSessionWhere(search);
  const totalRow = database.get(
    `SELECT COUNT(*) AS total FROM agent_session s
     LEFT JOIN agent_workspace w ON w.id = s.workspace_id ${where.sql}`,
    ...where.args,
  );
  const rows = database.all(
    `SELECT s.id, s.name, s.description, w.path AS workspace_path,
       s.created_at, s.updated_at,
       (SELECT model_id FROM agent_session_message m
        WHERE m.session_id = s.id AND m.model_id IS NOT NULL
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS model,
       (SELECT COUNT(*) FROM agent_session_message m
        WHERE m.session_id = s.id
          AND lower(m.role) IN ('user', 'assistant')) AS message_count
       , length(CAST(COALESCE(s.id, '') AS BLOB))
         + length(CAST(COALESCE(s.name, '') AS BLOB))
         + length(CAST(COALESCE(s.description, '') AS BLOB))
         + COALESCE((SELECT SUM(
             length(CAST(COALESCE(m.data, '') AS BLOB))
           ) FROM agent_session_message m WHERE m.session_id = s.id), 0)
         AS size_bytes
     FROM agent_session s
     LEFT JOIN agent_workspace w ON w.id = s.workspace_id ${where.sql}
     ORDER BY s.updated_at DESC, s.created_at DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    ...where.args,
    limit,
    offset,
  );
  return {
    total:
      isSessionRecord(totalRow) && typeof totalRow.total === "number"
        ? totalRow.total
        : 0,
    sessions: rows
      .map((row) => parseSession(row, sourcePath))
      .filter((row): row is AgentSessionMetadata => Boolean(row)),
  };
}

function sessionWhere(search?: string): { sql: string; args: string[] } {
  const query = search?.trim().toLocaleLowerCase();
  if (!query) return { sql: "", args: [] };
  return {
    sql: `WHERE instr(lower(COALESCE(s.name, '')), ?) > 0
       OR instr(lower(COALESCE(s.description, '')), ?) > 0
       OR instr(lower(COALESCE(s.accessible_paths, '')), ?) > 0
       OR EXISTS (
         SELECT 1 FROM session_messages m
         WHERE m.session_id = s.id
           AND lower(m.role) IN ('user', 'assistant')
           AND instr(lower(COALESCE(m.content, '')), ?) > 0
       )`,
    args: [query, query, query, query],
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
  const total =
    isSessionRecord(totalRow) && typeof totalRow.total === "number"
      ? totalRow.total
      : 0;
  const rows = database.all(
    `SELECT s.id, s.name, s.description, s.accessible_paths, s.model,
            s.created_at, s.updated_at,
            (SELECT COUNT(*) FROM session_messages m
             WHERE m.session_id = s.id
               AND lower(m.role) IN ('user', 'assistant')
               AND trim(COALESCE(m.content, '')) <> '') AS message_count,
            length(CAST(COALESCE(s.id, '') AS BLOB))
              + length(CAST(COALESCE(s.name, '') AS BLOB))
              + length(CAST(COALESCE(s.description, '') AS BLOB))
              + length(CAST(COALESCE(s.accessible_paths, '') AS BLOB))
              + COALESCE((SELECT SUM(
                  length(CAST(COALESCE(m.content, '') AS BLOB))
                  + length(CAST(COALESCE(m.metadata, '') AS BLOB))
                ) FROM session_messages m WHERE m.session_id = s.id), 0)
              AS size_bytes
       FROM sessions s ${where.sql}
      ORDER BY s.updated_at DESC, s.created_at DESC, s.id DESC
      LIMIT ? OFFSET ?`,
    ...where.args,
    limit,
    offset,
  );
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
    typeof value.lastId !== "number" ||
    !Number.isSafeInteger(value.lastId) ||
    value.lastId < 0 ||
    typeof value.revision !== "string"
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  if (value.revision !== revision) {
    throw new Error("AGENT_SESSION_CURSOR_STALE");
  }
  return value.lastId;
}

function encodeOffsetCursor(
  sessionId: string,
  index: number,
  revision: string,
): string {
  return Buffer.from(
    JSON.stringify({ v: 2, sessionId, index, revision }),
  ).toString("base64url");
}

function decodeOffsetCursor(
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
    value.v !== 2 ||
    value.sessionId !== sessionId ||
    !Number.isSafeInteger(value.index) ||
    (value.index as number) < 0 ||
    typeof value.revision !== "string"
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  if (value.revision !== revision) {
    throw new Error("AGENT_SESSION_CURSOR_STALE");
  }
  return value.index as number;
}

function parseMessage(value: unknown): AgentSessionEntry | null {
  if (!isSessionRecord(value)) return null;
  const row = value as CherryMessageRow;
  const id = typeof row.id === "number" ? row.id : null;
  const role = sessionString(row.role)?.toLocaleLowerCase();
  const text = parseContent(row.content);
  if (id === null || !text || (role !== "user" && role !== "assistant")) {
    return null;
  }
  return {
    id: String(id),
    role,
    timestamp: sessionTimestamp(row.created_at),
    text,
  };
}

function parseCurrentMessage(value: unknown): AgentSessionEntry | null {
  if (!isSessionRecord(value)) return null;
  const row = value as CherryMessageRow;
  const id = sessionString(row.id);
  const role = sessionString(row.role)?.toLocaleLowerCase();
  const text = boundedSessionText(row.content);
  if (!id || !text || (role !== "user" && role !== "assistant")) return null;
  return {
    id,
    role,
    timestamp: sessionTimestamp(row.created_at),
    text,
  };
}

function readCurrentDetail(
  database: Database.Database,
  sessionId: string,
  input: AgentSessionDetailPageInput,
  revision: string,
): AgentSessionDetail {
  const exists = database.get(
    "SELECT id FROM agent_session WHERE id = ?",
    sessionId,
  );
  if (!exists) throw new Error("AGENT_SESSION_NOT_FOUND");
  const start = decodeOffsetCursor(input.cursor, sessionId, revision);
  const limit = pageSize(input);
  const rows = database.all(
    `WITH visible_message AS (
       SELECT m.id, m.role, m.created_at,
         (SELECT group_concat(json_extract(part.value, '$.text'), char(10))
            FROM json_each(CASE WHEN json_valid(m.data)
              THEN json_extract(m.data, '$.parts') ELSE '[]' END) part
           WHERE json_extract(part.value, '$.type') = 'text') AS visible_text
         FROM agent_session_message m
        WHERE m.session_id = ?
          AND lower(m.role) IN ('user', 'assistant')
     )
     SELECT id, role, substr(visible_text, 1, 65536) AS content,
            length(visible_text) > 65536 AS content_truncated, created_at
       FROM visible_message
      ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    sessionId,
    limit + 1,
    start,
  ) as unknown[];
  const pageRows = rows.slice(0, limit);
  const entries = pageRows
    .map(parseCurrentMessage)
    .filter((entry): entry is AgentSessionEntry => Boolean(entry));
  const end = start + pageRows.length;
  return {
    agentId: "cherry-studio",
    adapter: CURRENT_ADAPTER,
    sessionId,
    entries,
    parseErrors: pageRows.length - entries.length,
    truncated: pageRows.some(
      (row) => isSessionRecord(row) && row.content_truncated === 1,
    ),
    nextCursor:
      rows.length > limit ? encodeOffsetCursor(sessionId, end, revision) : null,
  };
}

function readDetail(
  database: Database.Database,
  sessionId: string,
  input: AgentSessionDetailPageInput,
  revision: string,
): AgentSessionDetail {
  const exists = database.get(
    "SELECT id FROM sessions WHERE id = ?",
    sessionId,
  );
  if (!exists) throw new Error("AGENT_SESSION_NOT_FOUND");
  const start = decodeCursor(input.cursor, sessionId, revision);
  const limit = pageSize(input);
  const rows = database.all(
    `SELECT id, role, substr(content, 1, 65536) AS content,
            length(content) > 65536 AS content_truncated, created_at
       FROM session_messages
      WHERE session_id = ? AND id > ?
        AND lower(role) IN ('user', 'assistant')
        AND trim(COALESCE(content, '')) <> ''
      ORDER BY id ASC LIMIT ?`,
    sessionId,
    start,
    limit + 1,
  ) as unknown[];
  const pageRows = rows.slice(0, limit);
  const entries = pageRows
    .map(parseMessage)
    .filter((entry): entry is AgentSessionEntry => Boolean(entry));
  const last = pageRows.at(-1) as CherryMessageRow | undefined;
  const lastId = typeof last?.id === "number" ? last.id : start;
  return {
    agentId: "cherry-studio",
    adapter: LEGACY_ADAPTER,
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

export function createCherryStudioSessionAdapter(rootPath: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const result = await withStore(
        rootPath,
        {
          adapter: CURRENT_ADAPTER,
          page: { sessions: [], total: 0 },
        },
        (database, store) => ({
          adapter: store.adapter,
          page:
            store.schema === "current"
              ? readCurrentListPage(
                  database,
                  store.sourcePath,
                  limit,
                  offset,
                  search,
                )
              : readListPage(database, store.sourcePath, limit, offset, search),
        }),
      );
      return {
        agentId: "cherry-studio",
        adapter: result.adapter,
        sessions: result.page.sessions,
        total: result.page.total,
        hasMore: result.page.total > offset + limit,
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
        (database, store, revision) =>
          store.schema === "current"
            ? readCurrentDetail(database, sessionId, input, revision)
            : readDetail(database, sessionId, input, revision),
      );
      if (!detail) throw new Error("AGENT_SESSION_NOT_FOUND");
      return detail;
    },

    async delete(sessionId: string): Promise<void> {
      if (!isSafeSessionId(sessionId)) {
        throw new Error("AGENT_SESSION_ID_INVALID");
      }
      const store = await resolveStore(rootPath);
      if (!store) throw new Error("AGENT_SESSION_NOT_FOUND");
      const database = new Database(store.sourcePath);
      try {
        validateSchema(database, store.schema);
        const remove = database.transaction(() => {
          const table =
            store.schema === "current" ? "agent_session" : "sessions";
          const exists = database.get(
            `SELECT id FROM ${table} WHERE id = ? LIMIT 1`,
            sessionId,
          );
          if (!exists) throw new Error("AGENT_SESSION_NOT_FOUND");
          if (store.schema === "current") {
            database
              .prepare("DELETE FROM agent_session_message WHERE session_id = ?")
              .run(sessionId);
            database
              .prepare("DELETE FROM agent_session WHERE id = ?")
              .run(sessionId);
          } else {
            database
              .prepare("DELETE FROM session_messages WHERE session_id = ?")
              .run(sessionId);
            database
              .prepare("DELETE FROM sessions WHERE id = ?")
              .run(sessionId);
          }
        });
        remove();
      } finally {
        database.close();
      }
    },
  };
}
