import { lstat, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";

import { parseSkillMd } from "@prompthub/core/skills/skill-frontmatter";
import type {
  AgentDefinitionEntry,
  AgentDefinitionKind,
  AgentDefinitionListResult,
  AgentDefinitionScope,
} from "@prompthub/shared/types";

export interface QwenDefinitionLimits {
  maxDepth: number;
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxVisitedEntries: number;
}

export interface QwenDefinitionFileSystem {
  lstat: typeof lstat;
  open: typeof open;
  opendir: typeof opendir;
  realpath: typeof realpath;
}

export const QWEN_DEFINITION_LIMITS: QwenDefinitionLimits = {
  maxDepth: 8,
  maxEntries: 200,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 2 * 1024 * 1024,
  maxVisitedEntries: 1_000,
};

const NODE_FILE_SYSTEM: QwenDefinitionFileSystem = {
  lstat,
  open,
  opendir,
  realpath,
};

interface QwenDefinitionRootInput {
  rootPath: string;
  scope: AgentDefinitionScope;
}

interface QwenDefinitionPathInput extends QwenDefinitionRootInput {
  kind: AgentDefinitionKind;
  relativePath: string;
}

interface ScanState {
  entries: AgentDefinitionEntry[];
  readBytes: number;
  skippedSymlinks: number;
  skippedUnsafe: number;
  truncated: boolean;
  visitedEntries: number;
}

const SENSITIVE_METADATA_PATTERN =
  /(?:api[\s_-]*key|access[\s_-]*token|refresh[\s_-]*token|auth(?:orization)?|bearer\s+\S+|password|passwd|secret|cookie|private[\s_-]*key|(?:^|[^a-z0-9])sk-[a-z0-9_-]{8,}|gh[pousr]_[a-z0-9]{8,}|eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,})/i;
const MAX_METADATA_TEXT = 1_000;
const MAX_TOOL_ITEMS = 64;
const MAX_TOOL_TEXT = 128;

function mergedLimits(
  overrides: Partial<QwenDefinitionLimits> | undefined,
): QwenDefinitionLimits {
  const limits = { ...QWEN_DEFINITION_LIMITS, ...overrides };
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error("QWEN_DEFINITION_LIMIT_INVALID");
    }
  }
  return limits;
}

function definitionRoot(input: QwenDefinitionRootInput): string {
  if (
    !path.isAbsolute(input.rootPath) ||
    input.rootPath.includes("\0") ||
    !["user", "project"].includes(input.scope)
  ) {
    throw new Error("QWEN_DEFINITION_ROOT_INVALID");
  }
  return input.scope === "project"
    ? path.join(input.rootPath, ".qwen")
    : input.rootPath;
}

function kindDirectory(kind: AgentDefinitionKind): string {
  return kind === "subagent" ? "agents" : "commands";
}

function safeRelativePath(relativePath: string): string | null {
  if (
    !relativePath ||
    relativePath.includes("\0") ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  ) {
    return null;
  }
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    normalized !== path.posix.normalize(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.split("/").includes("..")
  ) {
    return null;
  }
  return normalized;
}

function isContained(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function sanitizeMetadata(
  value: unknown,
  warnings: Set<string>,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, MAX_METADATA_TEXT);
  if (!normalized) return null;
  if (SENSITIVE_METADATA_PATTERN.test(normalized)) {
    warnings.add("sensitive-metadata-redacted");
    return "[REDACTED]";
  }
  if (value.trim().length > MAX_METADATA_TEXT) {
    warnings.add("metadata-truncated");
  }
  return normalized;
}

function stringList(
  value: unknown,
  warnings: Set<string>,
): { value: string[]; valid: boolean } {
  if (value === undefined) return { value: [], valid: true };
  const values = Array.isArray(value) ? value : [value];
  if (values.length > MAX_TOOL_ITEMS) {
    warnings.add("invalid-metadata");
    return { value: [], valid: false };
  }
  const output: string[] = [];
  for (const item of values) {
    if (
      typeof item !== "string" ||
      !item.trim() ||
      item.length > MAX_TOOL_TEXT
    ) {
      warnings.add("invalid-metadata");
      return { value: [], valid: false };
    }
    const safe = sanitizeMetadata(item, warnings);
    if (safe) output.push(safe);
  }
  return { value: output, valid: true };
}

function commandName(relativePath: string): string {
  return relativePath
    .replace(/\.md$/i, "")
    .split("/")
    .filter(Boolean)
    .join(":");
}

function invalidEntry(
  input: {
    kind: AgentDefinitionKind;
    scope: AgentDefinitionScope;
    relativePath: string;
    size: number;
    modifiedAt: number;
  },
  warnings: string[],
): AgentDefinitionEntry {
  return {
    ...input,
    name:
      input.kind === "command"
        ? commandName(input.relativePath)
        : path.posix.basename(input.relativePath, ".md"),
    description: null,
    model: null,
    approvalMode: null,
    tools: [],
    disallowedTools: [],
    status: warnings.includes("file-too-large") ? "oversized" : "invalid",
    warnings,
  };
}

function parseDefinition(input: {
  content: string;
  kind: AgentDefinitionKind;
  scope: AgentDefinitionScope;
  relativePath: string;
  size: number;
  modifiedAt: number;
}): AgentDefinitionEntry {
  const parsed = parseSkillMd(input.content);
  if (!parsed) {
    return invalidEntry(input, ["invalid-frontmatter"]);
  }

  const warnings = new Set<string>();
  const raw = parsed.rawFrontmatter;
  const bodyMissing = !parsed.body.trim();
  if (bodyMissing) warnings.add("missing-body");

  if (input.kind === "command") {
    const description = sanitizeMetadata(raw.description, warnings);
    return {
      kind: input.kind,
      scope: input.scope,
      relativePath: input.relativePath,
      name: commandName(input.relativePath),
      description,
      model: null,
      approvalMode: null,
      tools: [],
      disallowedTools: [],
      status: bodyMissing ? "invalid" : "valid",
      warnings: [...warnings],
      size: input.size,
      modifiedAt: input.modifiedAt,
    };
  }

  const name = sanitizeMetadata(raw.name, warnings);
  const description = sanitizeMetadata(raw.description, warnings);
  const model = sanitizeMetadata(raw.model, warnings);
  const approvalMode = sanitizeMetadata(raw.approvalMode, warnings);
  const tools = stringList(raw.tools, warnings);
  const disallowedTools = stringList(raw.disallowedTools, warnings);
  const requiredMissing = !name || !description || bodyMissing;
  if (!name) warnings.add("missing-name");
  if (!description) warnings.add("missing-description");

  return {
    kind: input.kind,
    scope: input.scope,
    relativePath: input.relativePath,
    name: name ?? path.posix.basename(input.relativePath, ".md"),
    description,
    model,
    approvalMode,
    tools: tools.value,
    disallowedTools: disallowedTools.value,
    status:
      requiredMissing || !tools.valid || !disallowedTools.valid
        ? "invalid"
        : "valid",
    warnings: [...warnings],
    size: input.size,
    modifiedAt: input.modifiedAt,
  };
}

async function readBoundedFile(
  fileSystem: QwenDefinitionFileSystem,
  filePath: string,
  size: number,
): Promise<string> {
  const handle = await fileSystem.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await handle.read(buffer, 0, size, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function scanDirectory(
  input: {
    baseRealPath: string;
    currentPath: string;
    depth: number;
    kind: AgentDefinitionKind;
    scope: AgentDefinitionScope;
    relativePrefix: string;
  },
  state: ScanState,
  limits: QwenDefinitionLimits,
  fileSystem: QwenDefinitionFileSystem,
): Promise<void> {
  if (state.truncated || input.depth > limits.maxDepth) {
    if (input.depth > limits.maxDepth) state.truncated = true;
    return;
  }

  let directory;
  try {
    directory = await fileSystem.opendir(input.currentPath);
  } catch {
    state.skippedUnsafe += 1;
    return;
  }

  for await (const dirent of directory) {
    state.visitedEntries += 1;
    if (state.visitedEntries > limits.maxVisitedEntries) {
      state.visitedEntries = limits.maxVisitedEntries;
      state.truncated = true;
      break;
    }
    if (dirent.isSymbolicLink()) {
      state.skippedSymlinks += 1;
      continue;
    }

    const relativePath = input.relativePrefix
      ? `${input.relativePrefix}/${dirent.name}`
      : dirent.name;
    const targetPath = path.join(input.currentPath, dirent.name);
    if (dirent.isDirectory()) {
      if (input.kind === "command") {
        await scanDirectory(
          {
            ...input,
            currentPath: targetPath,
            depth: input.depth + 1,
            relativePrefix: relativePath,
          },
          state,
          limits,
          fileSystem,
        );
      }
      if (state.truncated) break;
      continue;
    }
    if (!dirent.isFile() || !/\.md$/i.test(dirent.name)) continue;
    if (state.entries.length >= limits.maxEntries) {
      state.truncated = true;
      break;
    }

    let fileStat;
    let targetRealPath;
    try {
      [fileStat, targetRealPath] = await Promise.all([
        fileSystem.lstat(targetPath),
        fileSystem.realpath(targetPath),
      ]);
    } catch {
      state.skippedUnsafe += 1;
      continue;
    }
    if (
      fileStat.isSymbolicLink() ||
      !fileStat.isFile() ||
      !isContained(input.baseRealPath, targetRealPath)
    ) {
      state.skippedUnsafe += 1;
      continue;
    }
    if (fileStat.size > limits.maxFileBytes) {
      state.entries.push(
        invalidEntry(
          {
            kind: input.kind,
            scope: input.scope,
            relativePath,
            size: fileStat.size,
            modifiedAt: fileStat.mtimeMs,
          },
          ["file-too-large"],
        ),
      );
      continue;
    }
    if (state.readBytes + fileStat.size > limits.maxTotalBytes) {
      state.truncated = true;
      break;
    }

    try {
      const content = await readBoundedFile(
        fileSystem,
        targetRealPath,
        fileStat.size,
      );
      state.readBytes += Buffer.byteLength(content);
      state.entries.push(
        parseDefinition({
          content,
          kind: input.kind,
          scope: input.scope,
          relativePath,
          size: fileStat.size,
          modifiedAt: fileStat.mtimeMs,
        }),
      );
    } catch {
      state.skippedUnsafe += 1;
    }
  }
}

async function scanKind(
  rootPath: string,
  scope: AgentDefinitionScope,
  kind: AgentDefinitionKind,
  state: ScanState,
  limits: QwenDefinitionLimits,
  fileSystem: QwenDefinitionFileSystem,
): Promise<void> {
  const directoryPath = path.join(rootPath, kindDirectory(kind));
  let directoryStat;
  let directoryRealPath;
  try {
    [directoryStat, directoryRealPath] = await Promise.all([
      fileSystem.lstat(directoryPath),
      fileSystem.realpath(directoryPath),
    ]);
  } catch {
    return;
  }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    state.skippedSymlinks += Number(directoryStat.isSymbolicLink());
    state.skippedUnsafe += Number(!directoryStat.isSymbolicLink());
    return;
  }
  await scanDirectory(
    {
      baseRealPath: directoryRealPath,
      currentPath: directoryRealPath,
      depth: 0,
      kind,
      scope,
      relativePrefix: "",
    },
    state,
    limits,
    fileSystem,
  );
}

export async function listQwenDefinitions(
  input: QwenDefinitionRootInput,
  limitOverrides?: Partial<QwenDefinitionLimits>,
  fileSystem: QwenDefinitionFileSystem = NODE_FILE_SYSTEM,
): Promise<AgentDefinitionListResult> {
  const rootPath = definitionRoot(input);
  const limits = mergedLimits(limitOverrides);
  const state: ScanState = {
    entries: [],
    readBytes: 0,
    skippedSymlinks: 0,
    skippedUnsafe: 0,
    truncated: false,
    visitedEntries: 0,
  };

  await scanKind(rootPath, input.scope, "subagent", state, limits, fileSystem);
  if (!state.truncated) {
    await scanKind(rootPath, input.scope, "command", state, limits, fileSystem);
  }
  state.entries.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.relativePath.localeCompare(right.relativePath),
  );
  return {
    agentId: "qwen",
    scope: input.scope,
    entries: state.entries,
    truncated: state.truncated,
    visitedEntries: state.visitedEntries,
    readBytes: state.readBytes,
    skippedSymlinks: state.skippedSymlinks,
    skippedUnsafe: state.skippedUnsafe,
  };
}

export async function resolveQwenDefinitionPath(
  input: QwenDefinitionPathInput,
  fileSystem: QwenDefinitionFileSystem = NODE_FILE_SYSTEM,
): Promise<string> {
  const rootPath = definitionRoot(input);
  const relativePath = safeRelativePath(input.relativePath);
  if (!relativePath || !/\.md$/i.test(relativePath)) {
    throw new Error("QWEN_DEFINITION_PATH_INVALID");
  }

  const directoryPath = path.join(rootPath, kindDirectory(input.kind));
  const targetPath = path.join(directoryPath, ...relativePath.split("/"));
  let directoryStat;
  let targetStat;
  let directoryRealPath;
  let targetRealPath;
  try {
    [directoryStat, targetStat, directoryRealPath, targetRealPath] =
      await Promise.all([
        fileSystem.lstat(directoryPath),
        fileSystem.lstat(targetPath),
        fileSystem.realpath(directoryPath),
        fileSystem.realpath(targetPath),
      ]);
  } catch {
    throw new Error("QWEN_DEFINITION_PATH_INVALID");
  }
  if (
    directoryStat.isSymbolicLink() ||
    !directoryStat.isDirectory() ||
    targetStat.isSymbolicLink() ||
    !targetStat.isFile() ||
    !isContained(directoryRealPath, targetRealPath)
  ) {
    throw new Error("QWEN_DEFINITION_PATH_INVALID");
  }
  return targetRealPath;
}
