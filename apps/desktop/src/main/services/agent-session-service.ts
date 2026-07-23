import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import type {
  AgentSessionDetail,
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import {
  createNativeCommandRunner,
  type NativeCommandRunner,
} from "./native-command";
import { createKimiSessionAdapter } from "./agent-session-kimi";
import { createCodexSessionAdapter } from "./agent-session-codex";
import { createGrokSessionAdapter } from "./agent-session-grok";
import { createOpenClawSessionAdapter } from "./agent-session-openclaw";
import { createQwenSessionAdapter } from "./agent-session-qwen";

interface AgentSessionServiceOptions {
  homeDir: string;
  commandRunner?: NativeCommandRunner;
  claudeConfigDir?: string;
  codexRootDir?: string;
  grokRootDir?: string;
  kimiRootDir?: string;
  openclawRootDir?: string;
  qwenRuntimeDir?: string;
}

interface ListOptions {
  limit: number;
  offset?: number;
}

interface SessionFile {
  id: string;
  path: string;
  projectLabel: string;
  size: number;
  updatedAt: number;
}

const MAX_LIST_LIMIT = 200;
const MAX_SCAN_FILES = 2_000;
const MAX_DETAIL_BYTES = 2 * 1024 * 1024;
const MAX_METADATA_BYTES = 256 * 1024;
const MAX_ENTRY_TEXT = 64 * 1024;
const COMMAND_OPTIONS = {
  timeout: 30_000,
  maxBuffer: MAX_DETAIL_BYTES,
};

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new Error("AGENT_SESSION_LIMIT_INVALID");
  }
}

function assertOffset(offset: number, limit: number): void {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset + limit > MAX_SCAN_FILES
  ) {
    throw new Error("AGENT_SESSION_OFFSET_INVALID");
  }
}

function assertSessionId(sessionId: string): void {
  if (!isSessionId(sessionId)) {
    throw new Error("AGENT_SESSION_ID_INVALID");
  }
}

function isSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function collectText(value: unknown, depth = 0): string[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectText(item, depth + 1));
  }
  if (!isRecord(value)) return [];
  const direct = [
    value.text,
    value.content,
    value.message,
    value.result,
  ].flatMap((item) => collectText(item, depth + 1));
  return direct.length > 0 ? direct : [];
}

function boundedText(value: unknown): string {
  return collectText(value).join("\n").slice(0, MAX_ENTRY_TEXT);
}

function normalizeTimestamp(value: unknown): number | null {
  const numeric = numberValue(value);
  if (numeric !== null)
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const text = stringValue(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRole(value: unknown): AgentSessionEntry["role"] {
  const role = stringValue(value)?.toLowerCase();
  if (
    role === "user" ||
    role === "assistant" ||
    role === "tool" ||
    role === "system"
  ) {
    return role;
  }
  return "unknown";
}

async function readPrefix(
  filePath: string,
  maxBytes: number,
): Promise<{
  raw: string;
  truncated: boolean;
}> {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const bytesToRead = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, 0);
    return {
      raw: buffer.toString("utf8"),
      truncated: stat.size > maxBytes,
    };
  } finally {
    await handle.close();
  }
}

async function scanClaudeFiles(root: string): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  const projectEntries = await fs
    .readdir(root, { withFileTypes: true })
    .catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
  if (!projectEntries) return [];

  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory() || projectEntry.isSymbolicLink()) continue;
    const projectPath = path.join(root, projectEntry.name);
    const entries = await fs
      .readdir(projectPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (files.length >= MAX_SCAN_FILES) return files;
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name.endsWith(".jsonl")
      ) {
        continue;
      }
      const filePath = path.join(projectPath, entry.name);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat?.isFile()) continue;
      files.push({
        id: entry.name.slice(0, -".jsonl".length),
        path: filePath,
        projectLabel: projectEntry.name,
        size: stat.size,
        updatedAt: stat.mtimeMs,
      });
    }
  }
  return files.sort((left, right) => right.updatedAt - left.updatedAt);
}

async function scanGeminiFiles(root: string): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  const projectEntries = await fs
    .readdir(root, { withFileTypes: true })
    .catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
  if (!projectEntries) return [];

  for (const projectEntry of projectEntries) {
    if (!projectEntry.isDirectory() || projectEntry.isSymbolicLink()) continue;
    const chatsPath = path.join(root, projectEntry.name, "chats");
    const entries = await fs
      .readdir(chatsPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      if (files.length >= MAX_SCAN_FILES) return files;
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name.endsWith(".json")
      ) {
        continue;
      }
      const filePath = path.join(chatsPath, entry.name);
      const stat = await fs.lstat(filePath).catch(() => null);
      if (!stat?.isFile() || stat.isSymbolicLink()) continue;
      files.push({
        id: entry.name.slice(0, -".json".length),
        path: filePath,
        projectLabel: projectEntry.name,
        size: stat.size,
        updatedAt: stat.mtimeMs,
      });
    }
  }
  return files.sort((left, right) => right.updatedAt - left.updatedAt);
}

function parseClaudeLine(
  line: string,
  index: number,
): AgentSessionEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const message = isRecord(value.message) ? value.message : value;
  const text = boundedText(message.content ?? message);
  if (!text) return null;
  return {
    id: `${index}`,
    role: normalizeRole(message.role ?? value.type),
    timestamp: normalizeTimestamp(value.timestamp),
    text,
  };
}

async function claudeTitle(filePath: string): Promise<string> {
  const { raw } = await readPrefix(filePath, 128 * 1024);
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const entry = parseClaudeLine(line, index);
    if (entry?.role === "user")
      return entry.text.split("\n", 1)[0].slice(0, 160);
  }
  return path.basename(filePath, ".jsonl");
}

function parseGeminiDocument(raw: string): {
  data: Record<string, unknown> | null;
  parseErrorCount: number;
} {
  const errors: ParseError[] = [];
  const value = parseJsonc(raw, errors, {
    allowTrailingComma: false,
    disallowComments: true,
  });
  return {
    data: isRecord(value) ? value : null,
    parseErrorCount: errors.length,
  };
}

function geminiEntries(data: Record<string, unknown>): {
  entries: AgentSessionEntry[];
  rejected: number;
} {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const entries = messages
    .map((message, index): AgentSessionEntry | null => {
      if (!isRecord(message)) return null;
      const text = boundedText(message.content ?? message);
      if (!text) return null;
      const rawRole = stringValue(message.type)?.toLowerCase();
      const role = rawRole === "gemini" ? "assistant" : normalizeRole(rawRole);
      return {
        id: stringValue(message.id) || `${index}`,
        role,
        timestamp: normalizeTimestamp(message.timestamp),
        text,
      };
    })
    .filter((entry): entry is AgentSessionEntry => Boolean(entry));
  return { entries, rejected: messages.length - entries.length };
}

async function geminiMetadata(
  file: SessionFile,
): Promise<AgentSessionMetadata | null> {
  const { raw } = await readPrefix(file.path, MAX_METADATA_BYTES);
  const { data } = parseGeminiDocument(raw);
  if (!data) return null;
  const id = stringValue(data.sessionId);
  if (!id || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return null;
  const { entries } = geminiEntries(data);
  const firstUser = entries.find((entry) => entry.role === "user");
  return {
    id,
    title: firstUser?.text.split("\n", 1)[0].slice(0, 160) || id,
    projectLabel: file.projectLabel,
    projectPath: null,
    createdAt: normalizeTimestamp(data.startTime),
    updatedAt: normalizeTimestamp(data.lastUpdated) || file.updatedAt,
    model: null,
    messageCount: Array.isArray(data.messages) ? data.messages.length : null,
    sourcePath: file.path,
    resume: {
      executable: "gemini",
      args: ["--resume", id],
    },
  };
}

function parseOpenCodeSession(
  value: unknown,
  executable: string,
): AgentSessionMetadata | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return null;
  const title = stringValue(value.title) || id;
  const projectPath = stringValue(value.directory);
  return {
    id,
    title,
    projectLabel: projectPath ? path.basename(projectPath) : null,
    projectPath,
    createdAt: normalizeTimestamp(value.created),
    updatedAt: normalizeTimestamp(value.updated),
    model: stringValue(value.model),
    messageCount: numberValue(value.messageCount),
    sourcePath: null,
    resume: {
      executable,
      args: ["--session", id],
      ...(projectPath ? { cwd: projectPath } : {}),
    },
  };
}

function parseOpenCodeDetail(
  raw: string,
  sessionId: string,
): AgentSessionDetail {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("AGENT_SESSION_EXPORT_INVALID");
  }
  const messages =
    isRecord(value) && Array.isArray(value.messages) ? value.messages : [];
  const entries = messages
    .map((message, index): AgentSessionEntry | null => {
      if (!isRecord(message)) return null;
      const text = boundedText(message.content ?? message.parts ?? message);
      if (!text) return null;
      return {
        id: stringValue(message.id) || `${index}`,
        role: normalizeRole(
          message.role ?? getNestedValue(message, ["info", "role"]),
        ),
        timestamp: normalizeTimestamp(message.created ?? message.time),
        text,
      };
    })
    .filter((entry): entry is AgentSessionEntry => Boolean(entry));
  return {
    agentId: "opencode",
    adapter: "opencode-cli-v1",
    sessionId,
    entries,
    parseErrors: messages.length - entries.length,
    truncated: false,
  };
}

function getNestedValue(value: unknown, keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function isMissing(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export function createAgentSessionService(options: AgentSessionServiceOptions) {
  const commandRunner = options.commandRunner || createNativeCommandRunner();
  const claudeProjectsRoot = path.join(
    options.claudeConfigDir || path.join(options.homeDir, ".claude"),
    "projects",
  );
  const geminiProjectsRoot = path.join(options.homeDir, ".gemini", "tmp");
  const kimiRoot =
    options.kimiRootDir || path.join(options.homeDir, ".kimi-code");
  const codexRoot =
    options.codexRootDir || path.join(options.homeDir, ".codex");
  const grokRoot = options.grokRootDir || path.join(options.homeDir, ".grok");
  const openclawRoot =
    options.openclawRootDir || path.join(options.homeDir, ".openclaw");
  const qwenRuntimeRoot = resolveQwenRuntimeRoot(options);
  const kimiAdapter = createKimiSessionAdapter(kimiRoot);
  const codexAdapter = createCodexSessionAdapter(codexRoot);
  const grokAdapter = createGrokSessionAdapter(grokRoot);
  const openclawAdapter = createOpenClawSessionAdapter(openclawRoot);
  const qwenAdapter = createQwenSessionAdapter(qwenRuntimeRoot, commandRunner);

  return {
    async list(
      agentId: string,
      input: ListOptions,
    ): Promise<AgentSessionListResult> {
      assertLimit(input.limit);
      const offset = input.offset ?? 0;
      assertOffset(offset, input.limit);
      if (agentId === "claude") {
        const files = await scanClaudeFiles(claudeProjectsRoot);
        const selected = files.slice(offset, offset + input.limit);
        const sessions = await Promise.all(
          selected.map(
            async (file): Promise<AgentSessionMetadata> => ({
              id: file.id,
              title: await claudeTitle(file.path),
              projectLabel: file.projectLabel,
              projectPath: null,
              createdAt: null,
              updatedAt: file.updatedAt,
              model: null,
              messageCount: null,
              sourcePath: file.path,
              resume: {
                executable: "claude",
                args: ["--resume", file.id],
              },
            }),
          ),
        );
        return {
          agentId,
          adapter: "claude-jsonl-v1",
          sessions,
          total: files.length,
          hasMore: files.length > offset + input.limit,
        };
      }

      if (agentId === "opencode") {
        const executable = await commandRunner.resolve("opencode");
        if (!executable) throw new Error("AGENT_SESSION_COMMAND_NOT_FOUND");
        const result = await commandRunner.run(
          executable,
          [
            "session",
            "list",
            "--format",
            "json",
            "--max-count",
            String(offset + input.limit + 1),
          ],
          COMMAND_OPTIONS,
        );
        let parsed: unknown;
        if (!result.stdout.trim()) {
          parsed = [];
        } else {
          try {
            parsed = JSON.parse(result.stdout);
          } catch {
            throw new Error("AGENT_SESSION_LIST_INVALID");
          }
        }
        const rows = Array.isArray(parsed)
          ? parsed
          : isRecord(parsed) && Array.isArray(parsed.sessions)
            ? parsed.sessions
            : [];
        const normalized = rows
          .map((row) => parseOpenCodeSession(row, executable))
          .filter((row): row is AgentSessionMetadata => Boolean(row));
        return {
          agentId,
          adapter: "opencode-cli-v1",
          sessions: normalized.slice(offset, offset + input.limit),
          total: normalized.length,
          hasMore: normalized.length > offset + input.limit,
        };
      }

      if (agentId === "gemini") {
        const files = await scanGeminiFiles(geminiProjectsRoot);
        const sessions: AgentSessionMetadata[] = [];
        for (const file of files.slice(offset, offset + input.limit)) {
          const session = await geminiMetadata(file);
          if (session) sessions.push(session);
        }
        return {
          agentId,
          adapter: "gemini-json-v1",
          sessions,
          total: files.length,
          hasMore: files.length > offset + input.limit,
        };
      }

      if (agentId === "kimi") {
        return kimiAdapter.list(input.limit, offset);
      }

      if (agentId === "codex") {
        return codexAdapter.list(input.limit, offset);
      }

      if (agentId === "grok") {
        return grokAdapter.list(input.limit, offset);
      }

      if (agentId === "openclaw") {
        return openclawAdapter.list(input.limit, offset);
      }

      if (agentId === "qwen") {
        return qwenAdapter.list(input.limit, offset);
      }

      throw new Error("AGENT_SESSION_UNSUPPORTED");
    },

    async read(
      agentId: string,
      sessionId: string,
    ): Promise<AgentSessionDetail> {
      assertSessionId(sessionId);
      if (agentId === "claude") {
        const file = (await scanClaudeFiles(claudeProjectsRoot)).find(
          (candidate) => candidate.id === sessionId,
        );
        if (!file) throw new Error("AGENT_SESSION_NOT_FOUND");
        const { raw, truncated } = await readPrefix(
          file.path,
          MAX_DETAIL_BYTES,
        );
        let parseErrors = 0;
        const entries: AgentSessionEntry[] = [];
        for (const [index, line] of raw.split(/\r?\n/).entries()) {
          if (!line.trim()) continue;
          const entry = parseClaudeLine(line, index);
          if (entry) entries.push(entry);
          else parseErrors += 1;
        }
        return {
          agentId,
          adapter: "claude-jsonl-v1",
          sessionId,
          entries,
          parseErrors,
          truncated,
        };
      }

      if (agentId === "opencode") {
        const executable = await commandRunner.resolve("opencode");
        if (!executable) throw new Error("AGENT_SESSION_COMMAND_NOT_FOUND");
        const result = await commandRunner.run(
          executable,
          ["export", sessionId, "--sanitize"],
          COMMAND_OPTIONS,
        );
        return parseOpenCodeDetail(result.stdout, sessionId);
      }

      if (agentId === "gemini") {
        const files = await scanGeminiFiles(geminiProjectsRoot);
        for (const file of files) {
          const metadata = await geminiMetadata(file);
          if (metadata?.id !== sessionId) continue;
          const { raw, truncated } = await readPrefix(
            file.path,
            MAX_DETAIL_BYTES,
          );
          const { data, parseErrorCount } = parseGeminiDocument(raw);
          if (!data) throw new Error("AGENT_SESSION_INVALID");
          const { entries, rejected } = geminiEntries(data);
          return {
            agentId,
            adapter: "gemini-json-v1",
            sessionId,
            entries,
            parseErrors: parseErrorCount + rejected,
            truncated,
          };
        }
        throw new Error("AGENT_SESSION_NOT_FOUND");
      }

      if (agentId === "kimi") {
        return kimiAdapter.read(sessionId);
      }

      if (agentId === "codex") {
        return codexAdapter.read(sessionId);
      }

      if (agentId === "grok") {
        return grokAdapter.read(sessionId);
      }

      if (agentId === "openclaw") {
        return openclawAdapter.read(sessionId);
      }

      if (agentId === "qwen") {
        return qwenAdapter.read(sessionId);
      }

      throw new Error("AGENT_SESSION_UNSUPPORTED");
    },
  };
}

function resolveQwenRuntimeRoot(options: AgentSessionServiceOptions): string {
  const configured =
    options.qwenRuntimeDir ||
    process.env.QWEN_RUNTIME_DIR ||
    process.env.QWEN_HOME ||
    path.join(options.homeDir, ".qwen");
  if (configured.includes("\0")) return path.join(options.homeDir, ".qwen");
  const expanded = configured.replace(/^~(?=$|[\\/])/, options.homeDir);
  return path.resolve(expanded);
}
