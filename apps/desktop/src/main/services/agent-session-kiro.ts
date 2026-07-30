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

const ADAPTER = "kiro-cli-session-v1";
const MAX_METADATA_BYTES = 256 * 1024;

interface KiroSessionCandidate {
  id: string;
  metadataPath: string;
  updatedAt: number;
}

function visibleTextContent(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return boundedSessionText(
    value
      .filter(isSessionRecord)
      .filter((item) => item.kind === "text")
      .map((item) => sessionString(item.data))
      .filter((item): item is string => Boolean(item))
      .join("\n"),
  );
}

function visibleKiroEntry(
  value: Record<string, unknown>,
  index: number,
): AgentSessionEntry | null {
  const role =
    value.kind === "Prompt"
      ? "user"
      : value.kind === "AssistantMessage"
        ? "assistant"
        : null;
  if (!role || !isSessionRecord(value.data)) return null;
  const text = visibleTextContent(value.data.content);
  if (!text) return null;
  return {
    id: `${index}`,
    role,
    timestamp: null,
    text,
  };
}

async function scanKiroMetadata(
  sessionsRoot: string,
): Promise<KiroSessionCandidate[]> {
  const files = await scanSessionFiles(
    sessionsRoot,
    (name) => {
      if (!name.endsWith(".json")) return false;
      return isSafeSessionId(name.slice(0, -".json".length));
    },
    0,
  );
  return files
    .map((file) => ({
      id: path.basename(file.path, ".json"),
      metadataPath: file.path,
      updatedAt: file.updatedAt,
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

async function readMetadata(
  sessionsRoot: string,
  candidate: KiroSessionCandidate,
): Promise<AgentSessionMetadata | null> {
  const metadataPath = await safeSessionFile(
    sessionsRoot,
    candidate.metadataPath,
  );
  if (!metadataPath) return null;
  const { raw, truncated } = await readSessionPrefix(
    metadataPath,
    MAX_METADATA_BYTES,
  );
  if (truncated) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isSessionRecord(data) ||
    sessionString(data.session_id) !== candidate.id
  ) {
    return null;
  }

  const projectPath = sessionString(data.cwd);
  const title = sessionString(data.title);
  return {
    id: candidate.id,
    title: title?.split("\n", 1)[0].slice(0, 160) || candidate.id,
    projectLabel: projectPath ? path.basename(projectPath) : null,
    projectPath,
    createdAt: sessionTimestamp(data.created_at),
    updatedAt: sessionTimestamp(data.updated_at) ?? candidate.updatedAt,
    model: null,
    messageCount: null,
    sourcePath: metadataPath,
    resume: null,
  };
}

export function createKiroSessionAdapter(kiroRoot: string) {
  const sessionsRoot = path.join(kiroRoot, "sessions", "cli");
  return {
    async list(limit: number, offset = 0): Promise<AgentSessionListResult> {
      const candidates = await scanKiroMetadata(sessionsRoot);
      const valid: AgentSessionMetadata[] = [];
      for (const candidate of candidates) {
        const metadata = await readMetadata(sessionsRoot, candidate);
        if (metadata) valid.push(metadata);
      }
      valid.sort((left, right) => right.updatedAt - left.updatedAt);
      return {
        agentId: "kiro",
        adapter: ADAPTER,
        sessions: valid.slice(offset, offset + limit),
        total: valid.length,
        hasMore: valid.length > offset + limit,
      };
    },
    async read(sessionId: string): Promise<AgentSessionDetail> {
      const candidates = await scanKiroMetadata(sessionsRoot);
      const candidate = candidates.find((item) => item.id === sessionId);
      if (!candidate) throw new Error("AGENT_SESSION_NOT_FOUND");
      const metadata = await readMetadata(sessionsRoot, candidate);
      if (!metadata) throw new Error("AGENT_SESSION_NOT_FOUND");
      const transcriptPath = await safeSessionFile(
        sessionsRoot,
        path.join(sessionsRoot, `${sessionId}.jsonl`),
      );
      if (!transcriptPath) throw new Error("AGENT_SESSION_NOT_FOUND");
      const { raw, truncated } = await readSessionPrefix(
        transcriptPath,
        MAX_SESSION_DETAIL_BYTES,
      );
      const parsed = parseVisibleJsonLines(raw, visibleKiroEntry);
      return {
        agentId: "kiro",
        adapter: ADAPTER,
        sessionId,
        entries: parsed.entries,
        parseErrors: parsed.parseErrors,
        truncated,
      };
    },
  };
}
