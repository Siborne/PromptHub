export type AgentAssetKind = "prompt" | "skill" | "mcp" | "plugin" | "rule";

export type CreatableAgentAssetKind = Exclude<AgentAssetKind, "rule">;

export type PromptQuickAddMode = "analyze" | "generate";

export type AgentAssetCommand =
  | { type: "asset:create"; asset: CreatableAgentAssetKind }
  | { type: "asset:manage"; asset: "rule" };

export type FutureAgentManagementCommand = { type: "agent:manage" };

export type AppCommand =
  | AgentAssetCommand
  | { type: "prompt:quick-add"; mode: PromptQuickAddMode }
  | { type: "settings:open" }
  | { type: "updater:open" }
  | FutureAgentManagementCommand;
