import crypto from "crypto";
import fs from "fs";
import path from "path";

import { pruneRecoveryArtifacts } from "./recovery-artifact-registry";
import { publishRecoveryArtifact } from "./recovery-artifact-publication";
import { assertStoragePathComponentsSafe } from "./runtime-storage-context";
import {
  acquireStorageMaintenanceIntent,
  assertStorageMaintenanceIntentHeld,
} from "./storage-maintenance-intent";

const RESTORE_FORMAT_VERSION = 1;
const RESTORE_JOURNAL_FILE = "full-restore.json";
const MAX_RESTORE_ENTRIES = 100_000;
const MAX_RESTORE_BYTES = 100 * 1024 * 1024 * 1024;
const MAX_RESTORE_DEPTH = 32;
const ALLOWED_ROOT_ENTRIES = new Set([
  "data",
  "config",
  "secrets",
  "prompthub.db",
  "workspace",
  "skills",
  "images",
  "videos",
  "shortcuts.json",
  "shortcut-mode.json",
]);

export type StorageRestorePublicationStage =
  | "prepared"
  | `entry-swapping:${string}`
  | `entry-swapped:${string}`
  | "verified"
  | "committed";

interface StorageRestoreJournal {
  formatVersion: number;
  kind: "prompthub-journaled-storage-restore";
  operationId: string;
  state: "prepared" | "swapping" | "committed";
  activeRoot: string;
  stageRoot: string;
  priorRoot: string;
  entryNames: string[];
  swappedEntries: string[];
  currentEntry: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunJournaledStorageRestoreOptions {
  activeRoot: string;
  operationId?: string;
  entryNames: string[];
  prepareCandidate: (stageRoot: string) => void | Promise<void>;
  verifyCandidate: (stageRoot: string) => void | Promise<void>;
  verifyActive: (activeRoot: string) => void | Promise<void>;
  injectFailure?: (stage: StorageRestorePublicationStage) => void;
  now?: Date;
  maintenanceOperationId?: string;
  candidateLimits?: StorageRestoreCandidateLimits;
}

export interface StorageRestoreCandidateLimits {
  maxEntries?: number;
  maxBytes?: number;
  maxDepth?: number;
}

export interface RecoverJournaledStorageRestoreOptions {
  activeRoot: string;
  verifyActive: (activeRoot: string) => void | Promise<void>;
}

export interface StorageRestoreResult {
  status: "committed";
  operationId: string;
  recoveryArtifactPath: string;
}

export interface StorageRestoreRecoveryResult {
  status: "none" | "committed" | "rolled-back" | "recovery-required";
  operationId?: string;
  recoveryArtifactPath?: string;
  reason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function isOperationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9._-]{1,128}$/.test(value) &&
    value !== "." &&
    value !== ".."
  );
}

function flushDirectory(directoryPath: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch {
    // Directory fsync is not available on every supported filesystem.
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function atomicWriteJson(
  activeRoot: string,
  filePath: string,
  value: unknown,
): void {
  const directory = path.dirname(filePath);
  assertStoragePathComponentsSafe(activeRoot, directory);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  assertStoragePathComponentsSafe(activeRoot, directory);
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporaryPath, filePath);
    flushDirectory(directory);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

export function getStorageRestoreJournalPath(activeRoot: string): string {
  return path.join(
    path.resolve(activeRoot),
    "backups",
    "recovery",
    "journals",
    RESTORE_JOURNAL_FILE,
  );
}

function parseJournal(
  value: unknown,
  activeRoot: string,
): StorageRestoreJournal | null {
  if (
    !isRecord(value) ||
    value.formatVersion !== RESTORE_FORMAT_VERSION ||
    value.kind !== "prompthub-journaled-storage-restore" ||
    !isOperationId(value.operationId) ||
    !["prepared", "swapping", "committed"].includes(String(value.state)) ||
    typeof value.activeRoot !== "string" ||
    path.resolve(value.activeRoot) !== path.resolve(activeRoot) ||
    typeof value.stageRoot !== "string" ||
    typeof value.priorRoot !== "string" ||
    !Array.isArray(value.entryNames) ||
    !Array.isArray(value.swappedEntries) ||
    (value.currentEntry !== null && typeof value.currentEntry !== "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  const entryNames = value.entryNames.filter(
    (entry): entry is string => typeof entry === "string",
  );
  const swappedEntries = value.swappedEntries.filter(
    (entry): entry is string => typeof entry === "string",
  );
  if (
    entryNames.length !== value.entryNames.length ||
    swappedEntries.length !== value.swappedEntries.length ||
    entryNames.some((entry) => !ALLOWED_ROOT_ENTRIES.has(entry)) ||
    swappedEntries.some((entry) => !entryNames.includes(entry)) ||
    (value.currentEntry !== null &&
      !entryNames.includes(value.currentEntry as string))
  ) {
    return null;
  }
  assertOwnedOperationPath(activeRoot, value.stageRoot);
  assertOwnedOperationPath(activeRoot, value.priorRoot);
  const expectedPaths = operationPaths(activeRoot, value.operationId);
  if (
    value.stageRoot !== expectedPaths.stageRoot ||
    value.priorRoot !== expectedPaths.priorRoot
  ) {
    return null;
  }
  return value as unknown as StorageRestoreJournal;
}

function readJournal(activeRoot: string): StorageRestoreJournal | null {
  const journalPath = getStorageRestoreJournalPath(activeRoot);
  try {
    assertStoragePathComponentsSafe(activeRoot, path.dirname(journalPath));
    const stats = fs.lstatSync(journalPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Invalid storage restore journal: ${journalPath}`);
    }
    const journal = parseJournal(
      JSON.parse(fs.readFileSync(journalPath, "utf8")),
      activeRoot,
    );
    if (!journal)
      throw new Error(`Invalid storage restore journal: ${journalPath}`);
    return journal;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function readStorageRestoreJournalState(activeRoot: string): {
  operationId: string;
  state: StorageRestoreJournal["state"];
  currentEntry: string | null;
  swappedEntries: string[];
} | null {
  const journal = readJournal(activeRoot);
  return journal
    ? {
        operationId: journal.operationId,
        state: journal.state,
        currentEntry: journal.currentEntry,
        swappedEntries: [...journal.swappedEntries],
      }
    : null;
}

function writeJournal(journal: StorageRestoreJournal): StorageRestoreJournal {
  const next = { ...journal, updatedAt: new Date().toISOString() };
  atomicWriteJson(
    journal.activeRoot,
    getStorageRestoreJournalPath(journal.activeRoot),
    next,
  );
  return next;
}

function removeJournal(activeRoot: string): void {
  const journalPath = getStorageRestoreJournalPath(activeRoot);
  assertStoragePathComponentsSafe(activeRoot, journalPath);
  fs.rmSync(journalPath, { force: true });
}

function assertEntryNames(entryNames: string[]): string[] {
  const unique = [...new Set(entryNames)];
  if (
    unique.length !== entryNames.length ||
    unique.length === 0 ||
    unique.some((entry) => !ALLOWED_ROOT_ENTRIES.has(entry))
  ) {
    throw new Error(`Invalid restore entry list: ${entryNames.join(", ")}`);
  }
  return unique;
}

function assertOperationId(operationId: string): void {
  if (!isOperationId(operationId)) {
    throw new Error(`Invalid storage restore operation id: ${operationId}`);
  }
}

function assertOwnedOperationPath(
  activeRoot: string,
  targetPath: string,
): void {
  const root = path.resolve(activeRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Storage restore operation path escapes active root: ${target}`,
    );
  }
}

function validateCandidateTree(
  stageRoot: string,
  limits: { maxEntries: number; maxBytes: number; maxDepth: number },
): void {
  let entries = 0;
  let bytes = 0;
  const visit = (targetPath: string, depth: number): void => {
    if (depth > limits.maxDepth) {
      throw new Error(
        `Storage restore candidate exceeds depth limit: ${targetPath}`,
      );
    }
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Storage restore candidate contains symbolic link: ${targetPath}`,
      );
    }
    entries += 1;
    if (entries > limits.maxEntries) {
      throw new Error("Storage restore candidate exceeds entry limit");
    }
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        visit(path.join(targetPath, entry.name), depth + 1);
      }
      return;
    }
    if (!stats.isFile()) {
      throw new Error(
        `Storage restore candidate contains special file: ${targetPath}`,
      );
    }
    bytes += stats.size;
    if (bytes > limits.maxBytes) {
      throw new Error("Storage restore candidate exceeds byte limit");
    }
  };
  for (const entry of fs.readdirSync(stageRoot, { withFileTypes: true })) {
    visit(path.join(stageRoot, entry.name), 1);
  }
}

function operationPaths(
  activeRoot: string,
  operationId: string,
): {
  stageRoot: string;
  priorRoot: string;
} {
  const root = path.resolve(activeRoot);
  return {
    stageRoot: path.join(root, `.prompthub-restore-stage-${operationId}`),
    priorRoot: path.join(root, `.prompthub-restore-prior-${operationId}`),
  };
}

function removePath(targetPath: string): void {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function swapEntry(journal: StorageRestoreJournal, entryName: string): void {
  const activePath = path.join(journal.activeRoot, entryName);
  const candidatePath = path.join(journal.stageRoot, entryName);
  const priorPath = path.join(journal.priorRoot, entryName);
  fs.mkdirSync(path.dirname(priorPath), { recursive: true, mode: 0o700 });
  if (fs.existsSync(activePath)) fs.renameSync(activePath, priorPath);
  if (fs.existsSync(candidatePath)) fs.renameSync(candidatePath, activePath);
}

function rollbackRestore(journal: StorageRestoreJournal): void {
  const considered = new Set([
    ...journal.swappedEntries,
    ...(journal.currentEntry ? [journal.currentEntry] : []),
  ]);
  for (const entryName of [...journal.entryNames].reverse()) {
    if (!considered.has(entryName)) continue;
    const activePath = path.join(journal.activeRoot, entryName);
    const priorPath = path.join(journal.priorRoot, entryName);
    if (fs.existsSync(priorPath)) {
      removePath(activePath);
      fs.renameSync(priorPath, activePath);
    } else if (journal.swappedEntries.includes(entryName)) {
      removePath(activePath);
    }
  }
  removePath(journal.stageRoot);
  removePath(journal.priorRoot);
  removeJournal(journal.activeRoot);
}

function preservePrior(journal: StorageRestoreJournal): string {
  const artifactPath = publishRecoveryArtifact({
    ownerRoot: journal.activeRoot,
    registryRoot: path.join(journal.activeRoot, "backups", "recovery"),
    priorRoot: journal.priorRoot,
    manifest: {
      kind: "storage-restore-recovery-artifact",
      id: journal.operationId,
      operationId: journal.operationId,
      artifactType: "pre-restore-state",
      sourceRoot: journal.activeRoot,
      entries: journal.entryNames,
      createdAt: journal.createdAt,
    },
  });
  removePath(journal.stageRoot);
  removeJournal(journal.activeRoot);
  return artifactPath;
}

function shouldLeaveForRecovery(error: unknown): boolean {
  return isRecord(error) && error.leaveOperationForRecovery === true;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertSafeActiveRoot(activeRoot: string): string {
  const root = path.resolve(activeRoot);
  const stats = fs.lstatSync(root);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`Storage restore active root is unsafe: ${root}`);
  }
  return root;
}

async function runJournaledStorageRestoreWithIntent(
  options: RunJournaledStorageRestoreOptions,
  operationId: string,
): Promise<StorageRestoreResult> {
  const activeRoot = path.resolve(options.activeRoot);
  if (readJournal(activeRoot))
    throw new Error("A storage restore is already pending");
  const entryNames = assertEntryNames(options.entryNames);
  const candidateLimits = {
    maxEntries: positiveInteger(
      options.candidateLimits?.maxEntries ?? MAX_RESTORE_ENTRIES,
      "maxEntries",
    ),
    maxBytes: positiveInteger(
      options.candidateLimits?.maxBytes ?? MAX_RESTORE_BYTES,
      "maxBytes",
    ),
    maxDepth: positiveInteger(
      options.candidateLimits?.maxDepth ?? MAX_RESTORE_DEPTH,
      "maxDepth",
    ),
  };
  const { stageRoot, priorRoot } = operationPaths(activeRoot, operationId);
  assertOwnedOperationPath(activeRoot, stageRoot);
  assertOwnedOperationPath(activeRoot, priorRoot);
  if (fs.existsSync(stageRoot) || fs.existsSync(priorRoot)) {
    throw new Error(
      `Storage restore operation path already exists: ${operationId}`,
    );
  }
  fs.mkdirSync(stageRoot, { recursive: true, mode: 0o700 });
  let journal: StorageRestoreJournal | null = null;
  try {
    await options.prepareCandidate(stageRoot);
    for (const entry of fs.readdirSync(stageRoot)) {
      if (!entryNames.includes(entry)) {
        throw new Error(
          `Restore candidate contains undeclared root entry: ${entry}`,
        );
      }
    }
    validateCandidateTree(stageRoot, candidateLimits);
    await options.verifyCandidate(stageRoot);
    const createdAt = (options.now ?? new Date()).toISOString();
    journal = writeJournal({
      formatVersion: RESTORE_FORMAT_VERSION,
      kind: "prompthub-journaled-storage-restore",
      operationId,
      state: "prepared",
      activeRoot,
      stageRoot,
      priorRoot,
      entryNames,
      swappedEntries: [],
      currentEntry: null,
      createdAt,
      updatedAt: createdAt,
    });
    options.injectFailure?.("prepared");
    for (const entryName of entryNames) {
      journal = writeJournal({
        ...journal,
        state: "swapping",
        currentEntry: entryName,
      });
      options.injectFailure?.(`entry-swapping:${entryName}`);
      swapEntry(journal, entryName);
      journal = writeJournal({
        ...journal,
        swappedEntries: [...journal.swappedEntries, entryName],
        currentEntry: null,
      });
      options.injectFailure?.(`entry-swapped:${entryName}`);
    }
    await options.verifyActive(activeRoot);
    options.injectFailure?.("verified");
    journal = writeJournal({ ...journal, state: "committed" });
    options.injectFailure?.("committed");
    const recoveryArtifactPath = preservePrior(journal);
    try {
      pruneRecoveryArtifacts(activeRoot, {}, new Set([operationId]));
    } catch {
      // Retention cleanup must not turn a committed restore into a failure.
    }
    return { status: "committed", operationId, recoveryArtifactPath };
  } catch (error) {
    if (shouldLeaveForRecovery(error) || journal?.state === "committed")
      throw error;
    if (journal) rollbackRestore(journal);
    else removePath(stageRoot);
    throw error;
  }
}

export async function runJournaledStorageRestore(
  options: RunJournaledStorageRestoreOptions,
): Promise<StorageRestoreResult> {
  if (
    options.maintenanceOperationId &&
    options.operationId &&
    options.maintenanceOperationId !== options.operationId
  ) {
    throw new Error(
      "Storage restore operation does not own maintenance intent",
    );
  }
  assertSafeActiveRoot(options.activeRoot);
  const operationId =
    options.operationId ??
    options.maintenanceOperationId ??
    crypto.randomUUID();
  assertOperationId(operationId);
  assertEntryNames(options.entryNames);
  if (options.maintenanceOperationId) {
    assertStorageMaintenanceIntentHeld(
      options.activeRoot,
      options.maintenanceOperationId,
    );
    return runJournaledStorageRestoreWithIntent(options, operationId);
  }
  const maintenance = acquireStorageMaintenanceIntent(options.activeRoot, {
    operationId,
    operationKind: "restore",
  });
  try {
    return await runJournaledStorageRestoreWithIntent(options, operationId);
  } finally {
    maintenance.release();
  }
}

function completeEntry(
  journal: StorageRestoreJournal,
  entryName: string,
): void {
  if (journal.swappedEntries.includes(entryName)) return;
  const activePath = path.join(journal.activeRoot, entryName);
  const candidatePath = path.join(journal.stageRoot, entryName);
  const priorPath = path.join(journal.priorRoot, entryName);
  const activeExists = fs.existsSync(activePath);
  const candidateExists = fs.existsSync(candidatePath);
  const priorExists = fs.existsSync(priorPath);
  if (priorExists) {
    if (!activeExists && candidateExists)
      fs.renameSync(candidatePath, activePath);
    else if (activeExists && candidateExists) {
      throw new Error(`Ambiguous restore publication for ${entryName}`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(priorPath), { recursive: true, mode: 0o700 });
  if (activeExists && candidateExists) {
    fs.renameSync(activePath, priorPath);
    fs.renameSync(candidatePath, activePath);
  } else if (!activeExists && candidateExists) {
    fs.renameSync(candidatePath, activePath);
  }
}

export async function recoverJournaledStorageRestore(
  options: RecoverJournaledStorageRestoreOptions,
): Promise<StorageRestoreRecoveryResult> {
  assertSafeActiveRoot(options.activeRoot);
  const pendingJournal = readJournal(options.activeRoot);
  if (!pendingJournal) return { status: "none" };
  const maintenance = acquireStorageMaintenanceIntent(options.activeRoot, {
    operationId: pendingJournal.operationId,
    operationKind: "restore-recovery",
  });
  try {
    return await recoverJournaledStorageRestoreWithIntent(options);
  } finally {
    maintenance.release();
  }
}

async function recoverJournaledStorageRestoreWithIntent(
  options: RecoverJournaledStorageRestoreOptions,
): Promise<StorageRestoreRecoveryResult> {
  let journal = readJournal(options.activeRoot);
  if (!journal) return { status: "none" };
  if (journal.state === "prepared") {
    rollbackRestore(journal);
    return { status: "rolled-back", operationId: journal.operationId };
  }
  try {
    for (const entryName of journal.entryNames) {
      completeEntry(journal, entryName);
      if (!journal.swappedEntries.includes(entryName)) {
        journal = writeJournal({
          ...journal,
          state: "swapping",
          swappedEntries: [...journal.swappedEntries, entryName],
          currentEntry: null,
        });
      }
    }
    await options.verifyActive(journal.activeRoot);
    journal = writeJournal({
      ...journal,
      state: "committed",
      currentEntry: null,
    });
    const recoveryArtifactPath = preservePrior(journal);
    try {
      pruneRecoveryArtifacts(
        journal.activeRoot,
        {},
        new Set([journal.operationId]),
      );
    } catch {
      // The committed state and its protected recovery point remain valid.
    }
    return {
      status: "committed",
      operationId: journal.operationId,
      recoveryArtifactPath,
    };
  } catch (error) {
    try {
      rollbackRestore(journal);
      return { status: "rolled-back", operationId: journal.operationId };
    } catch (rollbackError) {
      return {
        status: "recovery-required",
        operationId: journal.operationId,
        reason: `Recovery failed: ${errorMessage(error)}; rollback failed: ${errorMessage(rollbackError)}`,
      };
    }
  }
}
