import crypto from "node:crypto";
import path from "node:path";

import {
  deriveLocalResourceDeviceId,
  listRecoveryArtifacts,
  readMcpLibraryRecoverySource,
} from "@prompthub/core";

import { closeDatabase } from "../database";
import { logStartupEvent, scrubPath } from "../startup-log";
import type { PublishCanonicalStorageAuthorityResult } from "./canonical-storage-authority";
import { recoverCanonicalStorageAuthorityFromDatabase } from "./canonical-storage-authority";
import { repairCanonicalStorageFromPromptWorkspace } from "./canonical-storage-self-heal";
import { createVerifiedPromptMediaResolver } from "./file-authoritative-prompt-recovery";
import {
  createCanonicalMcpResourceSecretStore,
  createMcpResourceSecretStore,
  type McpResourceSecretEncryption,
} from "./mcp-resource-secret-store";
import { listUpgradeBackups } from "./upgrade-backup";

export type CanonicalDatabaseRecoveryResult =
  | {
      success: true;
      needsRestart: true;
      recoveryArtifactPath: PublishCanonicalStorageAuthorityResult["recoveryArtifactPath"];
    }
  | { success: false; error: string };

interface CanonicalDatabaseRecoveryOptions {
  activeRoot: string;
  sourceDatabasePath: string;
  sourcePath: string;
  encryption: McpResourceSecretEncryption;
  scheduleRelaunch: (delayMs: number) => void;
  onSuccess: () => void;
  onFailure: () => void | Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reopenDatabaseAfterFailure(
  options: CanonicalDatabaseRecoveryOptions,
  recoveryError: unknown,
): Promise<string> {
  const recoveryMessage = errorMessage(recoveryError);
  try {
    await options.onFailure();
    return recoveryMessage;
  } catch (reopenError) {
    return `${recoveryMessage}; failed to reopen database: ${errorMessage(reopenError)}`;
  }
}

function recoverSelectedDatabase(
  options: CanonicalDatabaseRecoveryOptions,
  sourceDatabasePath = options.sourceDatabasePath,
  resolvePromptMediaSource?: (
    prompt: unknown,
    kind: "image" | "video",
    reference: string,
  ) => string,
): Promise<PublishCanonicalStorageAuthorityResult> {
  const secretStorePath = path.join(
    options.activeRoot,
    "secrets",
    "mcp-resource-secrets.json",
  );
  const canonicalSecretStore = createCanonicalMcpResourceSecretStore({
    filePath: secretStorePath,
    encryption: options.encryption,
  });
  const mcpLibrary = readMcpLibraryRecoverySource({
    canonicalOptions: { secretStore: canonicalSecretStore },
    supersededPath: path.join(
      options.activeRoot,
      "data",
      "mcp",
      "library.json",
    ),
  });
  return recoverCanonicalStorageAuthorityFromDatabase({
    activeRoot: options.activeRoot,
    sourceDatabasePath,
    checkpointPath: path.join(
      options.activeRoot,
      "cache",
      `.canonical-checkpoint-${crypto.randomUUID()}`,
    ),
    deviceId: deriveLocalResourceDeviceId(options.activeRoot),
    mcpLibrary,
    resolvePromptMediaSource,
    persistExtractedMcpSecrets: (secrets) =>
      createMcpResourceSecretStore({
        filePath: secretStorePath,
        encryption: options.encryption,
      }).writeMany(secrets),
  });
}

async function trustedPromptMediaRoots(activeRoot: string): Promise<string[]> {
  const recoveryRoots = listRecoveryArtifacts(activeRoot).map(
    (artifact) => artifact.directoryPath,
  );
  const upgradeRoots = (await listUpgradeBackups(activeRoot)).map(
    (backup) => backup.backupPath,
  );
  return [...recoveryRoots, ...upgradeRoots];
}

function successfulRecovery(
  options: CanonicalDatabaseRecoveryOptions,
  result: { recoveryArtifactPath: string },
): CanonicalDatabaseRecoveryResult {
  logStartupEvent({
    event: "recovery:canonical_authority_rebuilt",
    sourcePath: scrubPath(options.sourcePath),
    recoveryArtifactPath: scrubPath(result.recoveryArtifactPath),
  });
  options.onSuccess();
  options.scheduleRelaunch(1500);
  return {
    success: true,
    needsRestart: true,
    recoveryArtifactPath: result.recoveryArtifactPath,
  };
}

async function failedRecovery(
  options: CanonicalDatabaseRecoveryOptions,
  error: unknown,
): Promise<CanonicalDatabaseRecoveryResult> {
  const message = await reopenDatabaseAfterFailure(options, error);
  const failure = { success: false, error: message } as const;
  logStartupEvent({
    event: "recovery:canonical_authority_rebuild_failed",
    sourcePath: scrubPath(options.sourcePath),
    error: failure.error,
  });
  return failure;
}

export async function performCanonicalDatabaseRecovery(
  options: CanonicalDatabaseRecoveryOptions,
): Promise<CanonicalDatabaseRecoveryResult> {
  closeDatabase();
  let result: PublishCanonicalStorageAuthorityResult;
  try {
    const resolver = createVerifiedPromptMediaResolver({
      activeRoot: options.activeRoot,
      trustedRoots: await trustedPromptMediaRoots(options.activeRoot),
    });
    result = await recoverSelectedDatabase(
      options,
      options.sourceDatabasePath,
      resolver,
    );
  } catch (error) {
    return failedRecovery(options, error);
  }
  return successfulRecovery(options, result);
}

export async function performCanonicalFileWorkspaceRecovery(
  options: CanonicalDatabaseRecoveryOptions,
): Promise<CanonicalDatabaseRecoveryResult> {
  closeDatabase();
  try {
    const result = await repairCanonicalStorageFromPromptWorkspace({
      activeRoot: options.activeRoot,
      sourceDatabasePath: options.sourceDatabasePath,
      trustedRoots: await trustedPromptMediaRoots(options.activeRoot),
    });
    return successfulRecovery(options, result);
  } catch (error) {
    return failedRecovery(options, error);
  }
}

export function performSelectedCanonicalRecovery(
  sourceType: "current-file-workspace" | "current-canonical-db",
  options: CanonicalDatabaseRecoveryOptions,
): Promise<CanonicalDatabaseRecoveryResult> {
  return sourceType === "current-file-workspace"
    ? performCanonicalFileWorkspaceRecovery(options)
    : performCanonicalDatabaseRecovery(options);
}
