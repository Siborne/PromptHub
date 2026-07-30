import fs from "node:fs/promises";
import path from "node:path";

import type {
  AgentSessionDetail,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import {
  boundedSessionText,
  isSafeSessionId,
  isSessionRecord,
  MAX_SESSION_DETAIL_BYTES,
  parseVisibleJsonLines,
  readSessionPrefix,
  safeSessionFile,
  scanSessionFiles,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "oh-my-pi-session-jsonl-v1";
const MAX_HEADER_BYTES = 16 * 1024;
const MAX_METADATA_BYTES = 256 * 1024;

interface OhMyPiCandidate {
  id: string;
  path: string;
  updatedAt: number;
}

interface SessionMetadataParts {
  projectPath: string | null;
  createdAt: number | null;
  title: string | null;
  model: string | null;
  messageCount: number;
  firstUserText: string | null;
}

function normalizeRole(value: unknown): AgentSessionEntry["role"] | null {
  const role = sessionString(value)?.toLowerCase();
  if (role === "user" || role === "assistant") return role;
  if (role === "tool" || role === "toolresult" || role === "tool_result") {
    return "tool";
  }
  if (role === "system" || role === "developer") return "system";
  return null;
}

function visibleOhMyPiEntry(
  value: Record<string, unknown>,
  index: number,
): AgentSessionEntry | null {
  if (value.type !== "message" || !isSessionRecord(value.message)) {
    return null;
  }
  const message = value.message;
  const role = normalizeRole(message.role);
  if (!role) return null;
  const text = boundedSessionText(message.content ?? message.parts ?? message);
  if (!text) return null;
  return {
    id: sessionString(value.id) || `${index}`,
    role,
    timestamp: sessionTimestamp(message.timestamp ?? value.timestamp),
    text,
  };
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  if (!line.trim()) return null;
  try {
    const value: unknown = JSON.parse(line);
    return isSessionRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function parseSessionHeader(raw: string): Record<string, unknown> | null {
  for (const line of raw.split(/\r?\n/)) {
    const value = parseJsonLine(line);
    if (value?.type === "session") return value;
  }
  return null;
}

function parseMetadata(raw: string, truncated: boolean): SessionMetadataParts {
  let projectPath: string | null = null;
  let createdAt: number | null = null;
  let title: string | null = null;
  let model: string | null = null;
  let messageCount = 0;
  let firstUserText: string | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const value = parseJsonLine(line);
    if (!value) continue;
    if (value.type === "session") {
      projectPath = sessionString(value.cwd);
      createdAt = sessionTimestamp(value.timestamp);
      title = sessionString(value.title);
      continue;
    }
    if (value.type === "title" || value.type === "title_change") {
      title = sessionString(value.title) || title;
      continue;
    }
    if (value.type === "model_change") {
      model = sessionString(value.model) || model;
      continue;
    }
    if (value.type !== "message" || !isSessionRecord(value.message)) continue;
    messageCount += 1;
    const message = value.message;
    if (!firstUserText && normalizeRole(message.role) === "user") {
      firstUserText = boundedSessionText(
        message.content ?? message.parts ?? message,
      );
    }
    if (!model) {
      model = sessionString(message.model);
    }
  }

  return {
    projectPath,
    createdAt,
    title,
    model,
    messageCount: truncated ? 0 : messageCount,
    firstUserText,
  };
}

async function scanOhMyPiSessions(
  sessionsRoot: string,
): Promise<OhMyPiCandidate[]> {
  const files = await scanSessionFiles(
    sessionsRoot,
    (name) => name.endsWith(".jsonl"),
    1,
  );
  const unique = new Map<string, OhMyPiCandidate>();
  for (const file of files) {
    const { raw } = await readSessionPrefix(file.path, MAX_HEADER_BYTES);
    const header = parseSessionHeader(raw);
    const id = sessionString(header?.id);
    if (!id || !isSafeSessionId(id)) continue;
    const candidate = { id, path: file.path, updatedAt: file.updatedAt };
    const previous = unique.get(id);
    if (!previous || candidate.updatedAt > previous.updatedAt) {
      unique.set(id, candidate);
    }
  }
  return [...unique.values()].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}

async function readMetadata(
  candidate: OhMyPiCandidate,
): Promise<AgentSessionMetadata> {
  const { raw, truncated } = await readSessionPrefix(
    candidate.path,
    MAX_METADATA_BYTES,
  );
  const parsed = parseMetadata(raw, truncated);
  const title =
    parsed.title ||
    parsed.firstUserText?.split("\n", 1)[0].slice(0, 160) ||
    candidate.id;
  return {
    id: candidate.id,
    title,
    projectLabel: parsed.projectPath ? path.basename(parsed.projectPath) : null,
    projectPath: parsed.projectPath,
    createdAt: parsed.createdAt,
    updatedAt: candidate.updatedAt,
    model: parsed.model,
    messageCount: truncated ? null : parsed.messageCount,
    sourcePath: candidate.path,
    resume: {
      executable: "omp",
      args: ["--resume", candidate.id],
      ...(parsed.projectPath ? { cwd: parsed.projectPath } : {}),
    },
  };
}

export function createOhMyPiSessionAdapter(ohMyPiRoot: string) {
  const sessionsRoot = path.join(ohMyPiRoot, "sessions");

  return {
    async list(limit: number, offset = 0): Promise<AgentSessionListResult> {
      const candidates = await scanOhMyPiSessions(sessionsRoot);
      const sessions: AgentSessionMetadata[] = [];
      for (const candidate of candidates.slice(offset, offset + limit)) {
        sessions.push(await readMetadata(candidate));
      }
      return {
        agentId: "oh-my-pi",
        adapter: ADAPTER,
        sessions,
        total: candidates.length,
        hasMore: candidates.length > offset + limit,
      };
    },
    async read(sessionId: string): Promise<AgentSessionDetail> {
      const candidate = (await scanOhMyPiSessions(sessionsRoot)).find(
        (item) => item.id === sessionId,
      );
      if (!candidate) throw new Error("AGENT_SESSION_NOT_FOUND");
      const transcript = await safeSessionFile(sessionsRoot, candidate.path);
      if (!transcript) throw new Error("AGENT_SESSION_NOT_FOUND");
      const { raw, truncated } = await readSessionPrefix(
        transcript,
        MAX_SESSION_DETAIL_BYTES,
      );
      const parsed = parseVisibleJsonLines(raw, visibleOhMyPiEntry);
      return {
        agentId: "oh-my-pi",
        adapter: ADAPTER,
        sessionId,
        entries: parsed.entries,
        parseErrors: parsed.parseErrors,
        truncated,
      };
    },
  };
}
