export type AgentDefinitionKind = "subagent" | "command";

export type AgentDefinitionScope = "user" | "project";

export type AgentDefinitionStatus = "valid" | "invalid" | "oversized";

export interface AgentDefinitionListRequest {
  agentId: "qwen";
  scope: AgentDefinitionScope;
  projectId?: string;
}

export interface AgentDefinitionOpenRequest extends AgentDefinitionListRequest {
  kind: AgentDefinitionKind;
  relativePath: string;
}

export interface AgentDefinitionEntry {
  kind: AgentDefinitionKind;
  scope: AgentDefinitionScope;
  relativePath: string;
  name: string;
  description: string | null;
  model: string | null;
  approvalMode: string | null;
  tools: string[];
  disallowedTools: string[];
  status: AgentDefinitionStatus;
  warnings: string[];
  size: number;
  modifiedAt: number;
}

export interface AgentDefinitionListResult {
  agentId: "qwen";
  scope: AgentDefinitionScope;
  entries: AgentDefinitionEntry[];
  truncated: boolean;
  visitedEntries: number;
  readBytes: number;
  skippedSymlinks: number;
  skippedUnsafe: number;
}

export interface AgentDefinitionOpenResult {
  opened: boolean;
}
