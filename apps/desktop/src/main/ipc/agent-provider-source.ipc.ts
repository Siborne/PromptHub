import { ipcMain } from "electron";
import type { ImportAgentProviderSourceRequest } from "@prompthub/shared";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

interface AgentProviderSourceOperations {
  list(platformId: string): unknown;
  importSource(request: ImportAgentProviderSourceRequest): Promise<unknown>;
  importPiSource(request: ImportAgentProviderSourceRequest): Promise<unknown>;
  ensureOfficial(platformId: string): Promise<unknown>;
}

const PUBLIC_ERROR_CODE =
  /^AGENT_PROVIDER_(?:SOURCE|OFFICIAL|REQUEST|PROFILE)_[A-Z0-9_]+$/;

function publicError(error: unknown): Error {
  if (error instanceof Error && PUBLIC_ERROR_CODE.test(error.message)) {
    return new Error(error.message);
  }
  console.error("[agent-provider-source] operation failed");
  return new Error("AGENT_PROVIDER_SOURCE_OPERATION_FAILED");
}

function safeHandle(
  channel: string,
  operation: (...args: unknown[]) => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await operation(...args);
    } catch (error) {
      throw publicError(error);
    }
  });
}

export function registerAgentProviderSourceIPC(
  service: AgentProviderSourceOperations,
): void {
  safeHandle(IPC_CHANNELS.AGENT_PROVIDER_SOURCES_LIST, (platformId) =>
    service.list(platformId as string),
  );
  safeHandle(IPC_CHANNELS.AGENT_PROVIDER_SOURCE_IMPORT, (request) =>
    service.importSource(request as ImportAgentProviderSourceRequest),
  );
  safeHandle(IPC_CHANNELS.AGENT_PI_PROVIDER_SOURCE_IMPORT, (request) =>
    service.importPiSource(request as ImportAgentProviderSourceRequest),
  );
  safeHandle(IPC_CHANNELS.AGENT_PROVIDER_OFFICIAL_ENSURE, (platformId) =>
    service.ensureOfficial(platformId as string),
  );
}
