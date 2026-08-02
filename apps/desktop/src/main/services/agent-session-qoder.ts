import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import type {
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import {
  MAX_SESSION_ENTRY_TEXT,
  MAX_SESSION_SCAN_FILES,
  isPathInside,
  isSafeSessionId,
  isSessionRecord,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "qoder-transcript-jsonl-v1";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const PARSE_CONCURRENCY = 12;
const MAX_JSONL_RECORD_BYTES = 1024 * 1024;
const TRANSCRIPT_PATTERN = /^([A-Za-z0-9_-]{1,160})\.jsonl$/;

interface TranscriptSource {
  nativeId: string;
  sourcePath: string;
  updatedAt: number;
}

interface ParsedTranscript {
  metadata: AgentSessionMetadata;
  entries: AgentSessionEntry[];
  searchableText: string;
  parseErrors: number;
  truncated: boolean;
  revision: string;
}

interface TranscriptState {
  entries: AgentSessionEntry[];
  searchable: string[];
  createdAt: number | null;
  updatedAt: number | null;
  projectPath: string | null;
  parseErrors: number;
  truncated: boolean;
  invalid: boolean;
  index: number;
}

function promptHubId(rootPath: string, sourcePath: string): string {
  const relative = path.relative(rootPath, sourcePath);
  return `qoder-${createHash("sha256").update(relative).digest("hex").slice(0, 32)}`;
}

function validProjectPath(value: unknown): string | null {
  const candidate = sessionString(value);
  return candidate && path.isAbsolute(candidate) && !candidate.includes("\0")
    ? candidate
    : null;
}

function assistantText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const text = value
    .filter(
      (part) =>
        isSessionRecord(part) &&
        part.type === "text" &&
        typeof part.text === "string",
    )
    .map((part) => (part as Record<string, unknown>).text as string)
    .filter((part) => part.trim())
    .join("\n");
  return text.trim() ? text : null;
}

function visibleEntry(
  value: Record<string, unknown>,
  index: number,
): { entry: AgentSessionEntry; rawText: string; truncated: boolean } | null {
  if (!isSessionRecord(value.message)) return null;
  const message = value.message;
  const rawText =
    value.type === "user"
      ? sessionString(message.content)
      : value.type === "assistant"
        ? assistantText(message.content)
        : null;
  if (!rawText) return null;
  const role = value.type === "user" ? "user" : "assistant";
  return {
    entry: {
      id: sessionString(value.uuid) || String(index),
      role,
      timestamp: sessionTimestamp(value.timestamp),
      text: rawText.slice(0, MAX_SESSION_ENTRY_TEXT),
    },
    rawText,
    truncated: rawText.length > MAX_SESSION_ENTRY_TEXT,
  };
}

function updateTimeline(
  timestamp: number | null,
  state: TranscriptState,
): void {
  if (timestamp === null) return;
  state.createdAt =
    state.createdAt === null ? timestamp : Math.min(state.createdAt, timestamp);
  state.updatedAt =
    state.updatedAt === null ? timestamp : Math.max(state.updatedAt, timestamp);
}

function newTranscriptState(): TranscriptState {
  return {
    entries: [],
    searchable: [],
    createdAt: null,
    updatedAt: null,
    projectPath: null,
    parseErrors: 0,
    truncated: false,
    invalid: false,
    index: 0,
  };
}

function consumeLine(
  line: string,
  nativeId: string,
  state: TranscriptState,
): void {
  if (Buffer.byteLength(line, "utf8") > MAX_JSONL_RECORD_BYTES) {
    state.parseErrors += 1;
    return;
  }
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    state.parseErrors += 1;
    return;
  }
  if (!isSessionRecord(value)) {
    state.parseErrors += 1;
    return;
  }
  if (sessionString(value.sessionId) !== nativeId) {
    state.invalid = true;
    return;
  }
  state.projectPath ||= validProjectPath(value.cwd);
  updateTimeline(sessionTimestamp(value.timestamp), state);
  const visible = visibleEntry(value, state.index++);
  if (!visible) return;
  state.entries.push(visible.entry);
  state.searchable.push(visible.rawText);
  state.truncated ||= visible.truncated;
}

async function readTranscript(
  source: TranscriptSource,
): Promise<TranscriptState> {
  const state = newTranscriptState();
  const lines = readline.createInterface({
    input: createReadStream(source.sourcePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    consumeLine(line, source.nativeId, state);
    if (state.invalid) break;
  }
  return state;
}

async function parseTranscript(
  rootPath: string,
  source: TranscriptSource,
): Promise<ParsedTranscript | null> {
  const state = await readTranscript(source);
  if (state.invalid || state.entries.length === 0) return null;
  const firstUser = state.entries.find((entry) => entry.role === "user")?.text;
  const id = promptHubId(rootPath, source.sourcePath);
  return {
    metadata: {
      id,
      title: firstUser || source.nativeId,
      projectLabel: state.projectPath
        ? path.basename(state.projectPath) || state.projectPath
        : null,
      projectPath: state.projectPath,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt ?? source.updatedAt,
      model: null,
      messageCount: state.entries.length,
      sourcePath: source.sourcePath,
      resume: null,
    },
    entries: state.entries,
    searchableText: state.searchable.join("\n").toLocaleLowerCase(),
    parseErrors: state.parseErrors,
    truncated: state.truncated,
    revision: `${source.updatedAt}:${(await fs.stat(source.sourcePath)).size}`,
  };
}

async function safeTranscript(
  rootPath: string,
  candidate: string,
): Promise<TranscriptSource | null> {
  const match = TRANSCRIPT_PATTERN.exec(path.basename(candidate));
  if (!match) return null;
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(rootPath).catch(() => null),
    fs.realpath(candidate).catch(() => null),
  ]);
  if (!realRoot || !realCandidate || !isPathInside(realRoot, realCandidate))
    return null;
  const stat = await fs.lstat(realCandidate).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) return null;
  return {
    nativeId: match[1],
    sourcePath: realCandidate,
    updatedAt: stat.mtimeMs,
  };
}

async function discoverSources(rootPath: string): Promise<TranscriptSource[]> {
  const rootStat = await fs.lstat(rootPath).catch(() => null);
  if (!rootStat) return [];
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new Error("AGENT_SESSION_STORE_INVALID");
  const projectsRoot = path.join(rootPath, "projects");
  const projects = await fs
    .readdir(projectsRoot, { withFileTypes: true })
    .catch(() => []);
  const sources: TranscriptSource[] = [];
  for (const project of projects) {
    if (!project.isDirectory() || project.isSymbolicLink()) continue;
    const transcriptRoot = path.join(projectsRoot, project.name, "transcript");
    const transcriptStat = await fs.lstat(transcriptRoot).catch(() => null);
    if (!transcriptStat?.isDirectory() || transcriptStat.isSymbolicLink())
      continue;
    const files = await fs.readdir(transcriptRoot, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || file.isSymbolicLink()) continue;
      const source = await safeTranscript(
        rootPath,
        path.join(transcriptRoot, file.name),
      );
      if (source) sources.push(source);
      if (sources.length > MAX_SESSION_SCAN_FILES)
        throw new Error("AGENT_SESSION_SCAN_LIMIT");
    }
  }
  return sources;
}

async function mapConcurrent<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < values.length) {
      const index = next++;
      result[index] = await mapper(values[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PARSE_CONCURRENCY, values.length) }, worker),
  );
  return result;
}

async function allSessions(rootPath: string): Promise<ParsedTranscript[]> {
  const parsed = await mapConcurrent(
    await discoverSources(rootPath),
    (source) => parseTranscript(rootPath, source),
  );
  return parsed
    .filter((session): session is ParsedTranscript => Boolean(session))
    .sort(
      (left, right) =>
        (right.metadata.updatedAt || 0) - (left.metadata.updatedAt || 0) ||
        right.metadata.id.localeCompare(left.metadata.id),
    );
}

function pageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE)
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  return limit;
}

function encodeCursor(sessionId: string, offset: number, revision: string) {
  return Buffer.from(
    JSON.stringify({ v: 1, sessionId, offset, revision }),
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
    !Number.isSafeInteger(value.offset) ||
    (value.offset as number) < 0 ||
    typeof value.revision !== "string"
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  if (value.revision !== revision)
    throw new Error("AGENT_SESSION_CURSOR_STALE");
  return value.offset as number;
}

export function createQoderSessionAdapter(rootPath: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const query = search?.trim().toLocaleLowerCase();
      const sessions = (await allSessions(rootPath)).filter((session) => {
        if (!query) return true;
        return (
          [
            session.metadata.title,
            session.metadata.projectLabel,
            session.metadata.projectPath,
          ].some((value) => value?.toLocaleLowerCase().includes(query)) ||
          session.searchableText.includes(query)
        );
      });
      return {
        agentId: "qoder",
        adapter: ADAPTER,
        sessions: sessions
          .slice(offset, offset + limit)
          .map((session) => session.metadata),
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
      const session = (await allSessions(rootPath)).find(
        (candidate) => candidate.metadata.id === sessionId,
      );
      if (!session) throw new Error("AGENT_SESSION_NOT_FOUND");
      const start = decodeCursor(input.cursor, sessionId, session.revision);
      if (start > session.entries.length)
        throw new Error("AGENT_SESSION_CURSOR_STALE");
      const end = Math.min(start + pageSize(input), session.entries.length);
      return {
        agentId: "qoder",
        adapter: ADAPTER,
        sessionId,
        entries: session.entries.slice(start, end),
        parseErrors: session.parseErrors,
        truncated: session.truncated,
        nextCursor:
          end < session.entries.length
            ? encodeCursor(sessionId, end, session.revision)
            : null,
      };
    },
  };
}
