import { describe, expect, it } from "vitest";

import { KNOWN_RULE_FILE_TEMPLATES, RULE_PLATFORM_ORDER } from "@prompthub/shared/constants/rules";
import { getPlatformById } from "@prompthub/shared/constants/platforms";

describe("Kimi Code platform support", () => {
  it("uses Kimi Code display name without CLI suffix", () => {
    const platform = getPlatformById("kimi");

    expect(platform).toMatchObject({
      id: "kimi",
      name: "Kimi Code",
      rootDir: {
        darwin: "~/.kimi-code",
        win32: "%USERPROFILE%\\.kimi-code",
        linux: "~/.kimi-code",
      },
      skillsRelativePath: "skills",
      mcpRelativePath: "mcp.json",
      globalRuleFile: "AGENTS.md",
    });
    expect(platform?.name).not.toMatch(/CLI/i);
  });

  it("includes Kimi Code in the Rules runtime whitelist", () => {
    expect(RULE_PLATFORM_ORDER).toContain("kimi");
    expect(KNOWN_RULE_FILE_TEMPLATES["kimi-global"]).toMatchObject({
      platformId: "kimi",
      platformName: "Kimi Code",
      name: "AGENTS.md",
      group: "assistant",
    });
  });
});
