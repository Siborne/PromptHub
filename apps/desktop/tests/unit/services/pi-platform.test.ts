import { describe, expect, it } from "vitest";

import { buildManagedAgents } from "@prompthub/core";
import {
  DEFAULT_SKILL_PLATFORM_ORDER,
  getAgentPlatformFamily,
  getPlatformById,
} from "@prompthub/shared/constants/platforms";
import { KNOWN_RULE_FILE_TEMPLATES } from "@prompthub/shared/constants/rules";

describe("Pi platform support", () => {
  it("keeps Pi and Oh My Pi as independent built-in agents", () => {
    expect(getPlatformById("pi")).toMatchObject({
      id: "pi",
      name: "Pi",
      icon: "Pi",
      rootEnvironmentVariable: "PI_CODING_AGENT_DIR",
      rootDir: {
        darwin: "~/.pi/agent",
        win32: "%USERPROFILE%\\.pi\\agent",
        linux: "~/.pi/agent",
      },
      skillsRelativePath: "skills",
      pluginsRelativePath: "extensions",
      globalRuleFile: "AGENTS.md",
      configFiles: ["settings.json", "models.json", "AGENTS.md"],
      cli: {
        executableCandidates: ["pi"],
        versionArgs: ["--version"],
        evidence: "official-pi-cli",
      },
    });
    expect(getPlatformById("pi")?.mcpRelativePath).toBeUndefined();
    expect(getPlatformById("oh-my-pi")?.rootDir.darwin).toBe("~/.omp/agent");
    expect(DEFAULT_SKILL_PLATFORM_ORDER).toEqual(
      expect.arrayContaining(["pi", "oh-my-pi"]),
    );
    expect(new Set(["pi", "oh-my-pi"]).size).toBe(2);
  });

  it("registers Pi rules and family metadata independently", () => {
    expect(getAgentPlatformFamily("pi")).toBe("code-work");
    expect(KNOWN_RULE_FILE_TEMPLATES["pi-global"]).toMatchObject({
      platformId: "pi",
      name: "AGENTS.md",
      group: "assistant",
    });
    expect(KNOWN_RULE_FILE_TEMPLATES["oh-my-pi-global"]).toMatchObject({
      platformId: "oh-my-pi",
      name: "RULES.md",
    });
  });

  it("derives Pi assets without borrowing Oh My Pi paths", () => {
    const pi = getPlatformById("pi");
    expect(pi).toBeDefined();

    const agents = buildManagedAgents({
      platforms: [pi!],
      detectedPlatformIds: ["pi"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      id: "pi",
      status: "installed",
      paths: {
        root: "~/.pi/agent",
        skills: "~/.pi/agent/skills",
        mcp: undefined,
        plugins: "~/.pi/agent/extensions",
        rules: "~/.pi/agent/AGENTS.md",
        configFiles: [
          "~/.pi/agent/settings.json",
          "~/.pi/agent/models.json",
          "~/.pi/agent/AGENTS.md",
        ],
      },
      capabilities: {
        provider: { status: "partial", reason: "model-config-only" },
        sessions: { status: "supported" },
      },
    });
  });
});
