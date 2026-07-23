import os from "node:os";
import path from "node:path";
import { access } from "node:fs/promises";
import { app, ipcMain, safeStorage, shell } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type { AgentUsageQuota } from "@prompthub/shared/types";
import { SkillInstaller } from "../services/skill-installer";
import {
  getBuiltinAgentOverride,
  getPlatformRootDir,
} from "../services/skill-installer-utils";
import {
  inspectAgentModelConfig,
  updateAgentModelConfig,
} from "../services/agent-model-config";
import { createAgentSecretStore } from "../services/agent-secret-store";
import {
  AgentCodexProviderError,
  createAgentCodexProviderService,
  type AgentCodexProviderService,
} from "../services/agent-codex-provider-service";
import { createAgentSessionService } from "../services/agent-session-service";
import { createAgentUsageService } from "../services/agent-usage-service";
import { createNativeCommandRunner } from "../services/native-command";
import { launchAgentPlatform } from "../services/agent-launch-service";

interface AgentConfigContext {
  rootPath: string;
  relativePaths: string[];
}

const KIMI_CONFIG_VALIDATION_OPTIONS = {
  timeout: 15_000,
  maxBuffer: 64 * 1024,
};

async function validateKimiConfig(
  agentId: string,
  targetPath: string,
): Promise<void> {
  if (agentId !== "kimi") return;
  const runner = createNativeCommandRunner();
  const executable = await runner.resolve("kimi");
  if (!executable) return;
  await runner.run(
    executable,
    ["doctor", "config", targetPath],
    KIMI_CONFIG_VALIDATION_OPTIONS,
  );
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
  const usageService = createAgentUsageService();
  let providerService: AgentCodexProviderService | null = null;

  // Lazily constructed so app.getPath("userData") is only touched once the
  // app is ready and a provider call actually arrives.
  function getProviderService(): AgentCodexProviderService {
    if (!providerService) {
      const userDataPath = app.getPath("userData");
      providerService = createAgentCodexProviderService({
        backupRoot: path.join(userDataPath, "agent-config-backups"),
        secretStore: createAgentSecretStore({
          userDataPath,
          encryption: safeStorage,
        }),
      });
    }
    return providerService;
  }

  // Only classified provider errors may cross the bridge; anything else is
  // logged main-side and replaced with a generic code so raw filesystem
  // paths or unexpected details never reach the renderer.
  function toProviderIpcError(error: unknown): Error {
    if (error instanceof AgentCodexProviderError) {
      return new Error(error.message);
    }
    console.error(
      "Agent provider operation failed:",
      error instanceof Error ? error.message : error,
    );
    return new Error("agent-codex-provider:internal-error");
  }

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
          ...(payload.agentId === "kimi"
            ? { validateNativeConfig: validateKimiConfig }
            : {}),
        },
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SESSIONS_LIST,
    async (_, agentId: unknown, limit: unknown, offset: unknown) => {
      if (typeof agentId !== "string" || typeof limit !== "number") {
        throw new Error(
          "Agent session list requires agentId and numeric limit",
        );
      }
      if (
        offset !== undefined &&
        (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0)
      ) {
        throw new Error(
          "Agent session list requires a non-negative numeric offset",
        );
      }
      const context = getAgentConfigContext(agentId);
      const pageOffset = typeof offset === "number" ? offset : 0;
      return createDefaultSessionService(agentId, context.rootPath).list(
        agentId,
        {
          limit,
          offset: pageOffset,
        },
      );
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
      const context = getAgentConfigContext(agentId);
      return createDefaultSessionService(agentId, context.rootPath).read(
        agentId,
        sessionId,
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

  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDERS_LIST,
    async (_, agentId: unknown) => {
      if (typeof agentId !== "string" || agentId.trim().length === 0) {
        throw new Error("Agent provider list requires a non-empty agentId");
      }
      try {
        return await getProviderService().listProviders(agentId);
      } catch (error) {
        throw toProviderIpcError(error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDERS_UPSERT,
    async (_, input: unknown) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Agent provider upsert requires an object payload");
      }
      const payload = input as Record<string, unknown>;
      if (
        typeof payload.agentId !== "string" ||
        typeof payload.providerId !== "string" ||
        typeof payload.name !== "string" ||
        typeof payload.baseUrl !== "string" ||
        (payload.wireApi !== "chat" && payload.wireApi !== "responses")
      ) {
        throw new Error(
          "Agent provider upsert requires agentId, providerId, name, baseUrl strings and a valid wireApi",
        );
      }
      for (const optionalKey of ["apiKey", "envKey", "profileModel"] as const) {
        const value = payload[optionalKey];
        if (
          value !== undefined &&
          value !== null &&
          typeof value !== "string"
        ) {
          throw new Error(
            `Agent provider upsert ${optionalKey} must be a string or null`,
          );
        }
      }
      try {
        return await getProviderService().upsertProvider({
          agentId: payload.agentId,
          providerId: payload.providerId,
          name: payload.name,
          baseUrl: payload.baseUrl,
          wireApi: payload.wireApi,
          apiKey: payload.apiKey as string | null | undefined,
          envKey: payload.envKey as string | null | undefined,
          profileModel: payload.profileModel as string | null | undefined,
        });
      } catch (error) {
        throw toProviderIpcError(error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDERS_REMOVE,
    async (_, agentId: unknown, providerId: unknown) => {
      if (
        typeof agentId !== "string" ||
        !agentId.trim() ||
        typeof providerId !== "string" ||
        !providerId.trim()
      ) {
        throw new Error(
          "Agent provider removal requires agentId and providerId strings",
        );
      }
      try {
        return await getProviderService().removeProvider(agentId, providerId);
      } catch (error) {
        throw toProviderIpcError(error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDERS_SET_DEFAULT,
    async (_, agentId: unknown, providerId: unknown) => {
      if (
        typeof agentId !== "string" ||
        !agentId.trim() ||
        typeof providerId !== "string" ||
        !providerId.trim()
      ) {
        throw new Error(
          "Agent provider default switch requires agentId and providerId strings",
        );
      }
      try {
        return await getProviderService().setDefaultProvider(
          agentId,
          providerId,
        );
      } catch (error) {
        throw toProviderIpcError(error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDERS_TEST,
    async (_, agentId: unknown, providerId: unknown) => {
      if (
        typeof agentId !== "string" ||
        !agentId.trim() ||
        typeof providerId !== "string" ||
        !providerId.trim()
      ) {
        throw new Error(
          "Agent provider test requires agentId and providerId strings",
        );
      }
      try {
        return await getProviderService().testProvider(agentId, providerId);
      } catch (error) {
        throw toProviderIpcError(error);
      }
    },
  );
}

function createDefaultSessionService(agentId: string, rootPath: string) {
  const configuredClaudeDir = process.env.CLAUDE_CONFIG_DIR;
  const claudeRoot =
    configuredClaudeDir && path.isAbsolute(configuredClaudeDir)
      ? configuredClaudeDir
      : rootPath;
  const rootOption =
    agentId === "claude"
      ? { claudeConfigDir: claudeRoot }
      : agentId === "codex"
        ? { codexRootDir: rootPath }
        : agentId === "grok"
          ? { grokRootDir: rootPath }
          : agentId === "kimi"
            ? { kimiRootDir: rootPath }
            : agentId === "openclaw"
              ? { openclawRootDir: rootPath }
              : {};
  return createAgentSessionService({
    homeDir: os.homedir(),
    ...rootOption,
  });
}
