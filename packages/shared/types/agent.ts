export type AgentCapabilityKey =
  | "overview"
  | "provider"
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
  isCustom: boolean;
  isConfigured: boolean;
  isDetected: boolean;
  isPinned: boolean;
  status: "installed" | "configured" | "not-detected";
  paths: ManagedAgentPaths;
  capabilities: Record<AgentCapabilityKey, ManagedAgentCapability>;
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
