import {
  createAgentUserConfigFileService as createSharedAgentUserConfigFileService,
  type AgentUserConfigFileService,
} from "@prompthub/core";

import { createEncryptedConfigBackup } from "./agent-encrypted-config-backup";
import type { AgentSecretStoreEncryption } from "./agent-secret-store";

export type {
  AgentConfigBackupInput,
  AgentConfigContext,
  AgentUserConfigFileService,
} from "@prompthub/core";

/** Desktop adapter that stores encrypted rollback backups with safeStorage. */
export function createAgentUserConfigFileService(options: {
  backupRoot: string;
  encryption: AgentSecretStoreEncryption;
  writeAtomically?: (targetPath: string, content: string) => Promise<void>;
}): AgentUserConfigFileService {
  return createSharedAgentUserConfigFileService({
    createBackup: ({ agentId, sourcePath, content }) =>
      createEncryptedConfigBackup({
        backupRoot: options.backupRoot,
        agentId,
        sourcePath,
        content,
        encryption: options.encryption,
      }),
    ...(options.writeAtomically
      ? { writeAtomically: options.writeAtomically }
      : {}),
  });
}
