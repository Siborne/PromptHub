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

interface CursorCandidate {
  id: string;
  path: string;
  projectLabel: string;
  updatedAt: number;
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

async function scanCursorCandidates(
  cursorRoot: string,
): Promise<CursorCandidate[]> {
  if (!(await fs.realpath(cursorRoot).catch(() => null))) return [];
  const projectsRoot = path.join(cursorRoot, "projects");
  const projects = await readDirectories(projectsRoot);
  const candidates: CursorCandidate[] = [];

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
        projectLabel: project.name,
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
      projectPath: null,
      createdAt: null,
      updatedAt: candidate.updatedAt,
      model: null,
      messageCount: entries.length || null,
      sourcePath: candidate.path,
      resume: {
        executable: "cursor-agent",
        args: ["--resume", candidate.id],
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

export function createCursorSessionAdapter(cursorRoot: string) {
  return {
    async list(
      limit: number,
      offset = 0,
      search?: string,
    ): Promise<AgentSessionListResult> {
      const candidates = await scanCursorCandidates(cursorRoot);
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
      const candidate = (await scanCursorCandidates(cursorRoot)).find(
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
