import fs from "node:fs/promises";
import path from "node:path";

import type {
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import {
  boundedSessionText,
  isSafeSessionId,
  isSessionRecord,
  parseVisibleJsonLines,
  readSessionPrefix,
  scanSessionFiles,
  sessionString,
  sessionTimestamp,
  type ScannedSessionFile,
} from "./agent-session-adapter-utils";

const ADAPTER = "codex-rollout-jsonl-v1";
const MAX_METADATA_BYTES = 256 * 1024;
const DEFAULT_DETAIL_PAGE_SIZE = 80;
const MAX_DETAIL_PAGE_SIZE = 200;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_PAGE_SCAN_BYTES = 16 * 1024 * 1024;
const MAX_JSONL_LINE_BYTES = 8 * 1024 * 1024;
const CODEX_ID_PATTERN = /([0-9a-f]{8}-[0-9a-f-]{27})\.jsonl$/i;

interface CodexDetailCursor {
  v: 1;
  offset: number;
  inode: string;
}

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

function encodeCursor(offset: number, inode: string): string {
  return Buffer.from(
    JSON.stringify({ v: 1, offset, inode } satisfies CodexDetailCursor),
  ).toString("base64url");
}

function decodeCursor(
  cursor: string | undefined,
  inode: string,
  fileSize: number,
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
    typeof value.offset !== "number" ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0 ||
    typeof value.inode !== "string"
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  if (value.inode !== inode || value.offset > fileSize) {
    throw new Error("AGENT_SESSION_CURSOR_STALE");
  }
  return value.offset;
}

function detailPageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_DETAIL_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DETAIL_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  }
  return limit;
}

function parseDetailLine(
  line: Buffer,
  lineOffset: number,
): { entry: AgentSessionEntry | null; parseError: boolean } {
  if (!line.toString("utf8").trim()) {
    return { entry: null, parseError: false };
  }
  let value: unknown;
  try {
    value = JSON.parse(line.toString("utf8"));
  } catch {
    return { entry: null, parseError: true };
  }
  if (!isSessionRecord(value)) return { entry: null, parseError: true };
  return {
    entry: visibleCodexEntry(value, lineOffset),
    parseError: false,
  };
}

async function readDetailPage(
  filePath: string,
  input: AgentSessionDetailPageInput,
): Promise<Pick<AgentSessionDetail, "entries" | "parseErrors" | "nextCursor">> {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const inode = String(stat.ino);
    const limit = detailPageSize(input);
    const startOffset = decodeCursor(input.cursor, inode, stat.size);
    let readOffset = startOffset;
    let pendingOffset = readOffset;
    let pending = Buffer.alloc(0);
    let parseErrors = 0;
    const entries: AgentSessionEntry[] = [];

    const consumeLine = (line: Buffer, nextOffset: number): string | null => {
      const parsed = parseDetailLine(line, pendingOffset);
      if (parsed.parseError) parseErrors += 1;
      if (parsed.entry) entries.push(parsed.entry);
      pendingOffset = nextOffset;
      return entries.length >= limit && nextOffset < stat.size
        ? encodeCursor(nextOffset, inode)
        : null;
    };

    while (readOffset < stat.size) {
      const size = Math.min(READ_CHUNK_BYTES, stat.size - readOffset);
      const chunk = Buffer.allocUnsafe(size);
      const { bytesRead } = await handle.read(chunk, 0, size, readOffset);
      if (bytesRead === 0) break;
      readOffset += bytesRead;
      pending = Buffer.concat([pending, chunk.subarray(0, bytesRead)]);
      if (pending.length > MAX_JSONL_LINE_BYTES) {
        throw new Error("AGENT_SESSION_LINE_TOO_LARGE");
      }
      let newline = pending.indexOf(0x0a);
      while (newline >= 0) {
        const nextOffset = pendingOffset + newline + 1;
        const nextCursor = consumeLine(
          pending.subarray(0, newline),
          nextOffset,
        );
        pending = pending.subarray(newline + 1);
        if (nextCursor) return { entries, parseErrors, nextCursor };
        newline = pending.indexOf(0x0a);
      }
      if (
        readOffset - startOffset >= MAX_PAGE_SCAN_BYTES &&
        pendingOffset > startOffset
      ) {
        return {
          entries,
          parseErrors,
          nextCursor: encodeCursor(pendingOffset, inode),
        };
      }
    }

    if (pending.length > 0 && entries.length < limit) {
      consumeLine(pending, stat.size);
    }
    return { entries, parseErrors, nextCursor: null };
  } finally {
    await handle.close();
  }
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
    async read(
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      const file = (await scanCodexFiles(codexRoot)).find(
        (candidate) => candidate.id === sessionId,
      );
      if (!file) throw new Error("AGENT_SESSION_NOT_FOUND");
      const page = await readDetailPage(file.path, input);
      return {
        agentId: "codex",
        adapter: ADAPTER,
        sessionId,
        entries: page.entries,
        parseErrors: page.parseErrors,
        truncated: false,
        nextCursor: page.nextCursor,
      };
    },
  };
}
