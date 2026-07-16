import os from "node:os";
import path from "node:path";
import { app, ipcMain } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import { SkillInstaller } from "../services/skill-installer";
import {
  getBuiltinAgentOverride,
  getPlatformRootDir,
} from "../services/skill-installer-utils";
import {
  inspectAgentModelConfig,
  updateAgentModelConfig,
} from "../services/agent-model-config";
import { createAgentSessionService } from "../services/agent-session-service";

interface AgentConfigContext {
  rootPath: string;
  relativePaths: string[];
}

function normalizeDeclaredPath(value: string): string {
  const normalized = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    return "";
  }
  return normalized.replace(/\/+/g, "/");
}

function getAgentConfigContext(agentId: unknown): AgentConfigContext {
  if (typeof agentId !== "string" || agentId.trim().length === 0) {
    throw new Error("agent config access requires a non-empty agentId");
  }

  const platform = SkillInstaller.getSupportedPlatforms().find(
    (candidate) => candidate.id === agentId,
  );
  if (!platform) {
    throw new Error(`Unknown Agent platform: ${agentId}`);
  }

  const override = getBuiltinAgentOverride(platform.id);
  const declaredPaths = override?.configRelativePaths?.length
    ? override.configRelativePaths
    : platform.configFiles || [];
  const relativePaths = Array.from(
    new Set(declaredPaths.map(normalizeDeclaredPath).filter(Boolean)),
  );

  return {
    rootPath: getPlatformRootDir(platform),
    relativePaths,
  };
}

function requireAllowlistedPath(
  context: AgentConfigContext,
  relativePath: unknown,
): string {
  if (typeof relativePath !== "string") {
    throw new Error("Agent config relativePath must be a string");
  }
  const normalized = normalizeDeclaredPath(relativePath);
  if (!context.relativePaths.includes(normalized)) {
    throw new Error("Agent config file is not allowlisted");
  }
  return normalized;
}

export function registerAgentIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONFIG_FILES_LIST,
    async (_, agentId: string) => {
      const context = getAgentConfigContext(agentId);
      return context.relativePaths.map((relativePath) => ({
        path: relativePath,
        isDirectory: false,
        size: 0,
      }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONFIG_FILE_READ,
    async (_, agentId: string, relativePath: string) => {
      const context = getAgentConfigContext(agentId);
      return SkillInstaller.readLocalRepoFileByPath(
        context.rootPath,
        requireAllowlistedPath(context, relativePath),
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE,
    async (_, agentId: string, relativePath: string, content: unknown) => {
      if (typeof content !== "string") {
        throw new Error("Agent config content must be a string");
      }
      const context = getAgentConfigContext(agentId);
      await SkillInstaller.writeLocalRepoFileByPath(
        context.rootPath,
        requireAllowlistedPath(context, relativePath),
        content,
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
        },
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSIONS_LIST,
    async (_, agentId: unknown, limit: unknown) => {
      if (typeof agentId !== "string" || typeof limit !== "number") {
        throw new Error(
          "Agent session list requires agentId and numeric limit",
        );
      }
      getAgentConfigContext(agentId);
      return createDefaultSessionService().list(agentId, { limit });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSION_READ,
    async (_, agentId: unknown, sessionId: unknown) => {
      if (typeof agentId !== "string" || typeof sessionId !== "string") {
        throw new Error(
          "Agent session read requires agentId and sessionId strings",
        );
      }
      getAgentConfigContext(agentId);
      return createDefaultSessionService().read(agentId, sessionId);
    },
  );
}

function createDefaultSessionService() {
  const configuredClaudeDir = process.env.CLAUDE_CONFIG_DIR;
  return createAgentSessionService({
    homeDir: os.homedir(),
    ...(configuredClaudeDir && path.isAbsolute(configuredClaudeDir)
      ? { claudeConfigDir: configuredClaudeDir }
      : {}),
  });
}
