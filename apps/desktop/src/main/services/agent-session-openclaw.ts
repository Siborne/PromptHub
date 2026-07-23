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
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "openclaw-session-store-v1";
const MAX_INDEX_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 256 * 1024;
const MAX_AGENTS = 100;

interface OpenClawCandidate {
  id: string;
  key: string;
  model: string | null;
  path: string;
  updatedAt: number | null;
}

function visibleOpenClawEntry(
  value: Record<string, unknown>,
  index: number,
): AgentSessionEntry | null {
  if (value.type !== "message" || !isSessionRecord(value.message)) return null;
  const rawRole = sessionString(value.message.role)?.toLowerCase();
  const role = rawRole === "user" || rawRole === "assistant" ? rawRole : null;
  if (!role) return null;
  const text = boundedSessionText(value.message.content);
  if (!text) return null;
  return {
    id: sessionString(value.id) || `${index}`,
    role,
    timestamp: sessionTimestamp(value.message.timestamp ?? value.timestamp),
    text,
  };
}

function transcriptHeader(raw: string) {
  let projectPath: string | null = null;
  let createdAt: number | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (!isSessionRecord(value) || value.type !== "session") continue;
      projectPath = sessionString(value.cwd);
      createdAt = sessionTimestamp(value.timestamp);
      break;
    } catch {
      continue;
    }
  }
  return { projectPath, createdAt };
}

async function readAgentIndex(
  root: string,
  agentId: string,
): Promise<OpenClawCandidate[]> {
  const indexPath = path.join(
    root,
    "agents",
    agentId,
    "sessions",
    "sessions.json",
  );
  const safeIndex = await safeSessionFile(root, indexPath);
  if (!safeIndex) return [];
  let value: unknown;
  try {
    value = JSON.parse(
      (await readSessionPrefix(safeIndex, MAX_INDEX_BYTES)).raw,
    );
  } catch {
    return [];
  }
  if (!isSessionRecord(value)) return [];
  const candidates: OpenClawCandidate[] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (!isSessionRecord(raw)) continue;
    const id = sessionString(raw.sessionId);
    const declaredPath = sessionString(raw.sessionFile);
    if (!id || !isSafeSessionId(id) || !declaredPath) continue;
    const transcript = await safeSessionFile(root, declaredPath);
    if (!transcript) continue;
    candidates.push({
      id,
      key,
      model: sessionString(raw.model),
      path: transcript,
      updatedAt: sessionTimestamp(raw.updatedAt),
    });
  }
  return candidates;
}

async function scanOpenClaw(root: string): Promise<OpenClawCandidate[]> {
  const agentsRoot = path.join(root, "agents");
  const agents = await fs
    .readdir(agentsRoot, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
  const results = await Promise.all(
    agents
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .slice(0, MAX_AGENTS)
      .map((entry) => readAgentIndex(root, entry.name)),
  );
  const unique = new Map<string, OpenClawCandidate>();
  for (const candidate of results.flat()) {
    const previous = unique.get(candidate.id);
    if (!previous || (candidate.updatedAt || 0) > (previous.updatedAt || 0)) {
      unique.set(candidate.id, candidate);
    }
  }
  return [...unique.values()].sort(
    (left, right) => (right.updatedAt || 0) - (left.updatedAt || 0),
  );
}

async function openClawMetadata(
  candidate: OpenClawCandidate,
): Promise<AgentSessionMetadata> {
  const { raw } = await readSessionPrefix(candidate.path, MAX_METADATA_BYTES);
  const header = transcriptHeader(raw);
  const entries = parseVisibleJsonLines(raw, visibleOpenClawEntry).entries;
  const firstUser = entries.find((entry) => entry.role === "user");
  return {
    id: candidate.id,
    title: firstUser?.text.split("\n", 1)[0].slice(0, 160) || candidate.key,
    projectLabel: header.projectPath ? path.basename(header.projectPath) : null,
    projectPath: header.projectPath,
    createdAt: header.createdAt,
    updatedAt: candidate.updatedAt,
    model: candidate.model,
    messageCount: entries.length || null,
    sourcePath: candidate.path,
    resume: null,
  };
}

export function createOpenClawSessionAdapter(openclawRoot: string) {
  return {
    async list(limit: number, offset = 0): Promise<AgentSessionListResult> {
      const candidates = await scanOpenClaw(openclawRoot);
      const sessions = await Promise.all(
        candidates.slice(offset, offset + limit).map(openClawMetadata),
      );
      return {
        agentId: "openclaw",
        adapter: ADAPTER,
        sessions,
        total: candidates.length,
        hasMore: candidates.length > offset + limit,
      };
    },
    async read(sessionId: string): Promise<AgentSessionDetail> {
      const candidate = (await scanOpenClaw(openclawRoot)).find(
        (item) => item.id === sessionId,
      );
      if (!candidate) throw new Error("AGENT_SESSION_NOT_FOUND");
      const { raw, truncated } = await readSessionPrefix(
        candidate.path,
        MAX_SESSION_DETAIL_BYTES,
      );
      const parsed = parseVisibleJsonLines(raw, visibleOpenClawEntry);
      return {
        agentId: "openclaw",
        adapter: ADAPTER,
        sessionId,
        entries: parsed.entries,
        parseErrors: parsed.parseErrors,
        truncated,
      };
    },
  };
}
