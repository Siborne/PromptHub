import { ipcMain } from "electron";

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type { AgentHarnessPluginMutationRequest } from "@prompthub/shared/types";
import {
  createAgentDeepSeekHarnessService,
  type AgentDeepSeekHarnessService,
} from "../services/agent-deepseek-harness-service";
import { getAgentConfigContext } from "../services/agent-platform-context";
import { createNativeCommandRunner } from "../services/native-command";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function parseMutation(value: unknown): AgentHarnessPluginMutationRequest {
  const operation = isRecord(value) ? value.operation : undefined;
  const operationFields =
    operation === "install" ? ["packageSpec"] : ["packageName"];
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "agentId",
      "operation",
      "profileName",
      "acknowledgeLifecycleScripts",
      ...operationFields,
    ]) ||
    value.agentId !== "deepseek-harness" ||
    !["install", "update", "remove"].includes(String(value.operation)) ||
    typeof value.profileName !== "string" ||
    typeof value.acknowledgeLifecycleScripts !== "boolean" ||
    (value.operation === "install"
      ? typeof value.packageSpec !== "string"
      : typeof value.packageName !== "string")
  ) {
    throw new Error("AGENT_HARNESS_REQUEST_INVALID");
  }
  return value as unknown as AgentHarnessPluginMutationRequest;
}

function createDefaultService(): AgentDeepSeekHarnessService {
  const context = getAgentConfigContext("deepseek-harness");
  return createAgentDeepSeekHarnessService({
    rootPath: context.rootPath,
    commandRunner: createNativeCommandRunner(),
  });
}

export function registerAgentDeepSeekHarnessIPC(
  service: AgentDeepSeekHarnessService = createDefaultService(),
): void {
  ipcMain.handle(IPC_CHANNELS.AGENT_HARNESS_PROFILES_LIST, () =>
    service.listProfiles(),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_HARNESS_PROFILE_READ,
    async (_, profileName) => {
      if (typeof profileName !== "string") {
        throw new Error("AGENT_HARNESS_REQUEST_INVALID");
      }
      return service.readProfile(profileName);
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_HARNESS_PLUGIN_MUTATE,
    async (_, request) => {
      return service.mutatePlugin(parseMutation(request));
    },
  );
}
