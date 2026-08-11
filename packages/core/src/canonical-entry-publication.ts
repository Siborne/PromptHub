import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const JOURNAL_KIND = "prompthub-canonical-entry-publication";
const JOURNAL_VERSION = 1;
const OPERATION_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const activePublications = new Set<string>();

interface JournalEntry {
  targetPath: string;
  stagePath: string | null;
  priorPath: string;
  delete: boolean;
  hadPrior: boolean;
}

interface CanonicalEntryPublicationJournal {
  kind: typeof JOURNAL_KIND;
  version: typeof JOURNAL_VERSION;
  operationKey: string;
  operationId: string;
  rootPath: string;
  state: "prepared";
  entries: JournalEntry[];
  createdAt: string;
}

export interface CanonicalEntryMutation {
  targetPath: string;
  delete?: boolean;
  prepare?: (stagePath: string) => void;
}

export interface PublishCanonicalEntriesOptions {
  rootPath: string;
  operationKey: string;
  entries: readonly CanonicalEntryMutation[];
  verify?: () => void;
  commit?: () => void;
  injectFailure?: (targetPath: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertOperationKey(value: string): void {
  if (!OPERATION_KEY_PATTERN.test(value)) {
    throw new Error("Canonical entry publication operation key is invalid");
  }
}

function assertOwnedPath(rootPath: string, candidatePath: string): string {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Canonical entry publication path escapes its root");
  }
  let cursor = root;
  for (const segment of relative.split(path.sep).slice(0, -1)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) break;
    const stats = fs.lstatSync(cursor);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error("Canonical entry publication parent path is unsafe");
    }
  }
  return candidate;
}

function flushDirectory(directoryPath: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch {
    // Directory fsync is not supported by every target filesystem.
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function journalPath(rootPath: string, operationKey: string): string {
  assertOperationKey(operationKey);
  return path.join(
    path.resolve(rootPath),
    "data",
    "operations",
    "journals",
    `${operationKey}-publication.json`,
  );
}

function writeJournal(
  filePath: string,
  journal: CanonicalEntryPublicationJournal,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const descriptor = fs.openSync(filePath, "wx", 0o600);
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
  flushDirectory(path.dirname(filePath));
}

function assertSiblingOperationPath(
  targetPath: string,
  candidatePath: string,
  marker: "stage" | "prior",
): void {
  if (
    path.dirname(targetPath) !== path.dirname(candidatePath) ||
    !path
      .basename(candidatePath)
      .startsWith(`.${path.basename(targetPath)}.${marker}-`)
  ) {
    throw new Error("Canonical entry publication operation path is invalid");
  }
}

function parseJournal(
  value: unknown,
  rootPath: string,
  operationKey: string,
): CanonicalEntryPublicationJournal {
  const root = path.resolve(rootPath);
  if (
    !isRecord(value) ||
    value.kind !== JOURNAL_KIND ||
    value.version !== JOURNAL_VERSION ||
    value.operationKey !== operationKey ||
    typeof value.operationId !== "string" ||
    !/^[a-f0-9-]{36}$/u.test(value.operationId) ||
    value.rootPath !== root ||
    value.state !== "prepared" ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0 ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("Canonical entry publication journal is invalid");
  }
  const entries = value.entries.map((raw): JournalEntry => {
    if (
      !isRecord(raw) ||
      typeof raw.targetPath !== "string" ||
      (raw.stagePath !== null && typeof raw.stagePath !== "string") ||
      typeof raw.priorPath !== "string" ||
      typeof raw.delete !== "boolean" ||
      typeof raw.hadPrior !== "boolean"
    ) {
      throw new Error("Canonical entry publication journal entry is invalid");
    }
    const targetPath = assertOwnedPath(root, raw.targetPath);
    const priorPath = assertOwnedPath(root, raw.priorPath);
    assertSiblingOperationPath(targetPath, priorPath, "prior");
    const stagePath =
      raw.stagePath === null
        ? null
        : assertOwnedPath(root, raw.stagePath as string);
    if (stagePath) assertSiblingOperationPath(targetPath, stagePath, "stage");
    if (raw.delete !== (stagePath === null)) {
      throw new Error("Canonical entry publication journal action is invalid");
    }
    return {
      targetPath,
      stagePath,
      priorPath,
      delete: raw.delete,
      hadPrior: raw.hadPrior,
    };
  });
  if (
    new Set(entries.map((entry) => entry.targetPath)).size !== entries.length
  ) {
    throw new Error(
      "Canonical entry publication journal has duplicate targets",
    );
  }
  return { ...(value as unknown as CanonicalEntryPublicationJournal), entries };
}

function readJournal(
  rootPath: string,
  operationKey: string,
): CanonicalEntryPublicationJournal | null {
  const filePath = journalPath(rootPath, operationKey);
  try {
    const stats = fs.lstatSync(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Canonical entry publication journal path is unsafe");
    }
    return parseJournal(
      JSON.parse(fs.readFileSync(filePath, "utf8")),
      rootPath,
      operationKey,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      throw new Error("Canonical entry publication journal is invalid", {
        cause: error,
      });
    }
    throw error;
  }
}

function removePath(candidatePath: string): void {
  fs.rmSync(candidatePath, { recursive: true, force: true });
}

function rollback(
  filePath: string,
  journal: CanonicalEntryPublicationJournal,
): void {
  for (const entry of [...journal.entries].reverse()) {
    if (fs.existsSync(entry.priorPath)) {
      removePath(entry.targetPath);
      fs.mkdirSync(path.dirname(entry.targetPath), {
        recursive: true,
        mode: 0o700,
      });
      fs.renameSync(entry.priorPath, entry.targetPath);
    } else if (
      !entry.delete &&
      entry.stagePath &&
      !fs.existsSync(entry.stagePath) &&
      !entry.hadPrior
    ) {
      removePath(entry.targetPath);
    }
    if (entry.stagePath) removePath(entry.stagePath);
    removePath(entry.priorPath);
    flushDirectory(path.dirname(entry.targetPath));
  }
  fs.rmSync(filePath, { force: true });
  flushDirectory(path.dirname(filePath));
}

export function recoverCanonicalEntryPublication(
  rootPath: string,
  operationKey: string,
): "none" | "rolled-back" {
  const activeKey = `${path.resolve(rootPath)}\u0000${operationKey}`;
  if (activePublications.has(activeKey)) return "none";
  const filePath = journalPath(rootPath, operationKey);
  const journal = readJournal(rootPath, operationKey);
  if (!journal) return "none";
  rollback(filePath, journal);
  return "rolled-back";
}

export function publishCanonicalEntries(
  options: PublishCanonicalEntriesOptions,
): void {
  const rootPath = path.resolve(options.rootPath);
  assertOperationKey(options.operationKey);
  if (options.entries.length === 0) return;
  const activeKey = `${rootPath}\u0000${options.operationKey}`;
  if (activePublications.has(activeKey)) {
    throw new Error("Canonical entry publication is already active");
  }
  recoverCanonicalEntryPublication(rootPath, options.operationKey);
  const operationId = crypto.randomUUID();
  const entries = options.entries.map((entry): JournalEntry => {
    const targetPath = assertOwnedPath(rootPath, entry.targetPath);
    if (entry.delete === true && entry.prepare) {
      throw new Error(
        "Canonical entry deletion cannot have a prepare callback",
      );
    }
    if (entry.delete !== true && !entry.prepare) {
      throw new Error(
        "Canonical entry replacement requires a prepare callback",
      );
    }
    return {
      targetPath,
      stagePath:
        entry.delete === true
          ? null
          : path.join(
              path.dirname(targetPath),
              `.${path.basename(targetPath)}.stage-${operationId}`,
            ),
      priorPath: path.join(
        path.dirname(targetPath),
        `.${path.basename(targetPath)}.prior-${operationId}`,
      ),
      delete: entry.delete === true,
      hadPrior: fs.existsSync(targetPath),
    };
  });
  if (
    new Set(entries.map((entry) => entry.targetPath)).size !== entries.length
  ) {
    throw new Error("Canonical entry publication has duplicate targets");
  }
  activePublications.add(activeKey);
  const filePath = journalPath(rootPath, options.operationKey);
  let journalWritten = false;
  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry.stagePath) continue;
      fs.mkdirSync(path.dirname(entry.stagePath), {
        recursive: true,
        mode: 0o700,
      });
      options.entries[index].prepare!(entry.stagePath);
      const stats = fs.lstatSync(entry.stagePath);
      if (stats.isSymbolicLink()) {
        throw new Error("Canonical entry publication stage is unsafe");
      }
    }
    const journal: CanonicalEntryPublicationJournal = {
      kind: JOURNAL_KIND,
      version: JOURNAL_VERSION,
      operationKey: options.operationKey,
      operationId,
      rootPath,
      state: "prepared",
      entries,
      createdAt: new Date().toISOString(),
    };
    writeJournal(filePath, journal);
    journalWritten = true;
    for (const entry of entries) {
      options.injectFailure?.(entry.targetPath);
      if (entry.hadPrior) fs.renameSync(entry.targetPath, entry.priorPath);
      if (entry.stagePath) fs.renameSync(entry.stagePath, entry.targetPath);
      flushDirectory(path.dirname(entry.targetPath));
    }
    options.verify?.();
    options.commit?.();
    for (const entry of entries) {
      removePath(entry.priorPath);
      if (entry.stagePath) removePath(entry.stagePath);
    }
    fs.rmSync(filePath, { force: true });
    flushDirectory(path.dirname(filePath));
  } catch (error) {
    if (journalWritten) {
      const journal = readJournal(rootPath, options.operationKey);
      if (journal) rollback(filePath, journal);
    } else {
      for (const entry of entries) {
        if (entry.stagePath) removePath(entry.stagePath);
        removePath(entry.priorPath);
      }
    }
    throw error;
  } finally {
    activePublications.delete(activeKey);
  }
}
