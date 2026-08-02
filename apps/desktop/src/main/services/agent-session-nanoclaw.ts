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
  MAX_SESSION_ENTRY_TEXT,
  MAX_SESSION_SCAN_FILES,
  isPathInside,
  isSafeSessionId,
  isSessionRecord,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "nanoclaw-v2-sqlite";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;

interface NanoRow {
  id?: unknown;
  seq?: unknown;
  timestamp?: unknown;
  kind?: unknown;
  content?: unknown;
}

interface NanoMessage {
  entry: AgentSessionEntry;
  searchableText: string;
  truncated: boolean;
}

interface NanoSession {
  metadata: AgentSessionMetadata;
  messages: NanoMessage[];
  revision: string;
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

function validateTable(database: Database.Database, table: string): void {
  const columns = tableColumns(database, table);
  if (
    ["id", "seq", "timestamp", "kind", "content"].some(
      (key) => !columns.has(key),
    )
  ) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
}

function visibleContent(
  row: NanoRow,
  role: "user" | "assistant",
): string | null {
  const kind = sessionString(row.kind)?.toLocaleLowerCase();
  if (kind !== "chat" && kind !== "chat-sdk") return null;
  const raw = sessionString(row.content);
  if (!raw) return null;
  let content: unknown;
  try {
    content = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isSessionRecord(content)) return null;
  if (role === "assistant" && (content.operation || content.action))
    return null;
  return role === "user"
    ? sessionString(content.text)
    : sessionString(content.text) ||
        sessionString(content.markdown) ||
        sessionString(content.fallbackText);
}

function parseRows(rows: unknown[], role: "user" | "assistant"): NanoMessage[] {
  return rows.flatMap((value) => {
    if (!isSessionRecord(value)) return [];
    const row = value as NanoRow;
    const seq = typeof row.seq === "number" ? row.seq : null;
    const text = visibleContent(row, role);
    if (seq === null || !text) return [];
    return [
      {
        entry: {
          id: String(seq),
          role,
          timestamp: sessionTimestamp(row.timestamp),
          text: text.slice(0, MAX_SESSION_ENTRY_TEXT),
        },
        searchableText: text.toLocaleLowerCase(),
        truncated: text.length > MAX_SESSION_ENTRY_TEXT,
      },
    ];
  });
}

function openReadOnly(filePath: string): Database.Database {
  try {
    return new Database(filePath, { readOnly: true });
  } catch {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
}

function readMessages(sessionDir: string): NanoMessage[] {
  const inbound = openReadOnly(path.join(sessionDir, "inbound.db"));
  const outbound = openReadOnly(path.join(sessionDir, "outbound.db"));
  try {
    validateTable(inbound, "messages_in");
    validateTable(outbound, "messages_out");
    const incoming = parseRows(
      inbound.all(
        "SELECT id, seq, timestamp, kind, content FROM messages_in ORDER BY seq",
      ),
      "user",
    );
    const outgoing = parseRows(
      outbound.all(
        "SELECT id, seq, timestamp, kind, content FROM messages_out ORDER BY seq",
      ),
      "assistant",
    );
    return [...incoming, ...outgoing].sort(
      (left, right) => Number(left.entry.id) - Number(right.entry.id),
    );
  } finally {
    inbound.close();
    outbound.close();
  }
}

async function revision(sessionDir: string): Promise<string> {
  const values = await Promise.all(
    ["inbound.db", "inbound.db-wal", "outbound.db", "outbound.db-wal"].map(
      async (name) => {
        const stat = await fs
          .stat(path.join(sessionDir, name))
          .catch(() => null);
        return stat ? `${stat.size}:${stat.mtimeMs}` : "missing";
      },
    ),
  );
  return values.join(":");
}

async function sessionDirectories(rootPath: string): Promise<string[]> {
  const base = path.join(rootPath, "data", "v2-sessions");
  const groups = await fs
    .readdir(base, { withFileTypes: true })
    .catch(() => []);
  const directories: string[] = [];
  for (const group of groups) {
    if (!group.isDirectory() || group.isSymbolicLink()) continue;
    const groupDir = path.join(base, group.name);
    const sessions = await fs
      .readdir(groupDir, { withFileTypes: true })
      .catch(() => []);
    for (const session of sessions) {
      if (!session.isDirectory() || session.isSymbolicLink()) continue;
      const candidate = path.join(groupDir, session.name);
      if (isPathInside(rootPath, candidate)) directories.push(candidate);
      if (directories.length > MAX_SESSION_SCAN_FILES)
        throw new Error("AGENT_SESSION_SCAN_LIMIT");
    }
  }
  return directories;
}

async function safeRoot(rootPath: string): Promise<boolean> {
  const stat = await fs.lstat(rootPath).catch(() => null);
  return Boolean(stat?.isDirectory() && !stat.isSymbolicLink());
}

async function parseSession(
  rootPath: string,
  sessionDir: string,
): Promise<NanoSession | null> {
  try {
    const messages = readMessages(sessionDir);
    if (messages.length === 0) return null;
    const id = path.basename(sessionDir);
    if (!isSafeSessionId(id)) return null;
    const [sourceRevision, inboundStat, outboundStat] = await Promise.all([
      revision(sessionDir),
      fs.stat(path.join(sessionDir, "inbound.db")),
      fs.stat(path.join(sessionDir, "outbound.db")),
    ]);
    const timestamps = messages.flatMap(({ entry }) => entry.timestamp ?? []);
    return {
      metadata: {
        id,
        title:
          messages.find(({ entry }) => entry.role === "user")?.entry.text || id,
        projectLabel: path.basename(rootPath) || rootPath,
        projectPath: rootPath,
        createdAt: timestamps.length ? Math.min(...timestamps) : null,
        updatedAt: timestamps.length
          ? Math.max(...timestamps)
          : Math.max(inboundStat.mtimeMs, outboundStat.mtimeMs),
        model: null,
        messageCount: messages.length,
        sourcePath: sessionDir,
        resume: null,
      },
      messages,
      revision: sourceRevision,
    };
  } catch {
    return null;
  }
}

async function loadSessions(rootPaths: string[]): Promise<NanoSession[]> {
  const sessions: NanoSession[] = [];
  for (const rootPath of rootPaths) {
    if (!(await safeRoot(rootPath))) continue;
    for (const dir of await sessionDirectories(rootPath)) {
      const parsed = await parseSession(rootPath, dir);
      if (parsed) sessions.push(parsed);
    }
  }
  return sessions.sort(
    (left, right) =>
      (right.metadata.updatedAt || 0) - (left.metadata.updatedAt || 0),
  );
}

function pageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  }
  return limit;
}

function encodeCursor(
  sessionId: string,
  offset: number,
  sourceRevision: string,
): string {
  return Buffer.from(
    JSON.stringify({ v: 1, sessionId, offset, sourceRevision }),
  ).toString("base64url");
}

function decodeCursor(
  cursor: string | undefined,
  sessionId: string,
  sourceRevision: string,
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
    !Number.isSafeInteger(value.offset) ||
    (value.offset as number) < 0 ||
    value.sourceRevision !== sourceRevision
  ) {
    throw new Error(
      value && isSessionRecord(value) && value.sourceRevision !== sourceRevision
        ? "AGENT_SESSION_CURSOR_STALE"
        : "AGENT_SESSION_CURSOR_INVALID",
    );
  }
  return value.offset as number;
}

export function createNanoClawSessionAdapter(rootPaths: string[]) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const query = search?.trim().toLocaleLowerCase();
      const sessions = (await loadSessions(rootPaths)).filter(
        (session) =>
          !query ||
          session.metadata.title.toLocaleLowerCase().includes(query) ||
          session.messages.some((message) =>
            message.searchableText.includes(query),
          ),
      );
      return {
        agentId: "nanoclaw",
        adapter: ADAPTER,
        sessions: sessions
          .slice(offset, offset + limit)
          .map(({ metadata }) => metadata),
        total: sessions.length,
        hasMore: sessions.length > offset + limit,
      };
    },

    async read(
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionId))
        throw new Error("AGENT_SESSION_ID_INVALID");
      const session = (await loadSessions(rootPaths)).find(
        ({ metadata }) => metadata.id === sessionId,
      );
      if (!session) throw new Error("AGENT_SESSION_NOT_FOUND");
      const start = decodeCursor(input.cursor, sessionId, session.revision);
      const limit = pageSize(input);
      const page = session.messages.slice(start, start + limit);
      const next = start + page.length;
      return {
        agentId: "nanoclaw",
        adapter: ADAPTER,
        sessionId,
        entries: page.map(({ entry }) => entry),
        parseErrors: 0,
        truncated: page.some(({ truncated }) => truncated),
        nextCursor:
          next < session.messages.length
            ? encodeCursor(sessionId, next, session.revision)
            : null,
      };
    },
  };
}
