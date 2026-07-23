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
  scanSessionFiles,
  sessionString,
  sessionTimestamp,
  type ScannedSessionFile,
} from "./agent-session-adapter-utils";

const ADAPTER = "codex-rollout-jsonl-v1";
const MAX_METADATA_BYTES = 256 * 1024;
const CODEX_ID_PATTERN = /([0-9a-f]{8}-[0-9a-f-]{27})\.jsonl$/i;

interface CodexFile extends ScannedSessionFile {
  active: boolean;
  id: string;
  orderAt: number;
}

function fileSessionId(filePath: string): string | null {
  return path.basename(filePath).match(CODEX_ID_PATTERN)?.[1] || null;
}

function visibleCodexEntry(
  value: Record<string, unknown>,
  index: number,
): AgentSessionEntry | null {
  if (value.type !== "event_msg" || !isSessionRecord(value.payload))
    return null;
  const eventType = sessionString(value.payload.type);
  const role =
    eventType === "user_message"
      ? "user"
      : eventType === "agent_message"
        ? "assistant"
        : null;
  if (!role) return null;
  const text = boundedSessionText(value.payload.message);
  if (!text) return null;
  return {
    id: sessionString(value.payload.id) || `${index}`,
    role,
    timestamp: sessionTimestamp(value.timestamp),
    text,
  };
}

function codexMeta(raw: string, fallbackId: string) {
  let id = fallbackId;
  let cwd: string | null = null;
  let createdAt: number | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isSessionRecord(value)) continue;
    if (value.type === "session_meta" && isSessionRecord(value.payload)) {
      const payloadId = sessionString(
        value.payload.id ?? value.payload.session_id,
      );
      if (payloadId && isSafeSessionId(payloadId)) id = payloadId;
      cwd = sessionString(value.payload.cwd);
      createdAt = sessionTimestamp(value.payload.timestamp ?? value.timestamp);
    }
  }
  const visible = parseVisibleJsonLines(raw, visibleCodexEntry).entries;
  return { id, cwd, createdAt, visible };
}

async function scanCodexFiles(codexRoot: string): Promise<CodexFile[]> {
  const [active, archived] = await Promise.all([
    scanSessionFiles(
      path.join(codexRoot, "sessions"),
      (name) => name.endsWith(".jsonl"),
      4,
    ),
    scanSessionFiles(
      path.join(codexRoot, "archived_sessions"),
      (name) => name.endsWith(".jsonl"),
      0,
    ),
  ]);
  const candidates = [
    ...active.map((file) => ({ ...file, active: true })),
    ...archived.map((file) => ({ ...file, active: false })),
  ];
  const unique = new Map<string, Omit<CodexFile, "orderAt">>();
  for (const file of candidates.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  })) {
    const id = fileSessionId(file.path);
    if (id && !unique.has(id)) unique.set(id, { ...file, id });
  }
  const files = await Promise.all(
    [...unique.values()].map(async (file): Promise<CodexFile> => {
      const { raw } = await readSessionPrefix(file.path, 8 * 1024);
      const createdAt = codexMeta(raw, file.id).createdAt;
      return { ...file, orderAt: createdAt || file.updatedAt };
    }),
  );
  return files.sort((a, b) => b.orderAt - a.orderAt);
}

async function metadata(file: CodexFile): Promise<AgentSessionMetadata> {
  const { raw } = await readSessionPrefix(file.path, MAX_METADATA_BYTES);
  const meta = codexMeta(raw, file.id);
  const firstUser = meta.visible.find((entry) => entry.role === "user");
  return {
    id: meta.id,
    title: firstUser?.text.split("\n", 1)[0].slice(0, 160) || meta.id,
    projectLabel: meta.cwd ? path.basename(meta.cwd) : null,
    projectPath: meta.cwd,
    createdAt: meta.createdAt,
    updatedAt: file.updatedAt,
    model: null,
    messageCount: meta.visible.length || null,
    sourcePath: file.path,
    resume: {
      executable: "codex",
      args: ["resume", meta.id],
      ...(meta.cwd ? { cwd: meta.cwd } : {}),
    },
  };
}

export function createCodexSessionAdapter(codexRoot: string) {
  return {
    async list(limit: number, offset = 0): Promise<AgentSessionListResult> {
      const files = await scanCodexFiles(codexRoot);
      const sessions = await Promise.all(
        files.slice(offset, offset + limit).map(metadata),
      );
      return {
        agentId: "codex",
        adapter: ADAPTER,
        sessions,
        total: files.length,
        hasMore: files.length > offset + limit,
      };
    },
    async read(sessionId: string): Promise<AgentSessionDetail> {
      const file = (await scanCodexFiles(codexRoot)).find(
        (candidate) => candidate.id === sessionId,
      );
      if (!file) throw new Error("AGENT_SESSION_NOT_FOUND");
      const { raw, truncated } = await readSessionPrefix(
        file.path,
        MAX_SESSION_DETAIL_BYTES,
      );
      const parsed = parseVisibleJsonLines(raw, visibleCodexEntry);
      return {
        agentId: "codex",
        adapter: ADAPTER,
        sessionId,
        entries: parsed.entries,
        parseErrors: parsed.parseErrors,
        truncated,
      };
    },
  };
}
