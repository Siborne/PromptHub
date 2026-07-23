import { describe, expect, it } from "vitest";

import { getPluginTargetMatrix } from "@prompthub/core";
import { getPlatformById } from "@prompthub/shared/constants/platforms";
import { KNOWN_RULE_FILE_TEMPLATES } from "@prompthub/shared/constants/rules";

describe("Qwen Code platform support", () => {
  it("keeps the documented identity, root, assets and global rule in one platform", () => {
    expect(getPlatformById("qwen")).toMatchObject({
      id: "qwen",
      name: "Qwen Code",
      rootEnvironmentVariable: "QWEN_HOME",
      skillsRelativePath: "skills",
      mcpRelativePath: "settings.json",
      pluginsRelativePath: "extensions",
      globalRuleFile: "QWEN.md",
    });
    expect(KNOWN_RULE_FILE_TEMPLATES["qwen-global"]).toMatchObject({
      platformId: "qwen",
      name: "QWEN.md",
    });
  });

  it("discovers native extension bundles without claiming PromptHub installation ownership", () => {
    expect(
      getPluginTargetMatrix().find((target) => target.id === "qwen"),
    ).toMatchObject({
      status: "native",
      enabled: false,
      nativeMarker: "qwen-extension.json",
    });
  });
});
