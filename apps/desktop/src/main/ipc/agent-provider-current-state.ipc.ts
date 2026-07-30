import { ipcMain } from "electron";
import type { AgentProviderCurrentState } from "@prompthub/shared";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

interface AgentProviderCurrentStateService {
  getCurrentState(agentId: string): Promise<AgentProviderCurrentState>;
}

const PUBLIC_ERROR_CODE = /^AGENT_PROVIDER_[A-Z0-9_]+$/;
const PLATFORM_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function requirePlatformId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  const platformId = value.trim();
  if (!PLATFORM_ID.test(platformId)) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return platformId;
}

function toPublicError(error: unknown): Error {
  if (error instanceof Error && PUBLIC_ERROR_CODE.test(error.message)) {
    return new Error(error.message);
  }
  console.error("[agent-provider-current-state] operation failed");
  return new Error("AGENT_PROVIDER_OPERATION_FAILED");
}

export function registerAgentProviderCurrentStateIPC(
  service: AgentProviderCurrentStateService,
): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE,
    async (_event, value: unknown) => {
      try {
        return await service.getCurrentState(requirePlatformId(value));
      } catch (error) {
        throw toPublicError(error);
      }
    },
  );
}
