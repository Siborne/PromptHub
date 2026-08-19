import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { AgentOverviewPanel } from "../../../src/renderer/components/agent/AgentOverviewPanel";
import { useMcpStore } from "../../../src/renderer/stores/mcp.store";
import { usePluginStore } from "../../../src/renderer/stores/plugin.store";
import { useRulesStore } from "../../../src/renderer/stores/rules.store";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { renderWithI18n } from "../../helpers/i18n";

const { listForTarget } = vi.hoisted(() => ({
  listForTarget: vi.fn(),
}));

vi.mock("../../../src/renderer/services/agent-asset-domain-adapters", () => ({
  agentAssetAggregationService: { listForTarget },
  readAgentAssetAggregate: (platformId: string) => ({
    platformId,
    total: 0,
    domains: [],
  }),
}));

const webAgent: ManagedAgentSummary = {
  id: "claude",
  name: "Claude Code",
  icon: "Sparkles",
  isCustom: false,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  launchable: false,
  status: "installed",
  paths: {
    root: "/srv/claude",
    skills: "/srv/claude/skills",
    mcp: "/srv/claude/mcp.json",
    plugins: "/srv/claude/plugins",
    rules: "/srv/claude/CLAUDE.md",
    configFiles: [],
    configFileRelativePaths: [],
  },
  capabilities: {
    overview: { status: "supported" },
    provider: { status: "unsupported" },
    appearance: { status: "unsupported" },
    assets: { status: "unsupported" },
    configFiles: { status: "unsupported" },
    sessions: { status: "unsupported" },
    usage: { status: "unsupported" },
    maintenance: { status: "unsupported" },
  },
};

describe("Agent overview Web capability boundary", () => {
  beforeEach(() => {
    listForTarget.mockReset();
  });

  it("does not invoke Desktop asset loaders when the server disables assets", async () => {
    const loadSkills = vi.fn();
    const scanSkills = vi.fn();
    const loadMcpTargetInventory = vi.fn();
    const loadRules = vi.fn();
    const loadPluginTargetInventory = vi.fn();
    useSkillStore.setState({
      skills: [],
      isLoading: false,
      agentScanState: {},
      loadSkills,
      scanAgentPlatformSkills: scanSkills,
    });
    useMcpStore.setState({
      hasLoadedTargetInventory: false,
      loadTargetInventory: loadMcpTargetInventory,
    });
    useRulesStore.setState({
      files: [],
      hasLoadedFiles: false,
      loadFiles: loadRules,
    });
    usePluginStore.setState({
      hasLoadedTargetInventory: false,
      loadTargetInventory: loadPluginTargetInventory,
    });

    renderWithI18n(
      <AgentOverviewPanel agent={webAgent} onNavigate={vi.fn()} />,
    );

    await waitFor(() => expect(listForTarget).not.toHaveBeenCalled());
    expect(loadSkills).not.toHaveBeenCalled();
    expect(scanSkills).not.toHaveBeenCalled();
    expect(loadMcpTargetInventory).not.toHaveBeenCalled();
    expect(loadRules).not.toHaveBeenCalled();
    expect(loadPluginTargetInventory).not.toHaveBeenCalled();
  });
});
