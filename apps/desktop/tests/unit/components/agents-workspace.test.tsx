import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentsSidebarPanel } from "../../../src/renderer/components/agent/AgentsSidebarPanel";
import { AgentsWorkspace } from "../../../src/renderer/components/agent/AgentsWorkspace";
import { useAgentStore } from "../../../src/renderer/stores/agent.store";
import { useMcpStore } from "../../../src/renderer/stores/mcp.store";
import { usePluginStore } from "../../../src/renderer/stores/plugin.store";
import { useRulesStore } from "../../../src/renderer/stores/rules.store";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

vi.mock("../../../src/renderer/components/skill/SkillFileEditor", () => ({
  SkillFileEditor: ({
    allowStructuralMutations,
    fileSource,
    localPath,
    visibleFilePaths,
  }: {
    allowStructuralMutations?: boolean;
    fileSource?: { key: string };
    localPath?: string;
    visibleFilePaths?: string[];
  }) => (
    <div
      data-testid="agent-config-editor"
      data-local-path={localPath}
      data-source-key={fileSource?.key}
      data-structural-mutations={String(allowStructuralMutations)}
    >
      {visibleFilePaths?.join(",")}
    </div>
  ),
}));

const agents = [
  {
    id: "claude",
    name: "Claude Code",
    icon: "Sparkles",
    isCustom: false,
    isConfigured: true,
    isDetected: true,
    isPinned: false,
    status: "installed" as const,
    paths: {
      root: "~/.claude",
      skills: "~/.claude/skills",
      mcp: "~/.claude.json",
      plugins: "~/.claude/plugins",
      rules: "~/.claude/CLAUDE.md",
      configFiles: ["~/.claude/settings.json"],
      configFileRelativePaths: ["settings.json"],
    },
    capabilities: {
      overview: { status: "supported" as const },
      provider: { status: "partial" as const, reason: "model-config-only" },
      assets: { status: "partial" as const, reason: "Asset management" },
      configFiles: {
        status: "partial" as const,
        reason: "direct-file-editing",
      },
      sessions: { status: "supported" as const },
      usage: { status: "planned" as const, reason: "Coming later" },
      maintenance: { status: "partial" as const, reason: "Basic tools" },
    },
  },
  {
    id: "cline",
    name: "Cline",
    icon: "Terminal",
    isCustom: false,
    isConfigured: false,
    isDetected: false,
    isPinned: false,
    status: "not-detected" as const,
    paths: {
      root: "~/.cline",
      skills: "~/.cline/skills",
      configFiles: [],
      configFileRelativePaths: [],
    },
    capabilities: {
      overview: { status: "supported" as const },
      provider: { status: "planned" as const, reason: "Coming later" },
      assets: { status: "partial" as const, reason: "Asset management" },
      configFiles: {
        status: "unsupported" as const,
        reason: "no-verified-config-path",
      },
      sessions: { status: "planned" as const, reason: "Coming later" },
      usage: { status: "planned" as const, reason: "Coming later" },
      maintenance: { status: "partial" as const, reason: "Basic tools" },
    },
  },
];

describe("Agent workspace shell", () => {
  beforeEach(() => {
    installWindowMocks();
    useAgentStore.setState({
      agents,
      selectedAgentId: "claude",
      searchQuery: "",
      filter: "all",
      pinnedAgentIds: [],
      isLoading: false,
      hasLoaded: true,
      error: null,
    });
    useSkillStore.setState({
      skills: [],
      agentScanState: {
        claude: {
          result: {
            platform: null as never,
            skillsDir: "~/.claude/skills",
            scannedSkills: [],
          },
          isScanning: false,
        },
      },
    });
    useMcpStore.setState({
      library: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        servers: [],
        bindings: [],
      },
      targetPresets: [],
      targetStatus: [],
    });
    useRulesStore.setState({ files: [], hasLoadedFiles: true });
    usePluginStore.setState({
      library: {
        kind: "prompthub-plugin-library",
        version: 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
        plugins: [],
      },
      targetMatrix: [],
    });
  });

  it("keeps every Agent row clickable even when deep capabilities are unavailable", async () => {
    await renderWithI18n(<AgentsSidebarPanel />);

    expect(
      screen.getByRole("combobox", { name: /sort agents/i }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /cline/i }));

    expect(useAgentStore.getState().selectedAgentId).toBe("cline");
  });

  it("promotes each asset domain into the stable top-level tab shell", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    const providerTab = screen.getByRole("tab", {
      name: /provider & model/i,
    });
    const usageTab = screen.getByRole("tab", { name: /usage/i });
    const skillsTab = screen.getByRole("tab", { name: /skills/i });
    const mcpTab = screen.getByRole("tab", { name: /^mcp$/i });
    const rulesTab = screen.getByRole("tab", { name: /^rules$/i });
    const pluginsTab = screen.getByRole("tab", { name: /^plugins$/i });

    expect(providerTab).toBeEnabled();
    expect(usageTab).toBeDisabled();
    expect(skillsTab).not.toBeDisabled();
    expect(mcpTab).not.toBeDisabled();
    expect(rulesTab).not.toBeDisabled();
    expect(pluginsTab).not.toBeDisabled();
    expect(
      screen.queryByRole("tab", { name: /^assets$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(skillsTab);
    expect(screen.getByRole("tabpanel", { name: /skills/i })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /skills installed/i }),
    ).toBeVisible();

    fireEvent.click(mcpTab);
    expect(screen.getByRole("tabpanel", { name: /^mcp$/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /mcp servers/i })).toBeVisible();

    fireEvent.click(rulesTab);
    expect(screen.getByRole("heading", { name: /rules files/i })).toBeVisible();

    fireEvent.click(pluginsTab);
    expect(
      screen.getByRole("heading", { name: /installed plugins/i }),
    ).toBeVisible();
  });

  it("uses the first asset domain as the capability-aware primary action", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /manage skills/i }));

    expect(screen.getByRole("tabpanel", { name: /skills/i })).toBeVisible();
  });

  it("loads and updates the Agent native model without exposing credentials", async () => {
    const setModelConfig = vi.fn().mockResolvedValue({
      agentId: "claude",
      adapter: "claude-settings-v1",
      status: "configured",
      model: "claude-sonnet-4-5",
      secondaryModel: null,
      fallbackModels: [],
      provider: "anthropic",
      endpoint: null,
      availableModels: ["claude-sonnet-4-5"],
      credentialStatus: "platform-managed",
      sourceRelativePath: "settings.json",
      canSetModel: true,
      formattingMayChange: false,
      backupPath: "/tmp/backup/settings.json",
    });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue({
            agentId: "claude",
            adapter: "claude-settings-v1",
            status: "configured",
            model: "claude-opus-4-1",
            secondaryModel: null,
            fallbackModels: [],
            provider: "anthropic",
            endpoint: null,
            availableModels: ["claude-opus-4-1", "claude-sonnet-4-5"],
            credentialStatus: "platform-managed",
            sourceRelativePath: "settings.json",
            canSetModel: true,
            formattingMayChange: false,
          }),
          setModelConfig,
        },
      },
    });

    await renderWithI18n(<AgentsWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: /provider & model/i }));

    const modelInput = await screen.findByLabelText(/default model/i);
    expect(modelInput).toHaveValue("claude-opus-4-1");
    expect(screen.getByText(/managed by agent/i)).toBeVisible();
    expect(screen.queryByText(/api[_ -]?key/i)).not.toBeInTheDocument();

    fireEvent.change(modelInput, { target: { value: "claude-sonnet-4-5" } });
    fireEvent.click(screen.getByRole("button", { name: /save model/i }));

    await waitFor(() =>
      expect(setModelConfig).toHaveBeenCalledWith({
        agentId: "claude",
        model: "claude-sonnet-4-5",
      }),
    );
    expect(await screen.findByText(/^saved$/i)).toBeVisible();
  });

  it("lists Agent sessions and lazily reads the selected transcript", async () => {
    const readSession = vi.fn().mockResolvedValue({
      agentId: "claude",
      adapter: "claude-jsonl-v1",
      sessionId: "session-1",
      entries: [
        {
          id: "1",
          role: "user",
          timestamp: 1_700_000_000_000,
          text: "Investigate the failing build",
        },
      ],
      parseErrors: 0,
      truncated: false,
    });
    installWindowMocks({
      api: {
        agent: {
          listSessions: vi.fn().mockResolvedValue({
            agentId: "claude",
            adapter: "claude-jsonl-v1",
            sessions: [
              {
                id: "session-1",
                title: "Build investigation",
                projectLabel: "PromptHub",
                projectPath: null,
                createdAt: null,
                updatedAt: 1_700_000_000_000,
                model: null,
                messageCount: null,
                sourcePath: "/tmp/session-1.jsonl",
                resume: {
                  executable: "claude",
                  args: ["--resume", "session-1"],
                },
              },
            ],
            total: 1,
            hasMore: false,
          }),
          readSession,
        },
      },
    });

    await renderWithI18n(<AgentsWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: /sessions/i }));

    expect(
      (await screen.findAllByText("Build investigation")).length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByText("Investigate the failing build"),
    ).toBeVisible();
    expect(readSession).toHaveBeenCalledWith("claude", "session-1");
  });

  it("keeps unsupported asset domains visible and disabled", async () => {
    useAgentStore.setState({ selectedAgentId: "cline" });

    await renderWithI18n(<AgentsWorkspace />);

    expect(screen.getByRole("tab", { name: /skills/i })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^mcp$/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^rules$/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^plugins$/i })).toBeDisabled();
  });

  it("opens the allowlisted native config editor and the Agent root folder", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    const configTab = screen.getByRole("tab", { name: /config files/i });
    expect(configTab).toBeEnabled();
    fireEvent.click(configTab);

    const editor = screen.getByTestId("agent-config-editor");
    expect(editor).toHaveAttribute("data-local-path", "~/.claude");
    expect(editor).toHaveAttribute("data-source-key", "agent-config:claude");
    expect(editor).toHaveAttribute("data-structural-mutations", "false");
    expect(editor).toHaveTextContent("settings.json");

    fireEvent.click(screen.getByRole("button", { name: /open agent folder/i }));
    expect(window.electron.openPath).toHaveBeenCalledWith("~/.claude");
  });

  it("keeps Config Files disabled when no native path is verified", async () => {
    useAgentStore.setState({ selectedAgentId: "cline" });

    await renderWithI18n(<AgentsWorkspace />);

    expect(screen.getByRole("tab", { name: /config files/i })).toBeDisabled();
  });

  it("refreshes from the shared store instead of maintaining a second Agent list", async () => {
    const refresh = vi
      .spyOn(useAgentStore.getState(), "refresh")
      .mockResolvedValue(undefined);

    await renderWithI18n(<AgentsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
