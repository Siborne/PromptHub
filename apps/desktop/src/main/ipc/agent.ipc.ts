import path from "node:path";
import { access } from "node:fs/promises";
import { app, ipcMain, safeStorage, shell } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type { AgentUsageQuota } from "@prompthub/shared/types";
import { SkillInstaller } from "../services/skill-installer";
import { getAgentConfigContext } from "../services/agent-platform-context";
import { createAgentUserConfigFileService } from "../services/agent-user-config-files";
import {
  inspectAgentModelConfig,
  updateAgentModelConfig,
} from "../services/agent-model-config";
import { createAgentUsageService } from "../services/agent-usage-service";
import { validateKimiConfigFile } from "../services/agent-kimi-config-validator";
import { launchAgentPlatform } from "../services/agent-launch-service";
import { createNativeCommandRunner } from "../services/native-command";
import { diagnoseAgentCli } from "../services/agent-cli-diagnostic-service";
import { registerAgentCliLifecycleIPC } from "./agent-cli-lifecycle.ipc";

export function registerAgentIPC(): void {
  const usageService = createAgentUsageService();
  const configFileService = createAgentUserConfigFileService({
    backupRoot: path.join(app.getPath("userData"), "agent-config-backups"),
    encryption: safeStorage,
  });
  registerAgentCliLifecycleIPC();

  ipcMain.handle(IPC_CHANNELS.AGENT_LAUNCH, async (_, agentId: unknown) => {
    if (typeof agentId !== "string" || !agentId.trim()) {
      return { success: false, errorCode: "unsupported" };
    }
    const platform = SkillInstaller.getSupportedPlatforms().find(
      (candidate) => candidate.id === agentId,
    );
    if (!platform) return { success: false, errorCode: "unsupported" };
    return launchAgentPlatform(platform, {
      platform: process.platform,
      homePath: app.getPath("home"),
      localAppDataPath: process.env.LOCALAPPDATA,
      pathExists: async (candidate) => {
        try {
          await access(candidate);
          return true;
        } catch {
          return false;
        }
      },
      openPath: (candidate) => shell.openPath(candidate),
    });
  });

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CLI_DIAGNOSE,
    async (_, agentId: unknown) => {
      if (typeof agentId !== "string" || !agentId.trim()) {
        throw new Error("Agent CLI diagnostic requires a non-empty agentId");
      }
      const platform = SkillInstaller.getSupportedPlatforms().find(
        (candidate) => candidate.id === agentId,
      );
      if (!platform) {
        throw new Error(`Unknown Agent platform: ${agentId}`);
      }
      const runner = createNativeCommandRunner();
      return diagnoseAgentCli(platform, {
        now: Date.now,
        resolve: runner.resolve,
        run: runner.run,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONFIG_FILES_LIST,
    async (_, agentId: string) => {
      const context = getAgentConfigContext(agentId);
      return configFileService.list(context);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONFIG_FILE_READ,
    async (_, agentId: string, relativePath: string) => {
      const context = getAgentConfigContext(agentId);
      return configFileService.read(context, relativePath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE,
    async (
      _,
      agentId: string,
      relativePath: string,
      content: unknown,
      expectedRevision: unknown,
    ) => {
      if (typeof content !== "string") {
        throw new Error("Agent config content must be a string");
      }
      if (
        expectedRevision !== undefined &&
        typeof expectedRevision !== "string"
      ) {
        throw new Error("Agent config revision must be a string");
      }
      const revision =
        typeof expectedRevision === "string" ? expectedRevision : undefined;
      const context = getAgentConfigContext(agentId);
      return configFileService.write(
        context,
        relativePath,
        content,
        revision,
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_MODEL_CONFIG_GET,
    async (_, agentId: string) => {
      const context = getAgentConfigContext(agentId);
      return inspectAgentModelConfig({ agentId, rootPath: context.rootPath });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_MODEL_CONFIG_SET,
    async (_, input: unknown) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Agent model update requires an object payload");
      }
      const payload = input as Record<string, unknown>;
      if (
        typeof payload.agentId !== "string" ||
        typeof payload.model !== "string"
      ) {
        throw new Error(
          "Agent model update requires agentId and model strings",
        );
      }
      if (
        payload.secondaryModel !== undefined &&
        payload.secondaryModel !== null &&
        typeof payload.secondaryModel !== "string"
      ) {
        throw new Error(
          "Agent model update secondaryModel must be a string or null",
        );
      }
      const context = getAgentConfigContext(payload.agentId);
      return updateAgentModelConfig(
        {
          agentId: payload.agentId,
          rootPath: context.rootPath,
          model: payload.model,
          secondaryModel: payload.secondaryModel as string | null | undefined,
        },
        {
          backupRoot: path.join(
            app.getPath("userData"),
            "agent-config-backups",
          ),
          ...(payload.agentId === "kimi"
            ? {
                validateNativeConfig: (_agentId: string, targetPath: string) =>
                  validateKimiConfigFile(targetPath),
              }
            : {}),
        },
      );
    },
  );

  ipcMain.handle(IPC_CHANNELS.AGENT_USAGE_GET, async (_, agentId: unknown) => {
    if (typeof agentId !== "string" || agentId.trim().length === 0) {
      throw new Error("Agent usage query requires a non-empty agentId");
    }
    try {
      return await usageService.getUsage(agentId);
    } catch (error) {
      console.error(
        `Agent usage query failed for "${agentId}":`,
        error instanceof Error ? error.message : error,
      );
      const fallback: AgentUsageQuota = {
        agentId,
        adapter: "unknown",
        status: "unavailable",
        source: "provider",
        metrics: [],
        plan: null,
        fetchedAt: Date.now(),
        errorCode: "internal-error",
      };
      return fallback;
    }
  });
}
