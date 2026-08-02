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
  safeSessionFile,
  scanSessionFiles,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "augment-session-json-v1";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const SESSION_FILE_PATTERN = /^[A-Za-z0-9_-]{1,160}\.json$/;

interface ParsedAugmentSession {
  entries: AgentSessionEntry[];
  metadata: AgentSessionMetadata;
}

function workspacePath(history: unknown[]): string | null {
  for (const item of history) {
    if (!isSessionRecord(item) || !isSessionRecord(item.exchange)) continue;
    const nodes = Array.isArray(item.exchange.request_nodes)
      ? item.exchange.request_nodes
      : [];
    for (const node of nodes) {
      if (!isSessionRecord(node) || !isSessionRecord(node.ide_state_node)) {
        continue;
      }
      const folders = Array.isArray(node.ide_state_node.workspace_folders)
        ? node.ide_state_node.workspace_folders
        : [];
      for (const folder of folders) {
        if (!isSessionRecord(folder)) continue;
        const root = sessionString(
          folder.repository_root ?? folder.folder_root,
        );
        if (root && path.isAbsolute(root) && !root.includes("\0")) return root;
      }
    }
  }
  return null;
}

function augmentEntries(history: unknown[]): AgentSessionEntry[] {
  const entries: AgentSessionEntry[] = [];
  history.forEach((item, index) => {
    if (!isSessionRecord(item) || !isSessionRecord(item.exchange)) return;
    const exchange = item.exchange;
    const requestId = sessionString(exchange.request_id) || `${index}`;
    const timestamp = sessionTimestamp(item.finishedAt ?? item.finished_at);
    const request = boundedSessionText(exchange.request_message);
    const response = boundedSessionText(exchange.response_text);
    if (request) {
      entries.push({
        id: `${requestId}:user`,
        role: "user",
        timestamp,
        text: request,
      });
    }
    if (response) {
      entries.push({
        id: `${requestId}:assistant`,
        role: "assistant",
        timestamp,
        text: response,
      });
    }
  });
  return entries;
}

function parseAugmentSession(
  raw: string,
  fallbackId: string,
  sourcePath: string,
): ParsedAugmentSession | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isSessionRecord(value) || !Array.isArray(value.chatHistory)) return null;
  const sessionId = sessionString(value.sessionId) || fallbackId;
  if (!isSafeSessionId(sessionId) || sessionId !== fallbackId) return null;
  const history = value.chatHistory;
  const entries = augmentEntries(history);
  const projectPath = workspacePath(history);
  const agentState = isSessionRecord(value.agentState) ? value.agentState : {};
  const firstUser = entries.find((entry) => entry.role === "user");
  const title =
    sessionString(value.customTitle)?.slice(0, 160) ||
    firstUser?.text.split("\n", 1)[0].slice(0, 160) ||
    sessionId;
  return {
    entries,
    metadata: {
      id: sessionId,
      title,
      projectLabel: projectPath ? path.basename(projectPath) : null,
      projectPath,
      createdAt: sessionTimestamp(value.created),
      updatedAt: sessionTimestamp(value.modified),
      model: sessionString(agentState.modelId),
      messageCount: entries.length || null,
      sourcePath,
      resume: {
        executable: "auggie",
        args: [
          "--resume",
          sessionId,
          ...(projectPath ? ["--workspace-root", projectPath] : []),
        ],
        ...(projectPath ? { cwd: projectPath } : {}),
      },
    },
  };
}

function encodeCursor(index: number, size: number, mtimeMs: number): string {
  return Buffer.from(JSON.stringify({ v: 1, index, size, mtimeMs })).toString(
    "base64url",
  );
}

function cursorIndex(
  cursor: string | undefined,
  size: number,
  mtimeMs: number,
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
    typeof value.index !== "number" ||
    !Number.isSafeInteger(value.index) ||
    value.index < 0 ||
    value.size !== size ||
    value.mtimeMs !== mtimeMs
  ) {
    throw new Error("AGENT_SESSION_CURSOR_INVALID");
  }
  return value.index;
}

function pageSize(input: AgentSessionDetailPageInput): number {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_DETAIL_REQUEST_INVALID");
  }
  return limit;
}

export function createAugmentSessionAdapter(augmentRoot: string) {
  const sessionsRoot = path.join(augmentRoot, "sessions");

  async function sessions(): Promise<ParsedAugmentSession[]> {
    const files = await scanSessionFiles(
      sessionsRoot,
      (name) => SESSION_FILE_PATTERN.test(name),
      0,
    );
    const parsed = await Promise.all(
      files.map(async (file) => {
        const id = path.basename(file.path, ".json");
        const raw = await fs.readFile(file.path, "utf8");
        return parseAugmentSession(raw, id, file.path);
      }),
    );
    return parsed
      .filter((item): item is ParsedAugmentSession => Boolean(item))
      .sort(
        (a, b) =>
          (b.metadata.updatedAt || b.metadata.createdAt || 0) -
          (a.metadata.updatedAt || a.metadata.createdAt || 0),
      );
  }

  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const query = search?.trim().toLocaleLowerCase();
      const matched = (await sessions()).filter((session) => {
        if (!query) return true;
        return [
          session.metadata.title,
          session.metadata.projectPath,
          session.metadata.model,
          ...session.entries.map((entry) => entry.text),
        ].some((value) => value?.toLocaleLowerCase().includes(query));
      });
      return {
        agentId: "augment",
        adapter: ADAPTER,
        sessions: matched
          .slice(offset, offset + limit)
          .map((item) => item.metadata),
        total: matched.length,
        hasMore: matched.length > offset + limit,
      };
    },

    async read(
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      if (!isSafeSessionId(sessionId))
        throw new Error("AGENT_SESSION_ID_INVALID");
      const candidate = path.join(sessionsRoot, `${sessionId}.json`);
      const sourcePath = await safeSessionFile(sessionsRoot, candidate);
      if (!sourcePath) throw new Error("AGENT_SESSION_NOT_FOUND");
      const [stat, raw] = await Promise.all([
        fs.stat(sourcePath),
        fs.readFile(sourcePath, "utf8"),
      ]);
      const parsed = parseAugmentSession(raw, sessionId, sourcePath);
      if (!parsed) throw new Error("AGENT_SESSION_INVALID");
      const start = cursorIndex(input.cursor, stat.size, stat.mtimeMs);
      if (start > parsed.entries.length) {
        throw new Error("AGENT_SESSION_CURSOR_STALE");
      }
      const limit = pageSize(input);
      const end = Math.min(start + limit, parsed.entries.length);
      return {
        agentId: "augment",
        adapter: ADAPTER,
        sessionId,
        entries: parsed.entries.slice(start, end),
        parseErrors: 0,
        truncated: false,
        nextCursor:
          end < parsed.entries.length
            ? encodeCursor(end, stat.size, stat.mtimeMs)
            : null,
      };
    },
  };
}
