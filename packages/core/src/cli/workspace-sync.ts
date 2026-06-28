import fs from "fs";
import path from "path";

import {
  isDatabaseEmpty,
  type DatabaseAdapter,
  type FolderDB,
  type PromptDB,
  type SkillDB,
} from "../database";
import { CoreMcpLibraryService, getMcpLibraryFilePath } from "../mcp-library";
import {
  CorePluginLibraryService,
  getPluginLibraryFilePath,
} from "../plugin-library";
import { coreRulesWorkspaceService } from "../rules-workspace";
import { getImagesDir, getVideosDir } from "../runtime-paths";
import type {
  AgentAssetFileSnapshot,
  AgentAssetFilesSnapshot,
  SyncSnapshot,
} from "@prompthub/shared/types/sync";
import type { PromptVersion } from "@prompthub/shared/types/prompt";

const WORKSPACE_BUNDLE_KIND = "prompthub-cli-workspace";
const WORKSPACE_BUNDLE_VERSION = 2;
const MAX_AGENT_ASSET_FILE_BYTES = 5 * 1024 * 1024;
const MAX_AGENT_ASSET_FILE_COUNT = 5000;
const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  ".venv",
  "__pycache__",
  ".cache",
]);

export interface CliWorkspaceBundleV2 {
  kind: typeof WORKSPACE_BUNDLE_KIND;
  version: typeof WORKSPACE_BUNDLE_VERSION;
  exportedAt: string;
  payload: SyncSnapshot;
}

interface LegacyCliWorkspaceBundleV1 {
  kind: typeof WORKSPACE_BUNDLE_KIND;
  version: 1;
  exportedAt: string;
  prompts: SyncSnapshot["prompts"];
  folders: SyncSnapshot["folders"];
  versions: PromptVersion[];
}

export interface CliWorkspaceSummary {
  prompts: number;
  folders: number;
  versions: number;
  rules: number;
  skills: number;
  skillVersions: number;
  mcpServers: number;
  plugins: number;
}

export interface ParsedCliWorkspaceBundle {
  exportedAt: string;
  payload: SyncSnapshot;
  legacyVersion: 1 | 2 | "raw-sync";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRelativePath(relativePath: string): string {
  if (/[\u0000-\u001F\u007F]/u.test(relativePath)) {
    throw new Error(`Agent asset path contains control characters: ${relativePath}`);
  }

  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  const withoutPrefix = normalized.replace(/^\.\//, "");
  if (
    !withoutPrefix ||
    withoutPrefix === "." ||
    withoutPrefix === ".." ||
    withoutPrefix.startsWith("../") ||
    path.posix.isAbsolute(withoutPrefix) ||
    /^[a-zA-Z]:/u.test(relativePath)
  ) {
    throw new Error(`Unsafe agent asset path: ${relativePath}`);
  }
  return withoutPrefix;
}

function ensureInsideDirectory(rootDir: string, candidatePath: string): void {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to write outside agent asset directory: ${candidate}`);
  }
}

function exportAgentAssetDirectorySnapshot(rootDir: string): AgentAssetFileSnapshot[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const files: AgentAssetFileSnapshot[] = [];
  const queue = [path.resolve(rootDir)];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_AGENT_ASSET_FILE_BYTES) {
        throw new Error(`Agent asset file exceeds sync limit: ${entry.name}`);
      }
      if (files.length >= MAX_AGENT_ASSET_FILE_COUNT) {
        throw new Error(`Agent asset file count exceeds sync limit: ${rootDir}`);
      }

      files.push({
        relativePath: normalizeRelativePath(path.relative(rootDir, fullPath)),
        contentBase64: fs.readFileSync(fullPath).toString("base64"),
        size: stat.size,
      });
    }
  }
  return files;
}

function restoreAgentAssetDirectorySnapshot(
  rootDir: string,
  files: AgentAssetFileSnapshot[],
): void {
  const tempDir = `${rootDir}.sync-tmp-${process.pid}-${Date.now()}`;
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    for (const file of files) {
      const relativePath = normalizeRelativePath(file.relativePath);
      const targetPath = path.join(tempDir, ...relativePath.split("/"));
      ensureInsideDirectory(tempDir, targetPath);
      const content = Buffer.from(file.contentBase64, "base64");
      if (content.length !== file.size) {
        throw new Error(`Agent asset file size mismatch: ${relativePath}`);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content);
    }

    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(rootDir), { recursive: true });
    fs.renameSync(tempDir, rootDir);
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function readMediaDirectory(dir: string): Record<string, string> | undefined {
  if (!fs.existsSync(dir)) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    const filePath = path.join(dir, entry.name);
    result[entry.name] = fs.readFileSync(filePath).toString("base64");
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function writeMediaDirectory(dir: string, files: Record<string, string> | undefined): void {
  if (!files) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  for (const [fileName, contentBase64] of Object.entries(files)) {
    const relativePath = normalizeRelativePath(fileName);
    if (relativePath.includes("/")) {
      throw new Error(`Unsafe media file name: ${fileName}`);
    }
    fs.writeFileSync(path.join(dir, relativePath), Buffer.from(contentBase64, "base64"));
  }
}

function createAgentAssetFilesSnapshot(): AgentAssetFilesSnapshot | undefined {
  const mcp = exportAgentAssetDirectorySnapshot(path.dirname(getMcpLibraryFilePath()));
  const plugins = exportAgentAssetDirectorySnapshot(path.dirname(getPluginLibraryFilePath()));
  const snapshot: AgentAssetFilesSnapshot = {};
  if (mcp.length > 0) snapshot.mcp = mcp;
  if (plugins.length > 0) snapshot.plugins = plugins;
  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}

export function createCliWorkspaceSummary(snapshot: SyncSnapshot): CliWorkspaceSummary {
  return {
    prompts: snapshot.prompts.length,
    folders: snapshot.folders.length,
    versions: (snapshot.versions ?? snapshot.promptVersions).length,
    rules: snapshot.rules?.length ?? 0,
    skills: snapshot.skills.length,
    skillVersions: snapshot.skillVersions.length,
    mcpServers: snapshot.mcpLibrary?.servers.length ?? 0,
    plugins: snapshot.pluginLibrary?.plugins.length ?? 0,
  };
}

export async function createCliWorkspaceBundle(
  promptDb: PromptDB,
  folderDb: FolderDB,
  skillDb: SkillDB,
): Promise<CliWorkspaceBundleV2> {
  const prompts = promptDb.getAll();
  const promptVersions = prompts.flatMap((prompt) => promptDb.getVersions(prompt.id));
  const skills = skillDb.getAll();
  const skillVersions = skills.flatMap((skill) => skillDb.getVersions(skill.id));
  const pluginSnapshot = new CorePluginLibraryService().exportSnapshot();
  const exportedAt = new Date().toISOString();
  const payload: SyncSnapshot = {
    version: "prompthub-cli-workspace-v2",
    exportedAt,
    prompts,
    promptVersions,
    versions: promptVersions,
    folders: folderDb.getAll(),
    rules: await coreRulesWorkspaceService.exportRuleBackupRecords(),
    skills,
    skillVersions,
    mcpLibrary: new CoreMcpLibraryService().read(),
    pluginLibrary: pluginSnapshot.library,
    pluginPackages: pluginSnapshot.packages,
    agentAssetFiles: createAgentAssetFilesSnapshot(),
    images: readMediaDirectory(getImagesDir()),
    videos: readMediaDirectory(getVideosDir()),
  };

  return {
    kind: WORKSPACE_BUNDLE_KIND,
    version: WORKSPACE_BUNDLE_VERSION,
    exportedAt,
    payload,
  };
}

function snapshotFromLegacyBundle(bundle: LegacyCliWorkspaceBundleV1): SyncSnapshot {
  return {
    version: "prompthub-cli-workspace-v1",
    exportedAt: bundle.exportedAt,
    prompts: bundle.prompts,
    promptVersions: bundle.versions,
    versions: bundle.versions,
    folders: bundle.folders,
    rules: [],
    skills: [],
    skillVersions: [],
  };
}

function assertSyncSnapshotShape(value: Record<string, unknown>): SyncSnapshot {
  if (
    typeof value.version !== "string" ||
    typeof value.exportedAt !== "string" ||
    !Array.isArray(value.prompts) ||
    !Array.isArray(value.folders) ||
    !Array.isArray(value.skills)
  ) {
    throw new Error("workspace import file has invalid SyncSnapshot shape");
  }
  const promptVersions = Array.isArray(value.promptVersions)
    ? value.promptVersions
    : Array.isArray(value.versions)
      ? value.versions
      : [];
  return {
    ...(value as unknown as SyncSnapshot),
    promptVersions: promptVersions as PromptVersion[],
    versions: (Array.isArray(value.versions) ? value.versions : promptVersions) as PromptVersion[],
    skillVersions: Array.isArray(value.skillVersions)
      ? (value.skillVersions as SyncSnapshot["skillVersions"])
      : [],
  };
}

export function parseCliWorkspaceBundle(text: string): ParsedCliWorkspaceBundle {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("workspace import file must be a JSON object");
  }

  if (
    parsed.kind === WORKSPACE_BUNDLE_KIND &&
    parsed.version === 1 &&
    Array.isArray(parsed.prompts) &&
    Array.isArray(parsed.folders) &&
    Array.isArray(parsed.versions)
  ) {
    const legacy = parsed as unknown as LegacyCliWorkspaceBundleV1;
    return {
      exportedAt: legacy.exportedAt,
      payload: snapshotFromLegacyBundle(legacy),
      legacyVersion: 1,
    };
  }

  if (parsed.kind === WORKSPACE_BUNDLE_KIND && parsed.version === 2 && isRecord(parsed.payload)) {
    const payload = assertSyncSnapshotShape(parsed.payload);
    return {
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : payload.exportedAt,
      payload,
      legacyVersion: 2,
    };
  }

  if (typeof parsed.version === "string" && Array.isArray(parsed.prompts)) {
    const payload = assertSyncSnapshotShape(parsed);
    return {
      exportedAt: payload.exportedAt,
      payload,
      legacyVersion: "raw-sync",
    };
  }

  throw new Error("workspace import file format is unsupported");
}

export function clearCliWorkspaceData(db: DatabaseAdapter.Database): void {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM prompt_versions").run();
    db.prepare("DELETE FROM prompts").run();
    db.prepare("DELETE FROM folders").run();
    db.prepare("DELETE FROM skill_versions").run();
    db.prepare("DELETE FROM skills").run();
  });
  transaction();
}

export async function hasCliWorkspaceData(db: DatabaseAdapter.Database): Promise<boolean> {
  if (!isDatabaseEmpty(db)) {
    return true;
  }
  if ((await coreRulesWorkspaceService.exportRuleBackupRecords()).length > 0) {
    return true;
  }
  if (new CoreMcpLibraryService().read().servers.length > 0) {
    return true;
  }
  if (new CorePluginLibraryService().read().plugins.length > 0) {
    return true;
  }
  return false;
}

export async function restoreCliWorkspaceSnapshot(
  snapshot: SyncSnapshot,
  dbs: {
    promptDb: PromptDB;
    folderDb: FolderDB;
    skillDb: SkillDB;
  },
): Promise<CliWorkspaceSummary> {
  for (const folder of snapshot.folders) {
    dbs.folderDb.insertFolderDirect(folder);
  }
  for (const prompt of snapshot.prompts) {
    dbs.promptDb.insertPromptDirect(prompt);
  }
  for (const version of snapshot.versions ?? snapshot.promptVersions) {
    dbs.promptDb.insertVersionDirect(version);
  }
  for (const skill of snapshot.skills) {
    dbs.skillDb.insertSkillDirect(skill);
  }
  for (const version of snapshot.skillVersions) {
    dbs.skillDb.insertVersionDirect(version);
  }

  if (snapshot.rules) {
    await coreRulesWorkspaceService.importRuleBackupRecords(snapshot.rules, {
      replace: true,
    });
  }

  if (snapshot.agentAssetFiles?.mcp) {
    restoreAgentAssetDirectorySnapshot(
      path.dirname(getMcpLibraryFilePath()),
      snapshot.agentAssetFiles.mcp,
    );
  }
  if (snapshot.agentAssetFiles?.plugins) {
    restoreAgentAssetDirectorySnapshot(
      path.dirname(getPluginLibraryFilePath()),
      snapshot.agentAssetFiles.plugins,
    );
  }
  if (snapshot.mcpLibrary) {
    new CoreMcpLibraryService().write(snapshot.mcpLibrary);
  }
  if (snapshot.pluginLibrary) {
    new CorePluginLibraryService().restoreSnapshot({
      library: snapshot.pluginLibrary,
      packages: snapshot.pluginPackages,
    });
  }
  writeMediaDirectory(getImagesDir(), snapshot.images);
  writeMediaDirectory(getVideosDir(), snapshot.videos);

  return createCliWorkspaceSummary(snapshot);
}
