import type {
  AgentAssetCommand,
  PromptQuickAddMode,
} from "@prompthub/shared/types";

export const APP_QUICK_ADD_PROMPT_EVENT = "app:quick-add-prompt";
export const APP_ASSET_WORKFLOW_READY_EVENT = "app:asset-workflow-ready";
export const OPEN_CREATE_SKILL_MODAL_EVENT = "open-create-skill-modal";
export const OPEN_CREATE_MCP_MODAL_EVENT = "open-create-mcp-modal";
export const OPEN_ADD_PLUGIN_MODAL_EVENT = "open-add-plugin-modal";

export interface QuickAddPromptEventDetail {
  mode: PromptQuickAddMode;
}

export interface AssetWorkflowReadyEventDetail {
  asset: "mcp" | "plugin";
  ready: boolean;
}

interface AssetWorkflowEventRegistration {
  asset: AssetWorkflowReadyEventDetail["asset"];
  eventName: string;
  listener: EventListener;
}

function announceAssetWorkflowReady(
  asset: AssetWorkflowReadyEventDetail["asset"],
  ready: boolean,
): void {
  document.dispatchEvent(
    new CustomEvent<AssetWorkflowReadyEventDetail>(
      APP_ASSET_WORKFLOW_READY_EVENT,
      { detail: { asset, ready } },
    ),
  );
}

export function registerAssetWorkflowEvent({
  asset,
  eventName,
  listener,
}: AssetWorkflowEventRegistration): () => void {
  document.addEventListener(eventName, listener);
  announceAssetWorkflowReady(asset, true);

  return () => {
    announceAssetWorkflowReady(asset, false);
    document.removeEventListener(eventName, listener);
  };
}

export function dispatchAgentAssetCommand(command: AgentAssetCommand): void {
  if (command.type === "asset:manage") {
    return;
  }

  switch (command.asset) {
    case "prompt":
      window.dispatchEvent(new CustomEvent("shortcut:newPrompt"));
      return;
    case "skill":
      document.dispatchEvent(new CustomEvent(OPEN_CREATE_SKILL_MODAL_EVENT));
      return;
    case "mcp":
      document.dispatchEvent(new CustomEvent(OPEN_CREATE_MCP_MODAL_EVENT));
      return;
    case "plugin":
      document.dispatchEvent(new CustomEvent(OPEN_ADD_PLUGIN_MODAL_EVENT));
  }
}

export function dispatchQuickAddPrompt(mode: PromptQuickAddMode): void {
  window.dispatchEvent(
    new CustomEvent<QuickAddPromptEventDetail>(APP_QUICK_ADD_PROMPT_EVENT, {
      detail: { mode },
    }),
  );
}
