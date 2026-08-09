import { ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type {
  AgentAppearanceActionResult,
  AgentLaunchResult,
  AgentManagementBackup,
  AgentManagementBackupRestoreResult,
  AgentCliDiagnostic,
  AgentCliLifecyclePlan,
  AgentCliLifecycleResult,
  AgentAppearanceOverview,
  AgentDesktopThemeSummary,
  AgentDefinitionListRequest,
  AgentDefinitionListResult,
  AgentDefinitionOpenRequest,
  AgentDefinitionOpenResult,
  AgentPetSummary,
  AgentPetStorePage,
  AgentPetStoreQuery,
  AgentProviderProfileExport,
  AgentProviderProfilePublic,
  AgentProviderMigrationPreview,
  AgentProviderMigrationRequest,
  AgentProviderMigrationResult,
  AgentProviderActivateRequest,
  AgentProviderActivationExecutionResult,
  AgentProviderActivationPlan,
  AgentProviderConnectionTestRequest,
  AgentProviderConnectionTestResult,
  AgentProviderCurrentState,
  AgentProviderImportCurrentRequest,
  AgentProviderImportPreview,
  AgentProviderModelTestCancelRequest,
  AgentProviderModelTestRequest,
  AgentProviderModelTestResult,
  AgentProviderPreviewRequest,
  AgentModelConfiguration,
  AgentPiCustomModelInput,
  AgentPiCustomModelUpdateInput,
  AgentPiCustomProviderInput,
  AgentPiCustomProviderUpdateInput,
  AgentPiWriteResult,
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionIndexCancelRequest,
  AgentSessionIndexProgress,
  AgentSessionIndexPublicState,
  AgentSessionIndexRefreshRequest,
  AgentSessionIndexSetEnabledRequest,
  AgentSessionListResult,
  AgentConversationActionResult,
  AgentConversationExportRequest,
  AgentConversationExportSaveResult,
  AgentConversationHandoffPreview,
  AgentConversationHandoffRequest,
  AgentConversationMetadata,
  AgentConversationResumeRequest,
  ContinueAgentConversationRequest,
  AgentUsageQuota,
  AgentUsageQueryOptions,
  SkillLocalFileEntry,
  SkillLocalFileTreeEntry,
  UpdateAgentModelInput,
  UpdateAgentPetInput,
  UpdateAgentModelResult,
  UpsertAgentConversationMetadataInput,
  CreateAgentProviderProfileRequest,
  AgentProviderSourceCandidate,
  ImportAgentProviderSourceRequest,
  UpdateAgentProviderProfileRequest,
} from "@prompthub/shared/types";

export const agentApi = {
  launch: (agentId: string): Promise<AgentLaunchResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_LAUNCH, agentId),
  diagnoseCli: (agentId: string): Promise<AgentCliDiagnostic> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CLI_DIAGNOSE, agentId),
  planCliUpdate: (agentId: string): Promise<AgentCliLifecyclePlan> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CLI_UPDATE_PLAN, agentId),
  applyCliUpdate: (planId: string): Promise<AgentCliLifecycleResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CLI_UPDATE_APPLY, planId),
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
    expectedRevision?: string,
  ): Promise<SkillLocalFileEntry> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE,
      agentId,
      relativePath,
      content,
      expectedRevision,
    ),
  listDefinitions: (
    request: AgentDefinitionListRequest,
  ): Promise<AgentDefinitionListResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_DEFINITIONS_LIST, request),
  openDefinition: (
    request: AgentDefinitionOpenRequest,
  ): Promise<AgentDefinitionOpenResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_DEFINITION_OPEN, request),
  getModelConfig: (agentId: string): Promise<AgentModelConfiguration> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_MODEL_CONFIG_GET, agentId),
  setModelConfig: (
    input: UpdateAgentModelInput,
  ): Promise<UpdateAgentModelResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_MODEL_CONFIG_SET, input),
  addPiProvider: (
    input: AgentPiCustomProviderInput & { agentId: "pi" },
  ): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_PROVIDER_ADD, input),
  updatePiProvider: (
    input: AgentPiCustomProviderUpdateInput & { agentId: "pi" },
  ): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_PROVIDER_UPDATE, input),
  removePiProvider: (input: {
    agentId: "pi";
    providerId: string;
  }): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_PROVIDER_REMOVE, input),
  addPiModel: (input: {
    agentId: "pi";
    providerId: string;
    model: AgentPiCustomModelInput;
  }): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_MODEL_ADD, input),
  updatePiModel: (input: {
    agentId: "pi";
    providerId: string;
    model: AgentPiCustomModelUpdateInput;
  }): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_MODEL_UPDATE, input),
  removePiModel: (input: {
    agentId: "pi";
    providerId: string;
    modelId: string;
  }): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_MODEL_REMOVE, input),
  testPiModel: (input: {
    agentId: "pi";
    providerId: string;
    modelId: string;
  }): Promise<AgentProviderModelTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_MODEL_TEST, input),
  setPiCredential: (input: {
    agentId: "pi";
    providerId: string;
    secret: string;
  }): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_CREDENTIAL_SET, input),
  listSessions: (
    agentId: string,
    limit = 50,
    offset = 0,
    search?: string,
  ): Promise<AgentSessionListResult> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_SESSIONS_LIST,
      agentId,
      limit,
      offset,
      search,
    ),
  readSession: (
    agentId: string,
    sessionId: string,
    options?: AgentSessionDetailPageInput,
  ): Promise<AgentSessionDetail> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_SESSION_READ,
      agentId,
      sessionId,
      options,
    ),
  listConversationMetadata: (
    agentId: string,
    sessionIds: string[],
  ): Promise<AgentConversationMetadata[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONVERSATION_METADATA_LIST, {
      agentId,
      sessionIds,
    }),
  updateConversationMetadata: (
    input: UpsertAgentConversationMetadataInput,
  ): Promise<AgentConversationMetadata> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONVERSATION_METADATA_UPDATE, input),
  deleteConversation: (
    request: AgentConversationResumeRequest,
  ): Promise<AgentConversationMetadata> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONVERSATION_DELETE, request),
  restoreConversation: (
    request: AgentConversationResumeRequest,
  ): Promise<AgentConversationMetadata> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONVERSATION_RESTORE, request),
  resumeConversation: (
    request: AgentConversationResumeRequest,
  ): Promise<AgentConversationActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONVERSATION_RESUME, request),
  previewConversationHandoff: (
    request: AgentConversationHandoffRequest,
  ): Promise<AgentConversationHandoffPreview> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_PREVIEW,
      request,
    ),
  continueConversationInAgent: (
    request: ContinueAgentConversationRequest,
  ): Promise<AgentConversationActionResult> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_CONTINUE,
      request,
    ),
  exportConversation: (
    request: AgentConversationExportRequest,
  ): Promise<AgentConversationExportSaveResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_CONVERSATION_EXPORT, request),
  getSessionIndexState: (
    agentId: string,
  ): Promise<AgentSessionIndexPublicState> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_INDEX_GET_STATE, agentId),
  setSessionIndexEnabled: (
    request: AgentSessionIndexSetEnabledRequest,
  ): Promise<AgentSessionIndexPublicState> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_INDEX_SET_ENABLED, request),
  refreshSessionIndex: (
    request: AgentSessionIndexRefreshRequest,
  ): Promise<AgentSessionIndexPublicState> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_INDEX_REFRESH, request),
  cancelSessionIndex: (
    request: AgentSessionIndexCancelRequest,
  ): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_INDEX_CANCEL, request),
  onSessionIndexProgress: (
    listener: (progress: AgentSessionIndexProgress) => void,
  ): (() => void) => {
    const handler = (_event: unknown, progress: AgentSessionIndexProgress) =>
      listener(progress);
    ipcRenderer.on(IPC_CHANNELS.AGENT_SESSION_INDEX_PROGRESS, handler);
    return () =>
      ipcRenderer.removeListener(
        IPC_CHANNELS.AGENT_SESSION_INDEX_PROGRESS,
        handler,
      );
  },
  getUsage: (
    agentId: string,
    options?: AgentUsageQueryOptions,
  ): Promise<AgentUsageQuota> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_USAGE_GET, agentId, options),
  listProviderProfiles: (options?: {
    platformId?: string;
    includeArchived?: boolean;
  }): Promise<AgentProviderProfilePublic[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_LIST, options),
  listProviderSources: (
    platformId: string,
  ): Promise<AgentProviderSourceCandidate[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_SOURCES_LIST, platformId),
  importProviderSource: (
    request: ImportAgentProviderSourceRequest,
  ): Promise<AgentProviderProfilePublic> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_SOURCE_IMPORT, request),
  importPiProviderSource: (
    request: ImportAgentProviderSourceRequest,
  ): Promise<AgentPiWriteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PI_PROVIDER_SOURCE_IMPORT, request),
  ensureOfficialProviderProfile: (
    platformId: string,
  ): Promise<AgentProviderProfilePublic> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_OFFICIAL_ENSURE, platformId),
  getProviderCurrentState: (
    agentId: string,
  ): Promise<AgentProviderCurrentState> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE, agentId),
  createProviderProfile: (
    request: CreateAgentProviderProfileRequest,
  ): Promise<AgentProviderProfilePublic> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_CREATE, request),
  updateProviderProfile: (
    request: UpdateAgentProviderProfileRequest,
  ): Promise<AgentProviderProfilePublic> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_UPDATE, request),
  archiveProviderProfile: (
    id: string,
    expectedUpdatedAt: number,
  ): Promise<AgentProviderProfilePublic> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_PROVIDER_PROFILES_ARCHIVE,
      id,
      expectedUpdatedAt,
    ),
  duplicateProviderProfile: (
    id: string,
    name: string,
  ): Promise<AgentProviderProfilePublic> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_PROVIDER_PROFILES_DUPLICATE,
      id,
      name,
    ),
  exportProviderProfile: (id: string): Promise<AgentProviderProfileExport> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_EXPORT, id),
  deleteProviderProfile: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_PROFILES_DELETE, id),
  exportManagementBackup: (): Promise<AgentManagementBackup> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_EXPORT),
  restoreManagementBackup: (
    backup: AgentManagementBackup,
  ): Promise<AgentManagementBackupRestoreResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_RESTORE, backup),
  previewProviderMigration: (
    agentId: string,
  ): Promise<AgentProviderMigrationPreview> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_MIGRATION_PREVIEW, agentId),
  migrateProviderProfiles: (
    request: AgentProviderMigrationRequest,
  ): Promise<AgentProviderMigrationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_MIGRATION_APPLY, request),
  importCurrentProvider: (
    request: AgentProviderImportCurrentRequest,
  ): Promise<AgentProviderImportPreview> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_IMPORT_CURRENT, request),
  testProviderConnection: (
    request: AgentProviderConnectionTestRequest,
  ): Promise<AgentProviderConnectionTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_TEST_CONNECTION, request),
  testProviderModel: (
    request: AgentProviderModelTestRequest,
  ): Promise<AgentProviderModelTestResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_TEST_MODEL, request),
  cancelProviderModelTest: (
    request: AgentProviderModelTestCancelRequest,
  ): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_CANCEL_MODEL_TEST, request),
  previewProviderActivation: (
    request: AgentProviderPreviewRequest,
  ): Promise<AgentProviderActivationPlan> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_PREVIEW, request),
  activateProvider: (
    request: AgentProviderActivateRequest,
  ): Promise<AgentProviderActivationExecutionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_PROVIDER_ACTIVATE, request),
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
  updateAppearancePet: (input: UpdateAgentPetInput): Promise<AgentPetSummary> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_UPDATE_PET, input),
  listAppearancePetStore: (
    query: AgentPetStoreQuery,
  ): Promise<AgentPetStorePage> =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_APPEARANCE_PET_STORE_LIST, query),
  installAppearancePetFromStore: (
    agentId: string,
    petId: string,
  ): Promise<AgentPetSummary> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_PET_STORE_INSTALL,
      agentId,
      petId,
    ),
  getAppearancePetStorePreview: (
    agentId: string,
    petId: string,
  ): Promise<string> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.AGENT_APPEARANCE_PET_STORE_PREVIEW,
      agentId,
      petId,
    ),
};
