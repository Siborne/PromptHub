import { describe, expect, it } from "vitest";

import { getPluginTargetMatrix } from "@prompthub/core";
import { KNOWN_RULE_FILE_TEMPLATES } from "@prompthub/shared/constants/rules";
import { getPlatformById } from "@prompthub/shared/constants/platforms";
import { BUILTIN_SKILL_REGISTRY } from "@prompthub/shared/constants/skill-registry";

describe("ZCode Agent platform support", () => {
  it("keeps documented Skills, Rules, and MCP metadata in one platform identity", () => {
    const platform = getPlatformById("zcode");

    expect(platform).toMatchObject({
      id: "zcode",
      name: "智谱 ZCode",
      rootDir: {
        darwin: "~/.zcode",
        win32: "%USERPROFILE%\\.zcode",
        linux: "~/.zcode",
      },
      skillsRelativePath: "skills",
      mcpRelativePath: "cli/config.json",
      globalRuleFile: "AGENTS.md",
    });
    expect(KNOWN_RULE_FILE_TEMPLATES["zcode-global"]).toMatchObject({
      platformId: "zcode",
      name: "AGENTS.md",
    });
    expect(BUILTIN_SKILL_REGISTRY[0]?.compatibility).toContain("zcode");
  });

  it("does not claim an unverified native ZCode Plugin package target", () => {
    expect(
      getPluginTargetMatrix().find((target) => target.id === "zcode"),
    ).toMatchObject({
      status: "pending",
      enabled: false,
    });
  });
});
