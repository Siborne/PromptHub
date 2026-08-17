import crypto from "node:crypto";
import path from "node:path";

import { deriveLocalResourceDeviceId } from "@prompthub/core";

import { closeDatabase } from "../database";
import { logStartupEvent, scrubPath } from "../startup-log";
import type { PublishCanonicalStorageAuthorityResult } from "./canonical-storage-authority";
import { recoverCanonicalStorageAuthorityFromDatabase } from "./canonical-storage-authority";
import {
  createMcpResourceSecretStore,
  type McpResourceSecretEncryption,
} from "./mcp-resource-secret-store";

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
): Promise<PublishCanonicalStorageAuthorityResult> {
  return recoverCanonicalStorageAuthorityFromDatabase({
    activeRoot: options.activeRoot,
    sourceDatabasePath: options.sourceDatabasePath,
    checkpointPath: path.join(
      options.activeRoot,
      "cache",
      `.canonical-recovery-checkpoint-${process.pid}-${crypto.randomUUID()}`,
    ),
    deviceId: deriveLocalResourceDeviceId(options.activeRoot),
    persistExtractedMcpSecrets: (secrets) =>
      createMcpResourceSecretStore({
        filePath: path.join(
          options.activeRoot,
          "secrets",
          "mcp-resource-secrets.json",
        ),
        encryption: options.encryption,
      }).writeMany(secrets),
  });
}

export async function performCanonicalDatabaseRecovery(
  options: CanonicalDatabaseRecoveryOptions,
): Promise<CanonicalDatabaseRecoveryResult> {
  closeDatabase();
  let result: PublishCanonicalStorageAuthorityResult;
  try {
    result = await recoverSelectedDatabase(options);
  } catch (error) {
    const message = await reopenDatabaseAfterFailure(options, error);
    const failure = {
      success: false,
      error: message,
    } as const;
    logStartupEvent({
      event: "recovery:canonical_authority_rebuild_failed",
      sourcePath: scrubPath(options.sourcePath),
      error: failure.error,
    });
    return failure;
  }
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
