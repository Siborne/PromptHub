import { ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type {
  AgentModelConfiguration,
  AgentSessionDetail,
  AgentSessionListResult,
  SkillLocalFileEntry,
  SkillLocalFileTreeEntry,
  UpdateAgentModelInput,
  UpdateAgentModelResult,
} from "@prompthub/shared/types";

export const agentApi = {
  listConfigFiles: (agentId: string): Promise<SkillLocalFileTreeEntry[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONFIG_FILES_LIST, agentId),
  readConfigFile: (
    agentId: string,
    relativePath: string,
  ): Promise<SkillLocalFileEntry | null> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_CONFIG_FILE_READ,
      agentId,
      relativePath,
    ),
  writeConfigFile: (
    agentId: string,
    relativePath: string,
    content: string,
  ): Promise<void> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE,
      agentId,
      relativePath,
      content,
    ),
  getModelConfig: (agentId: string): Promise<AgentModelConfiguration> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_MODEL_CONFIG_GET, agentId),
  setModelConfig: (
    input: UpdateAgentModelInput,
  ): Promise<UpdateAgentModelResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_MODEL_CONFIG_SET, input),
  listSessions: (
    agentId: string,
    limit = 100,
  ): Promise<AgentSessionListResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSIONS_LIST, agentId, limit),
  readSession: (
    agentId: string,
    sessionId: string,
  ): Promise<AgentSessionDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_READ, agentId, sessionId),
};
