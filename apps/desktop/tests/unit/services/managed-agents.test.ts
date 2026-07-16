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
    expect(agent.capabilities.usage.status).toBe("planned");
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
    expect(unsupported.paths.configFileRelativePaths).toEqual([]);
    expect(unsupported.capabilities.configFiles).toEqual({
      status: "unsupported",
      reason: "no-verified-config-path",
    });
  });

  it("enables verified model and session adapters independently by platform", () => {
    const agents = buildManagedAgents({
      platforms: [
        platform("gemini", "Gemini CLI", { configFiles: ["settings.json"] }),
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
      agents.find((agent) => agent.id === "openclaw")?.capabilities.sessions,
    ).toEqual({ status: "planned", reason: "adapter-pending" });
    expect(
      agents.find((agent) => agent.id === "cursor")?.capabilities.provider,
    ).toEqual({ status: "planned", reason: "adapter-pending" });
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
});
