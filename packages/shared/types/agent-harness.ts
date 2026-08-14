export const DEEPSEEK_HARNESS_AGENT_ID = "deepseek-harness" as const;

export type AgentHarnessProfileStatus = "valid" | "invalid" | "oversized";

export interface AgentHarnessProfileSummary {
  name: string;
  status: AgentHarnessProfileStatus;
  bundleCount: number;
  dependencyCount: number;
  updatedAt: number | null;
  warnings: string[];
}

export interface AgentHarnessOverview {
  agentId: typeof DEEPSEEK_HARNESS_AGENT_ID;
  cliAvailable: boolean;
  profiles: AgentHarnessProfileSummary[];
}

export type AgentHarnessPluginStatus = "installed" | "missing" | "invalid";

export interface AgentHarnessPluginSummary {
  name: string;
  version: string | null;
  description: string | null;
  license?: string | null;
  repositoryUrl?: string | null;
  homepage?: string | null;
  enabled: boolean;
  directDependency: boolean;
  sourceSpec: string | null;
  status: AgentHarnessPluginStatus;
  bundlePatch?: string | null;
  clientPlatform?: string | null;
  lifecycleScripts: string[];
  warnings: string[];
}

export interface AgentHarnessProfileDetail extends AgentHarnessProfileSummary {
  agentId: typeof DEEPSEEK_HARNESS_AGENT_ID;
  plugins: AgentHarnessPluginSummary[];
}

export type AgentHarnessPluginOperation = "install" | "update" | "remove";

export interface AgentHarnessPluginMutationRequest {
  agentId: typeof DEEPSEEK_HARNESS_AGENT_ID;
  operation: AgentHarnessPluginOperation;
  profileName: string;
  packageSpec?: string;
  packageName?: string;
  acknowledgeLifecycleScripts: boolean;
}

export type AgentHarnessPluginMutationErrorCode =
  | "agent-unsupported"
  | "cli-not-found"
  | "profile-name-invalid"
  | "profile-not-found"
  | "profile-invalid"
  | "package-spec-invalid"
  | "package-name-invalid"
  | "risk-acknowledgement-required"
  | "plugin-not-managed"
  | "timeout"
  | "output-limit"
  | "command-failed";

export type AgentHarnessPluginMutationResult =
  | { success: true; profile: AgentHarnessProfileDetail }
  | { success: false; errorCode: AgentHarnessPluginMutationErrorCode };
