export type AgentCapabilityKey =
  | "overview"
  | "provider"
  | "appearance"
  | "assets"
  | "configFiles"
  | "sessions"
  | "usage"
  | "maintenance";

export type AgentCapabilityStatus =
  | "supported"
  | "partial"
  | "planned"
  | "unsupported";

export const AGENT_PLATFORM_CAPABILITY_KEYS = [
  "installationPath",
  "providerModel",
  "skills",
  "mcp",
  "rules",
  "plugins",
  "configFiles",
  "sessions",
  "usage",
  "launch",
  "maintenanceCli",
  "backupExportImport",
  "secretRuntimeExclusion",
  "appearance",
] as const;

export type AgentPlatformCapabilityKey =
  (typeof AGENT_PLATFORM_CAPABILITY_KEYS)[number];

export interface AgentPlatformCapabilityDeclaration {
  status: AgentCapabilityStatus;
  evidence: string;
}

export type AgentPlatformCapabilityInventory = Record<
  AgentPlatformCapabilityKey,
  AgentPlatformCapabilityDeclaration
>;

export type AgentProductLifecycle = "current" | "enterprise-legacy";

export interface ManagedAgentCapability {
  status: AgentCapabilityStatus;
  reason?: string;
}

export interface ManagedAgentPaths {
  root: string;
  skills: string;
  mcp?: string;
  plugins?: string;
  rules?: string;
  configFiles: string[];
  configFileRelativePaths: string[];
}

export interface ManagedAgentSummary {
  id: string;
  name: string;
  icon: string;
  displayIconId?: string;
  isCustom: boolean;
  isConfigured: boolean;
  isDetected: boolean;
  isPinned: boolean;
  launchable?: boolean;
  status: "installed" | "configured" | "not-detected";
  lifecycle?: AgentProductLifecycle;
  replacementPlatformId?: string;
  paths: ManagedAgentPaths;
  capabilities: Record<AgentCapabilityKey, ManagedAgentCapability>;
}

export type AgentLaunchResult =
  | { success: true }
  | {
      success: false;
      errorCode: "unsupported" | "not-installed" | "launch-failed";
    };

export type AgentCliDiagnosticStatus =
  | "installed"
  | "not-installed"
  | "unhealthy"
  | "unsupported";

export type AgentCliInstallSource =
  | "homebrew"
  | "node-version-manager"
  | "pnpm"
  | "npm"
  | "user-local"
  | "system"
  | "unknown";

export type AgentCliDiagnosticErrorCode =
  | "unsupported"
  | "not-found"
  | "timeout"
  | "output-limit"
  | "command-failed"
  | "invalid-output";

export interface AgentCliDiagnostic {
  agentId: string;
  status: AgentCliDiagnosticStatus;
  executablePath: string | null;
  version: string | null;
  installSource: AgentCliInstallSource | null;
  errorCode: AgentCliDiagnosticErrorCode | null;
  checkedAt: number;
  canUpdate: boolean;
}

export type AgentCliLifecycleOperation = "update";

export interface AgentCliLifecyclePlan {
  id: string;
  agentId: string;
  operation: AgentCliLifecycleOperation;
  command: {
    executable: string;
    args: string[];
  };
  currentVersion: string;
  installSource: AgentCliInstallSource;
  expiresAt: number;
}

export type AgentCliLifecycleResultStatus =
  | "applied"
  | "no-change"
  | "rolled-back"
  | "failed";

export type AgentCliLifecycleErrorCode =
  | "unsupported"
  | "not-installed"
  | "diagnostic-failed"
  | "invalid-version"
  | "unsupported-install-source"
  | "update-command-not-found"
  | "plan-not-found"
  | "plan-owner-mismatch"
  | "plan-expired"
  | "precondition-changed"
  | "update-failed"
  | "verification-failed"
  | "rollback-failed";

export interface AgentCliLifecycleResult {
  agentId: string;
  operation: AgentCliLifecycleOperation;
  status: AgentCliLifecycleResultStatus;
  previousVersion: string;
  currentVersion: string | null;
  errorCode: Extract<
    AgentCliLifecycleErrorCode,
    "update-failed" | "verification-failed" | "rollback-failed"
  > | null;
}

export interface AgentDesktopThemeSummary {
  id: string;
  name: string;
  version: string;
  directoryPath: string;
  compatibleTarget: boolean;
  lintWarningCount: number;
}

export interface AgentPetSummary {
  id: string;
  name: string;
  description: string;
  directoryPath: string;
  spriteVersionNumber: 1 | 2;
  spritesheetName: string;
  spritesheetBytes: number;
}

export interface AgentAppearanceOverview {
  agentId: string;
  supported: boolean;
  engineVersion: string | null;
  adapterLastVerifiedVersion: string | null;
  activeThemeId: string | null;
  themeDirectoryPath: string;
  petDirectoryPath: string;
  themes: AgentDesktopThemeSummary[];
  pets: AgentPetSummary[];
  invalidThemeCount: number;
  invalidPetCount: number;
}

export interface ApplyAgentThemeInput {
  agentId: string;
  themeId: string;
  restartExisting?: boolean;
}

export interface AgentAppearanceActionResult {
  success: true;
  activeThemeId: string | null;
  message?: string;
}

export type ManagedAgentFilter =
  | "all"
  | "installed"
  | "configured"
  | "needs-attention"
  | "not-detected"
  | "custom";

export type AgentModelConfigStatus =
  | "configured"
  | "not-configured"
  | "missing"
  | "invalid"
  | "unsupported";

export type AgentCredentialStatus =
  | "configured"
  | "platform-managed"
  | "missing"
  | "unknown";

export interface AgentModelConfiguration {
  agentId: string;
  adapter: string | null;
  status: AgentModelConfigStatus;
  model: string | null;
  secondaryModel: string | null;
  fallbackModels: string[];
  provider: string | null;
  endpoint: string | null;
  availableModels: string[];
  credentialStatus: AgentCredentialStatus;
  sourceRelativePath: string | null;
  canSetModel: boolean;
  formattingMayChange: boolean;
  errorCode?: string;
}

export interface UpdateAgentModelInput {
  agentId: string;
  model: string;
  secondaryModel?: string | null;
}

export interface UpdateAgentModelResult extends AgentModelConfiguration {
  backupPath: string | null;
}

export interface AgentResumeCommand {
  executable: string;
  args: string[];
  cwd?: string;
}

export type AgentSessionSourceScanStatus = "idle" | "ok" | "partial" | "error";

export type AgentSessionIndexStatus = "present" | "missing" | "parse-error";

export interface AgentSessionSource {
  id: string;
  platformId: string;
  rootPath: string;
  adapterId: string;
  adapterVersion: string;
  enabled: boolean;
  scanCursor: string | null;
  lastStatus: AgentSessionSourceScanStatus;
  lastScannedAt: number | null;
  lastErrorCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RegisterAgentSessionSourceInput {
  platformId: string;
  rootPath: string;
  adapterId: string;
  adapterVersion: string;
  enabled?: boolean;
}

export interface AgentSessionIndexRecord {
  id: string;
  sourceId: string;
  externalId: string;
  title: string;
  projectPath: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  model: string | null;
  messageCount: number | null;
  redactedPreview: string | null;
  sourcePath: string;
  sourceMtimeMs: number | null;
  sourceSizeBytes: number | null;
  sourceDigest: string | null;
  sourceStatus: AgentSessionIndexStatus;
  tags: string[];
  note: string | null;
  indexedAt: number;
  annotationUpdatedAt: number | null;
}

export interface AgentSessionScanRecordInput {
  externalId: string;
  title: string;
  projectPath?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  model?: string | null;
  messageCount?: number | null;
  redactedPreview?: string | null;
  sourcePath: string;
  sourceMtimeMs?: number | null;
  sourceSizeBytes?: number | null;
  sourceDigest?: string | null;
  sourceStatus: AgentSessionIndexStatus;
}

export interface CommitAgentSessionScanInput {
  sourceId: string;
  mode: "full" | "incremental";
  adapterVersion: string;
  scanCursor?: string | null;
  scannedAt: number;
  status: Exclude<AgentSessionSourceScanStatus, "idle" | "error">;
  records: AgentSessionScanRecordInput[];
}

export interface AgentSessionScanCommitResult {
  source: AgentSessionSource;
  changedCount: number;
}

export interface RecordAgentSessionScanFailureInput {
  sourceId: string;
  scannedAt: number;
  errorCode: string;
}

export interface AgentSessionIndexListInput {
  sourceId: string;
  search?: string;
  statuses?: AgentSessionIndexStatus[];
  limit: number;
  offset: number;
}

export interface AgentSessionIndexListResult {
  items: AgentSessionIndexRecord[];
  total: number;
  hasMore: boolean;
}

export interface AgentSessionIndexPublicState {
  supported: boolean;
  enabled: boolean;
  lastStatus: AgentSessionSourceScanStatus | null;
  lastScannedAt: number | null;
  lastErrorCode: string | null;
}

export interface AgentSessionIndexSetEnabledRequest {
  agentId: string;
  enabled: boolean;
}

export interface AgentSessionIndexRefreshRequest {
  agentId: string;
  requestId: string;
}

export interface AgentSessionIndexCancelRequest {
  requestId: string;
}

export interface AgentSessionIndexProgress {
  agentId: string;
  requestId: string;
  processed: number;
  total: number;
}

export interface UpdateAgentSessionAnnotationsInput {
  tags: string[];
  note?: string | null;
}

export interface AgentSessionMetadata {
  id: string;
  title: string;
  projectLabel: string | null;
  projectPath: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  model: string | null;
  messageCount: number | null;
  sourcePath: string | null;
  resume: AgentResumeCommand | null;
}

export interface AgentSessionListResult {
  agentId: string;
  adapter: string;
  sessions: AgentSessionMetadata[];
  total: number;
  hasMore: boolean;
}

export interface AgentSessionEntry {
  id: string;
  role: "user" | "assistant" | "tool" | "system" | "unknown";
  timestamp: number | null;
  text: string;
}

export interface AgentSessionDetail {
  agentId: string;
  adapter: string;
  sessionId: string;
  entries: AgentSessionEntry[];
  parseErrors: number;
  truncated: boolean;
}

export type AgentUsageQuotaStatus =
  | "ok"
  | "no-credentials"
  | "expired"
  | "unavailable";

export type AgentCodexProviderKeySource = "managed" | "env" | "none";

export type AgentProviderProfileSource =
  | "manual"
  | "native-import"
  | "universal"
  | "import";

export interface AgentProviderProfile {
  id: string;
  platformId: string;
  name: string;
  providerKind: string;
  protocol: string;
  endpoint: string | null;
  config: Record<string, unknown>;
  secretRef: string | null;
  source: AgentProviderProfileSource;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentProviderProfileInput {
  platformId: string;
  name: string;
  providerKind: string;
  protocol: string;
  endpoint?: string | null;
  config: Record<string, unknown>;
  secretRef?: string | null;
  source: AgentProviderProfileSource;
}

export interface UpdateAgentProviderProfileInput {
  name?: string;
  providerKind?: string;
  protocol?: string;
  endpoint?: string | null;
  config?: Record<string, unknown>;
  secretRef?: string | null;
  source?: AgentProviderProfileSource;
}

export interface AgentProviderModelMapping {
  id: string;
  providerProfileId: string;
  routeKey: string;
  modelId: string;
  parameters: Record<string, unknown>;
}

export interface UpsertAgentProviderModelMappingInput {
  providerProfileId: string;
  routeKey: string;
  modelId: string;
  parameters: Record<string, unknown>;
}

export interface CreateAgentProviderModelMappingInput {
  routeKey: string;
  modelId: string;
  parameters: Record<string, unknown>;
}

export type AgentProviderSecretState = "none" | "available" | "missing";

export interface AgentProviderProfilePublic extends Omit<
  AgentProviderProfile,
  "secretRef"
> {
  modelMappings: AgentProviderModelMapping[];
  secretState: AgentProviderSecretState;
}

export type AgentProviderCurrentStateStatus =
  | "verified"
  | "none"
  | "stale"
  | "unavailable";

export interface AgentProviderCurrentState {
  platformId: string;
  status: AgentProviderCurrentStateStatus;
  currentProfileId: string | null;
  checkedAt: number;
}

export interface CreateAgentProviderProfileRequest {
  profile: Omit<CreateAgentProviderProfileInput, "secretRef">;
  modelMappings: CreateAgentProviderModelMappingInput[];
  /** Write-only. Main process responses must never echo this value. */
  secret?: string | null;
}

export interface UpdateAgentProviderProfileRequest {
  id: string;
  expectedUpdatedAt: number;
  profile: Omit<UpdateAgentProviderProfileInput, "secretRef">;
  modelMappings?: CreateAgentProviderModelMappingInput[];
  secretAction: "preserve" | "replace" | "clear";
  /** Write-only and only valid with secretAction="replace". */
  secret?: string | null;
}

export interface AgentProviderProfileExport {
  version: 1;
  profile: Omit<CreateAgentProviderProfileInput, "secretRef">;
  modelMappings: CreateAgentProviderModelMappingInput[];
  requiresSecret: boolean;
}

export type AgentProviderMigrationCredentialSource =
  | "legacy-managed"
  | "environment"
  | "native-inline"
  | "none";

export interface AgentProviderMigrationCandidate {
  providerId: string;
  name: string;
  baseUrl: string;
  wireApi: "chat" | "responses";
  envKey: string | null;
  credentialSource: AgentProviderMigrationCredentialSource;
  credentialReady: boolean;
  isActive: boolean;
  profileModel: string | null;
  alreadyMigrated: boolean;
}

export interface AgentProviderMigrationPreview {
  agentId: "codex";
  nativeDigest: string;
  candidates: AgentProviderMigrationCandidate[];
}

export interface AgentProviderMigrationRequest {
  agentId: string;
  expectedNativeDigest: string;
  providerIds: string[];
}

export interface AgentProviderMigrationResult {
  profiles: AgentProviderProfilePublic[];
}

export type AgentProviderSnapshotOperation =
  | "import"
  | "activate"
  | "backfill"
  | "restore";

export type AgentProviderSnapshotResult =
  | "planned"
  | "applied"
  | "verified"
  | "rolled-back"
  | "failed";

export interface AgentProviderSnapshot {
  id: string;
  platformId: string;
  providerProfileId: string | null;
  nativeDigest: string;
  redactedSnapshot: Record<string, unknown>;
  backupRef: string | null;
  operation: AgentProviderSnapshotOperation;
  result: AgentProviderSnapshotResult;
  createdAt: number;
}

export interface CreateAgentProviderSnapshotInput {
  platformId: string;
  providerProfileId?: string | null;
  nativeDigest: string;
  redactedSnapshot: Record<string, unknown>;
  backupRef?: string | null;
  operation: AgentProviderSnapshotOperation;
  result: AgentProviderSnapshotResult;
}

export interface AgentManagementBackupProfile {
  id: string;
  profile: Omit<CreateAgentProviderProfileInput, "secretRef">;
  modelMappings: CreateAgentProviderModelMappingInput[];
  requiresSecret: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AgentManagementBackupSnapshot {
  id: string;
  platformId: string;
  providerProfileId: string | null;
  nativeDigest: string;
  redactedSnapshot: Record<string, unknown>;
  operation: AgentProviderSnapshotOperation;
  result: AgentProviderSnapshotResult;
  createdAt: number;
}

export interface AgentManagementBackupSessionSourcePreference {
  platformId: string;
  adapterId: string;
  enabled: boolean;
}

export interface AgentManagementBackup {
  version: 1;
  providerProfiles: AgentManagementBackupProfile[];
  snapshots: AgentManagementBackupSnapshot[];
  sessionSourcePreferences?: AgentManagementBackupSessionSourcePreference[];
}

export interface AgentManagementBackupRestoreResult {
  profileCount: number;
  snapshotCount: number;
  availableSecretProfileIds: string[];
  missingSecretProfileIds: string[];
  restoredSessionPreferenceCount: number;
  unresolvedSessionPreferenceKeys: string[];
}

export type AgentProviderComparableValue =
  | null
  | string
  | number
  | boolean
  | AgentProviderComparableValue[]
  | { [key: string]: AgentProviderComparableValue };

export interface AgentProviderComparableState {
  platformId: string;
  adapterVersion: string;
  nativeDigest: string;
  values: Record<string, AgentProviderComparableValue>;
}

export interface AgentProviderDesiredState {
  platformId: string;
  values: Record<string, AgentProviderComparableValue>;
}

export type AgentProviderFieldDecisionStatus =
  | "apply"
  | "preserve"
  | "backfill"
  | "external-modified"
  | "conflict"
  | "unsupported"
  | "blocked";

export interface AgentProviderFieldDecision {
  field: string;
  status: AgentProviderFieldDecisionStatus;
  baseline?: AgentProviderComparableValue;
  current?: AgentProviderComparableValue;
  desired?: AgentProviderComparableValue;
}

export interface AgentProviderReconciliationInput {
  profileId: string;
  baseline: AgentProviderComparableState | null;
  current: AgentProviderComparableState;
  desired: AgentProviderDesiredState;
  supportedKeys: string[];
  blockedReasons?: string[];
}

export interface AgentProviderActivationPlan {
  platformId: string;
  profileId: string;
  adapterVersion: string;
  currentDigest: string;
  status: AgentProviderFieldDecisionStatus;
  decisions: AgentProviderFieldDecision[];
  canApply: boolean;
  requiresReview: boolean;
  blockedReasons: string[];
}

export type AgentProviderFieldResolutionAction =
  | "preserve-current"
  | "use-profile";

export interface AgentProviderFieldResolution {
  field: string;
  action: AgentProviderFieldResolutionAction;
}

export interface AgentProviderImportCurrentRequest {
  agentId: string;
}

export interface AgentProviderPreviewRequest {
  agentId: string;
  profileId: string;
}

export interface AgentProviderActivateRequest extends AgentProviderPreviewRequest {
  expectedCurrentDigest: string;
  resolutions?: AgentProviderFieldResolution[];
}

export type AgentProviderConnectionTestRequest = AgentProviderPreviewRequest;

export type AgentProviderConnectionTestStatus =
  | "ok"
  | "model-not-found"
  | "no-credentials"
  | "invalid-endpoint"
  | "blocked-address"
  | "auth-error"
  | "http-error"
  | "protocol-error"
  | "network-error"
  | "timeout"
  | "response-too-large"
  | "unsupported";

export interface AgentProviderConnectionTestResult {
  platformId: string;
  profileId: string;
  protocol: string;
  endpointOrigin: string | null;
  model: string | null;
  status: AgentProviderConnectionTestStatus;
  startedAt: number;
  finishedAt: number;
  totalMs: number;
  retryCount: number;
  modelCount: number | null;
  modelAvailable: boolean | null;
  errorCode?: string;
}

export interface AgentProviderModelTestRequest extends AgentProviderPreviewRequest {
  requestId: string;
}

export interface AgentProviderModelTestCancelRequest {
  requestId: string;
}

export type AgentProviderModelTestStatus =
  | "ok"
  | "cancelled"
  | "no-credentials"
  | "invalid-endpoint"
  | "blocked-address"
  | "auth-error"
  | "model-not-found"
  | "quota-error"
  | "rate-limited"
  | "http-error"
  | "protocol-error"
  | "network-error"
  | "connect-timeout"
  | "first-token-timeout"
  | "total-timeout"
  | "response-too-large"
  | "unsupported";

export interface AgentProviderModelTestResult {
  platformId: string;
  profileId: string;
  protocol: string;
  endpointOrigin: string | null;
  model: string | null;
  status: AgentProviderModelTestStatus;
  startedAt: number;
  finishedAt: number;
  totalMs: number;
  firstTokenMs: number | null;
  retryCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  outputPreview: string | null;
  errorCode?: string;
}

export interface AgentProviderAdapterContext {
  agentId: string;
  platformId: string;
  rootPath: string;
  projectRootPath?: string | null;
}

export interface AgentProviderImportPreview {
  state: AgentProviderComparableState;
  profile: CreateAgentProviderProfileInput;
  modelMappings: CreateAgentProviderModelMappingInput[];
  warnings: string[];
}

export interface AgentProviderActivationInput {
  context: AgentProviderAdapterContext;
  profile: AgentProviderProfile;
  modelMappings: AgentProviderModelMapping[];
  baseline: AgentProviderComparableState | null;
}

export interface AgentProviderApplyReceipt {
  platformId: string;
  profileId: string;
  adapterVersion: string;
  nativeDigestBefore: string;
  nativeDigestAfter: string;
  backupRef: string | null;
  appliedAt: number;
}

export interface AgentProviderVerification {
  verified: boolean;
  nativeDigest: string;
  state: AgentProviderComparableState;
  errorCode?: string;
}

export interface AgentProviderRollbackResult {
  restored: boolean;
  nativeDigest: string | null;
  errorCode?: string;
}

export type AgentProviderActivationExecutionStatus =
  | "verified"
  | "rolled-back"
  | "failed";

export interface AgentProviderActivationExecutionResult {
  status: AgentProviderActivationExecutionStatus;
  plan: AgentProviderActivationPlan;
  verification: AgentProviderVerification | null;
  rollback: AgentProviderRollbackResult | null;
  errorCode?: string;
}

export interface AgentCodexProvider {
  id: string;
  name: string;
  baseUrl: string;
  wireApi: "chat" | "responses";
  envKey: string | null;
  keySource: AgentCodexProviderKeySource;
  hasKey: boolean;
  isActive: boolean;
  profileModel: string | null;
}

export interface AgentCodexProviderList {
  agentId: string;
  activeProvider: string;
  defaultModel: string | null;
  providers: AgentCodexProvider[];
}

export interface UpsertAgentCodexProviderInput {
  agentId: string;
  providerId: string;
  name: string;
  baseUrl: string;
  wireApi: "chat" | "responses";
  apiKey?: string | null;
  envKey?: string | null;
  profileModel?: string | null;
}

export interface AgentCodexProviderTestResult {
  status:
    | "ok"
    | "auth-error"
    | "network-error"
    | "timeout"
    | "http-error"
    | "invalid-url"
    | "no-credentials";
  latencyMs: number | null;
  modelCount: number | null;
  errorCode?: string;
}

export type AgentUsageMetricKind = "window" | "quota";

export interface AgentUsageMetric {
  id: string;
  label: string;
  kind: AgentUsageMetricKind;
  utilization: number;
  resetsAt: number | null;
  usedAmount?: number;
  totalAmount?: number;
  unit?: string;
}

export interface AgentUsageQuota {
  agentId: string;
  adapter: string;
  status: AgentUsageQuotaStatus;
  source: "provider";
  plan: string | null;
  fetchedAt: number;
  errorCode?: string;
  metrics: AgentUsageMetric[];
}
