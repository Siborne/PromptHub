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

export const CURSOR_SESSION_ADAPTER = "cursor-agent-transcript-v1";

const MAX_PROJECTS = 1_000;
const MAX_SESSION_DIRECTORIES = 2_000;
const MAX_METADATA_BYTES = 64 * 1024;
const MAX_READ_CONCURRENCY = 8;
const MAX_PROJECT_RESOLVE_DIRECTORIES = 64;
const MAX_DIRECTORY_ENTRIES = 4_096;

interface CursorCandidate {
  id: string;
  path: string;
  projectLabel: string;
  projectPath: string | null;
  updatedAt: number;
}

interface CursorProjectResolver {
  homeDir: string;
  homeKey: string;
  directories: Map<string, string[] | null>;
  openedDirectories: number;
}

interface CursorMetadata {
  metadata: AgentSessionMetadata;
  searchableText: string;
}

function isMissing(error: unknown): boolean {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function visibleCursorEntry(
  value: Record<string, unknown>,
  index: number,
): AgentSessionEntry | null {
  const role = sessionString(value.role)?.toLowerCase();
  if (role !== "user" && role !== "assistant") return null;
  const message = isSessionRecord(value.message) ? value.message : value;
  const text = boundedSessionText(message.content ?? message);
  if (!text) return null;
  return {
    id: sessionString(value.id) || `${index}`,
    role,
    timestamp: sessionTimestamp(
      value.timestamp ?? message.timestamp ?? message.createdAt,
    ),
    text,
  };
}

function parseCursorTranscript(raw: string) {
  return parseVisibleJsonLines(raw, visibleCursorEntry);
}

async function readDirectories(directory: string) {
  return fs
    .readdir(directory, { withFileTypes: true })
    .catch((error: unknown) => {
      if (isMissing(error)) return [];
      throw error;
    });
}

function cursorProjectKey(projectPath: string): string {
  const root = path.parse(projectPath).root;
  return path.relative(root, projectPath).split(path.sep).join("-");
}

function createCursorProjectResolver(homeDir: string): CursorProjectResolver {
  const normalizedHome = path.resolve(homeDir);
  return {
    homeDir: normalizedHome,
    homeKey: cursorProjectKey(normalizedHome),
    directories: new Map(),
    openedDirectories: 0,
  };
}

async function boundedChildDirectories(
  resolver: CursorProjectResolver,
  directory: string,
): Promise<string[] | null> {
  const cached = resolver.directories.get(directory);
  if (cached !== undefined) return cached;
  if (resolver.openedDirectories >= MAX_PROJECT_RESOLVE_DIRECTORIES) {
    return null;
  }
  resolver.openedDirectories += 1;
  const handle = await fs.opendir(directory).catch(() => null);
  if (!handle) {
    resolver.directories.set(directory, null);
    return null;
  }
  const children: string[] = [];
  let entryCount = 0;
  try {
    for await (const entry of handle) {
      entryCount += 1;
      if (entryCount > MAX_DIRECTORY_ENTRIES) {
        resolver.directories.set(directory, null);
        return null;
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        children.push(entry.name);
      }
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
  resolver.directories.set(directory, children);
  return children;
}

async function resolveCursorProjectPath(
  resolver: CursorProjectResolver,
  projectKey: string,
): Promise<string | null> {
  if (projectKey === resolver.homeKey) return resolver.homeDir;
  const prefix = `${resolver.homeKey}-`;
  if (!resolver.homeKey || !projectKey.startsWith(prefix)) return null;
  const queue = [
    {
      directory: resolver.homeDir,
      remaining: projectKey.slice(prefix.length),
    },
  ];
  const matches = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = await boundedChildDirectories(resolver, current.directory);
    if (!children) return null;
    for (const child of children) {
      if (current.remaining === child) {
        matches.add(path.join(current.directory, child));
        if (matches.size > 1) return null;
      } else if (current.remaining.startsWith(`${child}-`)) {
        queue.push({
          directory: path.join(current.directory, child),
          remaining: current.remaining.slice(child.length + 1),
        });
      }
    }
  }
  return matches.size === 1 ? [...matches][0] : null;
}

async function compactCursorProjectLabel(
  resolver: CursorProjectResolver,
  projectKey: string,
): Promise<string> {
  const prefix = `${resolver.homeKey}-`;
  if (!resolver.homeKey || !projectKey.startsWith(prefix)) return projectKey;
  let directory = resolver.homeDir;
  let remaining = projectKey.slice(prefix.length);
  if (!remaining) return projectKey;
  for (;;) {
    const children = await boundedChildDirectories(resolver, directory);
    if (!children || children.includes(remaining)) return remaining;
    const prefixes = children.filter((child) =>
      remaining.startsWith(`${child}-`),
    );
    if (prefixes.length !== 1) return remaining;
    directory = path.join(directory, prefixes[0]);
    remaining = remaining.slice(prefixes[0].length + 1);
  }
}

async function scanCursorCandidates(
  cursorRoot: string,
  homeDir: string,
): Promise<CursorCandidate[]> {
  if (!(await fs.realpath(cursorRoot).catch(() => null))) return [];
  const projectsRoot = path.join(cursorRoot, "projects");
  const projects = await readDirectories(projectsRoot);
  const candidates: CursorCandidate[] = [];
  const projectResolver = createCursorProjectResolver(homeDir);

  for (const project of projects.slice(0, MAX_PROJECTS)) {
    if (
      !project.isDirectory() ||
      project.isSymbolicLink() ||
      candidates.length >= MAX_SESSION_DIRECTORIES
    ) {
      continue;
    }
    const transcriptRoot = path.join(
      projectsRoot,
      project.name,
      "agent-transcripts",
    );
    const sessions = await readDirectories(transcriptRoot);
    if (sessions.length === 0) continue;
    const projectPath = await resolveCursorProjectPath(
      projectResolver,
      project.name,
    );
    const projectLabel = projectPath
      ? path.basename(projectPath) || projectPath
      : await compactCursorProjectLabel(projectResolver, project.name);
    for (const session of sessions) {
      if (
        !session.isDirectory() ||
        session.isSymbolicLink() ||
        !isSafeSessionId(session.name) ||
        candidates.length >= MAX_SESSION_DIRECTORIES
      ) {
        continue;
      }
      const candidatePath = path.join(
        transcriptRoot,
        session.name,
        `${session.name}.jsonl`,
      );
      const safePath = await safeSessionFile(cursorRoot, candidatePath);
      if (!safePath) continue;
      const stat = await fs.stat(safePath).catch(() => null);
      if (!stat?.isFile()) continue;
      candidates.push({
        id: session.name,
        path: safePath,
        projectLabel,
        projectPath,
        updatedAt: stat.mtimeMs,
      });
    }
  }

  return candidates.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || left.id.localeCompare(right.id),
  );
}

async function mapBounded<T, R>(
  values: T[],
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const run = async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await worker(values[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MAX_READ_CONCURRENCY, values.length) }, run),
  );
  return results;
}

function metadataFromCandidate(
  candidate: CursorCandidate,
  entries: AgentSessionEntry[],
): CursorMetadata {
  const firstUser = entries.find((entry) => entry.role === "user");
  const title = firstUser?.text.split("\n", 1)[0].slice(0, 160) || candidate.id;
  const searchableText = [
    candidate.id,
    candidate.projectLabel,
    title,
    ...entries.map((entry) => entry.text),
  ].join("\n");
  return {
    metadata: {
      id: candidate.id,
      title,
      projectLabel: candidate.projectLabel,
      projectPath: candidate.projectPath,
      createdAt: null,
      updatedAt: candidate.updatedAt,
      model: null,
      messageCount: entries.length || null,
      sourcePath: candidate.path,
      resume: {
        executable: "cursor-agent",
        args: ["--resume", candidate.id],
        ...(candidate.projectPath ? { cwd: candidate.projectPath } : {}),
      },
    },
    searchableText,
  };
}

async function readMetadata(
  candidate: CursorCandidate,
): Promise<CursorMetadata | null> {
  try {
    const { raw } = await readSessionPrefix(candidate.path, MAX_METADATA_BYTES);
    return metadataFromCandidate(candidate, parseCursorTranscript(raw).entries);
  } catch {
    return null;
  }
}

function matchesSearch(metadata: CursorMetadata, search: string): boolean {
  return metadata.searchableText.toLocaleLowerCase().includes(search);
}

export function createCursorSessionAdapter(
  cursorRoot: string,
  homeDir: string,
) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const candidates = await scanCursorCandidates(cursorRoot, homeDir);
      const normalizedSearch = search?.trim().toLocaleLowerCase();
      const source = normalizedSearch
        ? candidates
        : candidates.slice(offset, offset + limit);
      const metadata = await mapBounded(source, readMetadata);
      const valid = metadata.filter(
        (item): item is CursorMetadata =>
          Boolean(item) &&
          (!normalizedSearch || matchesSearch(item, normalizedSearch)),
      );
      const sessions = normalizedSearch
        ? valid.slice(offset, offset + limit).map((item) => item.metadata)
        : valid.map((item) => item.metadata);
      const total = normalizedSearch ? valid.length : candidates.length;
      return {
        agentId: "cursor",
        adapter: CURSOR_SESSION_ADAPTER,
        sessions,
        total,
        hasMore: total > offset + limit,
      };
    },

    async read(sessionId: string): Promise<AgentSessionDetail> {
      const candidate = (await scanCursorCandidates(cursorRoot, homeDir)).find(
        (item) => item.id === sessionId,
      );
      if (!candidate) throw new Error("AGENT_SESSION_NOT_FOUND");
      const { raw, truncated } = await readSessionPrefix(
        candidate.path,
        MAX_SESSION_DETAIL_BYTES,
      );
      const parsed = parseCursorTranscript(raw);
      return {
        agentId: "cursor",
        adapter: CURSOR_SESSION_ADAPTER,
        sessionId,
        entries: parsed.entries,
        parseErrors: parsed.parseErrors,
        truncated,
      };
    },
  };
}
