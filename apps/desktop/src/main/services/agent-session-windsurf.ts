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
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "windsurf-transcript-jsonl-v1";
const MAX_METADATA_BYTES = 256 * 1024;

interface WindsurfTranscriptCandidate {
  id: string;
  path: string;
  updatedAt: number;
}

function visibleWindsurfEntry(
  value: Record<string, unknown>,
  index: number,
): AgentSessionEntry | null {
  if (value.type === "user_input" && isSessionRecord(value.user_input)) {
    const text = boundedSessionText(value.user_input.user_response);
    if (!text) return null;
    return {
      id: `${index}`,
      role: "user",
      timestamp: sessionTimestamp(value.timestamp),
      text,
    };
  }
  if (
    value.type === "planner_response" &&
    isSessionRecord(value.planner_response)
  ) {
    const text = boundedSessionText(value.planner_response.response);
    if (!text) return null;
    return {
      id: `${index}`,
      role: "assistant",
      timestamp: sessionTimestamp(value.timestamp),
      text,
    };
  }
  return null;
}

async function scanWindsurfTranscripts(
  transcriptsRoot: string,
): Promise<WindsurfTranscriptCandidate[]> {
  const files = await scanSessionFiles(
    transcriptsRoot,
    (name) => {
      if (!name.endsWith(".jsonl")) return false;
      return isSafeSessionId(name.slice(0, -".jsonl".length));
    },
    0,
  );
  return files
    .map((file) => ({
      id: path.basename(file.path, ".jsonl"),
      path: file.path,
      updatedAt: file.updatedAt,
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

async function readMetadata(
  candidate: WindsurfTranscriptCandidate,
): Promise<AgentSessionMetadata> {
  const { raw, truncated } = await readSessionPrefix(
    candidate.path,
    MAX_METADATA_BYTES,
  );
  const parsed = parseVisibleJsonLines(raw, visibleWindsurfEntry);
  const firstUserEntry = parsed.entries.find((entry) => entry.role === "user");
  return {
    id: candidate.id,
    title: firstUserEntry?.text.split("\n", 1)[0].slice(0, 160) || candidate.id,
    projectLabel: null,
    projectPath: null,
    createdAt: null,
    updatedAt: candidate.updatedAt,
    model: null,
    messageCount: truncated ? null : parsed.entries.length,
    sourcePath: candidate.path,
    resume: null,
  };
}

export function createWindsurfSessionAdapter(transcriptsRoot: string) {
  return {
    async list(limit: number, offset = 0): Promise<AgentSessionListResult> {
      const candidates = await scanWindsurfTranscripts(transcriptsRoot);
      const sessions: AgentSessionMetadata[] = [];
      for (const candidate of candidates.slice(offset, offset + limit)) {
        sessions.push(await readMetadata(candidate));
      }
      return {
        agentId: "windsurf",
        adapter: ADAPTER,
        sessions,
        total: candidates.length,
        hasMore: candidates.length > offset + limit,
      };
    },
    async read(sessionId: string): Promise<AgentSessionDetail> {
      const candidate = (await scanWindsurfTranscripts(transcriptsRoot)).find(
        (item) => item.id === sessionId,
      );
      if (!candidate) throw new Error("AGENT_SESSION_NOT_FOUND");
      const transcript = await safeSessionFile(transcriptsRoot, candidate.path);
      if (!transcript) throw new Error("AGENT_SESSION_NOT_FOUND");
      const { raw, truncated } = await readSessionPrefix(
        transcript,
        MAX_SESSION_DETAIL_BYTES,
      );
      const parsed = parseVisibleJsonLines(raw, visibleWindsurfEntry);
      return {
        agentId: "windsurf",
        adapter: ADAPTER,
        sessionId,
        entries: parsed.entries,
        parseErrors: parsed.parseErrors,
        truncated,
      };
    },
  };
}
