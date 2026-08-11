import fs from "fs";
import path from "path";

import { listRecoveryArtifacts } from "./recovery-artifact-registry";
import { readStorageRestoreJournalState } from "./journaled-storage-restore";
import { readStorageRootOperationJournal } from "./storage-root-operation";
import {
  readRuntimeLayoutState,
  resolveRuntimeStorageContext,
} from "./runtime-storage-context";

export interface StorageDatabaseDiagnostic {
  userVersion: number | null;
  migrationCount: number | null;
  quickCheck: "ok" | "failed" | "unavailable";
}

export interface StorageDiagnostic {
  root: {
    activePath: string;
    rootIdentity: string;
    layoutEpoch: number;
    resolutionReason: string;
    layoutState: "published" | "inferred";
  };
  database: {
    path: string;
    exists: boolean;
    sizeBytes: number;
  } & StorageDatabaseDiagnostic;
  operations: {
    rootChange: null | {
      operationId: string;
      action: string;
      state: string;
    };
    restore: ReturnType<typeof readStorageRestoreJournalState>;
  };
  recovery: {
    count: number;
    totalBytes: number;
    artifactTypes: Record<string, number>;
  };
  rendererPersistence: {
    migrationComplete: boolean;
    indexedDbMigrationComplete: boolean;
  };
  hostReconciliation: {
    desktopSkillRepoComplete: boolean;
  };
  portableOmissions: string[];
}

function regularFileSize(filePath: string): number | null {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isFile() && !stats.isSymbolicLink() ? stats.size : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function markerExists(rootPath: string, relativePath: string): boolean {
  return (
    regularFileSize(path.join(rootPath, ...relativePath.split("/"))) !== null
  );
}

export function getStorageDiagnostic(
  activeRoot: string,
  options: {
    controlDirectory?: string;
    inspectDatabase?: (databasePath: string) => StorageDatabaseDiagnostic;
  } = {},
): StorageDiagnostic {
  const context = resolveRuntimeStorageContext(activeRoot);
  const layoutState = readRuntimeLayoutState(context.activeRoot);
  const databaseSize = regularFileSize(context.databasePath);
  const database =
    databaseSize !== null && options.inspectDatabase
      ? options.inspectDatabase(context.databasePath)
      : ({
          userVersion: null,
          migrationCount: null,
          quickCheck: "unavailable",
        } satisfies StorageDatabaseDiagnostic);
  const artifacts = listRecoveryArtifacts(context.activeRoot);
  const artifactTypes: Record<string, number> = {};
  for (const artifact of artifacts) {
    artifactTypes[artifact.artifactType] =
      (artifactTypes[artifact.artifactType] ?? 0) + 1;
  }
  const rootJournal = options.controlDirectory
    ? readStorageRootOperationJournal(options.controlDirectory)
    : null;
  return {
    root: {
      activePath: context.activeRoot,
      rootIdentity: context.rootIdentity,
      layoutEpoch: context.layoutEpoch,
      resolutionReason: context.resolutionReason,
      layoutState: layoutState ? "published" : "inferred",
    },
    database: {
      path: context.databasePath,
      exists: databaseSize !== null,
      sizeBytes: databaseSize ?? 0,
      ...database,
    },
    operations: {
      rootChange: rootJournal
        ? {
            operationId: rootJournal.operationId,
            action: rootJournal.action,
            state: rootJournal.state,
          }
        : null,
      restore: readStorageRestoreJournalState(context.activeRoot),
    },
    recovery: {
      count: artifacts.length,
      totalBytes: artifacts.reduce(
        (total, artifact) => total + artifact.totalBytes,
        0,
      ),
      artifactTypes,
    },
    rendererPersistence: {
      migrationComplete: markerExists(
        context.activeRoot,
        "data/operations/migrations/renderer-persistence-v1.json",
      ),
      indexedDbMigrationComplete: markerExists(
        context.activeRoot,
        "data/operations/migrations/renderer-indexeddb-v1.json",
      ),
    },
    hostReconciliation: {
      desktopSkillRepoComplete: markerExists(
        context.activeRoot,
        "data/operations/migrations/desktop-skill-repo-v1.json",
      ),
    },
    portableOmissions: [
      "secrets",
      "cache",
      "logs",
      "browser-runtime",
      "recovery-artifacts",
    ],
  };
}
