import type { MessageBoxOptions, MessageBoxReturnValue } from "electron";

import type { TrayMenuLabels } from "../tray-menu";
import type {
  AgentProviderTrayService,
  AgentProviderTraySwitchResult,
} from "./agent-provider-tray-service";

interface AgentProviderTrayHandlerOptions {
  input: { agentId: string; profileId: string };
  labels: TrayMenuLabels;
  openAgents: () => void;
  reloadAgentProviders: () => Promise<void>;
  service: AgentProviderTrayService;
  showMessageBox(
    options: MessageBoxOptions,
  ): Promise<Pick<MessageBoxReturnValue, "response">>;
}

function profileDetail(
  agentName: string,
  profileName: string,
  model: string | null,
): string {
  return `${agentName}\n${model ? `${profileName} · ${model}` : profileName}`;
}

async function showOutcome(
  result: AgentProviderTraySwitchResult,
  options: AgentProviderTrayHandlerOptions,
): Promise<void> {
  if (result.status === "verified") {
    await options.reloadAgentProviders();
    return;
  }
  if (result.status === "cancelled" || result.status === "already-active") {
    return;
  }

  const response = await options.showMessageBox({
    type: result.status === "review-required" ? "warning" : "error",
    message:
      result.status === "review-required"
        ? options.labels.providerReviewRequired
        : options.labels.providerSwitchFailed,
    buttons: [options.labels.openAgents, options.labels.cancel],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response.response === 0) options.openAgents();
}

export async function handleAgentProviderTraySelection(
  options: AgentProviderTrayHandlerOptions,
): Promise<void> {
  const result = await options.service.switchProfile(
    options.input,
    async (summary) => {
      const response = await options.showMessageBox({
        type: "question",
        message: options.labels.confirmProviderSwitch,
        detail: profileDetail(
          summary.agentName,
          summary.profileName,
          summary.model,
        ),
        buttons: [options.labels.useProviderProfile, options.labels.cancel],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      return response.response === 0;
    },
  );
  await showOutcome(result, options);
}
