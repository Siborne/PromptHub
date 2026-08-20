import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getUserDataPath } from "@prompthub/core";
import {
  closeDatabase,
  cleanupOwnedTemporaryDatabase,
  createConsistentDatabaseImage,
  DatabaseAdapter,
  FolderDB,
  initDatabase,
  PromptDB,
} from "@prompthub/db";
import { importPromptWorkspaceIntoDatabase } from "./prompt-workspace";

const MAX_TRUSTED_ROOTS = 32;
const HASH_BUFFER_BYTES = 64 * 1024;
const MAX_WORKSPACE_ENTRIES = 100_000;
const MAX_WORKSPACE_FILE_BYTES = 16 * 1024 * 1024;

export interface FileAuthoritativePromptCatalogResult {
  databasePath: string;
  promptCount: number;
  folderCount: number;
  retainedVersionCount: number;
}

function removeDatabaseFiles(databasePath: string): void {
  cleanupOwnedTemporaryDatabase(databasePath);
}

function assertWorkspaceFile(filePath: string, allowedName: RegExp): void {
  const stats = fs.lstatSync(filePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`Prompt workspace contains a symlink: ${filePath}`);
  }
  if (!stats.isFile()) {
    throw new Error(`Prompt workspace contains a special file: ${filePath}`);
  }
  if (!allowedName.test(path.basename(filePath))) {
    throw new Error(
      `Prompt workspace contains an unexpected file: ${filePath}`,
    );
  }
  if (stats.size > MAX_WORKSPACE_FILE_BYTES) {
    throw new Error(`Prompt workspace file size limit exceeded: ${filePath}`);
  }
}

function assertWorkspaceTree(rootPath: string, allowedName: RegExp): void {
  if (!fs.existsSync(rootPath)) return;
  const rootStats = fs.lstatSync(rootPath);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Prompt workspace root is unsafe: ${rootPath}`);
  }
  const queue = [rootPath];
  let entriesSeen = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const directory = queue[index];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      entriesSeen += 1;
      if (entriesSeen > MAX_WORKSPACE_ENTRIES) {
        throw new Error("Prompt workspace entry limit exceeded");
      }
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Prompt workspace contains a symlink: ${entryPath}`);
      }
      if (entry.isDirectory()) queue.push(entryPath);
      else assertWorkspaceFile(entryPath, allowedName);
    }
  }
}

function assertSafePromptWorkspace(activeRoot: string): void {
  const dataPath = path.join(activeRoot, "data");
  assertWorkspaceTree(
    path.join(dataPath, "prompts"),
    /^(?:.+\.md|_folder\.json|\.DS_Store|Thumbs\.db)$/u,
  );
  assertWorkspaceTree(
    path.join(dataPath, ".versions"),
    /^(?:.+\.md|\.DS_Store|Thumbs\.db)$/u,
  );
  const foldersPath = path.join(dataPath, "folders.json");
  if (fs.existsSync(foldersPath)) {
    assertWorkspaceFile(foldersPath, /^folders\.json$/u);
  }
}

function hasUsableDatabaseImage(databasePath: string): boolean {
  try {
    const database = new DatabaseAdapter(databasePath, { readOnly: true });
    try {
      const check = database.pragma("quick_check") as Array<{
        quick_check?: unknown;
      }>;
      return (
        check.length === 1 &&
        check[0]?.quick_check === "ok" &&
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompts'",
          )
          .get() !== undefined
      );
    } finally {
      database.close();
    }
  } catch {
    return false;
  }
}

function prepareStagingDatabase(
  sourceDatabasePath: string,
  targetDatabasePath: string,
): void {
  try {
    createConsistentDatabaseImage(sourceDatabasePath, targetDatabasePath);
  } catch {
    removeDatabaseFiles(targetDatabasePath);
  }
  if (hasUsableDatabaseImage(targetDatabasePath)) return;
  removeDatabaseFiles(targetDatabasePath);
  initDatabase(targetDatabasePath);
  closeDatabase();
}

function ensureCurrentPromptVersions(database: DatabaseAdapter.Database): void {
  const promptDb = new PromptDB(database);
  for (const prompt of promptDb.getAll()) {
    if (
      promptDb
        .getVersions(prompt.id)
        .some((version) => version.version === prompt.currentVersion)
    ) {
      continue;
    }
    const versionId = crypto
      .createHash("sha256")
      .update(
        `prompthub-file-current-version-v1\0${prompt.id}\0${prompt.currentVersion}`,
        "utf8",
      )
      .digest("hex");
    promptDb.insertVersionDirect({
      id: `file-current-${versionId}`,
      promptId: prompt.id,
      version: prompt.currentVersion,
      systemPrompt: prompt.systemPrompt,
      systemPromptEn: prompt.systemPromptEn,
      userPrompt: prompt.userPrompt,
      userPromptEn: prompt.userPromptEn,
      variables: prompt.variables,
      aiResponse: prompt.lastAiResponse,
      createdAt: prompt.updatedAt,
    });
  }
}

function validateStagedPromptCatalog(
  database: DatabaseAdapter.Database,
): number {
  ensureCurrentPromptVersions(database);
  database.exec(`
    DELETE FROM prompt_versions
    WHERE version > (
      SELECT current_version
      FROM prompts
      WHERE prompts.id = prompt_versions.prompt_id
    )
  `);
  const quickCheck = database.pragma("quick_check") as Array<{
    quick_check?: unknown;
  }>;
  const foreignKeys = database.pragma("foreign_key_check") as unknown[];
  if (
    quickCheck.length !== 1 ||
    quickCheck[0]?.quick_check !== "ok" ||
    foreignKeys.length > 0
  ) {
    throw new Error("File-authoritative Prompt catalog validation failed");
  }
  return (
    database.prepare("SELECT COUNT(*) AS count FROM prompt_versions").get() as {
      count: number;
    }
  ).count;
}

function importFileAuthoritativePrompts(
  database: DatabaseAdapter.Database,
  activeRoot: string,
) {
  return importPromptWorkspaceIntoDatabase(
    new PromptDB(database),
    new FolderDB(database),
    {
      preserveSource: true,
      replaceCurrentPromptSet: true,
      sourcePromptsDir: path.join(activeRoot, "data", "prompts"),
      sourceWorkspaceDir: path.join(activeRoot, "data"),
      strict: true,
    },
  );
}

export function stageFileAuthoritativePromptCatalog(options: {
  activeRoot: string;
  sourceDatabasePath: string;
  targetDatabasePath: string;
}): FileAuthoritativePromptCatalogResult {
  if (path.resolve(getUserDataPath()) !== path.resolve(options.activeRoot)) {
    throw new Error(
      "Prompt workspace recovery root does not match runtime paths",
    );
  }
  assertSafePromptWorkspace(options.activeRoot);
  prepareStagingDatabase(
    options.sourceDatabasePath,
    options.targetDatabasePath,
  );
  const database = new DatabaseAdapter(options.targetDatabasePath);
  let completed = false;
  let closeError: unknown;
  try {
    const importResult = importFileAuthoritativePrompts(
      database,
      options.activeRoot,
    );
    const retainedVersionCount = validateStagedPromptCatalog(database);
    if (importResult.promptIds.size === 0 && importResult.folderCount === 0) {
      throw new Error("File-authoritative Prompt workspace contains no data");
    }
    const result = {
      databasePath: options.targetDatabasePath,
      promptCount: importResult.promptIds.size,
      folderCount: importResult.folderCount,
      retainedVersionCount,
    };
    completed = true;
    return result;
  } finally {
    try {
      database.close();
    } catch (error) {
      closeError = error;
    }
    if (!completed || closeError) {
      cleanupOwnedTemporaryDatabase(options.targetDatabasePath);
    }
    if (closeError && completed) {
      throw closeError;
    }
  }
}

function assertSafeReference(reference: string): string[] {
  if (
    !reference ||
    reference.length > 1024 ||
    path.isAbsolute(reference) ||
    reference.includes("\\") ||
    reference.includes("\0")
  ) {
    throw new Error(`Prompt media reference is unsafe: ${reference}`);
  }
  const segments = reference.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Prompt media reference is unsafe: ${reference}`);
  }
  return segments;
}

function hashRegularFile(filePath: string): string {
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Prompt media source is unsafe: ${filePath}`);
  }
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY);
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function candidateMediaDirectories(
  rootPath: string,
  kind: "image" | "video",
): string[] {
  const directory = kind === "image" ? "images" : "videos";
  return [
    path.join(rootPath, "data", "assets", directory),
    path.join(rootPath, "data", directory),
    path.join(rootPath, directory),
    path.join(rootPath, "root", "data", "assets", directory),
    path.join(rootPath, "root", "data", directory),
    path.join(rootPath, "root", directory),
  ];
}

export function createVerifiedPromptMediaResolver(options: {
  activeRoot: string;
  trustedRoots: readonly string[];
}): (prompt: unknown, kind: "image" | "video", reference: string) => string {
  const roots = Array.from(
    new Set(
      [options.activeRoot, ...options.trustedRoots].map((rootPath) =>
        path.resolve(rootPath),
      ),
    ),
  );
  if (roots.length > MAX_TRUSTED_ROOTS) {
    throw new Error("Prompt media recovery root limit exceeded");
  }
  for (const rootPath of roots) {
    const stats = fs.lstatSync(rootPath);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`Prompt media recovery root is unsafe: ${rootPath}`);
    }
  }

  return (_prompt, kind, reference) => {
    const segments = assertSafeReference(reference);
    const candidates = Array.from(
      new Set(
        roots.flatMap((rootPath) =>
          candidateMediaDirectories(rootPath, kind).map((directory) =>
            path.join(directory, ...segments),
          ),
        ),
      ),
    ).filter((filePath) => fs.existsSync(filePath));
    if (candidates.length === 0) {
      throw new Error(`Prompt media source is missing: ${reference}`);
    }
    const hashes = candidates.map((filePath) => ({
      filePath,
      hash: hashRegularFile(filePath),
    }));
    if (new Set(hashes.map((entry) => entry.hash)).size !== 1) {
      throw new Error(`Prompt media copies disagree: ${reference}`);
    }
    return hashes[0].filePath;
  };
}
