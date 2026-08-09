import type { AgentPiWriteResult } from "@prompthub/shared/types";

import { inspectAgentModelConfig } from "./agent-model-config";
import {
  addPiProviderOverride,
  type PiWriteOptions,
} from "./agent-pi-model-writes";

export async function importCurrentPiProvider(
  rootPath: string,
  options: PiWriteOptions,
): Promise<AgentPiWriteResult> {
  const config = await inspectAgentModelConfig({
    agentId: "pi",
    rootPath,
  });
  if (!config.provider) {
    throw new Error("AGENT_PI_CURRENT_PROVIDER_MISSING");
  }
  if (!config.model) throw new Error("AGENT_PI_CURRENT_MODEL_MISSING");

  const provider = config.modelCatalog?.find(
    (candidate) => candidate.id === config.provider,
  );
  if (!provider) throw new Error("AGENT_PI_PROVIDER_NOT_FOUND");
  if (provider.source !== "built-in") {
    throw new Error("AGENT_PI_PROVIDER_EXISTS");
  }
  if (!provider.models.some((model) => model.id === config.model)) {
    throw new Error("AGENT_PI_MODEL_NOT_FOUND");
  }

  return addPiProviderOverride(rootPath, provider.id, config.model, options);
}
