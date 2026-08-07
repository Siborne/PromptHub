import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import type {
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionEntry,
  AgentSessionIndexRecord,
  AgentSessionListResult,
  AgentSessionMetadata,
  AgentSessionScanRecordInput,
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
import {
  createOhMyPiSessionAdapter,
  createPiSessionAdapter,
} from "./agent-session-pi-family";
import { createWindsurfSessionAdapter } from "./agent-session-windsurf";
import { createKiroSessionAdapter } from "./agent-session-kiro";
import { createCopilotSessionAdapter } from "./agent-session-copilot";
import { createClineSessionAdapter } from "./agent-session-cline";
import { createCursorSessionAdapter } from "./agent-session-cursor";
import { createAntigravitySessionAdapter } from "./agent-session-antigravity";
import { createAugmentSessionAdapter } from "./agent-session-augment";
import { createCherryStudioSessionAdapter } from "./agent-session-cherry-studio";
import { createKiloSessionAdapter } from "./agent-session-kilo";
import { createHermesSessionAdapter } from "./agent-session-hermes";
import { createReasonixSessionAdapter } from "./agent-session-reasonix";
import { createNanoClawSessionAdapter } from "./agent-session-nanoclaw";
import { createCoPawSessionAdapter } from "./agent-session-copaw";
import { createQoderSessionAdapter } from "./agent-session-qoder";

interface AgentSessionServiceOptions {
  homeDir: string;
  commandRunner?: NativeCommandRunner;
  claudeConfigDir?: string;
  copilotRootDir?: string;
  clineRootDir?: string;
  cursorRootDir?: string;
  antigravityRootDir?: string;
  augmentRootDir?: string;
  cherryStudioRootDir?: string;
  kiloStorageRootDir?: string;
  hermesRootDir?: string;
  reasonixStateRootDir?: string;
  nanoclawRootDirs?: string[];
  copawRootDirs?: string[];
  qoderRootDir?: string;
  codexRootDir?: string;
  grokRootDir?: string;
  kimiRootDir?: string;
  openclawRootDir?: string;
  qwenRuntimeDir?: string;
  piRootDir?: string;
  ohMyPiRootDir?: string;
  kiroRootDir?: string;
}

interface ListOptions {
  limit: number;
  offset?: number;
  search?: string;
}

export interface AgentSessionIndexSourceDescriptor {
  platformId: string;
  rootPath: string;
  adapterId: string;
  adapterVersion: string;
}

export interface AgentSessionIndexScanProgress {
  processed: number;
  total: number;
}

export interface AgentSessionIndexScanOptions {
  previous: AgentSessionIndexRecord[];
  adapterVersionChanged: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: AgentSessionIndexScanProgress) => void;
}

export interface AgentSessionIndexScanResult {
  records: AgentSessionScanRecordInput[];
  scanCursor: string;
  status: "ok" | "partial";
}

interface SessionFile {
  id: string;
  path: string;
  projectLabel: string;
  size: number;
  updatedAt: number;
}

const MAX_LIST_LIMIT = 200;
const MAX_SCAN_FILES = 50_000;
const MAX_INDEX_SCAN_FILES = 10_000;
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
  digest: string;
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
      digest: `sha256:${createHash("sha256").update(buffer).digest("hex")}`,
    };
  } finally {
    await handle.close();
  }
}

async function scanClaudeFiles(
  root: string,
  maxFiles = MAX_SCAN_FILES,
  signal?: AbortSignal,
): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  throwIfAborted(signal);
  const projectEntries = await fs
    .readdir(root, { withFileTypes: true })
    .catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
  if (!projectEntries) return [];

  for (const projectEntry of projectEntries) {
    throwIfAborted(signal);
    if (!projectEntry.isDirectory() || projectEntry.isSymbolicLink()) continue;
    const projectPath = path.join(root, projectEntry.name);
    const entries = await fs
      .readdir(projectPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      throwIfAborted(signal);
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
      if (files.length >= maxFiles) throw new Error("AGENT_SESSION_SCAN_LIMIT");
      files.push({
        id: entry.name.slice(0, -".jsonl".length),
        path: filePath,
        projectLabel: projectEntry.name,
        size: stat.size,
        updatedAt: Math.trunc(stat.mtimeMs),
      });
    }
  }
  return files.sort((left, right) => right.updatedAt - left.updatedAt);
}

async function scanGeminiFiles(
  root: string,
  maxFiles = MAX_SCAN_FILES,
  signal?: AbortSignal,
): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  throwIfAborted(signal);
  const projectEntries = await fs
    .readdir(root, { withFileTypes: true })
    .catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
  if (!projectEntries) return [];

  for (const projectEntry of projectEntries) {
    throwIfAborted(signal);
    if (!projectEntry.isDirectory() || projectEntry.isSymbolicLink()) continue;
    const chatsPath = path.join(root, projectEntry.name, "chats");
    const entries = await fs
      .readdir(chatsPath, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      throwIfAborted(signal);
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
      if (files.length >= maxFiles) throw new Error("AGENT_SESSION_SCAN_LIMIT");
      files.push({
        id: entry.name.slice(0, -".json".length),
        path: filePath,
        projectLabel: projectEntry.name,
        size: stat.size,
        updatedAt: Math.trunc(stat.mtimeMs),
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

function parseClaudeMetadata(
  raw: string,
  fileId: string,
): { title: string | null; projectPath: string | null; resumeId: string } {
  let title: string | null = null;
  let projectPath: string | null = null;
  let resumeId = fileId;

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(value)) continue;

    const candidateId = stringValue(value.sessionId);
    if (candidateId && /^[A-Za-z0-9_-]{1,160}$/.test(candidateId)) {
      resumeId = candidateId;
    }
    const candidatePath = stringValue(value.cwd);
    if (
      !projectPath &&
      candidatePath &&
      path.isAbsolute(candidatePath) &&
      !candidatePath.includes("\0")
    ) {
      projectPath = candidatePath;
    }
    if (!title) {
      const entry = parseClaudeLine(line, index);
      if (entry?.role === "user") {
        title = entry.text.split("\n", 1)[0].slice(0, 160);
      }
    }
    if (title && projectPath) break;
  }

  return { title, projectPath, resumeId };
}

async function claudeMetadata(
  file: SessionFile,
): Promise<AgentSessionMetadata> {
  const { raw } = await readPrefix(file.path, MAX_METADATA_BYTES);
  const { title, projectPath, resumeId } = parseClaudeMetadata(raw, file.id);

  return {
    id: file.id,
    title: title || file.id,
    projectLabel: file.projectLabel,
    projectPath,
    createdAt: null,
    updatedAt: file.updatedAt,
    model: null,
    messageCount: null,
    sourcePath: file.path,
    resume: {
      executable: "claude",
      args: ["--resume", resumeId],
      ...(projectPath ? { cwd: projectPath } : {}),
    },
  };
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

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error("AGENT_SESSION_SCAN_CANCELLED");
  error.name = "AbortError";
  throw error;
}

function redactMetadataText(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/gi, "[REDACTED]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}\b/gi, "$1[REDACTED]")
    .replace(
      /\b(api[_ -]?key|token|secret|password)\s*[:=]\s*\S+/gi,
      "$1=[REDACTED]",
    );
}

function reusableRecord(
  file: SessionFile,
  previous: AgentSessionIndexRecord | undefined,
  adapterVersionChanged: boolean,
): AgentSessionScanRecordInput | null {
  if (
    adapterVersionChanged ||
    !previous ||
    previous.sourceMtimeMs !== file.updatedAt ||
    previous.sourceSizeBytes !== file.size
  ) {
    return null;
  }
  return {
    externalId: previous.externalId,
    title: previous.title,
    projectPath: previous.projectPath,
    createdAt: previous.createdAt,
    updatedAt: previous.updatedAt,
    model: previous.model,
    messageCount: previous.messageCount,
    redactedPreview: null,
    sourcePath: previous.sourcePath,
    sourceMtimeMs: previous.sourceMtimeMs,
    sourceSizeBytes: previous.sourceSizeBytes,
    sourceDigest: previous.sourceDigest,
    sourceStatus: previous.sourceStatus,
  };
}

function previousByPath(
  previous: AgentSessionIndexRecord[],
): Map<string, AgentSessionIndexRecord> {
  return new Map(previous.map((record) => [record.sourcePath, record]));
}

async function claudeScanRecord(
  file: SessionFile,
  previous: AgentSessionIndexRecord | undefined,
  adapterVersionChanged: boolean,
): Promise<AgentSessionScanRecordInput> {
  const reused = reusableRecord(file, previous, adapterVersionChanged);
  if (reused) return reused;
  const { raw, digest } = await readPrefix(file.path, MAX_METADATA_BYTES);
  let title: string | null = null;
  let validEntries = 0;
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const entry = parseClaudeLine(line, index);
    if (!entry) continue;
    validEntries += 1;
    if (!title && entry.role === "user") {
      title = entry.text.split("\n", 1)[0].slice(0, 160);
    }
  }
  return {
    externalId: file.id,
    title: redactMetadataText(title || file.id),
    projectPath: null,
    createdAt: null,
    updatedAt: file.updatedAt,
    model: null,
    messageCount: null,
    redactedPreview: null,
    sourcePath: file.path,
    sourceMtimeMs: file.updatedAt,
    sourceSizeBytes: file.size,
    sourceDigest: digest,
    sourceStatus: validEntries > 0 ? "present" : "parse-error",
  };
}

async function geminiScanRecord(
  file: SessionFile,
  previous: AgentSessionIndexRecord | undefined,
  adapterVersionChanged: boolean,
): Promise<AgentSessionScanRecordInput> {
  const reused = reusableRecord(file, previous, adapterVersionChanged);
  if (reused) return reused;
  const { raw, digest } = await readPrefix(file.path, MAX_METADATA_BYTES);
  const { data, parseErrorCount } = parseGeminiDocument(raw);
  if (!data) {
    return {
      externalId: file.id,
      title: file.id,
      projectPath: null,
      updatedAt: file.updatedAt,
      redactedPreview: null,
      sourcePath: file.path,
      sourceMtimeMs: file.updatedAt,
      sourceSizeBytes: file.size,
      sourceDigest: digest,
      sourceStatus: "parse-error",
    };
  }
  const id = stringValue(data.sessionId);
  const { entries, rejected } = geminiEntries(data);
  const firstUser = entries.find((entry) => entry.role === "user");
  const validId = id && isSessionId(id) ? id : file.id;
  return {
    externalId: validId,
    title: redactMetadataText(
      firstUser?.text.split("\n", 1)[0].slice(0, 160) || validId,
    ),
    projectPath: null,
    createdAt: normalizeTimestamp(data.startTime),
    updatedAt: normalizeTimestamp(data.lastUpdated) || file.updatedAt,
    model: null,
    messageCount: Array.isArray(data.messages) ? data.messages.length : null,
    redactedPreview: null,
    sourcePath: file.path,
    sourceMtimeMs: file.updatedAt,
    sourceSizeBytes: file.size,
    sourceDigest: digest,
    sourceStatus:
      id && isSessionId(id) && parseErrorCount + rejected === 0
        ? "present"
        : "parse-error",
  };
}

async function buildIndexScan(
  files: SessionFile[],
  options: AgentSessionIndexScanOptions,
  buildRecord: (
    file: SessionFile,
    previous: AgentSessionIndexRecord | undefined,
    adapterVersionChanged: boolean,
  ) => Promise<AgentSessionScanRecordInput>,
): Promise<AgentSessionIndexScanResult> {
  const prior = previousByPath(options.previous);
  const records: AgentSessionScanRecordInput[] = [];
  let partial = false;
  for (const file of files) {
    throwIfAborted(options.signal);
    const record = await buildRecord(
      file,
      prior.get(file.path),
      options.adapterVersionChanged,
    );
    records.push(record);
    partial ||= record.sourceStatus === "parse-error";
    options.onProgress?.({ processed: records.length, total: files.length });
  }
  throwIfAborted(options.signal);
  const newest = files[0];
  return {
    records,
    scanCursor: JSON.stringify({
      count: files.length,
      newestPath: newest?.path || null,
      newestMtimeMs: newest?.updatedAt || null,
    }),
    status: partial ? "partial" : "ok",
  };
}

export function createAgentSessionService(options: AgentSessionServiceOptions) {
  const commandRunner = options.commandRunner || createNativeCommandRunner();
  const claudeProjectsRoot = path.join(
    options.claudeConfigDir || path.join(options.homeDir, ".claude"),
    "projects",
  );
  const copilotRoot =
    options.copilotRootDir ||
    resolveEnvironmentRoot(
      process.env.COPILOT_HOME,
      options.homeDir,
      ".copilot",
    );
  const clineRoot =
    options.clineRootDir ||
    resolveEnvironmentRoot(
      process.env.CLINE_DATA_DIR,
      options.homeDir,
      ".cline",
    );
  const cursorRoot =
    options.cursorRootDir || path.join(options.homeDir, ".cursor");
  const geminiProjectsRoot = path.join(options.homeDir, ".gemini", "tmp");
  const kimiRoot =
    options.kimiRootDir || path.join(options.homeDir, ".kimi-code");
  const codexRoot =
    options.codexRootDir || path.join(options.homeDir, ".codex");
  const grokRoot = options.grokRootDir || path.join(options.homeDir, ".grok");
  const openclawRoot =
    options.openclawRootDir || path.join(options.homeDir, ".openclaw");
  const qwenRuntimeRoot = resolveQwenRuntimeRoot(options);
  const piRoot =
    options.piRootDir || path.join(options.homeDir, ".pi", "agent");
  const ohMyPiRoot =
    options.ohMyPiRootDir || path.join(options.homeDir, ".omp", "agent");
  const kiroRoot =
    options.kiroRootDir ||
    resolveEnvironmentRoot(process.env.KIRO_HOME, options.homeDir, ".kiro");
  const kimiAdapter = createKimiSessionAdapter(kimiRoot);
  const codexAdapter = createCodexSessionAdapter(codexRoot);
  const grokAdapter = createGrokSessionAdapter(grokRoot);
  const openclawAdapter = createOpenClawSessionAdapter(openclawRoot);
  const qwenAdapter = createQwenSessionAdapter(qwenRuntimeRoot, commandRunner);
  const piAdapter = createPiSessionAdapter(piRoot);
  const ohMyPiAdapter = createOhMyPiSessionAdapter(ohMyPiRoot);
  const windsurfAdapter = createWindsurfSessionAdapter(
    path.join(options.homeDir, ".windsurf", "transcripts"),
  );
  const kiroAdapter = createKiroSessionAdapter(kiroRoot);
  const copilotAdapter = createCopilotSessionAdapter(copilotRoot);
  const clineAdapter = createClineSessionAdapter(clineRoot);
  const cursorAdapter = createCursorSessionAdapter(cursorRoot);
  const antigravityAdapter = createAntigravitySessionAdapter(
    options.antigravityRootDir ||
      path.join(options.homeDir, ".gemini", "antigravity-cli"),
  );
  const augmentAdapter = createAugmentSessionAdapter(
    options.augmentRootDir || path.join(options.homeDir, ".augment"),
  );
  const cherryStudioAdapter = createCherryStudioSessionAdapter(
    options.cherryStudioRootDir || resolveCherryStudioRoot(options.homeDir),
  );
  const kiloAdapter = createKiloSessionAdapter(
    options.kiloStorageRootDir || resolveKiloStorageRoot(options.homeDir),
  );
  const hermesAdapter = createHermesSessionAdapter(
    options.hermesRootDir || resolveHermesRoot(options.homeDir),
  );
  const reasonixAdapter = createReasonixSessionAdapter(
    options.reasonixStateRootDir || resolveReasonixStateRoot(options.homeDir),
  );
  const nanoclawAdapter = createNanoClawSessionAdapter(
    options.nanoclawRootDirs || resolveNanoClawRoots(options.homeDir),
  );
  const copawAdapter = createCoPawSessionAdapter(
    options.copawRootDirs || resolveCoPawRoots(options.homeDir),
  );
  const qoderAdapter = createQoderSessionAdapter(
    options.qoderRootDir || path.join(options.homeDir, ".qoder"),
  );

  return {
    getIndexSource(agentId: string): AgentSessionIndexSourceDescriptor | null {
      if (agentId === "claude") {
        return {
          platformId: agentId,
          rootPath: claudeProjectsRoot,
          adapterId: "claude-jsonl-v1",
          adapterVersion: "1",
        };
      }
      if (agentId === "gemini") {
        return {
          platformId: agentId,
          rootPath: geminiProjectsRoot,
          adapterId: "gemini-json-v1",
          adapterVersion: "1",
        };
      }
      return null;
    },

    async scanIndex(
      agentId: string,
      input: AgentSessionIndexScanOptions,
    ): Promise<AgentSessionIndexScanResult> {
      if (agentId === "claude") {
        const files = await scanClaudeFiles(
          claudeProjectsRoot,
          MAX_INDEX_SCAN_FILES,
          input.signal,
        );
        return buildIndexScan(files, input, claudeScanRecord);
      }
      if (agentId === "gemini") {
        const files = await scanGeminiFiles(
          geminiProjectsRoot,
          MAX_INDEX_SCAN_FILES,
          input.signal,
        );
        return buildIndexScan(files, input, geminiScanRecord);
      }
      throw new Error("AGENT_SESSION_INDEX_UNSUPPORTED");
    },

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
        const sessions = await Promise.all(selected.map(claudeMetadata));
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

      if (agentId === "copilot") {
        return copilotAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "cline") {
        return clineAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "cursor") {
        return cursorAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "antigravity") {
        return antigravityAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "augment") {
        return augmentAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "cherry-studio") {
        return cherryStudioAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "kilo") {
        return kiloAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "hermes") {
        return hermesAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "reasonix") {
        return reasonixAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "nanoclaw") {
        return nanoclawAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "copaw") {
        return copawAdapter.list(input.limit, offset, input.search);
      }

      if (agentId === "qoder") {
        return qoderAdapter.list(input.limit, offset, input.search);
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

      if (agentId === "pi") {
        return piAdapter.list(input.limit, offset);
      }

      if (agentId === "oh-my-pi") {
        return ohMyPiAdapter.list(input.limit, offset);
      }

      if (agentId === "windsurf") {
        return windsurfAdapter.list(input.limit, offset);
      }

      if (agentId === "kiro") {
        return kiroAdapter.list(input.limit, offset);
      }

      throw new Error("AGENT_SESSION_UNSUPPORTED");
    },

    async read(
      agentId: string,
      sessionId: string,
      input: AgentSessionDetailPageInput = {},
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

      if (agentId === "copilot") {
        return copilotAdapter.read(sessionId);
      }

      if (agentId === "cline") {
        return clineAdapter.read(sessionId);
      }

      if (agentId === "cursor") {
        return cursorAdapter.read(sessionId);
      }

      if (agentId === "antigravity") {
        return antigravityAdapter.read(sessionId);
      }

      if (agentId === "augment") {
        return augmentAdapter.read(sessionId, input);
      }

      if (agentId === "cherry-studio") {
        return cherryStudioAdapter.read(sessionId, input);
      }

      if (agentId === "kilo") {
        return kiloAdapter.read(sessionId, input);
      }

      if (agentId === "hermes") {
        return hermesAdapter.read(sessionId, input);
      }

      if (agentId === "reasonix") {
        return reasonixAdapter.read(sessionId, input);
      }

      if (agentId === "nanoclaw") {
        return nanoclawAdapter.read(sessionId, input);
      }

      if (agentId === "copaw") {
        return copawAdapter.read(sessionId, input);
      }

      if (agentId === "qoder") {
        return qoderAdapter.read(sessionId, input);
      }

      if (agentId === "kimi") {
        return kimiAdapter.read(sessionId);
      }

      if (agentId === "codex") {
        return codexAdapter.read(sessionId, input);
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

      if (agentId === "pi") {
        return piAdapter.read(sessionId, input);
      }

      if (agentId === "oh-my-pi") {
        return ohMyPiAdapter.read(sessionId, input);
      }

      if (agentId === "windsurf") {
        return windsurfAdapter.read(sessionId);
      }

      if (agentId === "kiro") {
        return kiroAdapter.read(sessionId);
      }

      throw new Error("AGENT_SESSION_UNSUPPORTED");
    },
  };
}

function resolveEnvironmentRoot(
  configured: string | undefined,
  homeDir: string,
  fallback: string,
): string {
  if (!configured?.trim() || configured.includes("\0")) {
    return path.join(homeDir, fallback);
  }
  const expanded = configured.trim().replace(/^~(?=$|[\\/])/, homeDir);
  return path.isAbsolute(expanded)
    ? path.normalize(expanded)
    : path.join(homeDir, fallback);
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

function resolveCherryStudioRoot(homeDir: string): string {
  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "CherryStudio");
  }
  if (process.platform === "win32") {
    return resolveEnvironmentRoot(
      process.env.APPDATA,
      homeDir,
      path.join("AppData", "Roaming", "CherryStudio"),
    );
  }
  return resolveEnvironmentRoot(
    process.env.XDG_CONFIG_HOME,
    homeDir,
    path.join(".config", "CherryStudio"),
  );
}

function resolveKiloStorageRoot(homeDir: string): string {
  const dataRoot = resolveEnvironmentRoot(
    process.env.XDG_DATA_HOME,
    homeDir,
    path.join(".local", "share"),
  );
  return path.join(dataRoot, "kilo", "storage");
}

function resolveHermesRoot(homeDir: string): string {
  if (process.env.HERMES_HOME?.trim()) {
    return resolveEnvironmentRoot(
      process.env.HERMES_HOME,
      homeDir,
      path.join(homeDir, ".hermes"),
    );
  }
  if (process.platform === "win32") {
    const localAppData = resolveEnvironmentRoot(
      process.env.LOCALAPPDATA,
      homeDir,
      path.join("AppData", "Local"),
    );
    return path.join(localAppData, "hermes");
  }
  return path.join(homeDir, ".hermes");
}

function resolveReasonixStateRoot(homeDir: string): string {
  return resolveEnvironmentRoot(
    process.env.REASONIX_STATE_HOME || process.env.REASONIX_HOME,
    homeDir,
    ".reasonix",
  );
}

function resolveNanoClawRoots(homeDir: string): string[] {
  return [".nanoclaw", "nanoclaw", "nanoclaw-v2"].map((name) =>
    path.join(homeDir, name),
  );
}

function resolveCoPawRoots(homeDir: string): string[] {
  const explicit =
    process.env.QWENPAW_WORKING_DIR || process.env.COPAW_WORKING_DIR;
  if (explicit?.trim()) {
    return [resolveEnvironmentRoot(explicit, homeDir, ".qwenpaw")];
  }
  return [path.join(homeDir, ".qwenpaw"), path.join(homeDir, ".copaw")];
}
