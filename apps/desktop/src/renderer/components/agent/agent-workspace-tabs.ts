import type {
  AgentCapabilityKey,
  AgentCapabilityStatus,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import type { AgentAssetDomain } from "./use-agent-asset-domain";

export type AgentWorkspaceTabKey =
  | "overview"
  | AgentAssetDomain
  | "provider"
  | "appearance"
  | "configFiles"
  | "sessions";

export type AgentWorkspaceNavigate = (tab: AgentWorkspaceTabKey) => void;

export interface AgentWorkspaceTab {
  assetDomain?: AgentAssetDomain;
  capability: AgentCapabilityKey;
  fallback: string;
  key: AgentWorkspaceTabKey;
  labelKey: string;
}

export const AGENT_ASSET_DOMAINS: AgentAssetDomain[] = [
  "skills",
  "mcp",
  "rules",
  "plugins",
];

export function isAgentAssetDomain(
  tab: AgentWorkspaceTabKey,
): tab is AgentAssetDomain {
  return AGENT_ASSET_DOMAINS.some((domain) => domain === tab);
}

export const AGENT_WORKSPACE_TABS: AgentWorkspaceTab[] = [
  {
    key: "overview",
    capability: "overview",
    labelKey: "agents.overview",
    fallback: "Overview",
  },
  {
    key: "skills",
    assetDomain: "skills",
    capability: "assets",
    labelKey: "agents.skills",
    fallback: "Skills",
  },
  {
    key: "mcp",
    assetDomain: "mcp",
    capability: "assets",
    labelKey: "agents.mcp",
    fallback: "MCP",
  },
  {
    key: "rules",
    assetDomain: "rules",
    capability: "assets",
    labelKey: "agents.rules",
    fallback: "Rules",
  },
  {
    key: "plugins",
    assetDomain: "plugins",
    capability: "assets",
    labelKey: "agents.plugins",
    fallback: "Plugins",
  },
  {
    key: "provider",
    capability: "provider",
    labelKey: "agents.providerAndModel",
    fallback: "Provider & Model",
  },
  {
    key: "appearance",
    capability: "appearance",
    labelKey: "agents.appearanceTab",
    fallback: "Appearance",
  },
  {
    key: "configFiles",
    capability: "configFiles",
    labelKey: "agents.configFiles",
    fallback: "Config Files",
  },
  {
    key: "sessions",
    capability: "sessions",
    labelKey: "agents.sessions",
    fallback: "Sessions",
  },
];

export function getAgentTabStatus(
  agent: ManagedAgentSummary,
  tab: AgentWorkspaceTab,
): AgentCapabilityStatus {
  if (tab.assetDomain && !agent.paths[tab.assetDomain]) {
    return "unsupported";
  }
  return agent.capabilities[tab.capability].status;
}

export function isAgentTabEnabled(
  agent: ManagedAgentSummary,
  tab: AgentWorkspaceTab,
): boolean {
  const status = getAgentTabStatus(agent, tab);
  return status === "supported" || status === "partial";
}
