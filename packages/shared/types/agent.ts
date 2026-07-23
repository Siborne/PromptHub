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
