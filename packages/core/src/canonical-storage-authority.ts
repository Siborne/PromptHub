import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { deriveStorageRootIdentity } from "./storage-root-identity";

export const CANONICAL_STORAGE_AUTHORITY_FILE_NAME = ".authority-state.json";
export const CANONICAL_STORAGE_AUTHORITY_VERSION = 1;

export interface CanonicalStorageAuthorityState {
  kind: "prompthub-canonical-storage-authority";
  version: typeof CANONICAL_STORAGE_AUTHORITY_VERSION;
  authority: "canonical-files";
  catalogRole: "rebuildable";
  rootIdentity: string;
  consistencyId: string;
  operationId: string;
  publishedAt: string;
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

export function getCanonicalStorageAuthorityPath(activeRoot: string): string {
  return path.join(
    path.resolve(activeRoot),
    "data",
    CANONICAL_STORAGE_AUTHORITY_FILE_NAME,
  );
}

function parseAuthorityState(
  value: unknown,
  activeRoot: string,
): CanonicalStorageAuthorityState {
  if (
    isRecord(value) &&
    Number(value.version) > CANONICAL_STORAGE_AUTHORITY_VERSION
  ) {
    throw new Error("PromptHub data uses a newer authority marker");
  }
  if (
    !isRecord(value) ||
    value.kind !== "prompthub-canonical-storage-authority" ||
    value.version !== CANONICAL_STORAGE_AUTHORITY_VERSION ||
    value.authority !== "canonical-files" ||
    value.catalogRole !== "rebuildable" ||
    typeof value.rootIdentity !== "string" ||
    typeof value.consistencyId !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.consistencyId) ||
    typeof value.operationId !== "string" ||
    !/^[a-zA-Z0-9._-]{1,128}$/u.test(value.operationId) ||
    typeof value.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(value.publishedAt))
  ) {
    throw new Error("PromptHub canonical authority marker is invalid");
  }
  if (value.rootIdentity !== deriveStorageRootIdentity(activeRoot)) {
    throw new Error("PromptHub canonical authority root identity mismatch");
  }
  return value as unknown as CanonicalStorageAuthorityState;
}

export function readCanonicalStorageAuthority(
  activeRoot: string,
  options: { identityRoot?: string } = {},
): CanonicalStorageAuthorityState | null {
  const markerPath = getCanonicalStorageAuthorityPath(activeRoot);
  try {
    const stats = fs.lstatSync(markerPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("PromptHub canonical authority marker path is unsafe");
    }
    return parseAuthorityState(
      JSON.parse(fs.readFileSync(markerPath, "utf8")),
      path.resolve(options.identityRoot ?? activeRoot),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      throw new Error("PromptHub canonical authority marker is invalid", {
        cause: error,
      });
    }
    throw error;
  }
}

export function writeCanonicalStorageAuthority(
  activeRoot: string,
  input: {
    consistencyId: string;
    operationId: string;
    identityRoot?: string;
    now?: Date;
  },
): CanonicalStorageAuthorityState {
  const root = path.resolve(activeRoot);
  const markerPath = getCanonicalStorageAuthorityPath(root);
  const identityRoot = path.resolve(input.identityRoot ?? root);
  const state = parseAuthorityState(
    {
      kind: "prompthub-canonical-storage-authority",
      version: CANONICAL_STORAGE_AUTHORITY_VERSION,
      authority: "canonical-files",
      catalogRole: "rebuildable",
      rootIdentity: deriveStorageRootIdentity(identityRoot),
      consistencyId: input.consistencyId,
      operationId: input.operationId,
      publishedAt: (input.now ?? new Date()).toISOString(),
    },
    identityRoot,
  );
  const dataPath = path.dirname(markerPath);
  const rootStats = fs.lstatSync(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("PromptHub canonical authority root is unsafe");
  }
  if (fs.existsSync(dataPath)) {
    const dataStats = fs.lstatSync(dataPath);
    if (!dataStats.isDirectory() || dataStats.isSymbolicLink()) {
      throw new Error("PromptHub canonical authority data path is unsafe");
    }
  } else {
    fs.mkdirSync(dataPath, { recursive: true, mode: 0o700 });
  }
  const temporaryPath = `${markerPath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporaryPath, markerPath);
    flushDirectory(dataPath);
    return state;
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}
