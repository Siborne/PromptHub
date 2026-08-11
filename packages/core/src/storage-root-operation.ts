import crypto from "crypto";
import fs from "fs";
import path from "path";

import {
  classifyStorageRoot,
  copyStorageInventory,
  createStorageInventory,
  verifyStorageInventory,
  type StorageInventoryLimits,
  type StorageRootClassification,
} from "./storage-inventory";
import {
  resolveRuntimeStorageContext,
  writeRuntimeLayoutState,
} from "./runtime-storage-context";
import { pruneRecoveryArtifacts } from "./recovery-artifact-registry";
import { acquireStorageMaintenanceIntent } from "./storage-maintenance-intent";

export { classifyStorageRoot } from "./storage-inventory";

const JOURNAL_FILE_NAME = "storage-root-operation.json";
const JOURNAL_FORMAT_VERSION = 1;
const CAPACITY_HEADROOM_BYTES = 16 * 1024 * 1024;

export type StorageRootChangeAction = "switch" | "migrate" | "overwrite";
export type StorageRootOperationStage =
  | "inventory-created"
  | "staged"
  | "prepared"
  | "target-published"
  | "pointer-published"
  | "verified"
  | "committed";

interface StorageRootOperationJournal {
  formatVersion: number;
  kind: "prompthub-storage-root-operation";
  operationId: string;
  action: StorageRootChangeAction;
  state: "prepared" | "swapping" | "pointer-published" | "committed";
  sourceRoot: string;
  targetRoot: string;
  stagePath: string | null;
  priorPath: string | null;
  sourceDigest: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyStorageRootChangeOptions {
  action: StorageRootChangeAction;
  sourceRoot: string;
  targetRoot: string;
  controlDirectory: string;
  publishBootPointer: (rootPath: string) => void | Promise<void>;
  verifyDatabase?: (databasePath: string) => void | Promise<void>;
  getAvailableBytes?: (targetParent: string) => number;
  inventoryLimits?: StorageInventoryLimits;
  includeSecrets?: boolean;
  operationId?: string;
  now?: Date;
  injectFailure?: (stage: StorageRootOperationStage) => void;
}

export interface StorageRootChangeResult {
  status: "committed";
  operationId: string;
  action: StorageRootChangeAction;
  sourceRoot: string;
  targetRoot: string;
  copiedFiles: number;
  copiedBytes: number;
  recoveryArtifactPath?: string;
}

export interface RecoverStorageRootChangeOptions {
  controlDirectory: string;
  publishBootPointer: (rootPath: string) => void | Promise<void>;
  verifyDatabase?: (databasePath: string) => void | Promise<void>;
}

export interface RecoverStorageRootChangeSyncOptions {
  controlDirectory: string;
  publishBootPointer: (rootPath: string) => void;
  verifyDatabase?: (databasePath: string) => void;
}

export interface StorageRootRecoveryResult {
  status: "none" | "committed" | "rolled-back" | "recovery-required";
  operationId?: string;
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
    // Some supported filesystems do not permit directory fsync.
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

export function getStorageRootOperationJournalPath(
  controlDirectory: string,
): string {
  return path.join(path.resolve(controlDirectory), JOURNAL_FILE_NAME);
}

function writeJournal(
  controlDirectory: string,
  journal: StorageRootOperationJournal,
  state: StorageRootOperationJournal["state"] = journal.state,
): StorageRootOperationJournal {
  const next = {
    ...journal,
    state,
    updatedAt: new Date().toISOString(),
  };
  atomicWriteJson(getStorageRootOperationJournalPath(controlDirectory), next);
  return next;
}

function parseJournal(value: unknown): StorageRootOperationJournal | null {
  if (
    !isRecord(value) ||
    value.formatVersion !== JOURNAL_FORMAT_VERSION ||
    value.kind !== "prompthub-storage-root-operation" ||
    typeof value.operationId !== "string" ||
    !/^[a-zA-Z0-9._-]{1,128}$/.test(value.operationId) ||
    !["switch", "migrate", "overwrite"].includes(String(value.action)) ||
    !["prepared", "swapping", "pointer-published", "committed"].includes(
      String(value.state),
    ) ||
    typeof value.sourceRoot !== "string" ||
    typeof value.targetRoot !== "string" ||
    (value.stagePath !== null && typeof value.stagePath !== "string") ||
    (value.priorPath !== null && typeof value.priorPath !== "string") ||
    (value.sourceDigest !== null && typeof value.sourceDigest !== "string") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return value as unknown as StorageRootOperationJournal;
}

export function readStorageRootOperationJournal(
  controlDirectory: string,
): StorageRootOperationJournal | null {
  const journalPath = getStorageRootOperationJournalPath(controlDirectory);
  try {
    const stats = fs.lstatSync(journalPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Invalid storage root operation journal: ${journalPath}`);
    }
    const journal = parseJournal(
      JSON.parse(fs.readFileSync(journalPath, "utf8")),
    );
    if (!journal)
      throw new Error(`Invalid storage root operation journal: ${journalPath}`);
    return journal;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function removeJournal(controlDirectory: string): void {
  const journalPath = getStorageRootOperationJournalPath(controlDirectory);
  fs.rmSync(journalPath, { force: true });
  if (fs.existsSync(path.dirname(journalPath)))
    flushDirectory(path.dirname(journalPath));
}

function assertOperationId(operationId: string): void {
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(operationId)) {
    throw new Error(`Invalid storage root operation id: ${operationId}`);
  }
}

function assertDistinctRoots(sourceRoot: string, targetRoot: string): void {
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  const sourceToTarget = path.relative(source, target);
  const targetToSource = path.relative(target, source);
  if (
    source === target ||
    (sourceToTarget &&
      !sourceToTarget.startsWith("..") &&
      !path.isAbsolute(sourceToTarget)) ||
    (targetToSource &&
      !targetToSource.startsWith("..") &&
      !path.isAbsolute(targetToSource))
  ) {
    throw new Error("Storage source and target roots must not overlap");
  }
}

function assertRecognizedRoot(
  classification: StorageRootClassification,
  label: string,
): void {
  if (classification.kind !== "canonical" && classification.kind !== "legacy") {
    throw new Error(
      `${label} must be a verified PromptHub root; got ${classification.kind}`,
    );
  }
}

function defaultAvailableBytes(targetParent: string): number {
  let candidate = path.resolve(targetParent);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return 0;
    candidate = parent;
  }
  const stats = fs.statfsSync(candidate, { bigint: true });
  const available = stats.bavail * stats.bsize;
  return available > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(available);
}

function getDatabasePath(rootPath: string): string | null {
  const classification = classifyStorageRoot(rootPath);
  return classification.databasePath ?? null;
}

async function verifyPublishedRoot(
  rootPath: string,
  verifyDatabase?: (databasePath: string) => void | Promise<void>,
): Promise<void> {
  const classification = classifyStorageRoot(rootPath);
  assertRecognizedRoot(classification, "Published target");
  resolveRuntimeStorageContext(rootPath);
  if (classification.databasePath && verifyDatabase) {
    await verifyDatabase(classification.databasePath);
  }
}

function ownsRecoveryException(error: unknown): boolean {
  return Boolean(isRecord(error) && error.leaveOperationForRecovery === true);
}

function makeSiblingPath(
  targetRoot: string,
  kind: "stage" | "prior",
  operationId: string,
): string {
  const target = path.resolve(targetRoot);
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.prompthub-${kind}-${operationId}`,
  );
}

function removeOwnedPath(targetPath: string): void {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function rollbackTargetPublication(journal: StorageRootOperationJournal): void {
  if (journal.action === "switch") return;
  const targetExists = fs.existsSync(journal.targetRoot);
  const priorExists = Boolean(
    journal.priorPath && fs.existsSync(journal.priorPath),
  );
  if (targetExists) removeOwnedPath(journal.targetRoot);
  if (priorExists && journal.priorPath) {
    fs.renameSync(journal.priorPath, journal.targetRoot);
  }
  if (journal.stagePath) removeOwnedPath(journal.stagePath);
}

function preservePriorAsRecoveryArtifact(
  journal: StorageRootOperationJournal,
): string | undefined {
  if (!journal.priorPath || !fs.existsSync(journal.priorPath)) return undefined;
  if (journal.action !== "overwrite") {
    removeOwnedPath(journal.priorPath);
    return undefined;
  }
  const artifactPath = path.join(
    journal.targetRoot,
    "backups",
    "recovery",
    journal.operationId,
  );
  const rootPath = path.join(artifactPath, "root");
  if (fs.existsSync(artifactPath)) {
    throw new Error(`Recovery artifact already exists: ${artifactPath}`);
  }
  fs.mkdirSync(artifactPath, { recursive: true, mode: 0o700 });
  fs.renameSync(journal.priorPath, rootPath);
  atomicWriteJson(path.join(artifactPath, "manifest.json"), {
    formatVersion: 1,
    kind: "storage-root-recovery-artifact",
    state: "complete",
    id: journal.operationId,
    operationId: journal.operationId,
    artifactType: "overwritten-root",
    sourceRoot: journal.sourceRoot,
    targetRoot: journal.targetRoot,
    createdAt: journal.createdAt,
    validatedAt: new Date().toISOString(),
  });
  return artifactPath;
}

async function applyStorageRootChangeWithIntent(
  options: ApplyStorageRootChangeOptions,
  operationId: string,
): Promise<StorageRootChangeResult> {
  const sourceRoot = path.resolve(options.sourceRoot);
  const targetRoot = path.resolve(options.targetRoot);
  assertDistinctRoots(sourceRoot, targetRoot);
  assertOperationId(operationId);
  if (readStorageRootOperationJournal(options.controlDirectory)) {
    throw new Error("A storage root operation is already pending recovery");
  }
  const sourceClassification = classifyStorageRoot(sourceRoot);
  assertRecognizedRoot(sourceClassification, "Source");
  const targetClassification = classifyStorageRoot(targetRoot);
  if (options.action === "switch") {
    assertRecognizedRoot(targetClassification, "Switch target");
  } else if (options.action === "migrate") {
    if (
      targetClassification.kind !== "missing" &&
      targetClassification.kind !== "empty"
    ) {
      throw new Error(
        `Migration target must be absent or empty; got ${targetClassification.kind}`,
      );
    }
  } else {
    assertRecognizedRoot(targetClassification, "Overwrite target");
  }

  const createdAt = (options.now ?? new Date()).toISOString();
  const stagePath =
    options.action === "switch"
      ? null
      : makeSiblingPath(targetRoot, "stage", operationId);
  const priorPath =
    options.action === "switch"
      ? null
      : makeSiblingPath(targetRoot, "prior", operationId);
  if (
    (stagePath && fs.existsSync(stagePath)) ||
    (priorPath && fs.existsSync(priorPath))
  ) {
    throw new Error(`Storage operation path already exists for ${operationId}`);
  }

  let copiedFiles = 0;
  let copiedBytes = 0;
  let journalPersisted = false;
  let journal: StorageRootOperationJournal = {
    formatVersion: JOURNAL_FORMAT_VERSION,
    kind: "prompthub-storage-root-operation",
    operationId,
    action: options.action,
    state: "prepared",
    sourceRoot,
    targetRoot,
    stagePath,
    priorPath,
    sourceDigest: null,
    createdAt,
    updatedAt: createdAt,
  };

  try {
    if (options.action !== "switch" && stagePath) {
      const inventory = createStorageInventory(sourceRoot, {
        ...options.inventoryLimits,
        includeSecrets: options.includeSecrets ?? true,
      });
      copiedFiles = inventory.files.length;
      copiedBytes = inventory.totalBytes;
      journal.sourceDigest = inventory.digest;
      options.injectFailure?.("inventory-created");
      const availableBytes = (
        options.getAvailableBytes ?? defaultAvailableBytes
      )(path.dirname(targetRoot));
      const requiredBytes = inventory.totalBytes + CAPACITY_HEADROOM_BYTES;
      if (availableBytes < requiredBytes) {
        throw new Error(
          `Insufficient space for storage migration: required=${requiredBytes}, available=${availableBytes}`,
        );
      }
      copyStorageInventory(inventory, stagePath);
      writeRuntimeLayoutState(stagePath, {
        layoutEpoch: inventory.layoutEpoch,
        identityRoot: targetRoot,
        lastVerifiedOperation: operationId,
        now: options.now,
      });
      verifyStorageInventory(inventory, stagePath);
      const stagedDatabase = path.join(
        stagePath,
        ...(inventory.layoutEpoch === 1
          ? ["data", "prompthub.db"]
          : ["prompthub.db"]),
      );
      if (fs.existsSync(stagedDatabase) && options.verifyDatabase) {
        await options.verifyDatabase(stagedDatabase);
      }
      options.injectFailure?.("staged");
    } else {
      await verifyPublishedRoot(targetRoot, options.verifyDatabase);
    }

    journal = writeJournal(options.controlDirectory, journal, "prepared");
    journalPersisted = true;
    options.injectFailure?.("prepared");

    if (options.action !== "switch" && stagePath && priorPath) {
      if (fs.existsSync(targetRoot)) fs.renameSync(targetRoot, priorPath);
      fs.renameSync(stagePath, targetRoot);
      journal = writeJournal(options.controlDirectory, journal, "swapping");
      options.injectFailure?.("target-published");
    }

    await options.publishBootPointer(targetRoot);
    journal = writeJournal(
      options.controlDirectory,
      journal,
      "pointer-published",
    );
    options.injectFailure?.("pointer-published");
    await verifyPublishedRoot(targetRoot, options.verifyDatabase);
    options.injectFailure?.("verified");
    journal = writeJournal(options.controlDirectory, journal, "committed");
    options.injectFailure?.("committed");
    const recoveryArtifactPath = preservePriorAsRecoveryArtifact(journal);
    removeJournal(options.controlDirectory);
    if (recoveryArtifactPath) {
      try {
        pruneRecoveryArtifacts(targetRoot, {}, new Set([operationId]));
      } catch {
        // Retention cleanup is not part of the committed root publication.
      }
    }
    return {
      status: "committed",
      operationId,
      action: options.action,
      sourceRoot,
      targetRoot,
      copiedFiles,
      copiedBytes,
      ...(recoveryArtifactPath ? { recoveryArtifactPath } : {}),
    };
  } catch (error) {
    if (ownsRecoveryException(error) || journal.state === "committed")
      throw error;
    try {
      if (journalPersisted) {
        rollbackTargetPublication(journal);
        await options.publishBootPointer(sourceRoot);
        removeJournal(options.controlDirectory);
      } else if (stagePath) {
        removeOwnedPath(stagePath);
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Storage root operation failed and requires startup recovery",
      );
    }
    throw error;
  }
}

export async function applyStorageRootChange(
  options: ApplyStorageRootChangeOptions,
): Promise<StorageRootChangeResult> {
  const operationId = options.operationId ?? crypto.randomUUID();
  const maintenance = acquireStorageMaintenanceIntent(options.sourceRoot, {
    operationId,
    operationKind: `root-${options.action}`,
  });
  try {
    return await applyStorageRootChangeWithIntent(options, operationId);
  } finally {
    maintenance.release();
  }
}

async function completeRecoverablePublication(
  journal: StorageRootOperationJournal,
  options: RecoverStorageRootChangeOptions,
): Promise<boolean> {
  if (!fs.existsSync(journal.targetRoot)) return false;
  try {
    await verifyPublishedRoot(journal.targetRoot, options.verifyDatabase);
    await options.publishBootPointer(journal.targetRoot);
    writeJournal(options.controlDirectory, journal, "committed");
    preservePriorAsRecoveryArtifact(journal);
    removeJournal(options.controlDirectory);
    try {
      pruneRecoveryArtifacts(
        journal.targetRoot,
        {},
        new Set([journal.operationId]),
      );
    } catch {
      // The root is already committed and the recovery point stays protected.
    }
    return true;
  } catch {
    return false;
  }
}

export async function recoverPendingStorageRootChange(
  options: RecoverStorageRootChangeOptions,
): Promise<StorageRootRecoveryResult> {
  const pendingJournal = readStorageRootOperationJournal(
    options.controlDirectory,
  );
  if (!pendingJournal) return { status: "none" };
  const maintenance = acquireStorageMaintenanceIntent(
    pendingJournal.sourceRoot,
    {
      operationId: pendingJournal.operationId,
      operationKind: "root-recovery",
    },
  );
  try {
    return await recoverPendingStorageRootChangeWithIntent(options);
  } finally {
    maintenance.release();
  }
}

async function recoverPendingStorageRootChangeWithIntent(
  options: RecoverStorageRootChangeOptions,
): Promise<StorageRootRecoveryResult> {
  const journal = readStorageRootOperationJournal(options.controlDirectory);
  if (!journal) return { status: "none" };
  if (
    journal.state !== "prepared" &&
    (await completeRecoverablePublication(journal, options))
  ) {
    return { status: "committed", operationId: journal.operationId };
  }
  try {
    rollbackTargetPublication(journal);
    await options.publishBootPointer(journal.sourceRoot);
    removeJournal(options.controlDirectory);
    return { status: "rolled-back", operationId: journal.operationId };
  } catch (error) {
    return {
      status: "recovery-required",
      operationId: journal.operationId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function recoverPendingStorageRootChangeSync(
  options: RecoverStorageRootChangeSyncOptions,
): StorageRootRecoveryResult {
  const pendingJournal = readStorageRootOperationJournal(
    options.controlDirectory,
  );
  if (!pendingJournal) return { status: "none" };
  const maintenance = acquireStorageMaintenanceIntent(
    pendingJournal.sourceRoot,
    {
      operationId: pendingJournal.operationId,
      operationKind: "root-recovery",
    },
  );
  try {
    return recoverPendingStorageRootChangeSyncWithIntent(options);
  } finally {
    maintenance.release();
  }
}

function recoverPendingStorageRootChangeSyncWithIntent(
  options: RecoverStorageRootChangeSyncOptions,
): StorageRootRecoveryResult {
  const journal = readStorageRootOperationJournal(options.controlDirectory);
  if (!journal) return { status: "none" };
  if (journal.state !== "prepared" && fs.existsSync(journal.targetRoot)) {
    try {
      const classification = classifyStorageRoot(journal.targetRoot);
      assertRecognizedRoot(classification, "Published target");
      resolveRuntimeStorageContext(journal.targetRoot);
      if (classification.databasePath && options.verifyDatabase) {
        options.verifyDatabase(classification.databasePath);
      }
      options.publishBootPointer(journal.targetRoot);
      writeJournal(options.controlDirectory, journal, "committed");
      preservePriorAsRecoveryArtifact(journal);
      removeJournal(options.controlDirectory);
      try {
        pruneRecoveryArtifacts(
          journal.targetRoot,
          {},
          new Set([journal.operationId]),
        );
      } catch {
        // The root is already committed and the recovery point stays protected.
      }
      return { status: "committed", operationId: journal.operationId };
    } catch {
      // Fall through to deterministic rollback.
    }
  }
  try {
    rollbackTargetPublication(journal);
    options.publishBootPointer(journal.sourceRoot);
    removeJournal(options.controlDirectory);
    return { status: "rolled-back", operationId: journal.operationId };
  } catch (error) {
    return {
      status: "recovery-required",
      operationId: journal.operationId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
