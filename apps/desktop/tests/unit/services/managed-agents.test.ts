import { describe, expect, it } from "vitest";
import type { SkillPlatform } from "@prompthub/shared/constants/platforms";

import {
  buildManagedAgents,
  filterManagedAgents,
} from "../../../src/renderer/services/managed-agents";

function platform(
  id: string,
  name: string,
  options: Partial<SkillPlatform> = {},
): SkillPlatform {
  return {
    id,
    name,
    icon: "Bot",
    rootDir: {
      darwin: `~/.${id}`,
      win32: `%USERPROFILE%\\.${id}`,
      linux: `~/.${id}`,
    },
    skillsRelativePath: "skills",
    ...options,
  };
}

describe("managed Agent projection", () => {
  it("uses Codex by default and applies independent ChatGPT name and icon preferences", () => {
    const [defaultIdentity] = buildManagedAgents({
      platforms: [platform("codex", "Codex CLI")],
      detectedPlatformIds: ["codex"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      agentIdentityPreferences: {},
      osKey: "darwin",
    });
    const [preferredIdentity] = buildManagedAgents({
      platforms: [platform("codex", "Codex CLI")],
      detectedPlatformIds: ["codex"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      agentIdentityPreferences: {
        codex: { name: "chatgpt", icon: "codex" },
      },
      osKey: "darwin",
    });

    expect(defaultIdentity).toMatchObject({
      id: "codex",
      name: "Codex",
      displayIconId: "codex",
    });
    expect(preferredIdentity).toMatchObject({
      id: "codex",
      name: "ChatGPT",
      displayIconId: "codex",
    });
  });

  it("keeps every platform and prioritizes pinned, detected, configured, then common Agents", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("hermes", "Hermes"),
        platform("claude", "Claude Code"),
        platform("custom-team", "Team Agent", {
          isCustom: true,
          isConfigured: true,
        }),
        platform("gemini", "Gemini CLI"),
        platform("codex", "Codex CLI", { isConfigured: true }),
      ],
      detectedPlatformIds: ["gemini"],
      pinnedPlatformIds: ["hermes"],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agents.map((agent) => agent.id)).toEqual([
      "hermes",
      "codex",
      "gemini",
      "custom-team",
      "claude",
    ]);
    expect(agents).toHaveLength(5);
    expect(agents.find((agent) => agent.id === "hermes")?.isDetected).toBe(
      false,
    );
  });

  it("excludes built-in Agents disabled by the user", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("claude", "Claude Code"),
        platform("codex", "Codex"),
        platform("cursor", "Cursor"),
      ],
      detectedPlatformIds: ["claude", "codex", "cursor"],
      pinnedPlatformIds: ["codex"],
      disabledPlatformIds: ["codex", "cursor"],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agents.map((agent) => agent.id)).toEqual(["claude"]);
  });

  it("prioritizes Antigravity while retaining Gemini as enterprise compatibility", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("cursor", "Cursor"),
        platform("antigravity", "Antigravity", {
          lifecycle: "current",
        }),
        platform("gemini", "Gemini", {
          lifecycle: "enterprise-legacy",
          replacementPlatformId: "antigravity",
        }),
      ],
      detectedPlatformIds: [],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agents.map((agent) => agent.id)).toEqual([
      "antigravity",
      "gemini",
      "cursor",
    ]);
    expect(agents.find((agent) => agent.id === "antigravity")).toMatchObject({
      name: "Antigravity",
      lifecycle: "current",
    });
    expect(agents.find((agent) => agent.id === "gemini")).toMatchObject({
      name: "Gemini",
      lifecycle: "enterprise-legacy",
      replacementPlatformId: "antigravity",
    });
  });

  it("derives overridden paths and independent capability states without claiming unsupported adapters", () => {
    const [agent] = buildManagedAgents({
      platforms: [
        platform("claude", "Claude Code", {
          mcpRelativePath: "../.claude.json",
          pluginsRelativePath: "plugins",
          globalRuleFile: "CLAUDE.md",
          configFiles: ["settings.json"],
        }),
      ],
      detectedPlatformIds: ["claude"],
      pinnedPlatformIds: [],
      builtinOverrides: {
        claude: {
          rootPath: "~/agents/claude",
          mcpRelativePath: "config/mcp.json",
        },
      },
      osKey: "darwin",
    });

    expect(agent.paths).toMatchObject({
      root: "~/agents/claude",
      skills: "~/agents/claude/skills",
      mcp: "~/agents/claude/config/mcp.json",
      plugins: "~/agents/claude/plugins",
      rules: "~/agents/claude/CLAUDE.md",
      configFiles: ["~/agents/claude/settings.json"],
      configFileRelativePaths: ["settings.json"],
    });
    expect(agent.capabilities.overview.status).toBe("supported");
    expect(agent.capabilities.assets.status).toBe("partial");
    expect(agent.capabilities.maintenance.status).toBe("partial");
    expect(agent.capabilities.provider).toEqual({
      status: "partial",
      reason: "model-config-only",
    });
    expect(agent.capabilities.configFiles.status).toBe("partial");
    expect(agent.capabilities.sessions.status).toBe("supported");
    expect(agent.capabilities.usage.status).toBe("supported");
  });

  it("marks the usage adapter supported for quota-capable agents and planned elsewhere", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("claude", "Claude Code"),
        platform("codex", "Codex CLI"),
        platform("kimi", "Kimi Code"),
        platform("antigravity", "Antigravity"),
        platform("gemini", "Gemini CLI"),
        platform("copilot", "GitHub Copilot"),
        platform("cursor", "Cursor"),
      ],
      detectedPlatformIds: [
        "claude",
        "codex",
        "kimi",
        "antigravity",
        "gemini",
        "copilot",
        "cursor",
      ],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    for (const id of [
      "claude",
      "codex",
      "kimi",
      "antigravity",
      "gemini",
      "copilot",
    ]) {
      expect(
        agents.find((agent) => agent.id === id)?.capabilities.usage,
        `${id} usage capability`,
      ).toEqual({ status: "supported" });
    }
    expect(
      agents.find((agent) => agent.id === "cursor")?.capabilities.usage,
    ).toEqual({ status: "planned", reason: "adapter-pending" });
  });

  it("enables history only for Agents with verified session adapters", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("claude", "Claude Code"),
        platform("codex", "Codex"),
        platform("gemini", "Gemini"),
        platform("kimi", "Kimi Code"),
        platform("opencode", "OpenCode"),
        platform("grok", "Grok Build"),
        platform("openclaw", "OpenClaw"),
        platform("qwen", "Qwen Code"),
        platform("antigravity", "Antigravity"),
        platform("cursor", "Cursor"),
      ],
      detectedPlatformIds: [],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    for (const id of [
      "claude",
      "codex",
      "gemini",
      "kimi",
      "opencode",
      "grok",
      "openclaw",
      "qwen",
    ]) {
      expect(
        agents.find((agent) => agent.id === id)?.capabilities.sessions,
        `${id} sessions capability`,
      ).toEqual({ status: "supported" });
    }
    for (const id of ["antigravity", "cursor"]) {
      expect(
        agents.find((agent) => agent.id === id)?.capabilities.sessions,
        `${id} sessions capability`,
      ).toEqual({ status: "planned", reason: "adapter-pending" });
    }
  });

  it("enables config editing only for declared relative paths", () => {
    const [supported, unsupported] = buildManagedAgents({
      platforms: [
        platform("codex", "Codex CLI", {
          configFiles: ["config.toml"],
        }),
        platform("cursor", "Cursor"),
      ],
      detectedPlatformIds: ["codex", "cursor"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(supported.paths.configFileRelativePaths).toEqual(["config.toml"]);
    expect(supported.paths.configFiles).toEqual(["~/.codex/config.toml"]);
    expect(supported.capabilities.configFiles).toEqual({
      status: "partial",
      reason: "direct-file-editing",
    });
    expect(supported.capabilities.appearance).toEqual({
      status: "supported",
    });
    expect(unsupported.paths.configFileRelativePaths).toEqual([]);
    expect(unsupported.capabilities.configFiles).toEqual({
      status: "unsupported",
      reason: "no-verified-config-path",
    });
    expect(unsupported.capabilities.appearance).toEqual({
      status: "unsupported",
      reason: "appearance-adapter-unavailable",
    });
  });

  it("uses the main-process resolved root before the static platform template", () => {
    const [agent] = buildManagedAgents({
      platforms: [
        platform("kimi", "Kimi Code", {
          resolvedRootPath: "/Users/test/.kimi-code",
        }),
      ],
      detectedPlatformIds: ["kimi"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agent.paths.root).toBe("/Users/test/.kimi-code");
    expect(agent.paths.skills).toBe("/Users/test/.kimi-code/skills");
  });

  it("enables verified model and session adapters independently by platform", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("gemini", "Gemini CLI", { configFiles: ["settings.json"] }),
        platform("kimi", "Kimi Code", { configFiles: ["config.toml"] }),
        platform("openclaw", "OpenClaw", { configFiles: ["openclaw.json"] }),
        platform("cursor", "Cursor"),
      ],
      detectedPlatformIds: ["gemini", "openclaw", "cursor"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(
      agents.find((agent) => agent.id === "gemini")?.capabilities.sessions,
    ).toEqual({ status: "supported" });
    expect(
      agents.find((agent) => agent.id === "kimi")?.capabilities,
    ).toMatchObject({
      provider: { status: "partial", reason: "model-config-only" },
      sessions: { status: "supported" },
    });
    expect(
      agents.find((agent) => agent.id === "openclaw")?.capabilities.sessions,
    ).toEqual({ status: "supported" });
    expect(
      agents.find((agent) => agent.id === "cursor")?.capabilities.provider,
    ).toEqual({ status: "planned", reason: "adapter-pending" });
  });

  it("projects Qwen Code model and session support without claiming quota support", () => {
    const [agent] = buildManagedAgents({
      platforms: [
        platform("qwen", "Qwen Code", {
          mcpRelativePath: "settings.json",
          pluginsRelativePath: "extensions",
          globalRuleFile: "QWEN.md",
          resolvedRootPath: "/Users/test/.qwen-custom",
        }),
      ],
      detectedPlatformIds: ["qwen"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agent.paths).toMatchObject({
      root: "/Users/test/.qwen-custom",
      skills: "/Users/test/.qwen-custom/skills",
      mcp: "/Users/test/.qwen-custom/settings.json",
      plugins: "/Users/test/.qwen-custom/extensions",
      rules: "/Users/test/.qwen-custom/QWEN.md",
    });
    expect(agent.capabilities).toMatchObject({
      provider: { status: "partial", reason: "model-config-only" },
      sessions: { status: "supported" },
      usage: { status: "planned", reason: "adapter-pending" },
    });
  });

  it("normalizes parent segments in displayed Agent asset paths", () => {
    const [agent] = buildManagedAgents({
      platforms: [
        platform("claude", "Claude Code", {
          mcpRelativePath: "../.claude.json",
        }),
      ],
      detectedPlatformIds: ["claude"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agent.paths.mcp).toBe("~/.claude.json");
  });

  it("filters the complete projection by status and searchable path metadata", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("claude", "Claude Code"),
        platform("custom-team", "Team Agent", {
          isCustom: true,
          isConfigured: true,
          rootDir: {
            darwin: "~/work/team-agent",
            win32: "%USERPROFILE%\\work\\team-agent",
            linux: "~/work/team-agent",
          },
        }),
      ],
      detectedPlatformIds: ["claude"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(filterManagedAgents(agents, "work/team", "all")).toHaveLength(1);
    expect(filterManagedAgents(agents, "", "installed")).toHaveLength(1);
    expect(filterManagedAgents(agents, "", "configured")).toHaveLength(1);
    expect(filterManagedAgents(agents, "", "custom")).toHaveLength(1);
    expect(filterManagedAgents(agents, "", "not-detected")).toHaveLength(1);
  });

  it("finds enterprise compatibility targets by lifecycle metadata", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("gemini", "Gemini CLI", {
          lifecycle: "enterprise-legacy",
          replacementPlatformId: "antigravity",
        }),
        platform("claude", "Claude Code"),
      ],
      detectedPlatformIds: [],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(filterManagedAgents(agents, "enterprise", "all")).toHaveLength(1);
    expect(filterManagedAgents(agents, "antigravity", "all")[0]?.id).toBe(
      "gemini",
    );
  });
});
