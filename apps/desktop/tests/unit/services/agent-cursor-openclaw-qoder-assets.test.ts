import { describe, expect, it } from "vitest";

import { getAgentPlatformCapabilityInventory } from "@prompthub/shared/constants/agent-platform-capabilities";
import { getPlatformById } from "@prompthub/shared/constants/platforms";
import { buildManagedAgents } from "@prompthub/core/agent-management";

describe("project Rules and expanded MCP assets", () => {
  it("models Cursor's verified project rule without inventing a user-global file", () => {
    const cursor = getPlatformById("cursor")!;

    expect(cursor.globalRuleFile).toBeUndefined();
    expect(cursor.projectRuleFile).toBe(".cursor/rules/prompthub.mdc");
    expect(getAgentPlatformCapabilityInventory(cursor).rules).toEqual({
      status: "partial",
      evidence: "project-rule-path",
    });

    const [agent] = buildManagedAgents({
      platforms: [cursor],
      detectedPlatformIds: ["cursor"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });
    expect(agent.paths.rules).toBeUndefined();
    expect(agent.paths.projectRules).toBe(".cursor/rules/prompthub.mdc");
  });

  it("models Qoder's AGENTS.md compatibility as a shared project rule", () => {
    const qoder = getPlatformById("qoder")!;

    expect(qoder.globalRuleFile).toBeUndefined();
    expect(qoder.projectRuleFile).toBe("AGENTS.md");
    expect(qoder.projectRuleKind).toBe("workspace");
    expect(getAgentPlatformCapabilityInventory(qoder).rules).toEqual({
      status: "partial",
      evidence: "project-rule-path",
    });
  });

  it.each([
    ["openclaw", "openclaw.json"],
    ["qoder", "settings.json"],
    ["antigravity", "mcp_config.json"],
  ])(
    "registers the verified %s MCP config path",
    (platformId, relativePath) => {
      const platform = getPlatformById(platformId)!;

      expect(platform.mcpRelativePath).toBe(relativePath);
      expect(getAgentPlatformCapabilityInventory(platform).mcp).toEqual({
        status: "partial",
        evidence: "mcp-relative-path",
      });
    },
  );
});
