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
  readSessionPrefix,
  safeSessionFile,
  scanSessionFiles,
  sessionNumber,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

export const CLINE_SESSION_ADAPTER = "cline-session-snapshot-v1";

const SESSION_ROOT_NAME = "data/sessions";
const TASK_ROOT_NAME = "data/tasks";
const MAX_METADATA_BYTES = 256 * 1024;
const MAX_INDEX_ROWS = 10_000;
const MAX_DETAIL_ENTRIES = 256;

interface ClineCandidate {
  id: string;
  sourcePath: string;
  sourceKind: "snapshot" | "task";
  updatedAt: number;
}

interface ClineIndexRow {
  id: string;
  cwd: string | null;
  title: string | null;
  model: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  messageCount: number | null;
}

interface ClineDocument {
  id: string;
  cwd: string | null;
  title: string | null;
  model: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  messages: unknown[];
  messagesPath: string | null;
  parseErrors: number;
}

interface ReadResult {
  document: ClineDocument;
  truncated: boolean;
  sourcePath: string;
}

function isMissing(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function sessionRoot(clineRoot: string): string {
  return path.join(clineRoot, SESSION_ROOT_NAME);
}

function taskRoot(clineRoot: string): string {
  return path.join(clineRoot, TASK_ROOT_NAME);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isSessionRecord(value) ? value : null;
}

function firstValue(
  records: Array<Record<string, unknown> | null>,
  keys: string[],
): unknown {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) {
        return record[key];
      }
    }
  }
  return undefined;
}

function firstString(
  records: Array<Record<string, unknown> | null>,
  keys: string[],
): string | null {
  return sessionString(firstValue(records, keys));
}

function firstTimestamp(
  records: Array<Record<string, unknown> | null>,
  keys: string[],
): number | null {
  return sessionTimestamp(firstValue(records, keys));
}

function firstNumber(
  records: Array<Record<string, unknown> | null>,
  keys: string[],
): number | null {
  return sessionNumber(firstValue(records, keys));
}

function safeWorkspacePath(value: unknown): string | null {
  const candidate = sessionString(value);
  if (!candidate || candidate.includes("\0") || !path.isAbsolute(candidate)) {
    return null;
  }
  return path.normalize(candidate);
}

function documentMessages(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  const nested = [
    record.messages,
    record.messageHistory,
    record.conversation,
    record.history,
    asRecord(record.state)?.messages,
  ];
  return nested.find(Array.isArray) || [];
}

function visibleRole(
  value: Record<string, unknown>,
): AgentSessionEntry["role"] | null {
  const raw = sessionString(value.role ?? value.type)?.toLowerCase();
  if (raw === "user" || raw === "human") return "user";
  if (raw === "assistant" || raw === "ai" || raw === "model") {
    return "assistant";
  }
  return null;
}

function visibleEntry(value: unknown, index: number): AgentSessionEntry | null {
  const record = asRecord(value);
  if (!record) return null;
  const role = visibleRole(record);
  if (!role) return null;
  const text = boundedSessionText(
    record.content ?? record.message ?? record.text ?? record,
  );
  if (!text) return null;
  return {
    id: sessionString(record.id) || `${index}`,
    role,
    timestamp: sessionTimestamp(record.timestamp ?? record.createdAt),
    text,
  };
}

function firstVisibleUser(messages: unknown[]): AgentSessionEntry | null {
  for (const [index, message] of messages.entries()) {
    const entry = visibleEntry(message, index);
    if (entry?.role === "user") return entry;
  }
  return null;
}

function documentFields(
  records: Array<Record<string, unknown> | null>,
  messages: unknown[],
  fallbackId: string,
): Omit<ClineDocument, "messages" | "parseErrors"> {
  const rawId =
    firstString(records, [
      "sessionId",
      "session_id",
      "taskId",
      "task_id",
      "id",
    ]) || fallbackId;
  const firstUser = firstVisibleUser(messages);
  const title =
    firstString(records, ["title", "name", "summary"]) ||
    firstUser?.text.split("\n", 1)[0].slice(0, 160) ||
    null;
  const cwd = safeWorkspacePath(
    firstValue(records, [
      "cwd",
      "workspaceRoot",
      "workspacePath",
      "projectPath",
      "directory",
    ]),
  );
  const modelInfo = asRecord(firstValue(records, ["modelInfo"]));
  return {
    id: isSafeSessionId(rawId) ? rawId : fallbackId,
    cwd,
    title,
    model:
      firstString(records, ["modelId", "model", "modelName"]) ||
      sessionString(modelInfo?.id),
    createdAt: firstTimestamp(records, [
      "createdAt",
      "created_at",
      "startTime",
      "created",
    ]),
    updatedAt: firstTimestamp(records, [
      "updatedAt",
      "updated_at",
      "lastModified",
      "lastUpdated",
      "updated",
    ]),
    messagesPath: firstString(records, ["messagesPath", "messages_path"]),
  };
}

function normalizeDocument(
  value: unknown,
  fallbackId: string,
  sourceKind: ClineCandidate["sourceKind"],
): ClineDocument {
  const root = asRecord(value);
  const manifest = asRecord(root?.manifest);
  const metadata = asRecord(root?.metadata);
  const records = [root, manifest, metadata];
  const messages = documentMessages(value);
  const fields = documentFields(records, messages, fallbackId);
  return {
    ...fields,
    messages,
    parseErrors: sourceKind === "task" && !Array.isArray(value) ? 1 : 0,
  };
}

function metadataFromDocument(
  document: ClineDocument,
  candidate: ClineCandidate,
  indexRow?: ClineIndexRow,
): AgentSessionMetadata {
  const projectPath = document.cwd || indexRow?.cwd || null;
  const title = (document.title || indexRow?.title || document.id).slice(
    0,
    160,
  );
  return {
    id: document.id,
    title,
    projectLabel: projectPath
      ? path.basename(projectPath) || projectPath
      : null,
    projectPath,
    createdAt: document.createdAt ?? indexRow?.createdAt ?? null,
    updatedAt: document.updatedAt ?? indexRow?.updatedAt ?? candidate.updatedAt,
    model: document.model ?? indexRow?.model ?? null,
    messageCount:
      document.messages.length > 0
        ? document.messages.length
        : (indexRow?.messageCount ?? null),
    sourcePath: candidate.sourcePath,
    resume: {
      executable: "cline",
      args: ["--id", document.id],
      ...(projectPath ? { cwd: projectPath } : {}),
    },
  };
}

function sessionIndexPath(clineRoot: string): string {
  return path.join(sessionRoot(clineRoot), "sessions.db");
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function chooseColumn(columns: Set<string>, names: string[]): string | null {
  return names.find((name) => columns.has(name)) || null;
}

function sessionIndexColumns(rows: unknown[]): Set<string> {
  return new Set(
    rows
      .map((row) => asRecord(row)?.name)
      .filter((name): name is string => safeIdentifier(name)),
  );
}

function sessionIndexProjection(columns: Set<string>): string | null {
  const selected = [
    ["id", chooseColumn(columns, ["session_id", "sessionId", "id"])],
    ["cwd", chooseColumn(columns, ["cwd", "workspace_root", "workspaceRoot"])],
    ["title", chooseColumn(columns, ["title", "summary", "name"])],
    ["model", chooseColumn(columns, ["model_id", "modelId", "model"])],
    [
      "created_at",
      chooseColumn(columns, ["created_at", "createdAt", "created"]),
    ],
    [
      "updated_at",
      chooseColumn(columns, [
        "updated_at",
        "updatedAt",
        "updated",
        "last_modified",
      ]),
    ],
    ["message_count", chooseColumn(columns, ["message_count", "messageCount"])],
  ] as const;
  const idColumn = selected[0][1];
  if (!idColumn) return null;
  return selected
    .filter(([, column]) => column)
    .map(([alias, column]) => `${column} AS ${alias}`)
    .join(", ");
}

function parseSessionIndexRows(rows: unknown[]): Map<string, ClineIndexRow> {
  const result = new Map<string, ClineIndexRow>();
  for (const row of rows) {
    const record = asRecord(row);
    const id = sessionString(record?.id);
    if (!id || !isSafeSessionId(id)) continue;
    result.set(id, {
      id,
      cwd: sessionString(record?.cwd),
      title: sessionString(record?.title),
      model: sessionString(record?.model),
      createdAt: sessionTimestamp(record?.created_at),
      updatedAt: sessionTimestamp(record?.updated_at),
      messageCount: firstNumber([record], ["message_count"]),
    });
  }
  return result;
}

async function readSessionIndex(
  clineRoot: string,
): Promise<Map<string, ClineIndexRow>> {
  const filePath = sessionIndexPath(clineRoot);
  const stat = await fs.lstat(filePath).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) return new Map();

  let database: Database.Database | null = null;
  try {
    database = new Database(filePath, { readOnly: true });
    const tableRows = database.pragma("table_info(sessions)");
    if (!Array.isArray(tableRows)) return new Map();
    const projection = sessionIndexProjection(sessionIndexColumns(tableRows));
    if (!projection) return new Map();
    const rows = database.all(
      `SELECT ${projection} FROM sessions LIMIT ?`,
      MAX_INDEX_ROWS,
    );
    return parseSessionIndexRows(rows);
  } catch {
    return new Map();
  } finally {
    database?.close();
  }
}

async function scanCandidates(clineRoot: string): Promise<ClineCandidate[]> {
  const snapshots = await scanSessionFiles(
    sessionRoot(clineRoot),
    (name) =>
      name.endsWith(".json") && isSafeSessionId(name.slice(0, -".json".length)),
    0,
  );
  const tasks = await scanSessionFiles(
    taskRoot(clineRoot),
    (name) => name === "api_conversation_history.json",
    1,
  );
  const candidates = [
    ...candidateFiles(snapshots, "snapshot"),
    ...candidateFiles(tasks, "task"),
  ];
  const deduped = new Map<string, ClineCandidate>();
  for (const candidate of candidates) {
    const existing = deduped.get(candidate.id);
    if (
      !existing ||
      (candidate.sourceKind === "snapshot" && existing.sourceKind === "task")
    ) {
      deduped.set(candidate.id, candidate);
    }
  }
  return [...deduped.values()].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

function candidateFiles(
  files: Array<{ path: string; updatedAt: number }>,
  sourceKind: ClineCandidate["sourceKind"],
): ClineCandidate[] {
  return files.flatMap((file) => {
    const id =
      sourceKind === "snapshot"
        ? path.basename(file.path, ".json")
        : path.basename(path.dirname(file.path));
    return isSafeSessionId(id)
      ? [{ id, sourcePath: file.path, sourceKind, updatedAt: file.updatedAt }]
      : [];
  });
}

async function parseJsonFile(
  root: string,
  filePath: string,
  maxBytes: number,
): Promise<{ value: unknown; truncated: boolean; path: string } | null> {
  const [resolvedRoot, resolvedCandidate] = await Promise.all([
    fs.realpath(root).catch(() => root),
    fs.realpath(filePath).catch(() => filePath),
  ]);
  const safePath = await safeSessionFile(resolvedRoot, resolvedCandidate);
  if (!safePath) return null;
  const { raw, truncated } = await readSessionPrefix(safePath, maxBytes);
  try {
    return { value: JSON.parse(raw), truncated, path: safePath };
  } catch {
    return { value: null, truncated, path: safePath };
  }
}

async function readTaskMetadata(
  clineRoot: string,
  candidate: ClineCandidate,
): Promise<Record<string, unknown> | null> {
  const taskDirectory = path.dirname(candidate.sourcePath);
  const metadataPath = path.join(taskDirectory, "task_metadata.json");
  const parsed = await parseJsonFile(
    clineRoot,
    metadataPath,
    MAX_METADATA_BYTES,
  );
  return asRecord(parsed?.value);
}

function mergeTaskMetadata(
  document: ClineDocument,
  taskMetadata: Record<string, unknown>,
  candidate: ClineCandidate,
  records: Array<Record<string, unknown> | null>,
): ClineDocument {
  return {
    ...document,
    id: candidate.id,
    cwd:
      document.cwd ||
      safeWorkspacePath(firstValue(records, ["cwd", "workspaceRoot"])),
    title: document.title,
    model:
      document.model ||
      sessionString(asRecord(taskMetadata.modelInfo)?.id) ||
      firstString(records, ["model", "modelId"]),
    createdAt:
      document.createdAt ||
      firstTimestamp(records, ["createdAt", "created_at"]),
    updatedAt:
      document.updatedAt ||
      firstTimestamp(records, ["lastModified", "updatedAt", "updated_at"]) ||
      candidate.updatedAt,
  };
}

async function readCandidate(
  clineRoot: string,
  candidate: ClineCandidate,
  maxBytes: number,
): Promise<ReadResult | null> {
  const parsed = await parseJsonFile(clineRoot, candidate.sourcePath, maxBytes);
  if (!parsed) return null;
  const taskMetadata =
    candidate.sourceKind === "task"
      ? await readTaskMetadata(clineRoot, candidate)
      : null;
  const rawValue = parsed.value;
  const records = [asRecord(rawValue), taskMetadata];
  let document = normalizeDocument(
    rawValue,
    candidate.id,
    candidate.sourceKind,
  );
  if (taskMetadata) {
    document = mergeTaskMetadata(document, taskMetadata, candidate, records);
  }
  if (
    !Array.isArray(rawValue) &&
    rawValue !== null &&
    candidate.sourceKind === "task"
  ) {
    document.parseErrors += 1;
  }
  return { document, truncated: parsed.truncated, sourcePath: parsed.path };
}

async function messagesForDocument(
  clineRoot: string,
  read: ReadResult,
): Promise<{ messages: unknown[]; truncated: boolean }> {
  if (!read.document.messagesPath) {
    return { messages: read.document.messages, truncated: read.truncated };
  }
  const rawPath = read.document.messagesPath;
  const candidatePath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(path.dirname(read.sourcePath), rawPath);
  const parsed = await parseJsonFile(
    clineRoot,
    candidatePath,
    MAX_SESSION_DETAIL_BYTES,
  );
  if (!parsed) return { messages: [], truncated: read.truncated };
  return {
    messages: documentMessages(parsed.value),
    truncated: read.truncated || parsed.truncated,
  };
}

function visibleEntries(messages: unknown[]): {
  entries: AgentSessionEntry[];
  parseErrors: number;
  truncated: boolean;
} {
  const entries: AgentSessionEntry[] = [];
  let parseErrors = 0;
  let totalText = 0;
  let truncated = false;
  for (const [index, message] of messages.entries()) {
    if (!isSessionRecord(message)) {
      parseErrors += 1;
      continue;
    }
    const entry = visibleEntry(message, index);
    if (!entry) continue;
    totalText += entry.text.length;
    if (
      entries.length >= MAX_DETAIL_ENTRIES ||
      totalText > MAX_SESSION_DETAIL_BYTES
    ) {
      truncated = true;
      break;
    }
    entries.push(entry);
  }
  return {
    entries,
    parseErrors,
    truncated: truncated || messages.length > MAX_DETAIL_ENTRIES,
  };
}

function detailFromMessages(
  agentId: string,
  sessionId: string,
  document: ClineDocument,
  messages: unknown[],
  truncated: boolean,
): AgentSessionDetail {
  const parsed = visibleEntries(messages);
  return {
    agentId,
    adapter: CLINE_SESSION_ADAPTER,
    sessionId,
    entries: parsed.entries,
    parseErrors: document.parseErrors + parsed.parseErrors,
    truncated: truncated || parsed.truncated,
  };
}

function matchesSearch(
  metadata: AgentSessionMetadata,
  document: ClineDocument,
  query: string,
): boolean {
  const values = [
    metadata.title,
    metadata.projectLabel,
    metadata.projectPath,
    metadata.model,
    ...document.messages.flatMap((message, index) => {
      const entry = visibleEntry(message, index);
      return entry ? [entry.text] : [];
    }),
  ];
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
}

export function createClineSessionAdapter(clineRoot: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const [candidates, indexRows] = await Promise.all([
        scanCandidates(clineRoot),
        readSessionIndex(clineRoot),
      ]);
      const query = search?.trim().toLocaleLowerCase() || "";
      const sessions: AgentSessionMetadata[] = [];
      for (const candidate of candidates) {
        const read = await readCandidate(
          clineRoot,
          candidate,
          MAX_METADATA_BYTES,
        );
        if (!read) continue;
        const metadata = metadataFromDocument(
          read.document,
          candidate,
          indexRows.get(candidate.id),
        );
        if (query && !matchesSearch(metadata, read.document, query)) continue;
        sessions.push(metadata);
      }
      sessions.sort(
        (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
      );
      return {
        agentId: "cline",
        adapter: CLINE_SESSION_ADAPTER,
        sessions: sessions.slice(offset, offset + limit),
        total: sessions.length,
        hasMore: sessions.length > offset + limit,
      };
    },

    async read(sessionId: string): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionId))
        throw new Error("AGENT_SESSION_ID_INVALID");
      const candidate = (await scanCandidates(clineRoot)).find(
        (item) => item.id === sessionId,
      );
      if (!candidate) throw new Error("AGENT_SESSION_NOT_FOUND");
      const read = await readCandidate(
        clineRoot,
        candidate,
        MAX_SESSION_DETAIL_BYTES,
      );
      if (!read) throw new Error("AGENT_SESSION_NOT_FOUND");
      if (!read.document.messages.length && !read.document.messagesPath) {
        if (read.truncated) {
          return detailFromMessages(
            "cline",
            sessionId,
            read.document,
            [],
            true,
          );
        }
        throw new Error("AGENT_SESSION_INVALID");
      }
      const resolved = await messagesForDocument(clineRoot, read);
      return detailFromMessages(
        "cline",
        sessionId,
        read.document,
        resolved.messages,
        resolved.truncated,
      );
    },
  };
}
