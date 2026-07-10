import { describe, expect, it } from "vitest";

import { getPlatformById } from "@prompthub/shared/constants/platforms";
import {
  buildAgentRootAssetPreview,
  getEffectiveBuiltinAgentConfig,
} from "../../../src/renderer/services/agent-root-paths";

describe("agent root paths", () => {
  it("keeps Hermes Agent Windows Native rooted under local app data", () => {
    const platform = getPlatformById("hermes");
    expect(platform).toBeDefined();

    expect(platform!.rootDir.win32).toBe("%LOCALAPPDATA%\\hermes");
  });

  it("uses the official Kilo Code MCP config outside the .kilo asset root", () => {
    const platform = getPlatformById("kilo");
    expect(platform).toBeDefined();

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.kilo",
      undefined,
    );

    expect(config.mcpRelativePath).toBe("../.config/kilo/kilo.json");
    expect(buildAgentRootAssetPreview(config).mcpConfigPaths).toEqual([
      "~/.config/kilo/kilo.json",
    ]);
  });

  it("uses Cline's settings data directory for MCP config", () => {
    const platform = getPlatformById("cline");
    expect(platform).toBeDefined();

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.cline",
      undefined,
    );

    expect(config.mcpRelativePath).toBe(
      "data/settings/cline_mcp_settings.json",
    );
    expect(buildAgentRootAssetPreview(config).mcpConfigPaths).toEqual([
      "~/.cline/data/settings/cline_mcp_settings.json",
    ]);
  });

  it("does not invent MCP config paths for built-in agents without confirmed support", () => {
    const platform = getPlatformById("trae-work");
    expect(platform).toBeDefined();

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.trae-work",
      undefined,
    );

    expect(config.mcpRelativePath).toBeUndefined();
    expect(buildAgentRootAssetPreview(config).mcpConfigPaths).toEqual([]);
  });

  it("uses Tencent WorkBuddy's documented user MCP config path", () => {
    const platform = getPlatformById("workbuddy");
    expect(platform).toBeDefined();

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.workbuddy",
      undefined,
    );

    expect(config.skillsRelativePath).toBe("skills");
    expect(config.mcpRelativePath).toBe("mcp.json");
    expect(buildAgentRootAssetPreview(config).mcpConfigPaths).toEqual([
      "~/.workbuddy/mcp.json",
    ]);
  });

  it("uses CodeBuddy's documented user assets instead of skills-only defaults", () => {
    const platform = getPlatformById("codebuddy");
    expect(platform).toBeDefined();

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.codebuddy",
      undefined,
    );

    expect(config.skillsRelativePath).toBe("skills");
    expect(config.rulesRelativePath).toBe("CODEBUDDY.md");
    expect(config.mcpRelativePath).toBe(".mcp.json");
    expect(config.agentsRelativePath).toBe("agents");
    expect(config.commandsRelativePath).toBe("commands");
    expect(config.configRelativePaths).toEqual([
      "settings.json",
      ".mcp.json",
      "CODEBUDDY.md",
    ]);
    expect(buildAgentRootAssetPreview(config).mcpConfigPaths).toEqual([
      "~/.codebuddy/.mcp.json",
    ]);
  });

  it("shows Grok Build's documented user assets without enabling an MCP writer", () => {
    const platform = getPlatformById("grok");
    expect(platform).toBeDefined();
    expect(platform!.rootDir.darwin).toBe("~/.grok");
    expect(platform!.rootDir.win32).toBe("%USERPROFILE%\\.grok");

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.grok",
      undefined,
    );

    expect(config.skillsRelativePath).toBe("skills");
    expect(config.pluginsRelativePath).toBe("plugins");
    expect(config.rulesRelativePath).toBe("AGENTS.md");
    expect(config.configRelativePaths).toEqual([
      "config.toml",
      "pager.toml",
      "settings.json",
      "lsp.json",
      "sandbox.toml",
    ]);
    expect(config.mcpRelativePath).toBe("config.toml");
    expect(buildAgentRootAssetPreview(config)).toMatchObject({
      mcpConfigPaths: ["~/.grok/config.toml"],
      ruleCandidates: ["~/.grok/AGENTS.md"],
      agentDirectories: ["~/.grok/agents"],
      pluginDirectories: ["~/.grok/plugins"],
      configCandidates: [
        "~/.grok/config.toml",
        "~/.grok/pager.toml",
        "~/.grok/settings.json",
        "~/.grok/lsp.json",
        "~/.grok/sandbox.toml",
      ],
    });
  });

  it("keeps QClaw as an OpenClaw-compatible platform without an unconfirmed MCP path", () => {
    const platform = getPlatformById("qclaw");
    expect(platform).toBeDefined();

    const config = getEffectiveBuiltinAgentConfig(
      platform!,
      "~/.qclaw",
      undefined,
    );

    expect(config.skillsRelativePath).toBe("skills");
    expect(config.rulesRelativePath).toBe("workspace/SOUL.md");
    expect(config.mcpRelativePath).toBeUndefined();
    expect(buildAgentRootAssetPreview(config).mcpConfigPaths).toEqual([]);
  });

  it("keeps plugin package directories only on supported built-in targets", () => {
    const claude = getPlatformById("claude");
    const cline = getPlatformById("cline");
    expect(claude).toBeDefined();
    expect(cline).toBeDefined();

    expect(
      getEffectiveBuiltinAgentConfig(claude!, "~/.claude", undefined)
        .pluginsRelativePath,
    ).toBe("plugins/cache/prompthub");
    expect(
      getEffectiveBuiltinAgentConfig(cline!, "~/.cline", undefined)
        .pluginsRelativePath,
    ).toBeUndefined();
  });
});
