import crypto from "crypto";
import fs from "fs";
import path from "path";

import { pruneRecoveryArtifacts } from "./recovery-artifact-registry";
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

function atomicWriteJson(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
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
    typeof value.operationId !== "string" ||
    !/^[a-zA-Z0-9._-]{1,128}$/.test(value.operationId) ||
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
  return value as unknown as StorageRestoreJournal;
}

function readJournal(activeRoot: string): StorageRestoreJournal | null {
  const journalPath = getStorageRestoreJournalPath(activeRoot);
  try {
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
  atomicWriteJson(getStorageRestoreJournalPath(journal.activeRoot), next);
  return next;
}

function removeJournal(activeRoot: string): void {
  fs.rmSync(getStorageRestoreJournalPath(activeRoot), { force: true });
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

function validateCandidateTree(stageRoot: string): void {
  let entries = 0;
  let bytes = 0;
  const visit = (targetPath: string, depth: number): void => {
    if (depth > MAX_RESTORE_DEPTH) {
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
    if (entries > MAX_RESTORE_ENTRIES) {
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
    if (bytes > MAX_RESTORE_BYTES) {
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
  const artifactPath = path.join(
    journal.activeRoot,
    "backups",
    "recovery",
    journal.operationId,
  );
  const artifactRoot = path.join(artifactPath, "root");
  if (fs.existsSync(artifactPath)) {
    throw new Error(
      `Storage restore recovery artifact already exists: ${artifactPath}`,
    );
  }
  fs.mkdirSync(artifactPath, { recursive: true, mode: 0o700 });
  if (fs.existsSync(journal.priorRoot)) {
    fs.renameSync(journal.priorRoot, artifactRoot);
  } else {
    fs.mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
  }
  atomicWriteJson(path.join(artifactPath, "manifest.json"), {
    formatVersion: 1,
    kind: "storage-restore-recovery-artifact",
    state: "complete",
    id: journal.operationId,
    operationId: journal.operationId,
    artifactType: "pre-restore-state",
    sourceRoot: journal.activeRoot,
    entries: journal.entryNames,
    createdAt: journal.createdAt,
    validatedAt: new Date().toISOString(),
  });
  removePath(journal.stageRoot);
  removeJournal(journal.activeRoot);
  return artifactPath;
}

function shouldLeaveForRecovery(error: unknown): boolean {
  return isRecord(error) && error.leaveOperationForRecovery === true;
}

async function runJournaledStorageRestoreWithIntent(
  options: RunJournaledStorageRestoreOptions,
  operationId: string,
): Promise<StorageRestoreResult> {
  const activeRoot = path.resolve(options.activeRoot);
  const rootStats = fs.lstatSync(activeRoot);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error(`Storage restore active root is unsafe: ${activeRoot}`);
  }
  if (readJournal(activeRoot))
    throw new Error("A storage restore is already pending");
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(operationId)) {
    throw new Error(`Invalid storage restore operation id: ${operationId}`);
  }
  const entryNames = assertEntryNames(options.entryNames);
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
    validateCandidateTree(stageRoot);
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
  const operationId =
    options.operationId ??
    options.maintenanceOperationId ??
    crypto.randomUUID();
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
        reason: new AggregateError([error, rollbackError]).message,
      };
    }
  }
}
