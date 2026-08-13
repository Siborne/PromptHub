import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assertStoragePathComponentsSafe } from "./runtime-storage-context";

export interface RecoveryArtifactManifestBase {
  kind: "storage-restore-recovery-artifact" | "storage-root-recovery-artifact";
  id: string;
  operationId: string;
  artifactType: string;
  sourceRoot: string;
  targetRoot?: string;
  entries?: readonly string[];
  createdAt: string;
}

export interface PublishRecoveryArtifactOptions {
  ownerRoot: string;
  registryRoot: string;
  priorRoot: string;
  manifest: RecoveryArtifactManifestBase;
  now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertArtifactId(id: string): void {
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id) || id === "." || id === "..") {
    throw new Error(`Invalid recovery artifact id: ${id}`);
  }
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
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporaryPath, filePath);
    flushDirectory(path.dirname(filePath));
  } catch (error) {
    if (descriptor !== null) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original publication failure.
      }
    }
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function assertDirectory(directoryPath: string, label: string): void {
  const stats = fs.lstatSync(directoryPath);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} is unsafe: ${directoryPath}`);
  }
}

function manifestMatches(
  value: Record<string, unknown>,
  expected: RecoveryArtifactManifestBase,
): boolean {
  const identityMatches =
    value.formatVersion === 1 &&
    value.kind === expected.kind &&
    value.id === expected.id &&
    value.operationId === expected.operationId &&
    value.artifactType === expected.artifactType &&
    value.sourceRoot === expected.sourceRoot &&
    value.targetRoot === expected.targetRoot &&
    JSON.stringify(value.entries) === JSON.stringify(expected.entries) &&
    value.createdAt === expected.createdAt;
  if (!identityMatches) return false;
  if (value.state === "preparing") return value.validatedAt === undefined;
  return (
    value.state === "complete" &&
    typeof value.validatedAt === "string" &&
    Number.isFinite(Date.parse(value.validatedAt))
  );
}

function readOwnedManifest(
  directoryPath: string,
  expected: RecoveryArtifactManifestBase,
): "preparing" | "complete" | "legacy-root-only" {
  assertDirectory(directoryPath, "Recovery artifact directory");
  const manifestPath = path.join(directoryPath, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    const entries = fs.readdirSync(directoryPath);
    const rootPath = path.join(directoryPath, "root");
    if (entries.length === 1 && entries[0] === "root") {
      assertDirectory(rootPath, "Recovery artifact root");
      return "legacy-root-only";
    }
    throw new Error(`Recovery artifact already exists: ${directoryPath}`);
  }
  const stats = fs.lstatSync(manifestPath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`Recovery artifact manifest is unsafe: ${manifestPath}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error(`Recovery artifact manifest is invalid: ${manifestPath}`);
  }
  if (!isRecord(value) || !manifestMatches(value, expected)) {
    throw new Error(`Recovery artifact already exists: ${directoryPath}`);
  }
  return value.state as "preparing" | "complete";
}

function preparingManifest(expected: RecoveryArtifactManifestBase) {
  return { formatVersion: 1, ...expected, state: "preparing" as const };
}

function completeManifest(
  expected: RecoveryArtifactManifestBase,
  validatedAt: string,
) {
  return {
    formatVersion: 1,
    ...expected,
    state: "complete" as const,
    validatedAt,
  };
}

function prepareArtifactDirectory(
  registryRoot: string,
  artifactPath: string,
  stagePath: string,
  expected: RecoveryArtifactManifestBase,
): void {
  if (fs.existsSync(artifactPath)) return;
  if (fs.existsSync(stagePath)) {
    assertDirectory(stagePath, "Recovery artifact preparation directory");
    const entries = fs.readdirSync(stagePath);
    if (entries.length === 0) {
      fs.rmSync(stagePath, { recursive: true });
    } else if (readOwnedManifest(stagePath, expected) !== "preparing") {
      throw new Error(`Recovery artifact preparation is invalid: ${stagePath}`);
    }
  }
  if (!fs.existsSync(stagePath)) {
    fs.mkdirSync(stagePath, { mode: 0o700 });
    try {
      atomicWriteJson(
        path.join(stagePath, "manifest.json"),
        preparingManifest(expected),
      );
    } catch (error) {
      fs.rmSync(stagePath, { recursive: true, force: true });
      throw error;
    }
  }
  fs.renameSync(stagePath, artifactPath);
  flushDirectory(registryRoot);
}

export function publishRecoveryArtifact(
  options: PublishRecoveryArtifactOptions,
): string {
  assertArtifactId(options.manifest.id);
  const registryRoot = path.resolve(options.registryRoot);
  const priorRoot = path.resolve(options.priorRoot);
  const artifactPath = path.join(registryRoot, options.manifest.id);
  const stagePath = path.join(
    registryRoot,
    `.${options.manifest.id}.preparing`,
  );
  assertStoragePathComponentsSafe(options.ownerRoot, registryRoot);
  fs.mkdirSync(registryRoot, { recursive: true, mode: 0o700 });
  assertStoragePathComponentsSafe(options.ownerRoot, registryRoot);
  assertDirectory(registryRoot, "Recovery artifact registry");
  prepareArtifactDirectory(
    registryRoot,
    artifactPath,
    stagePath,
    options.manifest,
  );

  const state = readOwnedManifest(artifactPath, options.manifest);
  const artifactRoot = path.join(artifactPath, "root");
  if (state === "complete") {
    assertDirectory(artifactRoot, "Recovery artifact root");
    if (fs.existsSync(priorRoot)) {
      throw new Error(
        `Recovery artifact has an unexpected prior tree: ${priorRoot}`,
      );
    }
    return artifactPath;
  }
  const priorExists = fs.existsSync(priorRoot);
  const artifactRootExists = fs.existsSync(artifactRoot);
  if (priorExists && artifactRootExists) {
    throw new Error(
      `Recovery artifact publication is ambiguous: ${artifactPath}`,
    );
  }
  if (priorExists) {
    fs.renameSync(priorRoot, artifactRoot);
  } else if (!artifactRootExists) {
    fs.mkdirSync(artifactRoot, { mode: 0o700 });
  } else {
    assertDirectory(artifactRoot, "Recovery artifact root");
  }
  atomicWriteJson(
    path.join(artifactPath, "manifest.json"),
    completeManifest(
      options.manifest,
      (options.now ?? (() => new Date()))().toISOString(),
    ),
  );
  return artifactPath;
}
