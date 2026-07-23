import fs from "node:fs/promises";
import path from "node:path";

import type { AgentSessionEntry } from "@prompthub/shared/types";

export const MAX_SESSION_DETAIL_BYTES = 2 * 1024 * 1024;
export const MAX_SESSION_ENTRY_TEXT = 64 * 1024;
export const MAX_SESSION_SCAN_FILES = 2_000;

export interface ScannedSessionFile {
  path: string;
  size: number;
  updatedAt: number;
}

export function isSessionRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sessionString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sessionNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sessionTimestamp(value: unknown): number | null {
  const numeric = sessionNumber(value);
  if (numeric !== null) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const text = sessionString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sessionText(value: unknown, depth = 0): string[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => sessionText(item, depth + 1));
  }
  if (!isSessionRecord(value)) return [];
  return [value.text, value.content, value.message, value.result].flatMap(
    (item) => sessionText(item, depth + 1),
  );
}

export function boundedSessionText(value: unknown): string {
  return sessionText(value).join("\n").slice(0, MAX_SESSION_ENTRY_TEXT);
}

export function isSafeSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

export function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

export async function readSessionPrefix(
  filePath: string,
  maxBytes: number,
): Promise<{ raw: string; truncated: boolean }> {
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

export async function safeSessionFile(
  root: string,
  candidate: string,
): Promise<string | null> {
  if (!path.isAbsolute(candidate) || !isPathInside(root, candidate))
    return null;
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(root).catch(() => null),
    fs.realpath(candidate).catch(() => null),
  ]);
  if (!realRoot || !realCandidate || !isPathInside(realRoot, realCandidate)) {
    return null;
  }
  const stat = await fs.lstat(realCandidate).catch(() => null);
  return stat?.isFile() && !stat.isSymbolicLink() ? realCandidate : null;
}

export async function scanSessionFiles(
  root: string,
  matches: (name: string) => boolean,
  maxDepth: number,
): Promise<ScannedSessionFile[]> {
  const files: ScannedSessionFile[] = [];
  const queue: Array<{ dir: string; depth: number }> = [
    { dir: root, depth: 0 },
  ];
  while (queue.length > 0 && files.length < MAX_SESSION_SCAN_FILES) {
    const current = queue.shift();
    if (!current) break;
    const entries = await fs
      .readdir(current.dir, { withFileTypes: true })
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const candidate = path.join(current.dir, entry.name);
      if (entry.isDirectory() && current.depth < maxDepth) {
        queue.push({ dir: candidate, depth: current.depth + 1 });
      } else if (entry.isFile() && matches(entry.name)) {
        const stat = await fs.stat(candidate).catch(() => null);
        if (stat?.isFile()) {
          files.push({
            path: candidate,
            size: stat.size,
            updatedAt: stat.mtimeMs,
          });
        }
      }
      if (files.length >= MAX_SESSION_SCAN_FILES) break;
    }
  }
  return files;
}

export function parseVisibleJsonLines(
  raw: string,
  parse: (
    value: Record<string, unknown>,
    index: number,
  ) => AgentSessionEntry | null,
): { entries: AgentSessionEntry[]; parseErrors: number } {
  const entries: AgentSessionEntry[] = [];
  let parseErrors = 0;
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      parseErrors += 1;
      continue;
    }
    if (!isSessionRecord(value)) {
      parseErrors += 1;
      continue;
    }
    const entry = parse(value, index);
    if (entry) entries.push(entry);
  }
  return { entries, parseErrors };
}
