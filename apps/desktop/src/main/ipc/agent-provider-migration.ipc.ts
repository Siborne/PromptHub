import { ipcMain } from "electron";

import type {
  AgentProviderMigrationPreview,
  AgentProviderMigrationRequest,
  AgentProviderMigrationResult,
} from "@prompthub/shared";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

interface AgentProviderMigrationOperations {
  preview(agentId: string): Promise<AgentProviderMigrationPreview>;
  migrate(
    request: AgentProviderMigrationRequest,
  ): Promise<AgentProviderMigrationResult>;
}

const PUBLIC_ERROR = /^AGENT_PROVIDER_MIGRATION_[A-Z0-9_]+$/;

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AGENT_PROVIDER_MIGRATION_INPUT_INVALID");
  }
  return value as Record<string, unknown>;
}

function readRequest(value: unknown): AgentProviderMigrationRequest {
  const request = requireRecord(value);
  if (
    typeof request.agentId !== "string" ||
    typeof request.expectedNativeDigest !== "string" ||
    !Array.isArray(request.providerIds) ||
    request.providerIds.some((providerId) => typeof providerId !== "string")
  ) {
    throw new Error("AGENT_PROVIDER_MIGRATION_INPUT_INVALID");
  }
  return {
    agentId: request.agentId,
    expectedNativeDigest: request.expectedNativeDigest,
    providerIds: request.providerIds as string[],
  };
}

function publicError(error: unknown): Error {
  if (error instanceof Error && PUBLIC_ERROR.test(error.message)) {
    return new Error(error.message);
  }
  console.error("[agent-provider-migration] operation failed");
  return new Error("AGENT_PROVIDER_MIGRATION_FAILED");
}

async function invoke<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw publicError(error);
  }
}

export function registerAgentProviderMigrationIPC(
  service: AgentProviderMigrationOperations,
): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_MIGRATION_PREVIEW,
    async (_event, agentId: unknown) =>
      invoke(async () => {
        if (typeof agentId !== "string") {
          throw new Error("AGENT_PROVIDER_MIGRATION_INPUT_INVALID");
        }
        return service.preview(agentId);
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_MIGRATION_APPLY,
    async (_event, request: unknown) =>
      invoke(() => service.migrate(readRequest(request))),
  );
}
