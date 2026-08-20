import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  deriveLocalResourceDeviceId,
  readCanonicalStorageAuthority,
  readPromptCanonicalGraph,
  readRendererPersistenceMigrationMarker,
  refreshRuntimeStorageContext,
} from "@prompthub/core";

import {
  publishCanonicalStorageAuthority,
  type PublishCanonicalStorageAuthorityOptions,
  type PublishCanonicalStorageAuthorityResult,
} from "./canonical-storage-authority";
import {
  reconcileCanonicalStorageCatalog,
  repairCanonicalStorageFromPromptWorkspace,
  type RepairCanonicalStorageFromPromptWorkspaceResult,
} from "./canonical-storage-self-heal";

type AuthorityPublisher = (
  options: PublishCanonicalStorageAuthorityOptions,
) => Promise<PublishCanonicalStorageAuthorityResult>;

type InvalidAuthorityRepairer = (options: {
  activeRoot: string;
  sourceDatabasePath: string;
}) => Promise<RepairCanonicalStorageFromPromptWorkspaceResult>;

type CatalogReconciler = (options: {
  activeRoot: string;
  databasePath: string;
}) => { status: "current" | "rebuilt" };

export interface EnsureCanonicalStorageAuthorityOnStartupOptions extends Omit<
  PublishCanonicalStorageAuthorityOptions,
  "activeRoot" | "sourceDatabasePath" | "checkpointPath" | "deviceId"
> {
  activeRoot: string;
  sourceDatabasePath: string;
  checkpointPath?: string;
  publish?: AuthorityPublisher;
  prepareSourceDatabase?: () => void | Promise<void>;
  refreshRuntimeContext?: () => void;
  repairInvalidAuthority?: InvalidAuthorityRepairer;
  reconcileCatalog?: CatalogReconciler;
}

export type CanonicalStorageAuthorityStartupResult =
  | { status: "already-canonical" }
  | {
      status: "recovery-required";
      reason: "invalid-canonical-prompt-graph" | "invalid-canonical-storage";
      error: string;
    }
  | { status: "catalog-rebuilt" }
  | { status: "self-healed"; recoveryArtifactPath: string }
  | { status: "waiting-renderer-migration" }
  | { status: "source-database-missing" }
  | ({ status: "published" } & Omit<
      PublishCanonicalStorageAuthorityResult,
      "status"
    >);

function assertRegularDatabaseOrMissing(databasePath: string): boolean {
  try {
    const stats = fs.lstatSync(databasePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Canonical authority source database is unsafe");
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function canonicalPromptGraphError(activeRoot: string): string | null {
  try {
    readPromptCanonicalGraph(path.join(activeRoot, "data"));
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Canonical Prompt graph is invalid";
  }
}

async function repairInvalidAuthority(
  options: EnsureCanonicalStorageAuthorityOnStartupOptions,
  activeRoot: string,
  graphError: string,
): Promise<CanonicalStorageAuthorityStartupResult> {
  try {
    const repaired = await (
      options.repairInvalidAuthority ??
      ((input) => repairCanonicalStorageFromPromptWorkspace(input))
    )({
      activeRoot,
      sourceDatabasePath: path.resolve(options.sourceDatabasePath),
    });
    (options.refreshRuntimeContext ?? refreshRuntimeStorageContext)();
    return {
      status: "self-healed",
      recoveryArtifactPath: repaired.recoveryArtifactPath,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Automatic file repair failed";
    return {
      status: "recovery-required",
      reason: "invalid-canonical-prompt-graph",
      error: `${graphError}; automatic file repair failed: ${message}`,
    };
  }
}

async function ensureExistingCanonicalAuthority(
  options: EnsureCanonicalStorageAuthorityOnStartupOptions,
  activeRoot: string,
): Promise<CanonicalStorageAuthorityStartupResult> {
  const graphError = canonicalPromptGraphError(activeRoot);
  if (graphError) {
    return repairInvalidAuthority(options, activeRoot, graphError);
  }
  try {
    const result = (
      options.reconcileCatalog ?? reconcileCanonicalStorageCatalog
    )({
      activeRoot,
      databasePath: path.resolve(options.sourceDatabasePath),
    });
    return {
      status:
        result.status === "rebuilt" ? "catalog-rebuilt" : "already-canonical",
    };
  } catch (error) {
    return {
      status: "recovery-required",
      reason: "invalid-canonical-storage",
      error:
        error instanceof Error ? error.message : "Canonical storage is invalid",
    };
  }
}

export async function ensureCanonicalStorageAuthorityOnStartup(
  options: EnsureCanonicalStorageAuthorityOnStartupOptions,
): Promise<CanonicalStorageAuthorityStartupResult> {
  const activeRoot = path.resolve(options.activeRoot);
  if (readCanonicalStorageAuthority(activeRoot)) {
    return ensureExistingCanonicalAuthority(options, activeRoot);
  }
  if (!readRendererPersistenceMigrationMarker(activeRoot)) {
    return { status: "waiting-renderer-migration" };
  }
  const sourceDatabasePath = path.resolve(options.sourceDatabasePath);
  if (!assertRegularDatabaseOrMissing(sourceDatabasePath)) {
    return { status: "source-database-missing" };
  }
  await options.prepareSourceDatabase?.();
  const checkpointPath = path.resolve(
    options.checkpointPath ??
      path.join(
        activeRoot,
        "cache",
        `.canonical-checkpoint-${crypto.randomUUID()}`,
      ),
  );
  const {
    publish = publishCanonicalStorageAuthority,
    prepareSourceDatabase: _prepareSourceDatabase,
    refreshRuntimeContext = refreshRuntimeStorageContext,
    repairInvalidAuthority: _repairInvalidAuthority,
    reconcileCatalog: _reconcileCatalog,
    ...publicationOptions
  } = options;
  const result = await publish({
    ...publicationOptions,
    activeRoot,
    sourceDatabasePath,
    checkpointPath,
    deviceId: deriveLocalResourceDeviceId(activeRoot),
  });
  refreshRuntimeContext();
  return {
    status: "published",
    operationId: result.operationId,
    consistencyId: result.consistencyId,
    recoveryArtifactPath: result.recoveryArtifactPath,
  };
}
