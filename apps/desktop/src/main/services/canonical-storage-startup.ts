import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  readCanonicalStorageAuthority,
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
  "activeRoot" | "sourceDatabasePath" | "checkpointPath"
> {
  activeRoot: string;
  sourceDatabasePath: string;
  checkpointPath?: string;
  publish?: AuthorityPublisher;
  refreshRuntimeContext?: () => void;
}

export type CanonicalStorageAuthorityStartupResult =
  | { status: "already-canonical" }
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
    return { status: "already-canonical" };
  }
  if (!readRendererPersistenceMigrationMarker(activeRoot)) {
    return { status: "waiting-renderer-migration" };
  }
  const sourceDatabasePath = path.resolve(options.sourceDatabasePath);
  if (!assertRegularDatabaseOrMissing(sourceDatabasePath)) {
    return { status: "source-database-missing" };
  }
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
    refreshRuntimeContext = refreshRuntimeStorageContext,
    ...publicationOptions
  } = options;
  const result = await publish({
    ...publicationOptions,
    activeRoot,
    sourceDatabasePath,
    checkpointPath,
  });
  refreshRuntimeContext();
  return {
    status: "published",
    operationId: result.operationId,
    consistencyId: result.consistencyId,
    recoveryArtifactPath: result.recoveryArtifactPath,
  };
}
