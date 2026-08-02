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

const ADAPTER = "reasonix-events-v1";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const MAX_META_BYTES = 256 * 1024;
const CONCURRENCY = 8;

interface ReasonixMessage {
  role?: unknown;
  content?: unknown;
  raw_content?: unknown;
  provider_content?: unknown;
  createdAt?: unknown;
}

interface ReasonixMeta {
  id?: unknown;
  name?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  workspace_root?: unknown;
  topic_title?: unknown;
  custom_title?: unknown;
  model?: unknown;
  preview?: unknown;
}

interface SessionCandidate {
  id: string;
  path: string;
  updatedAt: number;
}

interface ParsedTranscript {
  entries: AgentSessionEntry[];
  searchableText: string;
  parseErrors: number;
  truncated: boolean;
}

interface ParsedSession {
  metadata: AgentSessionMetadata;
  transcript: ParsedTranscript;
  revision: string;
}

function eventPath(sessionPath: string): string {
  return sessionPath.replace(/\.jsonl$/, ".events.jsonl");
}

function isTranscript(name: string): boolean {
  return (
    name.endsWith(".jsonl") &&
    !name.endsWith(".events.jsonl") &&
    !name.endsWith(".conflicts.jsonl") &&
    !name.endsWith(".guardian.jsonl")
  );
}

function sessionId(rootPath: string, sessionPath: string): string {
  const relative = path.relative(rootPath, sessionPath);
  const digest = createHash("sha256").update(relative).digest("hex");
  return `reasonix-${digest}`;
}

function visibleMessage(
  value: unknown,
  index: number,
  fallbackTimestamp: number | null,
): { entry: AgentSessionEntry; rawText: string; truncated: boolean } | null {
  if (!isSessionRecord(value)) return null;
  const message = value as ReasonixMessage;
  const role = sessionString(message.role)?.toLocaleLowerCase();
  if (role !== "user" && role !== "assistant") return null;
  const rawText =
    (role === "user" && sessionString(message.raw_content)) ||
    sessionString(message.content) ||
    sessionString(message.provider_content);
  if (!rawText) return null;
  return {
    entry: {
      id: String(index),
      role,
      timestamp: sessionTimestamp(message.createdAt) ?? fallbackTimestamp,
      text: rawText.slice(0, MAX_SESSION_ENTRY_TEXT),
    },
    rawText,
    truncated: rawText.length > MAX_SESSION_ENTRY_TEXT,
  };
}

async function readJsonLines(filePath: string): Promise<{
  values: unknown[];
  parseErrors: number;
}> {
  const values: unknown[] = [];
  let parseErrors = 0;
  const lines = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      values.push(JSON.parse(line));
    } catch {
      parseErrors += 1;
      break;
    }
  }
  return { values, parseErrors };
}

function replayEvents(values: unknown[]): {
  messages: unknown[];
  timestamps: Array<number | null>;
  valid: boolean;
  future: boolean;
  damaged: boolean;
} {
  const messages: unknown[] = [];
  const timestamps: Array<number | null> = [];
  let records = 0;
  for (const value of values) {
    if (!isSessionRecord(value))
      return {
        messages,
        timestamps,
        valid: false,
        future: false,
        damaged: true,
      };
    const version = value.schema_version;
    if (typeof version === "number" && version > 1) {
      return {
        messages: [],
        timestamps: [],
        valid: false,
        future: true,
        damaged: false,
      };
    }
    if (
      version !== 1 ||
      (value.type !== "replace" && value.type !== "append")
    ) {
      return {
        messages,
        timestamps,
        valid: false,
        future: false,
        damaged: true,
      };
    }
    const next = Array.isArray(value.messages) ? value.messages : [];
    const timestamp = sessionTimestamp(value.created_at);
    if (value.type === "replace") {
      messages.splice(0, messages.length, ...next);
      timestamps.splice(0, timestamps.length, ...next.map(() => null));
    } else if (value.message_index !== messages.length) {
      return {
        messages,
        timestamps,
        valid: records > 0,
        future: false,
        damaged: true,
      };
    } else {
      messages.push(...next);
      timestamps.push(...next.map(() => timestamp));
    }
    records += 1;
  }
  return {
    messages,
    timestamps,
    valid: records > 0,
    future: false,
    damaged: false,
  };
}

function projectTranscript(
  messages: unknown[],
  timestamps: Array<number | null>,
  parseErrors: number,
): ParsedTranscript {
  const entries: AgentSessionEntry[] = [];
  const searchable: string[] = [];
  let truncated = false;
  messages.forEach((message, index) => {
    const visible = visibleMessage(message, index, timestamps[index] ?? null);
    if (!visible) return;
    entries.push(visible.entry);
    searchable.push(visible.rawText);
    truncated ||= visible.truncated;
  });
  return {
    entries,
    searchableText: searchable.join("\n").toLocaleLowerCase(),
    parseErrors,
    truncated,
  };
}

async function loadTranscript(sessionPath: string): Promise<ParsedTranscript> {
  const events = eventPath(sessionPath);
  const eventStat = await fs.lstat(events).catch(() => null);
  if (eventStat?.isSymbolicLink())
    throw new Error("AGENT_SESSION_STORE_INVALID");
  if (eventStat?.isFile()) {
    const decoded = await readJsonLines(events);
    const replay = replayEvents(decoded.values);
    if (replay.future) throw new Error("AGENT_SESSION_SCHEMA_UNSUPPORTED");
    if (replay.valid) {
      return projectTranscript(
        replay.messages,
        replay.timestamps,
        decoded.parseErrors + (replay.damaged ? 1 : 0),
      );
    }
  }
  const checkpoint = await readJsonLines(sessionPath);
  return projectTranscript(
    checkpoint.values,
    checkpoint.values.map(() => null),
    checkpoint.parseErrors,
  );
}

async function readMeta(sessionPath: string): Promise<ReasonixMeta> {
  const metaPath = `${sessionPath}.meta`;
  const stat = await fs.lstat(metaPath).catch(() => null);
  if (!stat) return {};
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_META_BYTES) {
    throw new Error("AGENT_SESSION_STORE_INVALID");
  }
  const value: unknown = JSON.parse(await fs.readFile(metaPath, "utf8"));
  return isSessionRecord(value) ? (value as ReasonixMeta) : {};
}

async function validProjectPath(value: unknown): Promise<string | null> {
  const candidate = sessionString(value);
  if (!candidate || !path.isAbsolute(candidate) || candidate.includes("\0"))
    return null;
  const stat = await fs.lstat(candidate).catch(() => null);
  return stat?.isDirectory() && !stat.isSymbolicLink() ? candidate : null;
}

async function fileRevision(sessionPath: string): Promise<string> {
  const parts = await Promise.all(
    [sessionPath, eventPath(sessionPath), `${sessionPath}.meta`].map(
      async (file) => {
        const stat = await fs.stat(file).catch(() => null);
        return stat ? `${stat.size}:${stat.mtimeMs}` : "missing";
      },
    ),
  );
  return parts.join(":");
}

async function parseCandidate(
  candidate: SessionCandidate,
): Promise<ParsedSession | null> {
  try {
    const [meta, transcript, revision] = await Promise.all([
      readMeta(candidate.path),
      loadTranscript(candidate.path),
      fileRevision(candidate.path),
    ]);
    if (transcript.entries.length === 0) return null;
    const projectPath = await validProjectPath(meta.workspace_root);
    const firstUser = transcript.entries.find(
      (entry) => entry.role === "user",
    )?.text;
    const title =
      sessionString(meta.custom_title) ||
      sessionString(meta.topic_title) ||
      sessionString(meta.name) ||
      sessionString(meta.preview) ||
      firstUser ||
      path.basename(candidate.path, ".jsonl");
    return {
      metadata: {
        id: candidate.id,
        title,
        projectLabel: projectPath
          ? path.basename(projectPath) || projectPath
          : null,
        projectPath,
        createdAt: sessionTimestamp(meta.created_at),
        updatedAt: sessionTimestamp(meta.updated_at) ?? candidate.updatedAt,
        model: sessionString(meta.model),
        messageCount: transcript.entries.length,
        sourcePath: candidate.path,
        resume: {
          executable: "reasonix",
          args: ["--resume", candidate.path],
          ...(projectPath ? { cwd: projectPath } : {}),
        },
      },
      transcript,
      revision,
    };
  } catch {
    return null;
  }
}

async function scanDirectory(
  rootPath: string,
  dir: string,
): Promise<SessionCandidate[]> {
  const entries = await fs
    .readdir(dir, { withFileTypes: true })
    .catch(() => []);
  const sessions: SessionCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !isTranscript(entry.name))
      continue;
    const candidate = path.join(dir, entry.name);
    const stat = await fs.lstat(candidate).catch(() => null);
    if (
      !stat?.isFile() ||
      stat.isSymbolicLink() ||
      !isPathInside(rootPath, candidate)
    )
      continue;
    const eventStat = await fs.stat(eventPath(candidate)).catch(() => null);
    sessions.push({
      id: sessionId(rootPath, candidate),
      path: candidate,
      updatedAt: Math.max(stat.mtimeMs, eventStat?.mtimeMs || 0),
    });
  }
  return sessions;
}

async function discoverCandidates(
  rootPath: string,
): Promise<SessionCandidate[]> {
  const rootStat = await fs.lstat(rootPath).catch(() => null);
  if (!rootStat) return [];
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
    throw new Error("AGENT_SESSION_STORE_INVALID");
  const directories = [path.join(rootPath, "sessions")];
  const projectsRoot = path.join(rootPath, "projects");
  const projects = await fs
    .readdir(projectsRoot, { withFileTypes: true })
    .catch(() => []);
  for (const project of projects) {
    if (project.isDirectory() && !project.isSymbolicLink()) {
      directories.push(path.join(projectsRoot, project.name, "sessions"));
    }
  }
  const groups = await Promise.all(
    directories.map((dir) => scanDirectory(rootPath, dir)),
  );
  const candidates = groups.flat();
  if (candidates.length > MAX_SESSION_SCAN_FILES)
    throw new Error("AGENT_SESSION_SCAN_LIMIT");
  return candidates;
}

async function mapConcurrent<T, R>(
  values: T[],
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      result[index] = await mapper(values[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, values.length) }, worker),
  );
  return result;
}

async function allSessions(rootPath: string): Promise<ParsedSession[]> {
  const candidates = await discoverCandidates(rootPath);
  const parsed = await mapConcurrent(candidates, parseCandidate);
  return parsed
    .filter((session): session is ParsedSession => Boolean(session))
    .sort((a, b) => (b.metadata.updatedAt || 0) - (a.metadata.updatedAt || 0));
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
  revision: string,
): string {
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

export function createReasonixSessionAdapter(rootPath: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const query = search?.trim().toLocaleLowerCase();
      const sessions = (await allSessions(rootPath)).filter((session) => {
        if (!query) return true;
        const metadata = session.metadata;
        return (
          [
            metadata.title,
            metadata.projectLabel,
            metadata.projectPath,
            metadata.model,
          ].some((value) => value?.toLocaleLowerCase().includes(query)) ||
          session.transcript.searchableText.includes(query)
        );
      });
      return {
        agentId: "reasonix",
        adapter: ADAPTER,
        sessions: sessions
          .slice(offset, offset + limit)
          .map((session) => session.metadata),
        total: sessions.length,
        hasMore: sessions.length > offset + limit,
      };
    },

    async read(
      sessionIdValue: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionIdValue))
        throw new Error("AGENT_SESSION_ID_INVALID");
      const session = (await allSessions(rootPath)).find(
        ({ metadata }) => metadata.id === sessionIdValue,
      );
      if (!session) throw new Error("AGENT_SESSION_NOT_FOUND");
      const start = decodeCursor(
        input.cursor,
        sessionIdValue,
        session.revision,
      );
      const limit = pageSize(input);
      const entries = session.transcript.entries.slice(start, start + limit);
      const next = start + entries.length;
      return {
        agentId: "reasonix",
        adapter: ADAPTER,
        sessionId: sessionIdValue,
        entries,
        parseErrors: session.transcript.parseErrors,
        truncated: entries.some(
          (entry) => entry.text.length === MAX_SESSION_ENTRY_TEXT,
        ),
        nextCursor:
          next < session.transcript.entries.length
            ? encodeCursor(sessionIdValue, next, session.revision)
            : null,
      };
    },
  };
}
