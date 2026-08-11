import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  acquireStorageMaintenanceIntent,
  deriveStorageRootIdentity,
  readCanonicalStorageAuthority,
  readRendererPersistenceMigrationMarker,
  readRuntimeLayoutState,
  runJournaledStorageRestore,
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
  type StorageRestorePublicationStage,
} from "@prompthub/core";
import { DatabaseAdapter } from "@prompthub/db";

import {
  createCanonicalCheckpointFromClosedDatabase,
  verifyCanonicalStorageCheckpoint,
  verifyCanonicalStorageCheckpointContent,
  type CanonicalStorageCheckpointManifest,
  type CreateCanonicalCheckpointFromClosedDatabaseOptions,
} from "./canonical-storage-checkpoint";

export interface PublishCanonicalStorageAuthorityOptions extends Omit<
  CreateCanonicalCheckpointFromClosedDatabaseOptions,
  "targetPath" | "maintenanceOperationId" | "publishedCanonicalRootPath"
> {
  checkpointPath: string;
  operationId?: string;
  now?: Date;
  injectFailure?: (stage: StorageRestorePublicationStage) => void;
}

export interface PublishCanonicalStorageAuthorityResult {
  status: "committed";
  operationId: string;
  consistencyId: string;
  recoveryArtifactPath: string;
}

function copyCompletedMigrationState(
  activeRoot: string,
  candidateData: string,
): void {
  const sourcePath = path.join(activeRoot, "data", "operations", "migrations");
  if (!fs.existsSync(sourcePath)) return;
  const stats = fs.lstatSync(sourcePath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error("Canonical authority migration state is unsafe");
  }
  fs.cpSync(sourcePath, path.join(candidateData, "operations", "migrations"), {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
  });
}

function copyExistingRootEntry(
  activeRoot: string,
  stageRoot: string,
  entryName: "config" | "secrets",
): void {
  const sourcePath = path.join(activeRoot, entryName);
  const targetPath = path.join(stageRoot, entryName);
  if (!fs.existsSync(sourcePath)) {
    fs.mkdirSync(targetPath, { recursive: true, mode: 0o700 });
    return;
  }
  const stats = fs.lstatSync(sourcePath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`Canonical authority ${entryName} path is unsafe`);
  }
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
  });
}

function hashFile(filePath: string): string {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY);
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(64 * 1024);
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

function verifyPublishedCatalogPaths(
  databasePath: string,
  publishedDataPath: string,
): void {
  const database = new DatabaseAdapter(databasePath, { readOnly: true });
  try {
    if (
      JSON.stringify(database.pragma("quick_check")) !==
      JSON.stringify([{ quick_check: "ok" }])
    ) {
      throw new Error("Canonical authority catalog failed quick_check");
    }
    const skillRoot = `${path.join(publishedDataPath, "skills")}${path.sep}`;
    const ruleRoot = `${path.join(publishedDataPath, "rules")}${path.sep}`;
    const skills = database.all(
      "SELECT local_repo_path AS path FROM skills WHERE local_repo_path IS NOT NULL",
    ) as Array<{ path: string }>;
    const rules = database.all(
      "SELECT managed_path AS path FROM rules WHERE managed_path IS NOT NULL",
    ) as Array<{ path: string }>;
    if (skills.some((entry) => !entry.path.startsWith(skillRoot))) {
      throw new Error(
        "Canonical authority catalog contains a stale Skill path",
      );
    }
    if (rules.some((entry) => !entry.path.startsWith(ruleRoot))) {
      throw new Error("Canonical authority catalog contains a stale Rule path");
    }
  } finally {
    database.close();
  }
}

export function verifyCanonicalAuthorityRoot(
  rootPath: string,
  manifest: CanonicalStorageCheckpointManifest,
  identityRoot = rootPath,
): void {
  const root = path.resolve(rootPath);
  const identity = path.resolve(identityRoot);
  const dataPath = path.join(root, "data");
  const layout = readRuntimeLayoutState(root);
  if (layout?.rootIdentity !== deriveStorageRootIdentity(identity)) {
    throw new Error("Canonical authority layout identity mismatch");
  }
  const authority = readCanonicalStorageAuthority(root, {
    identityRoot: identity,
  });
  if (!authority || authority.consistencyId !== manifest.consistencyId) {
    throw new Error("Canonical authority marker consistency mismatch");
  }
  verifyCanonicalStorageCheckpointContent(dataPath, manifest);
  const databasePath = path.join(dataPath, "prompthub.db");
  const stats = fs.lstatSync(databasePath);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size !== manifest.catalogByteSize ||
    hashFile(databasePath) !== manifest.catalogSha256
  ) {
    throw new Error("Canonical authority catalog digest mismatch");
  }
  verifyPublishedCatalogPaths(databasePath, path.join(identity, "data"));
}

function prepareAuthorityCandidate(
  stageRoot: string,
  options: PublishCanonicalStorageAuthorityOptions,
  manifest: CanonicalStorageCheckpointManifest,
  operationId: string,
): void {
  copyExistingRootEntry(options.activeRoot, stageRoot, "config");
  copyExistingRootEntry(options.activeRoot, stageRoot, "secrets");
  const candidateData = path.join(stageRoot, "data");
  fs.cpSync(path.join(options.checkpointPath, "canonical"), candidateData, {
    recursive: true,
    dereference: false,
    errorOnExist: true,
    force: false,
  });
  fs.copyFileSync(
    path.join(options.checkpointPath, "catalog", "prompthub.db"),
    path.join(candidateData, "prompthub.db"),
    fs.constants.COPYFILE_EXCL,
  );
  copyCompletedMigrationState(options.activeRoot, candidateData);
  const bindingSource = path.join(
    options.checkpointPath,
    "device",
    "mcp-bindings.json",
  );
  if (fs.existsSync(bindingSource)) {
    const bindingTarget = path.join(
      stageRoot,
      "config",
      "devices",
      "mcp-bindings.json",
    );
    fs.mkdirSync(path.dirname(bindingTarget), { recursive: true, mode: 0o700 });
    fs.copyFileSync(bindingSource, bindingTarget, fs.constants.COPYFILE_EXCL);
  }
  writeRuntimeLayoutState(stageRoot, {
    identityRoot: options.activeRoot,
    lastVerifiedOperation: operationId,
    now: options.now,
  });
  writeCanonicalStorageAuthority(stageRoot, {
    consistencyId: manifest.consistencyId,
    operationId,
    identityRoot: options.activeRoot,
    now: options.now,
  });
}

export async function publishCanonicalStorageAuthority(
  options: PublishCanonicalStorageAuthorityOptions,
): Promise<PublishCanonicalStorageAuthorityResult> {
  const activeRoot = path.resolve(options.activeRoot);
  if (readCanonicalStorageAuthority(activeRoot)) {
    throw new Error("Canonical file authority is already published");
  }
  if (!readRendererPersistenceMigrationMarker(activeRoot)) {
    throw new Error(
      "Renderer persistence migration must complete before authority publication",
    );
  }
  const operationId = options.operationId ?? `authority-${crypto.randomUUID()}`;
  const maintenance = acquireStorageMaintenanceIntent(activeRoot, {
    operationId,
    operationKind: "canonical-authority",
  });
  let ownsCheckpoint = false;
  try {
    const checkpoint = await createCanonicalCheckpointFromClosedDatabase({
      ...options,
      activeRoot,
      targetPath: path.resolve(options.checkpointPath),
      maintenanceOperationId: operationId,
      publishedCanonicalRootPath: path.join(activeRoot, "data"),
    });
    ownsCheckpoint = true;
    const manifest = verifyCanonicalStorageCheckpoint(checkpoint.targetPath);
    const result = await runJournaledStorageRestore({
      activeRoot,
      operationId,
      maintenanceOperationId: operationId,
      entryNames: ["data", "config", "secrets"],
      prepareCandidate: (stageRoot) =>
        prepareAuthorityCandidate(stageRoot, options, manifest, operationId),
      verifyCandidate: (stageRoot) =>
        verifyCanonicalAuthorityRoot(stageRoot, manifest, activeRoot),
      verifyActive: (publishedRoot) =>
        verifyCanonicalAuthorityRoot(publishedRoot, manifest),
      injectFailure: options.injectFailure,
      now: options.now,
    });
    return {
      status: result.status,
      operationId,
      consistencyId: manifest.consistencyId,
      recoveryArtifactPath: result.recoveryArtifactPath,
    };
  } finally {
    if (ownsCheckpoint) {
      fs.rmSync(path.resolve(options.checkpointPath), {
        recursive: true,
        force: true,
      });
    }
    maintenance.release();
  }
}
