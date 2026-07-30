import { describe, expect, it } from "vitest";

import {
  getAgentPlatformFamily,
  getPlatformById,
} from "@prompthub/shared/constants/platforms";
import { KNOWN_RULE_FILE_TEMPLATES } from "@prompthub/shared/constants/rules";

describe("Oh My Pi platform support", () => {
  it("uses the native .omp/agent root and declares its managed assets", () => {
    expect(getPlatformById("oh-my-pi")).toMatchObject({
      id: "oh-my-pi",
      name: "Oh My Pi",
      rootEnvironmentVariable: "PI_CODING_AGENT_DIR",
      rootDir: {
        darwin: "~/.omp/agent",
        win32: "%USERPROFILE%\\.omp\\agent",
        linux: "~/.omp/agent",
      },
      skillsRelativePath: "skills",
      mcpRelativePath: "mcp.json",
      pluginsRelativePath: "../plugins",
      globalRuleFile: "RULES.md",
      configFiles: [
        "config.yml",
        "config.yaml",
        "settings.json",
        "mcp.json",
        ".mcp.json",
        "RULES.md",
      ],
    });
    expect(getAgentPlatformFamily("oh-my-pi")).toBe("code-work");
    expect(KNOWN_RULE_FILE_TEMPLATES["oh-my-pi-global"]).toMatchObject({
      platformId: "oh-my-pi",
      name: "RULES.md",
      group: "assistant",
    });
  });
});
