import { ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type {
  AgentAppearanceActionResult,
  AgentLaunchResult,
  AgentAppearanceOverview,
  AgentDesktopThemeSummary,
  AgentPetSummary,
  AgentModelConfiguration,
  AgentSessionDetail,
  AgentSessionListResult,
  AgentUsageQuota,
  AgentCodexProviderList,
  AgentCodexProviderTestResult,
  UpsertAgentCodexProviderInput,
  SkillLocalFileEntry,
  SkillLocalFileTreeEntry,
  UpdateAgentModelInput,
  UpdateAgentModelResult,
} from "@prompthub/shared/types";

export const agentApi = {
  launch: (agentId: string): Promise<AgentLaunchResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_LAUNCH, agentId),
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
    limit = 50,
    offset = 0,
  ): Promise<AgentSessionListResult> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_SESSIONS_LIST,
      agentId,
      limit,
      offset,
    ),
  readSession: (
    agentId: string,
    sessionId: string,
  ): Promise<AgentSessionDetail> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_READ, agentId, sessionId),
  getUsage: (agentId: string): Promise<AgentUsageQuota> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_USAGE_GET, agentId),
  listProviders: (agentId: string): Promise<AgentCodexProviderList> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDERS_LIST, agentId),
  upsertProvider: (
    input: UpsertAgentCodexProviderInput,
  ): Promise<AgentCodexProviderList> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDERS_UPSERT, input),
  removeProvider: (
    agentId: string,
    providerId: string,
  ): Promise<AgentCodexProviderList> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_PROVIDERS_REMOVE,
      agentId,
      providerId,
    ),
  setDefaultProvider: (
    agentId: string,
    providerId: string,
  ): Promise<AgentCodexProviderList> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_PROVIDERS_SET_DEFAULT,
      agentId,
      providerId,
    ),
  testProvider: (
    agentId: string,
    providerId: string,
  ): Promise<AgentCodexProviderTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDERS_TEST, agentId, providerId),
  getAppearance: (agentId: string): Promise<AgentAppearanceOverview> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_GET, agentId),
  importAppearanceTheme: (
    agentId: string,
  ): Promise<AgentDesktopThemeSummary | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_IMPORT_THEME, agentId),
  applyAppearanceTheme: (input: {
    agentId: string;
    themeId: string;
    restartExisting?: boolean;
  }): Promise<AgentAppearanceActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_APPLY_THEME, input),
  restoreAppearanceTheme: (
    agentId: string,
  ): Promise<AgentAppearanceActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_RESTORE_THEME, agentId),
  deleteAppearanceTheme: (agentId: string, themeId: string): Promise<void> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_DELETE_THEME,
      agentId,
      themeId,
    ),
  exportAppearanceTheme: (
    agentId: string,
    themeId: string,
  ): Promise<string | null> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_EXPORT_THEME,
      agentId,
      themeId,
    ),
  getAppearanceThemePreview: (
    agentId: string,
    themeId: string,
  ): Promise<string | null> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_THEME_PREVIEW,
      agentId,
      themeId,
    ),
  importAgentPet: (agentId: string): Promise<AgentPetSummary | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_IMPORT_PET, agentId),
  exportAgentPet: (agentId: string, petId: string): Promise<string | null> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_EXPORT_PET,
      agentId,
      petId,
    ),
  deleteAgentPet: (agentId: string, petId: string): Promise<void> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_DELETE_PET,
      agentId,
      petId,
    ),
  getAgentPetPreview: (agentId: string, petId: string): Promise<string> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_PET_PREVIEW,
      agentId,
      petId,
    ),
};
