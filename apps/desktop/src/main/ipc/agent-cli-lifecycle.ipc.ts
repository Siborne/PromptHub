import { randomUUID } from "node:crypto";
import { ipcMain } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import { SkillInstaller } from "../services/skill-installer";
import {
  AgentCliLifecycleService,
  type AgentCliLifecycleDependencies,
} from "../services/agent-cli-lifecycle-service";
import { createNativeCommandRunner } from "../services/native-command";

type LifecycleService = Pick<
  AgentCliLifecycleService,
  "planUpdate" | "applyUpdate"
>;

function createLifecycleService(): AgentCliLifecycleService {
  const runner = createNativeCommandRunner();
  const dependencies: AgentCliLifecycleDependencies = {
    now: Date.now,
    randomId: randomUUID,
    resolve: runner.resolve,
    run: runner.run,
  };
  return new AgentCliLifecycleService(dependencies);
}

export function registerAgentCliLifecycleIPC(
  service: LifecycleService = createLifecycleService(),
): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CLI_UPDATE_PLAN,
    async (event, agentId: unknown) => {
      if (typeof agentId !== "string" || !agentId.trim()) {
        throw new Error("Agent CLI update plan requires a non-empty agentId");
      }
      const platform = SkillInstaller.getSupportedPlatforms().find(
        (candidate) => candidate.id === agentId,
      );
      if (!platform) {
        throw new Error(`Unknown Agent platform: ${agentId}`);
      }
      return service.planUpdate(platform, event.sender.id);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CLI_UPDATE_APPLY,
    async (event, planId: unknown) => {
      if (typeof planId !== "string" || !planId.trim()) {
        throw new Error("Agent CLI update apply requires a non-empty planId");
      }
      return service.applyUpdate(planId, event.sender.id);
    },
  );
}
