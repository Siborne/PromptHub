import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  materializeResourceBundle,
  readResourceBundle,
  type MaterializeResourceBundleInput,
  type ResourceBundleManifest,
} from "./resource-bundle";

const JOURNAL_VERSION = 1;
const CANONICAL_BUNDLE_DOMAINS = [
  "prompts",
  "skills",
  "rules",
  "mcp",
  "plugins",
  "agents",
  "generations",
] as const;
const PUBLICATION_JOURNAL_PATTERN = /^\.(.+)\.publish\.json$/u;

export type ResourceBundlePublicationStage =
  | "staged"
  | "prepared"
  | "prior-moved"
  | "destination-published"
  | "verified";

interface ResourceBundlePublicationJournal {
  kind: "prompthub-resource-bundle-publication";
  version: typeof JOURNAL_VERSION;
  operationId: string;
  state: "staging" | "prepared" | "prior-moved" | "published";
  bundlePath: string;
  stagePath: string;
  priorPath: string;
  resourceType: string;
  resourceId: string;
  targetRevision: number;
  hadPrior: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishResourceBundleOptions {
  injectFailure?: (stage: ResourceBundlePublicationStage) => void;
}

export interface WriteResourceBundleOptions extends PublishResourceBundleOptions {
  mode?: "create" | "replace";
}

export interface PublishResourceBundleResult {
  manifest: ResourceBundleManifest;
  replacedRevision: number | null;
}

export interface NextResourceBundleRevisionOptions {
  resourceType: string;
  resourceId: string;
  minimumRevision?: number;
}

export interface ResourceBundleWritePolicy {
  mode?: "create" | "replace";
  revision?: number;
}

export type ResourceBundlePublicationRecovery =
  | "none"
  | "committed"
  | "rolled-back";

export interface CanonicalResourcePublicationRecoveryResult {
  scannedJournals: number;
  committed: number;
  rolledBack: number;
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
    // Directory fsync is unavailable on some supported filesystems.
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

export function getResourceBundlePublicationJournalPath(
  bundlePath: string,
): string {
  const target = path.resolve(bundlePath);
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.publish.json`,
  );
}

function atomicWriteJournal(
  journalPath: string,
  journal: ResourceBundlePublicationJournal,
  create: boolean,
): void {
  fs.mkdirSync(path.dirname(journalPath), { recursive: true, mode: 0o700 });
  if (create) {
    const descriptor = fs.openSync(journalPath, "wx", 0o600);
    try {
      fs.writeFileSync(
        descriptor,
        `${JSON.stringify(journal, null, 2)}\n`,
        "utf8",
      );
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    flushDirectory(path.dirname(journalPath));
    return;
  }
  const temporaryPath = `${journalPath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
  try {
    fs.writeFileSync(
      descriptor,
      `${JSON.stringify(journal, null, 2)}\n`,
      "utf8",
    );
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporaryPath, journalPath);
    flushDirectory(path.dirname(journalPath));
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function updateJournal(
  journalPath: string,
  journal: ResourceBundlePublicationJournal,
  state: ResourceBundlePublicationJournal["state"],
): ResourceBundlePublicationJournal {
  const next = { ...journal, state, updatedAt: new Date().toISOString() };
  atomicWriteJournal(journalPath, next, false);
  return next;
}

function assertOwnedSibling(
  bundlePath: string,
  candidatePath: string,
  marker: "stage" | "prior",
): void {
  const target = path.resolve(bundlePath);
  const candidate = path.resolve(candidatePath);
  if (
    path.dirname(candidate) !== path.dirname(target) ||
    !path.basename(candidate).startsWith(`.${path.basename(target)}.${marker}-`)
  ) {
    throw new Error("Invalid resource bundle publication operation path");
  }
}

function parseJournal(
  value: unknown,
  bundlePath: string,
): ResourceBundlePublicationJournal {
  const target = path.resolve(bundlePath);
  if (
    !isRecord(value) ||
    value.kind !== "prompthub-resource-bundle-publication" ||
    value.version !== JOURNAL_VERSION ||
    typeof value.operationId !== "string" ||
    !/^[a-f0-9-]{36}$/u.test(value.operationId) ||
    !["staging", "prepared", "prior-moved", "published"].includes(
      String(value.state),
    ) ||
    typeof value.bundlePath !== "string" ||
    path.resolve(value.bundlePath) !== target ||
    typeof value.stagePath !== "string" ||
    typeof value.priorPath !== "string" ||
    typeof value.resourceType !== "string" ||
    typeof value.resourceId !== "string" ||
    !Number.isSafeInteger(value.targetRevision) ||
    Number(value.targetRevision) < 1 ||
    typeof value.hadPrior !== "boolean" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Invalid resource bundle publication journal");
  }
  assertOwnedSibling(target, value.stagePath, "stage");
  assertOwnedSibling(target, value.priorPath, "prior");
  return value as unknown as ResourceBundlePublicationJournal;
}

function readJournal(
  bundlePath: string,
): ResourceBundlePublicationJournal | null {
  const journalPath = getResourceBundlePublicationJournalPath(bundlePath);
  try {
    const stats = fs.lstatSync(journalPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Invalid resource bundle publication journal path");
    }
    return parseJournal(
      JSON.parse(fs.readFileSync(journalPath, "utf8")),
      bundlePath,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function removeOwnedPath(targetPath: string): void {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function verifyJournalTarget(
  bundlePath: string,
  journal: ResourceBundlePublicationJournal,
): ResourceBundleManifest {
  const verified = readResourceBundle(bundlePath, {
    expectedResourceType: journal.resourceType,
    expectedResourceId: journal.resourceId,
  });
  if (verified.manifest.revision !== journal.targetRevision) {
    throw new Error(
      "Published resource bundle revision does not match journal",
    );
  }
  return verified.manifest;
}

function finalizePublication(
  journalPath: string,
  journal: ResourceBundlePublicationJournal,
): void {
  removeOwnedPath(journal.stagePath);
  removeOwnedPath(journal.priorPath);
  fs.rmSync(journalPath, { force: true });
  flushDirectory(path.dirname(journal.bundlePath));
}

export function recoverResourceBundlePublication(
  bundlePath: string,
): ResourceBundlePublicationRecovery {
  const journal = readJournal(bundlePath);
  if (!journal) return "none";
  const journalPath = getResourceBundlePublicationJournalPath(bundlePath);
  if (journal.state === "staging" || journal.state === "prepared") {
    if (
      !fs.existsSync(journal.bundlePath) &&
      fs.existsSync(journal.priorPath)
    ) {
      fs.renameSync(journal.priorPath, journal.bundlePath);
    }
    removeOwnedPath(journal.stagePath);
    finalizePublication(journalPath, journal);
    return "rolled-back";
  }
  if (!fs.existsSync(journal.bundlePath) && fs.existsSync(journal.stagePath)) {
    fs.renameSync(journal.stagePath, journal.bundlePath);
  }
  if (!fs.existsSync(journal.bundlePath)) {
    if (fs.existsSync(journal.priorPath)) {
      fs.renameSync(journal.priorPath, journal.bundlePath);
      finalizePublication(journalPath, journal);
      return "rolled-back";
    }
    throw new Error("Resource bundle publication has no recoverable state");
  }
  verifyJournalTarget(journal.bundlePath, journal);
  finalizePublication(journalPath, journal);
  return "committed";
}

export function recoverCanonicalResourcePublications(
  dataPath: string,
  options: { maxJournals?: number } = {},
): CanonicalResourcePublicationRecoveryResult {
  const root = path.resolve(dataPath);
  const maxJournals = options.maxJournals ?? 100_000;
  if (!Number.isSafeInteger(maxJournals) || maxJournals < 1) {
    throw new Error("Canonical publication journal limit is invalid");
  }
  const journals: string[] = [];
  for (const domain of CANONICAL_BUNDLE_DOMAINS) {
    const domainPath = path.join(root, domain);
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(domainPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`Canonical resource domain is unsafe: ${domainPath}`);
    }
    for (const entry of fs.readdirSync(domainPath, { withFileTypes: true })) {
      const match = PUBLICATION_JOURNAL_PATTERN.exec(entry.name);
      if (!match) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(
          `Canonical publication journal is unsafe: ${entry.name}`,
        );
      }
      journals.push(path.join(domainPath, match[1]));
      if (journals.length > maxJournals) {
        throw new Error("Canonical publication journal limit exceeded");
      }
    }
  }
  const result = {
    scannedJournals: journals.length,
    committed: 0,
    rolledBack: 0,
  };
  for (const bundlePath of journals) {
    const recovery = recoverResourceBundlePublication(bundlePath);
    if (recovery === "committed") result.committed += 1;
    if (recovery === "rolled-back") result.rolledBack += 1;
  }
  return result;
}

function rollbackPublication(
  journalPath: string,
  journal: ResourceBundlePublicationJournal,
): void {
  if (fs.existsSync(journal.priorPath)) {
    removeOwnedPath(journal.bundlePath);
    fs.renameSync(journal.priorPath, journal.bundlePath);
  } else if (!journal.hadPrior) {
    removeOwnedPath(journal.bundlePath);
  }
  finalizePublication(journalPath, journal);
}

function shouldLeaveForRecovery(error: unknown): boolean {
  return isRecord(error) && error.leaveOperationForRecovery === true;
}

export function getNextResourceBundleRevision(
  bundlePathValue: string,
  options: NextResourceBundleRevisionOptions,
): number {
  const minimumRevision = options.minimumRevision ?? 1;
  if (!Number.isSafeInteger(minimumRevision) || minimumRevision < 1) {
    throw new Error("Resource bundle minimum revision is invalid");
  }
  const bundlePath = path.resolve(bundlePathValue);
  if (!fs.existsSync(bundlePath)) return minimumRevision;
  const activeRevision = readResourceBundle(bundlePath, {
    expectedResourceType: options.resourceType,
    expectedResourceId: options.resourceId,
  }).manifest.revision;
  if (activeRevision === Number.MAX_SAFE_INTEGER) {
    throw new Error("Resource bundle revision is exhausted");
  }
  return Math.max(minimumRevision, activeRevision + 1);
}

export function resolveResourceBundleWriteRevision(
  bundlePath: string,
  resourceType: string,
  resourceId: string,
  defaultRevision: number,
  policy: ResourceBundleWritePolicy = {},
): number {
  if (policy.revision !== undefined) {
    if (!Number.isSafeInteger(policy.revision) || policy.revision < 1) {
      throw new Error("Resource bundle revision is invalid");
    }
    return policy.revision;
  }
  if ((policy.mode ?? "create") === "replace") {
    return getNextResourceBundleRevision(bundlePath, {
      resourceType,
      resourceId,
      minimumRevision: defaultRevision,
    });
  }
  return defaultRevision;
}

export function publishResourceBundle(
  input: MaterializeResourceBundleInput,
  options: PublishResourceBundleOptions = {},
): PublishResourceBundleResult {
  const bundlePath = path.resolve(input.bundlePath);
  if (readJournal(bundlePath)) {
    throw new Error("Resource bundle publication requires startup recovery");
  }
  const active = fs.existsSync(bundlePath)
    ? readResourceBundle(bundlePath, {
        expectedResourceType: input.resourceType,
        expectedResourceId: input.resourceId,
      }).manifest
    : null;
  if (active && input.revision < active.revision) {
    throw new Error("Resource bundle update is older than active revision");
  }
  if (active && input.schemaVersion < active.schemaVersion) {
    throw new Error("Resource bundle schema downgrade is not allowed");
  }
  const operationId = crypto.randomUUID();
  const parentPath = path.dirname(bundlePath);
  const baseName = path.basename(bundlePath);
  const stagePath = path.join(parentPath, `.${baseName}.stage-${operationId}`);
  const priorPath = path.join(parentPath, `.${baseName}.prior-${operationId}`);
  const journalPath = getResourceBundlePublicationJournalPath(bundlePath);
  const createdAt = new Date().toISOString();
  let journal: ResourceBundlePublicationJournal = {
    kind: "prompthub-resource-bundle-publication",
    version: JOURNAL_VERSION,
    operationId,
    state: "staging",
    bundlePath,
    stagePath,
    priorPath,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    targetRevision: input.revision,
    hadPrior: active !== null,
    createdAt,
    updatedAt: createdAt,
  };
  atomicWriteJournal(journalPath, journal, true);
  try {
    const manifest = materializeResourceBundle({
      ...input,
      bundlePath: stagePath,
    });
    options.injectFailure?.("staged");
    if (
      active &&
      manifest.revision === active.revision &&
      manifest.schemaVersion === active.schemaVersion &&
      manifest.contentHash !== active.contentHash
    ) {
      throw new Error("Resource bundle update conflicts with active revision");
    }
    if (active && manifest.contentHash === active.contentHash) {
      removeOwnedPath(stagePath);
      finalizePublication(journalPath, journal);
      return { manifest: active, replacedRevision: active.revision };
    }
    journal = updateJournal(journalPath, journal, "prepared");
    options.injectFailure?.("prepared");
    if (active) fs.renameSync(bundlePath, priorPath);
    journal = updateJournal(journalPath, journal, "prior-moved");
    options.injectFailure?.("prior-moved");
    fs.renameSync(stagePath, bundlePath);
    journal = updateJournal(journalPath, journal, "published");
    options.injectFailure?.("destination-published");
    const verified = verifyJournalTarget(bundlePath, journal);
    options.injectFailure?.("verified");
    finalizePublication(journalPath, journal);
    return {
      manifest: verified,
      replacedRevision: active?.revision ?? null,
    };
  } catch (error) {
    if (!shouldLeaveForRecovery(error))
      rollbackPublication(journalPath, journal);
    throw error;
  }
}

export function writeResourceBundle(
  input: MaterializeResourceBundleInput,
  options: WriteResourceBundleOptions = {},
): PublishResourceBundleResult {
  if ((options.mode ?? "create") === "replace") {
    return publishResourceBundle(input, options);
  }
  return {
    manifest: materializeResourceBundle(input),
    replacedRevision: null,
  };
}
