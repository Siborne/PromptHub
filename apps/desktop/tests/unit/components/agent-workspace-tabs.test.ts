import { describe, expect, it } from "vitest";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import {
  AGENT_WORKSPACE_TABS,
  getAgentCapabilityGuidance,
  getAgentTabStatus,
  getAgentWorkspaceTabs,
  isAgentAssetDomain,
  isAgentTabEnabled,
} from "../../../src/renderer/components/agent/agent-workspace-tabs";

function agent(id: string): ManagedAgentSummary {
  return {
    id,
    paths: {},
    capabilities: {
      overview: { status: "supported" },
      provider: { status: "planned" },
      appearance: { status: "unsupported" },
      assets: { status: "partial" },
      configFiles: { status: "planned" },
      sessions: { status: "planned" },
      usage: { status: "planned" },
      maintenance: { status: "planned" },
    },
  } as ManagedAgentSummary;
}

describe("Agent workspace tab availability", () => {
  it("keeps Skills, MCP, and Plugins adjacent before Rules", () => {
    expect(
      getAgentWorkspaceTabs(agent("claude")).map((tab) => tab.key),
    ).toEqual([
      "overview",
      "skills",
      "mcp",
      "plugins",
      "rules",
      "provider",
      "appearance",
      "configFiles",
      "sessions",
    ]);
    expect(getAgentWorkspaceTabs(agent("qwen")).map((tab) => tab.key)).toEqual([
      "overview",
      "skills",
      "mcp",
      "plugins",
      "rules",
      "definitions",
      "provider",
      "appearance",
      "configFiles",
      "sessions",
    ]);
  });

  it("shows Definitions only for Qwen without creating a global capability", () => {
    expect(
      getAgentWorkspaceTabs(agent("qwen")).map((tab) => tab.key),
    ).toContain("definitions");
    expect(
      getAgentWorkspaceTabs(agent("claude")).map((tab) => tab.key),
    ).not.toContain("definitions");
  });

  it("derives asset and platform availability from the same Agent summary", () => {
    const qwen = agent("qwen");
    const definitions = AGENT_WORKSPACE_TABS.find(
      (tab) => tab.key === "definitions",
    )!;
    const skills = AGENT_WORKSPACE_TABS.find((tab) => tab.key === "skills")!;
    const overview = AGENT_WORKSPACE_TABS.find(
      (tab) => tab.key === "overview",
    )!;

    expect(getAgentTabStatus(qwen, definitions)).toBe("partial");
    expect(getAgentTabStatus(agent("codex"), definitions)).toBe("unsupported");
    expect(getAgentTabStatus(qwen, skills)).toBe("unsupported");
    qwen.paths.skills = "/home/test/.qwen/skills";
    expect(getAgentTabStatus(qwen, skills)).toBe("partial");
    expect(getAgentTabStatus(qwen, overview)).toBe("supported");
    expect(isAgentTabEnabled(qwen, overview)).toBe(true);
    expect(isAgentTabEnabled(qwen, skills)).toBe(true);
    expect(
      isAgentTabEnabled(
        qwen,
        AGENT_WORKSPACE_TABS.find((tab) => tab.key === "provider")!,
      ),
    ).toBe(false);
  });

  it("identifies asset tabs and returns explicit capability guidance", () => {
    expect(isAgentAssetDomain("skills")).toBe(true);
    expect(isAgentAssetDomain("overview")).toBe(false);
    expect(getAgentCapabilityGuidance("planned")).toMatchObject({
      key: "agents.adapterPlannedDescription",
    });
    expect(getAgentCapabilityGuidance("unsupported")).toMatchObject({
      key: "agents.adapterUnsupportedDescription",
    });
    expect(getAgentCapabilityGuidance("supported")).toBeNull();
    expect(getAgentCapabilityGuidance("partial")).toBeNull();
  });
});
