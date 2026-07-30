import { ipcMain } from "electron";
import type { AgentManagementBackup } from "@prompthub/shared";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

import type { AgentManagementBackupService } from "../services/agent-management-backup-service";

const PUBLIC_ERROR_CODE = /^AGENT_MANAGEMENT_BACKUP_[A-Z0-9_]+$/;

function toPublicError(error: unknown): Error {
  if (error instanceof Error && PUBLIC_ERROR_CODE.test(error.message)) {
    return new Error(error.message);
  }
  console.error("[agent-management-backup] operation failed");
  return new Error("AGENT_MANAGEMENT_BACKUP_OPERATION_FAILED");
}

export function registerAgentManagementBackupIPC(
  service: AgentManagementBackupService,
): void {
  ipcMain.handle(IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_EXPORT, async () => {
    try {
      return await service.exportBackup();
    } catch (error) {
      throw toPublicError(error);
    }
  });
  ipcMain.handle(
    IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_RESTORE,
    async (_event, input: unknown) => {
      try {
        return await service.restoreBackup(input as AgentManagementBackup);
      } catch (error) {
        throw toPublicError(error);
      }
    },
  );
}
