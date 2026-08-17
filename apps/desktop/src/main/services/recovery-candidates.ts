import fs from "fs";
import path from "path";

import type {
  RecoveryCandidate,
  RecoveryContentCounts,
  RecoveryDataSource,
  RecoveryPreviewItemKind,
  RecoveryPreviewItem,
  RecoveryPreviewResult,
  UpgradeBackupEntry,
} from "@prompthub/shared/types";

import DatabaseAdapter from "../database/sqlite";
import type { RecoverableDatabase } from "../database";
import {
  detectResidualLegacyEntries,
  getDataLayoutMigrationMarkerPath,
} from "./data-layout-migration";

const PREVIEW_LIMIT = 12;

function countWorkspacePromptFiles(targetPath: string): number {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    return 0;
  }

  if (!stat.isDirectory()) {
    return path.basename(targetPath) === "prompt.md" ? 1 : 0;
  }

  let total = 0;
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    total += countWorkspacePromptFiles(path.join(targetPath, entry.name));
  }
  return total;
}

function readWorkspaceFolderCount(foldersFile: string): number {
  if (!fs.existsSync(foldersFile)) {
    return 0;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(foldersFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function countDirectEntriesSafe(dirPath: string): number {
  try {
    if (!fs.existsSync(dirPath)) {
      return 0;
    }

    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() || entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

function latestModifiedIso(targetPath: string): string | null {
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return stat.mtime.toISOString();
    }

    let latest = stat.mtimeMs;
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const childIso = latestModifiedIso(path.join(targetPath, entry.name));
      if (!childIso) {
        continue;
      }
      const childTime = new Date(childIso).getTime();
      if (!Number.isNaN(childTime)) {
        latest = Math.max(latest, childTime);
      }
    }
    return new Date(latest).toISOString();
  } catch {
    return null;
  }
}

function inferDataSources(raw: RecoverableDatabase): RecoveryDataSource[] {
  const sources: RecoveryDataSource[] = [];
  if (raw.hasDatabaseFile) {
    sources.push("sqlite");
  }
  if (raw.hasWorkspaceData) {
    sources.push("workspace");
  }
  if (raw.hasBrowserStorage) {
    sources.push("browser-storage");
  }
  if (raw.skillCount > 0) {
    sources.push("skills");
  }
  const contentSourceMap: Array<
    [keyof RecoveryContentCounts, RecoveryDataSource]
  > = [
    ["mcp", "mcp"],
    ["rules", "rules"],
    ["plugins", "plugins"],
    ["config", "config"],
    ["media", "media"],
    ["otherData", "other-data"],
  ];
  for (const [kind, source] of contentSourceMap) {
    if ((raw.contentCounts?.[kind] ?? 0) > 0) sources.push(source);
  }
  return sources;
}

function candidateDescription(
  type: RecoveryCandidate["sourceType"],
  sources: RecoveryDataSource[],
): string | null {
  if (type === "current-residual") {
    return "Detected residual legacy layout data in the current data directory.";
  }
  if (type === "standalone-db-backup") {
    return "Detected a standalone SQLite backup file created before the upgrade.";
  }
  if (type === "upgrade-backup") {
    return "Detected an automatic upgrade snapshot.";
  }
  if (sources.length === 1 && sources[0] === "browser-storage") {
    return "Detected legacy renderer storage only. Preview is limited before recovery.";
  }
  return null;
}

export function buildResidualLegacyRecoveryCandidate(
  currentPath: string,
): RecoveryCandidate | null {
  const migrationMarker = getDataLayoutMigrationMarkerPath(currentPath);
  if (!fs.existsSync(migrationMarker)) {
    return null;
  }

  const residual = detectResidualLegacyEntries(currentPath);
  if (residual.length === 0) {
    return null;
  }

  const promptCount = Math.max(
    countWorkspacePromptFiles(path.join(currentPath, "workspace", "prompts")),
    countWorkspacePromptFiles(path.join(currentPath, "data", "prompts")),
  );
  const folderCount = Math.max(
    readWorkspaceFolderCount(
      path.join(currentPath, "workspace", "folders.json"),
    ),
    readWorkspaceFolderCount(path.join(currentPath, "data", "folders.json")),
  );
  const skillCount = Math.max(
    countDirectEntriesSafe(path.join(currentPath, "skills")),
    countDirectEntriesSafe(path.join(currentPath, "data", "skills")),
  );

  if (promptCount === 0 && folderCount === 0 && skillCount === 0) {
    return null;
  }

  const dataSources: RecoveryDataSource[] = [];
  if (promptCount > 0 || folderCount > 0) {
    dataSources.push("workspace");
  }
  if (skillCount > 0) {
    dataSources.push("skills");
  }
  dataSources.push("legacy-layout");

  return {
    sourcePath: currentPath,
    sourceType: "current-residual",
    displayName: "Current data directory residuals",
    displayPath: currentPath,
    promptCount,
    folderCount,
    skillCount,
    dbSizeBytes: 0,
    lastModified: latestModifiedIso(currentPath),
    previewAvailable: true,
    dataSources,
    description: candidateDescription("current-residual", dataSources),
  };
}

export function listStandaloneDatabaseBackupFiles(
  currentPath: string,
): string[] {
  const searchRoots = [currentPath, path.join(currentPath, "data")];
  return Array.from(
    new Set(searchRoots.flatMap(listGeneratedDatabaseBackupsInDirectory)),
  ).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function listGeneratedDatabaseBackupsInDirectory(
  directoryPath: string,
): string[] {
  try {
    const rootStat = fs.lstatSync(directoryPath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return [];
    return fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          /^prompthub\.db(?:$|\.(?:backup(?:-before)?-|pre-recovery-|integrity-backup-|legacy-conflict-).+)/i.test(
            entry.name,
          ),
      )
      .map((entry) => path.join(directoryPath, entry.name));
  } catch {
    return [];
  }
}

export function buildDirectoryRecoveryCandidate(
  raw: RecoverableDatabase,
  options?: Partial<
    Pick<
      RecoveryCandidate,
      | "sourceType"
      | "displayName"
      | "displayPath"
      | "description"
      | "backupId"
      | "fromVersion"
      | "toVersion"
      | "lastModified"
    >
  >,
): RecoveryCandidate {
  const dataSources = inferDataSources(raw);
  const sourceType = options?.sourceType ?? "external-user-data";
  const previewAvailable =
    raw.hasDatabaseFile === true ||
    raw.hasWorkspaceData === true ||
    Object.values(raw.contentCounts ?? {}).some((count) => (count ?? 0) > 0);

  return {
    sourcePath: raw.sourcePath,
    sourceType,
    displayName: options?.displayName ?? "Recovered data location",
    displayPath: options?.displayPath ?? raw.sourcePath,
    promptCount: raw.promptCount,
    folderCount: raw.folderCount,
    skillCount: raw.skillCount,
    dbSizeBytes: raw.dbSizeBytes,
    lastModified: options?.lastModified ?? latestModifiedIso(raw.sourcePath),
    previewAvailable,
    dataSources,
    contentCounts: raw.contentCounts,
    description:
      options?.description ?? candidateDescription(sourceType, dataSources),
    backupId: options?.backupId ?? null,
    fromVersion: options?.fromVersion ?? null,
    toVersion: options?.toVersion ?? null,
  };
}

export function buildUpgradeBackupRecoveryCandidate(
  raw: RecoverableDatabase,
  backup: UpgradeBackupEntry,
): RecoveryCandidate {
  return buildDirectoryRecoveryCandidate(raw, {
    sourceType: "upgrade-backup",
    displayName: "Automatic upgrade backup",
    displayPath: backup.manifest.sourcePath,
    description:
      `Upgrade snapshot ${backup.backupId}` +
      (backup.manifest.fromVersion
        ? ` from ${backup.manifest.fromVersion}`
        : ""),
    backupId: backup.backupId,
    fromVersion: backup.manifest.fromVersion,
    toVersion: backup.manifest.toVersion ?? null,
    lastModified: backup.manifest.createdAt,
  });
}

export function buildStandaloneDbBackupCandidate(
  raw: RecoverableDatabase,
): RecoveryCandidate {
  return {
    sourcePath: raw.sourcePath,
    sourceType: "standalone-db-backup",
    displayName: "Standalone database backup",
    displayPath: raw.sourcePath,
    promptCount: raw.promptCount,
    folderCount: raw.folderCount,
    skillCount: raw.skillCount,
    dbSizeBytes: raw.dbSizeBytes,
    lastModified: latestModifiedIso(raw.sourcePath),
    previewAvailable: true,
    dataSources: ["sqlite"],
    description: candidateDescription("standalone-db-backup", ["sqlite"]),
    backupId: null,
    fromVersion: null,
    toVersion: null,
  };
}

function readCandidateTableCount(
  database: DatabaseAdapter.Database,
  tableName: string,
  optional = false,
): number {
  try {
    const row = database
      .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
      .get() as { count?: number } | undefined;
    return row?.count ?? 0;
  } catch (error) {
    if (optional) return 0;
    throw error;
  }
}

function hasAdditionalDurableRows(database: DatabaseAdapter.Database): boolean {
  return ["prompt_versions", "rule_versions", "settings"].some(
    (tableName) => readCandidateTableCount(database, tableName, true) > 0,
  );
}

export function buildCanonicalDatabaseRecoveryCandidate(
  databasePath: string,
): RecoveryCandidate | null {
  let database: DatabaseAdapter.Database | null = null;
  try {
    const stats = fs.lstatSync(databasePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 4096) {
      return null;
    }
    database = new DatabaseAdapter(databasePath, { readOnly: true });
    const quickCheck = database.pragma("quick_check") as Array<{
      quick_check?: unknown;
    }>;
    if (quickCheck.length !== 1 || quickCheck[0]?.quick_check !== "ok") {
      return null;
    }
    const promptCount = readCandidateTableCount(database, "prompts");
    const folderCount = readCandidateTableCount(database, "folders");
    const skillCount = readCandidateTableCount(database, "skills", true);
    const ruleCount = readCandidateTableCount(database, "rules", true);
    const hasDurableRows =
      promptCount + folderCount + skillCount + ruleCount > 0 ||
      hasAdditionalDurableRows(database);
    if (!hasDurableRows) return null;
    return {
      sourcePath: databasePath,
      sourceType: "current-canonical-db",
      displayName: "Current SQLite catalog",
      displayPath: databasePath,
      promptCount,
      folderCount,
      skillCount,
      dbSizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
      previewAvailable: true,
      dataSources: ruleCount > 0 ? ["sqlite", "rules"] : ["sqlite"],
      contentCounts: ruleCount > 0 ? { rules: ruleCount } : undefined,
      description:
        "The current SQLite catalog is intact and can rebuild the damaged canonical file graph.",
      backupId: null,
      fromVersion: null,
      toVersion: null,
    };
  } catch {
    return null;
  } finally {
    try {
      database?.close();
    } catch {
      // ignore close errors
    }
  }
}

export function findRecoveryCandidateByPath(
  candidates: readonly RecoveryCandidate[],
  sourcePath: string,
): RecoveryCandidate | undefined {
  const normalizedSourcePath = path.resolve(sourcePath).toLowerCase();
  return candidates.find(
    (candidate) =>
      path.resolve(candidate.sourcePath).toLowerCase() === normalizedSourcePath,
  );
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function extractFrontmatterTitle(raw: string): string | null {
  if (!raw.startsWith("---\n")) {
    return null;
  }

  const endIndex = raw.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return null;
  }

  const metadataBlock = raw.slice(4, endIndex);
  const titleLine = metadataBlock
    .split("\n")
    .find((line) => line.trim().startsWith("title:"));
  if (!titleLine) {
    return null;
  }

  const value = titleLine.slice(titleLine.indexOf(":") + 1).trim();
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" && parsed.trim().length > 0
      ? parsed
      : null;
  } catch {
    return value.replace(/^['"]|['"]$/g, "") || null;
  }
}

function collectWorkspacePromptFiles(basePath: string): string[] {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(basePath);
  } catch {
    return [];
  }
  if (stat.isSymbolicLink()) return [];

  if (!stat.isDirectory()) {
    return path.basename(basePath) === "prompt.md" ? [basePath] : [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  for (const entry of entries) {
    files.push(...collectWorkspacePromptFiles(path.join(basePath, entry.name)));
  }
  return files;
}

interface FilePreviewSource {
  kind: RecoveryPreviewItemKind;
  paths: string[];
}

const FILE_PREVIEW_SOURCES: FilePreviewSource[] = [
  { kind: "mcp", paths: ["mcp", path.join("data", "mcp")] },
  { kind: "rule", paths: ["rules", path.join("data", "rules")] },
  { kind: "plugin", paths: ["plugins", path.join("data", "plugins")] },
  { kind: "config", paths: ["config"] },
  {
    kind: "media",
    paths: [
      "images",
      "videos",
      path.join("data", "assets"),
      path.join("data", "images"),
      path.join("data", "videos"),
    ],
  },
];
const KNOWN_DATA_PREVIEW_ENTRIES = new Set([
  "assets",
  "folders.json",
  "images",
  "mcp",
  "plugins",
  "prompts",
  "rules",
  "skills",
  "videos",
]);

function collectLinkSafeFiles(targetPath: string): string[] {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(targetPath);
  } catch {
    return [];
  }
  if (stat.isSymbolicLink()) return [];
  if (!stat.isDirectory()) return stat.isFile() ? [targetPath] : [];

  try {
    return fs
      .readdirSync(targetPath, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isSymbolicLink()
          ? []
          : collectLinkSafeFiles(path.join(targetPath, entry.name)),
      );
  } catch {
    return [];
  }
}

function appendFilePreviews(
  basePath: string,
  items: RecoveryPreviewItem[],
): number {
  let total = 0;
  for (const source of FILE_PREVIEW_SOURCES) {
    const files = Array.from(
      new Set(
        source.paths.flatMap((relativePath) =>
          collectLinkSafeFiles(path.join(basePath, relativePath)),
        ),
      ),
    );
    total += files.length;
    for (const filePath of files.slice(
      0,
      Math.max(0, PREVIEW_LIMIT - items.length),
    )) {
      items.push({
        kind: source.kind,
        title: path.basename(filePath),
        subtitle: path.relative(basePath, filePath),
        updatedAt: latestModifiedIso(filePath),
      });
    }
  }
  const dataPath = path.join(basePath, "data");
  try {
    const unknownFiles = fs
      .readdirSync(dataPath, { withFileTypes: true })
      .filter(
        (entry) =>
          !entry.isSymbolicLink() &&
          !KNOWN_DATA_PREVIEW_ENTRIES.has(entry.name) &&
          !/^prompthub\.db(?:$|[-.])/i.test(entry.name),
      )
      .flatMap((entry) =>
        collectLinkSafeFiles(path.join(dataPath, entry.name)),
      );
    total += unknownFiles.length;
    for (const filePath of unknownFiles.slice(
      0,
      Math.max(0, PREVIEW_LIMIT - items.length),
    )) {
      items.push({
        kind: "other-data",
        title: path.basename(filePath),
        subtitle: path.relative(basePath, filePath),
        updatedAt: latestModifiedIso(filePath),
      });
    }
  } catch {
    // No readable unified data directory.
  }
  return total;
}

function previewFromWorkspace(basePath: string): RecoveryPreviewResult {
  const promptPaths = [
    ...collectWorkspacePromptFiles(path.join(basePath, "workspace", "prompts")),
    ...collectWorkspacePromptFiles(path.join(basePath, "data", "prompts")),
  ];
  const items: RecoveryPreviewItem[] = [];

  for (const promptPath of promptPaths.slice(0, PREVIEW_LIMIT)) {
    let title = path.basename(path.dirname(promptPath));
    try {
      const raw = fs.readFileSync(promptPath, "utf8");
      title = extractFrontmatterTitle(raw) ?? title;
    } catch {
      // ignore preview read failures
    }
    items.push({
      kind: "prompt",
      title,
      subtitle: path.relative(basePath, promptPath),
      updatedAt: latestModifiedIso(promptPath),
    });
  }

  const foldersFiles = [
    path.join(basePath, "workspace", "folders.json"),
    path.join(basePath, "data", "folders.json"),
  ];
  for (const foldersFile of foldersFiles) {
    if (!fs.existsSync(foldersFile)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(foldersFile, "utf8")) as Array<{
        id?: string;
        name?: string;
        createdAt?: unknown;
      }>;
      for (const folder of parsed.slice(
        0,
        Math.max(0, PREVIEW_LIMIT - items.length),
      )) {
        items.push({
          kind: "folder",
          id: folder.id,
          title:
            typeof folder.name === "string" && folder.name.trim().length > 0
              ? folder.name
              : "Untitled folder",
          updatedAt: toIsoTimestamp(folder.createdAt),
        });
      }
      break;
    } catch {
      // ignore malformed folders preview
    }
  }

  const skillDirs = [
    path.join(basePath, "skills"),
    path.join(basePath, "data", "skills"),
  ];
  for (const skillsDir of skillDirs) {
    if (!fs.existsSync(skillsDir)) {
      continue;
    }

    try {
      const entries = fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory());
      for (const entry of entries.slice(
        0,
        Math.max(0, PREVIEW_LIMIT - items.length),
      )) {
        items.push({
          kind: "skill",
          title: entry.name,
          subtitle: path.join(path.basename(skillsDir), entry.name),
          updatedAt: latestModifiedIso(path.join(skillsDir, entry.name)),
        });
      }
      break;
    } catch {
      // ignore skills preview failure
    }
  }

  const filePreviewCount = appendFilePreviews(basePath, items);

  return {
    sourcePath: basePath,
    previewAvailable: items.length > 0,
    description:
      items.length > 0
        ? null
        : "Preview is unavailable because this candidate only contains legacy browser storage.",
    items,
    truncated: promptPaths.length + filePreviewCount > items.length,
  };
}

function previewFromSqlite(dbPath: string): RecoveryPreviewResult {
  const items: RecoveryPreviewItem[] = [];
  let candidateDb: DatabaseAdapter | null = null;

  try {
    candidateDb = new DatabaseAdapter(dbPath, { readOnly: true });
    candidateDb.pragma("foreign_keys = OFF");

    const promptRows = candidateDb
      .prepare(
        "SELECT id, title, updated_at as updatedAt FROM prompts ORDER BY updated_at DESC LIMIT ?",
      )
      .all(PREVIEW_LIMIT) as Array<{
      id?: string;
      title?: string;
      updatedAt?: unknown;
    }>;

    for (const row of promptRows) {
      items.push({
        kind: "prompt",
        id: row.id,
        title:
          typeof row.title === "string" && row.title.trim().length > 0
            ? row.title
            : "Untitled prompt",
        updatedAt: toIsoTimestamp(row.updatedAt),
      });
    }

    if (items.length < PREVIEW_LIMIT) {
      const folderRows = candidateDb
        .prepare(
          "SELECT id, name, created_at as createdAt FROM folders ORDER BY created_at DESC LIMIT ?",
        )
        .all(PREVIEW_LIMIT - items.length) as Array<{
        id?: string;
        name?: string;
        createdAt?: unknown;
      }>;

      for (const row of folderRows) {
        items.push({
          kind: "folder",
          id: row.id,
          title:
            typeof row.name === "string" && row.name.trim().length > 0
              ? row.name
              : "Untitled folder",
          updatedAt: toIsoTimestamp(row.createdAt),
        });
      }
    }

    if (items.length < PREVIEW_LIMIT) {
      try {
        const skillRows = candidateDb
          .prepare(
            "SELECT id, name, updated_at as updatedAt FROM skills ORDER BY updated_at DESC LIMIT ?",
          )
          .all(PREVIEW_LIMIT - items.length) as Array<{
          id?: string;
          name?: string;
          updatedAt?: unknown;
        }>;

        for (const row of skillRows) {
          items.push({
            kind: "skill",
            id: row.id,
            title:
              typeof row.name === "string" && row.name.trim().length > 0
                ? row.name
                : "Untitled skill",
            updatedAt: toIsoTimestamp(row.updatedAt),
          });
        }
      } catch {
        // skills table may not exist in older snapshots
      }
    }

    if (items.length < PREVIEW_LIMIT) {
      try {
        const ruleRows = candidateDb
          .prepare(
            "SELECT id, canonical_file_name as name, updated_at as updatedAt FROM rules ORDER BY updated_at DESC LIMIT ?",
          )
          .all(PREVIEW_LIMIT - items.length) as Array<{
          id?: string;
          name?: string;
          updatedAt?: unknown;
        }>;
        for (const row of ruleRows) {
          items.push({
            kind: "rule",
            id: row.id,
            title:
              typeof row.name === "string" && row.name.trim().length > 0
                ? row.name
                : "Untitled rule",
            updatedAt: toIsoTimestamp(row.updatedAt),
          });
        }
      } catch {
        // rules table may not exist in older snapshots
      }
    }

    const promptTotal = candidateDb
      .prepare("SELECT COUNT(*) as count FROM prompts")
      .get() as { count: number } | undefined;
    const folderTotal = candidateDb
      .prepare("SELECT COUNT(*) as count FROM folders")
      .get() as { count: number } | undefined;
    let skillTotal = 0;
    let ruleTotal = 0;
    try {
      const skillRow = candidateDb
        .prepare("SELECT COUNT(*) as count FROM skills")
        .get() as { count: number } | undefined;
      skillTotal = skillRow?.count ?? 0;
    } catch {
      skillTotal = 0;
    }
    try {
      const ruleRow = candidateDb
        .prepare("SELECT COUNT(*) as count FROM rules")
        .get() as { count: number } | undefined;
      ruleTotal = ruleRow?.count ?? 0;
    } catch {
      ruleTotal = 0;
    }

    return {
      sourcePath: dbPath,
      previewAvailable: true,
      items,
      truncated:
        (promptTotal?.count ?? 0) +
          (folderTotal?.count ?? 0) +
          skillTotal +
          ruleTotal >
        items.length,
    };
  } catch (error) {
    return {
      sourcePath: dbPath,
      previewAvailable: false,
      description:
        error instanceof Error
          ? error.message
          : "Failed to open SQLite recovery candidate.",
      items: [],
      truncated: false,
    };
  } finally {
    try {
      candidateDb?.close();
    } catch {
      // ignore
    }
  }
}

export async function previewRecoveryCandidate(
  candidate: RecoveryCandidate,
): Promise<RecoveryPreviewResult> {
  if (!candidate.previewAvailable) {
    return {
      sourcePath: candidate.sourcePath,
      previewAvailable: false,
      description:
        candidate.description ??
        "Preview is unavailable for this recovery candidate.",
      items: [],
      truncated: false,
    };
  }

  if (candidate.sourceType === "current-residual") {
    return previewFromWorkspace(candidate.sourcePath);
  }

  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(candidate.sourcePath);
  } catch {
    stat = null;
  }

  if (stat?.isFile()) {
    return previewFromSqlite(candidate.sourcePath);
  }

  const sqlitePath = fs.existsSync(
    path.join(candidate.sourcePath, "data", "prompthub.db"),
  )
    ? path.join(candidate.sourcePath, "data", "prompthub.db")
    : path.join(candidate.sourcePath, "prompthub.db");
  if (fs.existsSync(sqlitePath)) {
    const sqlitePreview = previewFromSqlite(sqlitePath);
    if (sqlitePreview.previewAvailable) return sqlitePreview;

    const filePreview = previewFromWorkspace(candidate.sourcePath);
    if (filePreview.previewAvailable) {
      return {
        ...filePreview,
        description: sqlitePreview.description ?? filePreview.description,
      };
    }
    return sqlitePreview;
  }

  return previewFromWorkspace(candidate.sourcePath);
}
