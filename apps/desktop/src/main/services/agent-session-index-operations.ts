import os from "node:os";
import path from "node:path";

import type { AgentSessionIndexDB } from "@prompthub/db";
import type { AgentSessionIndexOperations } from "../ipc/agent-session-index.ipc";
import { createAgentSessionIndexService } from "./agent-session-index-service";
import { createAgentSessionService } from "./agent-session-service";
import { getAgentConfigContext } from "./agent-platform-context";

function rootOption(agentId: string, rootPath: string) {
  switch (agentId) {
    case "claude": {
      const configuredRoot = process.env.CLAUDE_CONFIG_DIR;
      return {
        claudeConfigDir:
          configuredRoot && path.isAbsolute(configuredRoot)
            ? configuredRoot
            : rootPath,
      };
    }
    case "copilot":
      return { copilotRootDir: rootPath };
    case "cline":
      return { clineRootDir: rootPath };
    case "cursor":
      return { cursorRootDir: rootPath };
    case "codex":
      return { codexRootDir: rootPath };
    case "grok":
      return { grokRootDir: rootPath };
    case "kimi":
      return { kimiRootDir: rootPath };
    case "openclaw":
      return { openclawRootDir: rootPath };
    case "pi":
      return { piRootDir: rootPath };
    case "oh-my-pi":
      return { ohMyPiRootDir: rootPath };
    case "kiro":
      return { kiroRootDir: rootPath };
    default:
      return {};
  }
}

export function createAgentSessionIndexOperations(
  index: AgentSessionIndexDB,
  agentId: string,
): AgentSessionIndexOperations {
  const reader = createAgentSessionReader(agentId);
  return createAgentSessionIndexService({ index, reader });
}

function createAgentSessionReader(agentId: string) {
  const context = getAgentConfigContext(agentId);
  return createAgentSessionService({
    homeDir: os.homedir(),
    ...rootOption(agentId, context.rootPath),
  });
}

export function resolveAgentSessionIndexSource(agentId: string) {
  if (agentId !== "claude" && agentId !== "gemini") return null;

  const claudeConfigDir =
    agentId === "claude" &&
    process.env.CLAUDE_CONFIG_DIR &&
    path.isAbsolute(process.env.CLAUDE_CONFIG_DIR)
      ? process.env.CLAUDE_CONFIG_DIR
      : undefined;
  const reader = createAgentSessionService({
    homeDir: os.homedir(),
    ...(claudeConfigDir ? { claudeConfigDir } : {}),
  });
  return reader.getIndexSource(agentId);
}
