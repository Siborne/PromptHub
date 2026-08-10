import fs from "node:fs/promises";
import path from "node:path";

import type {
  AgentSessionDetail,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import Database from "../database/sqlite";
import {
  boundedSessionText,
  isSafeSessionId,
  isSessionRecord,
  MAX_SESSION_DETAIL_BYTES,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "copilot-session-store-v1";
const MAX_TURN_ROWS = 128;
const MAX_FIELD_BYTES = 16 * 1024;

interface CopilotSessionRow {
  id?: unknown;
  cwd?: unknown;
  repository?: unknown;
  summary?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  title?: unknown;
  message_count?: unknown;
  size_bytes?: unknown;
}

interface CopilotTurnRow {
  id?: unknown;
  user_message?: unknown;
  assistant_response?: unknown;
  user_message_truncated?: unknown;
  assistant_response_truncated?: unknown;
  timestamp?: unknown;
}

interface CopilotSession {
  id: string;
  cwd: string | null;
  repository: string | null;
  title: string;
  createdAt: number | null;
  updatedAt: number | null;
  messageCount: number;
  sizeBytes: number;
}

function isMissing(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function storePath(rootPath: string): string {
  return path.join(rootPath, "session-store.db");
}

function rowText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function projectLabel(session: CopilotSession): string | null {
  const project = session.cwd || session.repository;
  return project ? path.basename(project) || project : null;
}

function toMetadata(
  session: CopilotSession,
  sourcePath: string,
): AgentSessionMetadata {
  return {
    id: session.id,
    title: session.title,
    projectLabel: projectLabel(session),
    projectPath: session.cwd,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    model: null,
    messageCount: session.messageCount || null,
    sizeBytes: session.sizeBytes,
    sourcePath,
    resume: {
      executable: "copilot",
      args: [`--resume=${session.id}`],
      ...(session.cwd ? { cwd: session.cwd } : {}),
    },
  };
}

function parseSession(row: unknown): CopilotSession | null {
  if (!isSessionRecord(row)) return null;
  const record = row as CopilotSessionRow;
  const id = rowText(record.id);
  if (!id || !isSafeSessionId(id)) return null;
  const fallbackTitle = id;
  return {
    id,
    cwd: rowText(record.cwd),
    repository: rowText(record.repository),
    title: boundedSessionText(record.title) || fallbackTitle,
    createdAt: sessionTimestamp(record.created_at),
    updatedAt: sessionTimestamp(record.updated_at),
    messageCount: Math.max(0, rowNumber(record.message_count) || 0),
    sizeBytes: Math.max(0, rowNumber(record.size_bytes) || 0),
  };
}

function visibleEntry(
  value: unknown,
  id: string,
  role: AgentSessionEntry["role"],
  timestamp: unknown,
): AgentSessionEntry | null {
  const text = boundedSessionText(value);
  if (!text) return null;
  return {
    id,
    role,
    timestamp: sessionTimestamp(timestamp),
    text,
  };
}

async function openStore(
  rootPath: string,
  readOnly = true,
): Promise<Database.Database | null> {
  const filePath = storePath(rootPath);
  const stat = await fs.lstat(filePath).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  try {
    return new Database(filePath, readOnly ? { readOnly: true } : undefined);
  } catch {
    throw new Error("AGENT_SESSION_STORE_UNAVAILABLE");
  }
}

async function withStore<T>(
  rootPath: string,
  operation: (database: Database.Database) => T,
  empty: T,
): Promise<T> {
  const database = await openStore(rootPath);
  if (!database) return empty;
  try {
    return operation(database);
  } catch (error) {
    if (error instanceof Error && /no such table/i.test(error.message)) {
      throw new Error("AGENT_SESSION_STORE_INVALID");
    }
    throw error;
  } finally {
    database.close();
  }
}

function readSessionPage(
  database: Database.Database,
  limit: number,
  offset: number,
  search?: string,
): { sessions: CopilotSession[]; total: number } {
  const query = search?.trim().toLocaleLowerCase() || null;
  const where = query
    ? `WHERE instr(lower(COALESCE(s.summary, '')), ?) > 0
         OR instr(lower(COALESCE(s.cwd, '')), ?) > 0
         OR instr(lower(COALESCE(s.repository, '')), ?) > 0
         OR instr(lower(COALESCE((
         SELECT t.user_message
           FROM turns t
           WHERE t.session_id = s.id
           ORDER BY t.turn_index ASC
           LIMIT 1
         ), '')), ?) > 0
         OR EXISTS (
           SELECT 1
           FROM turns t
           WHERE t.session_id = s.id
             AND (
               instr(lower(COALESCE(t.user_message, '')), ?) > 0
               OR instr(lower(COALESCE(t.assistant_response, '')), ?) > 0
             )
         )`
    : "";
  const searchArgs = query ? [query, query, query, query, query, query] : [];
  const totalRow = database.get(
    `SELECT COUNT(*) AS total FROM sessions s ${where}`,
    ...searchArgs,
  );
  const total =
    isSessionRecord(totalRow) && typeof totalRow.total === "number"
      ? totalRow.total
      : 0;
  const rows = database.all(
    `SELECT
       s.id,
       s.cwd,
       s.repository,
       substr(
         CASE
           WHEN trim(COALESCE(s.summary, '')) <> '' THEN s.summary
           ELSE COALESCE(
             (
               SELECT t.user_message
               FROM turns t
               WHERE t.session_id = s.id
                 AND trim(COALESCE(t.user_message, '')) <> ''
               ORDER BY t.turn_index ASC
               LIMIT 1
             ),
             s.id
           )
         END,
         1,
         160
       ) AS title,
       s.created_at,
       s.updated_at,
       (
         SELECT COALESCE(SUM(
           (CASE WHEN trim(COALESCE(t.user_message, '')) <> '' THEN 1 ELSE 0 END) +
           (CASE WHEN trim(COALESCE(t.assistant_response, '')) <> '' THEN 1 ELSE 0 END)
         ), 0)
         FROM turns t
         WHERE t.session_id = s.id
       ) AS message_count
       , length(CAST(COALESCE(s.id, '') AS BLOB))
         + length(CAST(COALESCE(s.cwd, '') AS BLOB))
         + length(CAST(COALESCE(s.repository, '') AS BLOB))
         + length(CAST(COALESCE(s.summary, '') AS BLOB))
         + COALESCE((SELECT SUM(
             length(CAST(COALESCE(t.user_message, '') AS BLOB))
             + length(CAST(COALESCE(t.assistant_response, '') AS BLOB))
           ) FROM turns t WHERE t.session_id = s.id), 0) AS size_bytes
     FROM sessions s
     ${where}
     ORDER BY s.updated_at DESC, s.created_at DESC, s.id DESC
     LIMIT ? OFFSET ?`,
    ...searchArgs,
    limit,
    offset,
  );
  return {
    sessions: rows
      .map(parseSession)
      .filter((session): session is CopilotSession => Boolean(session)),
    total,
  };
}

export function createCopilotSessionAdapter(copilotRoot: string) {
  const sourcePath = storePath(copilotRoot);

  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const page = await withStore(
        copilotRoot,
        (database) => readSessionPage(database, limit + 1, offset, search),
        { sessions: [], total: 0 },
      );
      return {
        agentId: "copilot",
        adapter: ADAPTER,
        sessions: page.sessions
          .slice(0, limit)
          .map((session) => toMetadata(session, sourcePath)),
        total: page.total,
        hasMore: page.total > offset + limit,
      };
    },

    async read(sessionId: string): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionId)) {
        throw new Error("AGENT_SESSION_ID_INVALID");
      }
      const detail = await withStore(
        copilotRoot,
        (database) => {
          const row = database.get(
            "SELECT id FROM sessions WHERE id = ? LIMIT 1",
            sessionId,
          );
          if (!parseSession(row)) throw new Error("AGENT_SESSION_NOT_FOUND");
          const rows = database.all(
            `SELECT id,
                    substr(user_message, 1, ${MAX_FIELD_BYTES}) AS user_message,
                    substr(assistant_response, 1, ${MAX_FIELD_BYTES}) AS assistant_response,
                    length(user_message) > ${MAX_FIELD_BYTES} AS user_message_truncated,
                    length(assistant_response) > ${MAX_FIELD_BYTES} AS assistant_response_truncated,
                    timestamp
             FROM turns
             WHERE session_id = ?
             ORDER BY turn_index ASC, id ASC
             LIMIT ?`,
            sessionId,
            MAX_TURN_ROWS + 1,
          ) as unknown[];
          const truncatedByRows = rows.length > MAX_TURN_ROWS;
          const entries: AgentSessionEntry[] = [];
          let consumed = 0;
          let parseErrors = 0;
          let truncatedByField = false;
          for (const [index, value] of rows.slice(0, MAX_TURN_ROWS).entries()) {
            if (!isSessionRecord(value)) {
              parseErrors += 1;
              continue;
            }
            const turn = value as CopilotTurnRow;
            truncatedByField ||=
              turn.user_message_truncated === 1 ||
              turn.assistant_response_truncated === 1;
            const turnId = rowText(turn.id) || String(index);
            for (const [role, content] of [
              ["user", turn.user_message],
              ["assistant", turn.assistant_response],
            ] as const) {
              if (
                content !== null &&
                content !== undefined &&
                typeof content !== "string"
              ) {
                parseErrors += 1;
                continue;
              }
              const entry = visibleEntry(
                content,
                `${turnId}:${role}`,
                role,
                turn.timestamp,
              );
              if (!entry) continue;
              consumed += entry.text.length;
              if (consumed > MAX_SESSION_DETAIL_BYTES) {
                return {
                  agentId: "copilot",
                  adapter: ADAPTER,
                  sessionId,
                  entries,
                  parseErrors,
                  truncated: true,
                };
              }
              entries.push(entry);
            }
          }
          return {
            agentId: "copilot",
            adapter: ADAPTER,
            sessionId,
            entries,
            parseErrors,
            truncated: truncatedByRows || truncatedByField,
          };
        },
        null,
      );
      if (!detail) throw new Error("AGENT_SESSION_NOT_FOUND");
      return detail;
    },

    async delete(sessionId: string): Promise<void> {
      if (!isSafeSessionId(sessionId)) {
        throw new Error("AGENT_SESSION_ID_INVALID");
      }
      const database = await openStore(copilotRoot, false);
      if (!database) throw new Error("AGENT_SESSION_NOT_FOUND");
      try {
        const remove = database.transaction(() => {
          const exists = database.get(
            "SELECT id FROM sessions WHERE id = ? LIMIT 1",
            sessionId,
          );
          if (!exists) throw new Error("AGENT_SESSION_NOT_FOUND");
          database
            .prepare("DELETE FROM turns WHERE session_id = ?")
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

export { ADAPTER as COPILOT_SESSION_ADAPTER };
