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

type AuthorityPublisher = (
  options: PublishCanonicalStorageAuthorityOptions,
) => Promise<PublishCanonicalStorageAuthorityResult>;

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
}

export type CanonicalStorageAuthorityStartupResult =
  | { status: "already-canonical" }
  | {
      status: "recovery-required";
      reason: "invalid-canonical-prompt-graph";
      error: string;
    }
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

export async function ensureCanonicalStorageAuthorityOnStartup(
  options: EnsureCanonicalStorageAuthorityOnStartupOptions,
): Promise<CanonicalStorageAuthorityStartupResult> {
  const activeRoot = path.resolve(options.activeRoot);
  if (readCanonicalStorageAuthority(activeRoot)) {
    try {
      readPromptCanonicalGraph(path.join(activeRoot, "data"));
      return { status: "already-canonical" };
    } catch (error) {
      return {
        status: "recovery-required",
        reason: "invalid-canonical-prompt-graph",
        error:
          error instanceof Error
            ? error.message
            : "Canonical Prompt graph is invalid",
      };
    }
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
        `.canonical-authority-checkpoint-${process.pid}-${crypto.randomUUID()}`,
      ),
  );
  const {
    publish = publishCanonicalStorageAuthority,
    prepareSourceDatabase: _prepareSourceDatabase,
    refreshRuntimeContext = refreshRuntimeStorageContext,
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
