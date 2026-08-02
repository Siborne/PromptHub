import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type {
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import {
  boundedSessionText,
  isPathInside,
  isSafeSessionId,
  isSessionRecord,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "kilo-session-json-v1";
const MAX_SESSION_FILES = 50_000;
const MAX_RECORD_BYTES = 256 * 1024;
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const SESSION_PARSE_CONCURRENCY = 32;
const TRANSCRIPT_READ_CONCURRENCY = 16;
const SESSION_FILE_PATTERN = /^([A-Za-z0-9_-]{1,160})\.json$/;

interface SessionSource {
  metadata: AgentSessionMetadata;
  sourcePath: string;
}

interface VisibleTranscript {
  entries: AgentSessionEntry[];
  model: string | null;
  parseErrors: number;
  revision: string;
  truncated: boolean;
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function pageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  }
  return limit;
}

async function readJson(filePath: string): Promise<unknown> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_RECORD_BYTES)
    throw new Error("AGENT_SESSION_RECORD_TOO_LARGE");
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function safeRegularFile(
  root: string,
  candidate: string,
): Promise<string | null> {
  const stat = await fs.lstat(candidate).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) return null;
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(root).catch(() => null),
    fs.realpath(candidate).catch(() => null),
  ]);
  if (!realRoot || !realCandidate || !isPathInside(realRoot, realCandidate))
    return null;
  return realCandidate;
}

async function sessionFiles(storageRoot: string): Promise<string[]> {
  const root = path.join(storageRoot, "session");
  const projects = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => []);
  const files: string[] = [];
  for (const project of projects) {
    if (!project.isDirectory() || project.isSymbolicLink()) continue;
    const projectRoot = path.join(root, project.name);
    const entries = await fs
      .readdir(projectRoot, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !SESSION_FILE_PATTERN.test(entry.name)
      )
        continue;
      if (files.length >= MAX_SESSION_FILES)
        throw new Error("AGENT_SESSION_SCAN_LIMIT");
      const candidate = await safeRegularFile(
        storageRoot,
        path.join(projectRoot, entry.name),
      );
      if (candidate) files.push(candidate);
    }
  }
  return files;
}

function validProjectPath(value: unknown): string | null {
  const candidate = sessionString(value);
  return candidate && path.isAbsolute(candidate) && !candidate.includes("\0")
    ? candidate
    : null;
}

function parseTime(value: unknown, key: "created" | "updated"): number | null {
  return isSessionRecord(value) ? sessionTimestamp(value[key]) : null;
}

async function parseSessionFile(
  filePath: string,
): Promise<SessionSource | null> {
  let value: unknown;
  try {
    value = await readJson(filePath);
  } catch {
    return null;
  }
  if (!isSessionRecord(value)) return null;
  const id = sessionString(value.id);
  const fileId = path.basename(filePath, ".json");
  if (!id || id !== fileId || !isSafeSessionId(id)) return null;
  const projectPath = validProjectPath(value.directory);
  return {
    sourcePath: filePath,
    metadata: {
      id,
      title: boundedSessionText(value.title) || id,
      projectLabel: projectPath
        ? path.basename(projectPath) || projectPath
        : null,
      projectPath,
      createdAt: parseTime(value.time, "created"),
      updatedAt: parseTime(value.time, "updated"),
      model: null,
      messageCount: null,
      sourcePath: filePath,
      resume: {
        executable: "kilo",
        args: ["--session", id],
        ...(projectPath ? { cwd: projectPath } : {}),
      },
    },
  };
}

async function sessions(storageRoot: string): Promise<SessionSource[]> {
  const parsed = await mapConcurrent(
    await sessionFiles(storageRoot),
    SESSION_PARSE_CONCURRENCY,
    parseSessionFile,
  );
  return parsed
    .filter((item): item is SessionSource => Boolean(item))
    .sort(
      (left, right) =>
        (right.metadata.updatedAt || right.metadata.createdAt || 0) -
          (left.metadata.updatedAt || left.metadata.createdAt || 0) ||
        right.metadata.id.localeCompare(left.metadata.id),
    );
}

async function childJsonFiles(
  root: string,
  relativeDir: string,
): Promise<string[]> {
  const directory = path.join(root, relativeDir);
  const entries = await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      !entry.isFile() ||
      entry.isSymbolicLink() ||
      !SESSION_FILE_PATTERN.test(entry.name)
    )
      continue;
    const safe = await safeRegularFile(root, path.join(directory, entry.name));
    if (safe) files.push(safe);
  }
  return files;
}

async function textParts(
  storageRoot: string,
  sessionId: string,
  messageId: string,
): Promise<{ text: string; parseErrors: number; revision: string }> {
  const files = await childJsonFiles(storageRoot, path.join("part", messageId));
  const texts: string[] = [];
  let parseErrors = 0;
  const revision = createHash("sha256");
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      revision.update(`${path.basename(file)}:${stat.size}:${stat.mtimeMs};`);
      const value = await readJson(file);
      if (
        !isSessionRecord(value) ||
        value.sessionID !== sessionId ||
        value.messageID !== messageId
      ) {
        parseErrors += 1;
      } else if (value.type === "text") {
        const text = boundedSessionText(value.text);
        if (text) texts.push(text);
      }
    } catch {
      parseErrors += 1;
    }
  }
  return {
    text: texts.join("\n"),
    parseErrors,
    revision: revision.digest("hex"),
  };
}

async function visibleTranscript(
  storageRoot: string,
  sessionId: string,
): Promise<VisibleTranscript> {
  const files = await childJsonFiles(
    storageRoot,
    path.join("message", sessionId),
  );
  const entries: AgentSessionEntry[] = [];
  let parseErrors = 0;
  let model: string | null = null;
  let truncated = false;
  const revision = createHash("sha256");
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      revision.update(`${path.basename(file)}:${stat.size}:${stat.mtimeMs};`);
      const value = await readJson(file);
      if (!isSessionRecord(value) || value.sessionID !== sessionId) {
        parseErrors += 1;
        continue;
      }
      const id = sessionString(value.id);
      const role = sessionString(value.role)?.toLocaleLowerCase();
      if (
        !id ||
        !isSafeSessionId(id) ||
        (role !== "user" && role !== "assistant")
      )
        continue;
      model ||= sessionString(value.modelID);
      const parts = await textParts(storageRoot, sessionId, id);
      revision.update(parts.revision);
      parseErrors += parts.parseErrors;
      if (!parts.text) continue;
      truncated ||= parts.text.length >= 64 * 1024;
      entries.push({
        id,
        role,
        timestamp: parseTime(value.time, "created"),
        text: parts.text,
      });
    } catch {
      parseErrors += 1;
    }
  }
  entries.sort(
    (a, b) =>
      (a.timestamp || 0) - (b.timestamp || 0) || a.id.localeCompare(b.id),
  );
  return {
    entries,
    model,
    parseErrors,
    revision: revision.digest("hex"),
    truncated,
  };
}

function encodeCursor(
  sessionId: string,
  index: number,
  revision: string,
): string {
  return Buffer.from(
    JSON.stringify({ v: 1, sessionId, index, revision }),
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
    value.revision !== revision ||
    typeof value.index !== "number" ||
    !Number.isSafeInteger(value.index) ||
    value.index < 0
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  return value.index;
}

async function hydrateSession(
  storageRoot: string,
  source: SessionSource,
): Promise<{ source: SessionSource; transcript: VisibleTranscript }> {
  const transcript = await visibleTranscript(storageRoot, source.metadata.id);
  return {
    source: {
      ...source,
      metadata: {
        ...source.metadata,
        model: transcript.model,
        messageCount: transcript.entries.length || null,
      },
    },
    transcript,
  };
}

function matchesSearch(
  source: SessionSource,
  transcript: VisibleTranscript,
  query: string,
): boolean {
  return [
    source.metadata.title,
    source.metadata.projectPath,
    source.metadata.model,
    ...transcript.entries.map((entry) => entry.text),
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

export function createKiloSessionAdapter(storageRoot: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const all = await sessions(storageRoot);
      const query = search?.trim().toLocaleLowerCase();
      let hydrated: Array<{
        source: SessionSource;
        transcript: VisibleTranscript;
      }>;
      if (query) {
        hydrated = (
          await mapConcurrent(all, TRANSCRIPT_READ_CONCURRENCY, (item) =>
            hydrateSession(storageRoot, item),
          )
        ).filter((item) => matchesSearch(item.source, item.transcript, query));
      } else {
        hydrated = await mapConcurrent(
          all.slice(offset, offset + limit),
          TRANSCRIPT_READ_CONCURRENCY,
          (item) => hydrateSession(storageRoot, item),
        );
      }
      const total = query ? hydrated.length : all.length;
      const page = query ? hydrated.slice(offset, offset + limit) : hydrated;
      return {
        agentId: "kilo",
        adapter: ADAPTER,
        sessions: page.map((item) => item.source.metadata),
        total,
        hasMore: total > offset + limit,
      };
    },

    async read(
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionId))
        throw new Error("AGENT_SESSION_ID_INVALID");
      const match = (await sessions(storageRoot)).find(
        (item) => item.metadata.id === sessionId,
      );
      if (!match) {
        const candidate = (await sessionFiles(storageRoot)).find(
          (file) => path.basename(file, ".json") === sessionId,
        );
        if (candidate) throw new Error("AGENT_SESSION_INVALID");
        throw new Error("AGENT_SESSION_NOT_FOUND");
      }
      const transcript = await visibleTranscript(storageRoot, sessionId);
      const start = decodeCursor(input.cursor, sessionId, transcript.revision);
      if (start > transcript.entries.length)
        throw new Error("AGENT_SESSION_CURSOR_STALE");
      const limit = pageSize(input);
      const end = Math.min(start + limit, transcript.entries.length);
      return {
        agentId: "kilo",
        adapter: ADAPTER,
        sessionId,
        entries: transcript.entries.slice(start, end),
        parseErrors: transcript.parseErrors,
        truncated: transcript.truncated,
        nextCursor:
          end < transcript.entries.length
            ? encodeCursor(sessionId, end, transcript.revision)
            : null,
      };
    },
  };
}
