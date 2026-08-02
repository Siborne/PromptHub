import { createHash } from "node:crypto";
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
  MAX_SESSION_ENTRY_TEXT,
  MAX_SESSION_SCAN_FILES,
  isPathInside,
  isSessionRecord,
  sessionString,
  sessionTimestamp,
} from "./agent-session-adapter-utils";

const ADAPTER = "copaw-safe-json-session-v2";
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const SYNTHETIC_TAGS = new Set([
  "auto_continue",
  "loop_continuation",
  "rubric_evaluation",
  "scroll_memory",
]);
const VISUAL_PLACEHOLDER_NAMES = new Set(["visual_context", "visual_history"]);
const SESSION_FILE_PATTERN = /^[^/\\\0]{1,240}\.json$/;

interface ChatSpec {
  name: string | null;
  sessionId: string;
  userId: string;
  channel: string;
  createdAt: number | null;
  updatedAt: number | null;
}

interface CoPawMessage {
  entry: AgentSessionEntry;
  searchableText: string;
  truncated: boolean;
}

interface CoPawSession {
  metadata: AgentSessionMetadata;
  messages: CoPawMessage[];
  parseErrors: number;
  revision: string;
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
  if (!stat.isFile() || stat.size > MAX_JSON_BYTES) {
    throw new Error("AGENT_SESSION_RECORD_TOO_LARGE");
  }
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function safeConfiguredPath(value: unknown): string | null {
  const candidate = sessionString(value);
  return candidate && path.isAbsolute(candidate) && !candidate.includes("\0")
    ? path.normalize(candidate)
    : null;
}

async function isSafeDirectory(candidate: string): Promise<boolean> {
  const stat = await fs.lstat(candidate).catch(() => null);
  return Boolean(stat?.isDirectory() && !stat.isSymbolicLink());
}

function configuredWorkspacePaths(value: unknown): string[] {
  if (!isSessionRecord(value) || !isSessionRecord(value.agents)) return [];
  const profiles = value.agents.profiles;
  if (!isSessionRecord(profiles)) return [];
  return Object.values(profiles).flatMap((profile) => {
    if (!isSessionRecord(profile)) return [];
    const workspace = safeConfiguredPath(profile.workspace_dir);
    return workspace ? [workspace] : [];
  });
}

async function rootWorkspaces(rootPath: string): Promise<string[]> {
  if (!(await isSafeDirectory(rootPath))) return [];
  const candidates = new Set<string>();
  try {
    configuredWorkspacePaths(
      await readJson(path.join(rootPath, "config.json")),
    ).forEach((workspace) => candidates.add(workspace));
  } catch {
    // A missing or malformed root config does not hide default workspaces.
  }
  const workspacesRoot = path.join(rootPath, "workspaces");
  const entries = await fs
    .readdir(workspacesRoot, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      candidates.add(path.join(workspacesRoot, entry.name));
    }
  }
  const resolved: string[] = [];
  for (const candidate of candidates) {
    if (!(await isSafeDirectory(candidate))) continue;
    const real = await fs.realpath(candidate).catch(() => null);
    if (real) resolved.push(real);
  }
  return resolved;
}

async function resolveWorkspaces(rootPaths: string[]): Promise<string[]> {
  const workspaces = new Set<string>();
  for (const rootPath of rootPaths) {
    for (const workspace of await rootWorkspaces(rootPath)) {
      workspaces.add(workspace);
    }
  }
  return [...workspaces];
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "--");
}

function chatSessionPath(sessionsDir: string, chat: ChatSpec): string {
  const safeSessionId = sanitizeFilename(chat.sessionId);
  let safeUserId = sanitizeFilename(chat.userId);
  if (safeUserId === safeSessionId) safeUserId = "";
  const filename = `${safeUserId ? `${safeUserId}_` : ""}${safeSessionId}.json`;
  return chat.channel
    ? path.join(sessionsDir, sanitizeFilename(chat.channel), filename)
    : path.join(sessionsDir, filename);
}

function parseChat(value: unknown): ChatSpec | null {
  if (!isSessionRecord(value)) return null;
  const sessionId = sessionString(value.session_id);
  if (!sessionId) return null;
  return {
    name: sessionString(value.name),
    sessionId,
    userId: sessionString(value.user_id) || "",
    channel: sessionString(value.channel) || "",
    createdAt: sessionTimestamp(value.created_at),
    updatedAt: sessionTimestamp(value.updated_at),
  };
}

async function chatMap(workspace: string): Promise<Map<string, ChatSpec>> {
  const chats = new Map<string, ChatSpec>();
  let value: unknown;
  try {
    value = await readJson(path.join(workspace, "chats.json"));
  } catch {
    return chats;
  }
  if (!isSessionRecord(value) || !Array.isArray(value.chats)) return chats;
  const sessionsDir = path.join(workspace, "sessions");
  for (const item of value.chats) {
    const chat = parseChat(item);
    if (chat)
      chats.set(path.normalize(chatSessionPath(sessionsDir, chat)), chat);
  }
  return chats;
}

async function safeSessionPath(
  sessionsRoot: string,
  candidate: string,
): Promise<string | null> {
  const stat = await fs.lstat(candidate).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) return null;
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(sessionsRoot).catch(() => null),
    fs.realpath(candidate).catch(() => null),
  ]);
  return realRoot && realCandidate && isPathInside(realRoot, realCandidate)
    ? realCandidate
    : null;
}

async function workspaceSessionFiles(workspace: string): Promise<string[]> {
  const sessionsRoot = path.join(workspace, "sessions");
  const top = await fs
    .readdir(sessionsRoot, { withFileTypes: true })
    .catch(() => []);
  const files: string[] = [];
  const addFile = async (candidate: string): Promise<void> => {
    if (files.length >= MAX_SESSION_SCAN_FILES) {
      throw new Error("AGENT_SESSION_SCAN_LIMIT");
    }
    const safe = await safeSessionPath(sessionsRoot, candidate);
    if (safe) files.push(safe);
  };
  for (const entry of top) {
    if (entry.isFile() && SESSION_FILE_PATTERN.test(entry.name)) {
      await addFile(path.join(sessionsRoot, entry.name));
      continue;
    }
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      entry.name.startsWith(".")
    ) {
      continue;
    }
    const channelDir = path.join(sessionsRoot, entry.name);
    const children = await fs
      .readdir(channelDir, { withFileTypes: true })
      .catch(() => []);
    for (const child of children) {
      if (child.isFile() && SESSION_FILE_PATTERN.test(child.name)) {
        await addFile(path.join(channelDir, child.name));
      }
    }
  }
  return files;
}

function isSyntheticMessage(value: Record<string, unknown>): boolean {
  if (sessionString(value.role)?.toLocaleLowerCase() !== "user") return false;
  const name = sessionString(value.name)?.toLocaleLowerCase();
  if (name && VISUAL_PLACEHOLDER_NAMES.has(name)) return true;
  const metadata = isSessionRecord(value.metadata) ? value.metadata : null;
  const tag = metadata ? sessionString(metadata.qwenpaw_tag) : null;
  return Boolean(tag && SYNTHETIC_TAGS.has(tag));
}

function cleanVisibleText(text: string, role: "user" | "assistant"): string {
  let cleaned = text.replace(
    /^[ \t]*(?:<!--)?[ \t]*[⟦〚][^\r\n]*[⟧〛][ \t]*(?:-->)?[ \t]*$/gm,
    "",
  );
  if (role === "user") {
    cleaned = cleaned.replace(/\s*<skill\b[^>]*>.*<\/skill>\s*$/s, "");
  }
  return cleaned.trim();
}

function visibleMessageText(
  value: Record<string, unknown>,
  role: "user" | "assistant",
): string {
  if (typeof value.content === "string") {
    return cleanVisibleText(value.content, role);
  }
  if (!Array.isArray(value.content)) return "";
  return value.content
    .flatMap((block) => {
      if (!isSessionRecord(block) || block.type !== "text") return [];
      const text = sessionString(block.text);
      return text ? [cleanVisibleText(text, role)] : [];
    })
    .filter(Boolean)
    .join("\n");
}

function parseMessage(value: unknown, index: number): CoPawMessage | null {
  if (!isSessionRecord(value) || isSyntheticMessage(value)) return null;
  const role = sessionString(value.role)?.toLocaleLowerCase();
  if (role !== "user" && role !== "assistant") return null;
  const text = visibleMessageText(value, role);
  if (!text) return null;
  const id = sessionString(value.id) || String(index);
  return {
    entry: {
      id,
      role,
      timestamp: sessionTimestamp(value.timestamp),
      text: text.slice(0, MAX_SESSION_ENTRY_TEXT),
    },
    searchableText: text.toLocaleLowerCase(),
    truncated: text.length > MAX_SESSION_ENTRY_TEXT,
  };
}

function sessionContext(
  value: unknown,
): { values: unknown[]; sessionId: string | null } | null {
  if (!isSessionRecord(value) || !isSessionRecord(value.agent)) return null;
  if (
    isSessionRecord(value.agent.state) &&
    Array.isArray(value.agent.state.context)
  ) {
    return {
      values: value.agent.state.context,
      sessionId: sessionString(value.agent.state.session_id),
    };
  }
  if (
    !isSessionRecord(value.agent.memory) ||
    !Array.isArray(value.agent.memory.content)
  ) {
    return null;
  }
  return {
    sessionId: null,
    values: value.agent.memory.content.map((item) =>
      Array.isArray(item) && item.length === 2 ? item[0] : item,
    ),
  };
}

function promptHubSessionId(workspace: string, sourcePath: string): string {
  return `copaw-${createHash("sha256")
    .update(workspace)
    .update("\0")
    .update(path.relative(workspace, sourcePath))
    .digest("hex")
    .slice(0, 32)}`;
}

async function parseSession(
  workspace: string,
  sourcePath: string,
  chat: ChatSpec | undefined,
): Promise<CoPawSession | null> {
  try {
    const [value, stat] = await Promise.all([
      readJson(sourcePath),
      fs.stat(sourcePath),
    ]);
    const context = sessionContext(value);
    if (!context) return null;
    const messages = context.values.flatMap((item, index) => {
      const parsed = parseMessage(item, index);
      return parsed ? [parsed] : [];
    });
    if (messages.length === 0) return null;
    const id = promptHubSessionId(workspace, sourcePath);
    const timestamps = messages.flatMap(({ entry }) => entry.timestamp ?? []);
    const title =
      chat?.name ||
      messages.find(({ entry }) => entry.role === "user")?.entry.text ||
      context.sessionId ||
      path.basename(sourcePath, ".json");
    return {
      metadata: {
        id,
        title: title.slice(0, MAX_SESSION_ENTRY_TEXT),
        projectLabel: path.basename(workspace) || workspace,
        projectPath: workspace,
        createdAt:
          chat?.createdAt ??
          (timestamps.length ? Math.min(...timestamps) : stat.birthtimeMs),
        updatedAt:
          chat?.updatedAt ??
          (timestamps.length ? Math.max(...timestamps) : stat.mtimeMs),
        model: null,
        messageCount: messages.length,
        sourcePath,
        resume: null,
      },
      messages,
      parseErrors: 0,
      revision: `${stat.size}:${stat.mtimeMs}`,
    };
  } catch {
    return null;
  }
}

async function loadSessions(rootPaths: string[]): Promise<CoPawSession[]> {
  const sessions: CoPawSession[] = [];
  for (const workspace of await resolveWorkspaces(rootPaths)) {
    const chats = await chatMap(workspace);
    for (const sourcePath of await workspaceSessionFiles(workspace)) {
      const parsed = await parseSession(
        workspace,
        sourcePath,
        chats.get(path.normalize(sourcePath)),
      );
      if (parsed) sessions.push(parsed);
    }
  }
  return sessions.sort(
    (left, right) =>
      (right.metadata.updatedAt || 0) - (left.metadata.updatedAt || 0) ||
      right.metadata.id.localeCompare(left.metadata.id),
  );
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
    value.revision !== revision
  ) {
    throw new Error(
      isSessionRecord(value) && value.revision !== revision
        ? "AGENT_SESSION_CURSOR_STALE"
        : "AGENT_SESSION_CURSOR_INVALID",
    );
  }
  return value.offset as number;
}

export function createCoPawSessionAdapter(rootPaths: string[]) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const query = search?.trim().toLocaleLowerCase();
      const sessions = (await loadSessions(rootPaths)).filter(
        (session) =>
          !query ||
          session.metadata.title.toLocaleLowerCase().includes(query) ||
          session.metadata.projectPath?.toLocaleLowerCase().includes(query) ||
          session.messages.some((message) =>
            message.searchableText.includes(query),
          ),
      );
      return {
        agentId: "copaw",
        adapter: ADAPTER,
        sessions: sessions
          .slice(offset, offset + limit)
          .map(({ metadata }) => metadata),
        total: sessions.length,
        hasMore: sessions.length > offset + limit,
      };
    },

    async read(
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
    ): Promise<AgentSessionDetail> {
      if (!/^copaw-[a-f0-9]{32}$/.test(sessionId)) {
        throw new Error("AGENT_SESSION_ID_INVALID");
      }
      const session = (await loadSessions(rootPaths)).find(
        ({ metadata }) => metadata.id === sessionId,
      );
      if (!session) throw new Error("AGENT_SESSION_NOT_FOUND");
      const start = decodeCursor(input.cursor, sessionId, session.revision);
      const limit = pageSize(input);
      const page = session.messages.slice(start, start + limit);
      const next = start + page.length;
      return {
        agentId: "copaw",
        adapter: ADAPTER,
        sessionId,
        entries: page.map(({ entry }) => entry),
        parseErrors: session.parseErrors,
        truncated: page.some(({ truncated }) => truncated),
        nextCursor:
          next < session.messages.length
            ? encodeCursor(sessionId, next, session.revision)
            : null,
      };
    },
  };
}
