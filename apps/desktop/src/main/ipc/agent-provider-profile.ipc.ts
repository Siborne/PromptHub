import { ipcMain } from "electron";
import type {
  CreateAgentProviderProfileRequest,
  UpdateAgentProviderProfileRequest,
} from "@prompthub/shared";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

import type { AgentProviderProfileService } from "../services/agent-provider-profile-service";

type AgentProviderProfileIpcService = Pick<
  AgentProviderProfileService,
  "list" | "create" | "update" | "archive" | "duplicate" | "export" | "delete"
>;

const PUBLIC_ERROR_CODE = /^AGENT_PROVIDER_[A-Z0-9_]+$/;

function toPublicError(error: unknown): Error {
  if (
    error instanceof Error &&
    PUBLIC_ERROR_CODE.test(error.message)
  ) {
    return new Error(error.message);
  }
  console.error("[agent-provider-profile] operation failed");
  return new Error("AGENT_PROVIDER_PROFILE_OPERATION_FAILED");
}

function registerSafeHandler(
  channel: string,
  handler: (...args: unknown[]) => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      throw toPublicError(error);
    }
  });
}

export function registerAgentProviderProfileIPC(
  service: AgentProviderProfileIpcService,
): void {
  registerSafeHandler(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_LIST, (options) =>
    service.list(
      (options ?? {}) as {
        platformId?: string;
        includeArchived?: boolean;
      },
    ),
  );
  registerSafeHandler(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_CREATE, (request) =>
    service.create(request as CreateAgentProviderProfileRequest),
  );
  registerSafeHandler(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_UPDATE, (request) =>
    service.update(request as UpdateAgentProviderProfileRequest),
  );
  registerSafeHandler(
    IPC_CHANNELS.AGENT_PROVIDER_PROFILES_ARCHIVE,
    (id, expectedUpdatedAt) =>
      service.archive(id as string, expectedUpdatedAt as number),
  );
  registerSafeHandler(
    IPC_CHANNELS.AGENT_PROVIDER_PROFILES_DUPLICATE,
    (id, name) => service.duplicate(id as string, name as string),
  );
  registerSafeHandler(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_EXPORT, (id) =>
    service.export(id as string),
  );
  registerSafeHandler(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_DELETE, (id) =>
    service.delete(id as string),
  );
}
