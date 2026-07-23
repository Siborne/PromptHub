import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentsSidebarPanel } from "../../../src/renderer/components/agent/AgentsSidebarPanel";
import { AgentsWorkspace } from "../../../src/renderer/components/agent/AgentsWorkspace";
import { useAgentStore } from "../../../src/renderer/stores/agent.store";
import { useMcpStore } from "../../../src/renderer/stores/mcp.store";
import { usePluginStore } from "../../../src/renderer/stores/plugin.store";
import { useRulesStore } from "../../../src/renderer/stores/rules.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

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
    launchable: true,
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
      appearance: {
        status: "unsupported" as const,
        reason: "appearance-adapter-unavailable",
      },
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
      appearance: {
        status: "unsupported" as const,
        reason: "appearance-adapter-unavailable",
      },
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

const settingsActions = {
  updateBuiltinAgentOverride:
    useSettingsStore.getState().updateBuiltinAgentOverride,
  updateCustomAgent: useSettingsStore.getState().updateCustomAgent,
};

describe("Agent workspace shell", () => {
  beforeEach(() => {
    installWindowMocks();
    useAgentStore.setState({
      agents,
      selectedAgentId: "claude",
      searchQuery: "",
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
    useSettingsStore.setState({
      builtinAgentOverrides: {},
      customAgents: [],
      disabledPlatformIds: [],
      ...settingsActions,
    });
  });

  it("keeps the Agent list search-only and rows clickable", async () => {
    await renderWithI18n(<AgentsSidebarPanel />);

    expect(
      screen.queryByRole("combobox", { name: /filter agents/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /sort agents/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cline/i }));

    expect(useAgentStore.getState().selectedAgentId).toBe("cline");
  });

  it("positions the pin action at the centered right edge", async () => {
    await renderWithI18n(<AgentsSidebarPanel />);

    const pinButton = screen.getAllByRole("button", { name: /^pin$/i })[0];
    expect(pinButton.className).toContain("top-1/2");
    expect(pinButton.className).toContain("-translate-y-1/2");
    expect(pinButton.className).toContain("right-2");
    expect(pinButton.className).not.toContain("top-1 ");
    expect(pinButton.className).not.toContain("right-7");
  });

  it("renders the detail identity icon without a decorative frame", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    const identityIcon = screen.getByTestId("agent-identity-icon");
    expect(identityIcon.className).not.toContain("border");
    expect(identityIcon.className).not.toContain("bg-background");
    expect(identityIcon.className).not.toContain("shadow");
  });

  it("does not repeat Gemini lifecycle guidance as compatibility badges", async () => {
    const gemini = {
      ...agents[0],
      id: "gemini",
      name: "Gemini",
      lifecycle: "enterprise-legacy" as const,
      replacementPlatformId: "antigravity",
    };
    useAgentStore.setState({ agents: [gemini], selectedAgentId: "gemini" });

    await renderWithI18n(
      <>
        <AgentsSidebarPanel />
        <AgentsWorkspace />
      </>,
    );

    expect(
      screen.queryByText(/enterprise compatibility/i),
    ).not.toBeInTheDocument();
  });

  it("omits disabled Agents when the shared projection refreshes", async () => {
    installWindowMocks({
      api: {
        skill: {
          getSupportedPlatforms: vi.fn().mockResolvedValue([
            {
              id: "claude",
              name: "Claude Code",
              icon: "Sparkles",
              rootDir: {
                darwin: "~/.claude",
                win32: "%USERPROFILE%\\.claude",
                linux: "~/.claude",
              },
              skillsRelativePath: "skills",
            },
            {
              id: "cline",
              name: "Cline",
              icon: "Terminal",
              rootDir: {
                darwin: "~/.cline",
                win32: "%USERPROFILE%\\.cline",
                linux: "~/.cline",
              },
              skillsRelativePath: "skills",
            },
          ]),
          detectPlatforms: vi.fn().mockResolvedValue(["claude", "cline"]),
        },
      },
    });
    useSettingsStore.setState({ disabledPlatformIds: ["cline"] });
    useAgentStore.setState({ selectedAgentId: "cline" });

    await useAgentStore.getState().refresh();

    expect(useAgentStore.getState().agents.map((agent) => agent.id)).toEqual([
      "claude",
    ]);
    expect(useAgentStore.getState().selectedAgentId).toBe("claude");
  });

  it("renders direct asset tabs without maintenance, usage, or an assets submenu", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(9);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Skills",
      "MCP",
      "Rules",
      "Plugins",
      "Provider & Model",
      "Appearance",
      "Config Files",
      "Sessions",
    ]);

    expect(
      screen.queryByRole("tab", { name: /maintenance/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /usage/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /^assets$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^skills$/i })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^mcp$/i })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^rules$/i })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^plugins$/i })).toBeEnabled();
    expect(
      screen.getByRole("tab", { name: /provider & model/i }),
    ).toBeEnabled();
    expect(screen.getByRole("tab", { name: /appearance/i })).toBeDisabled();
  });

  it("keeps the tab panel flush with the workspace without a page canvas", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    const panel = screen.getByRole("tabpanel", { name: /overview/i });
    expect(panel.className).toContain("flex");
    expect(panel.className).toContain("h-full");
    expect(panel.className).not.toContain("max-w-6xl");
    expect(panel.className).not.toContain("px-6");
    expect(panel.parentElement?.className).not.toContain("overflow-y-auto");
    expect(panel.parentElement?.className).not.toContain("max-w-6xl");
    expect(panel.parentElement?.className).not.toContain("px-6");
  });

  it("renders each asset domain directly from its top-level tab", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    fireEvent.click(screen.getByRole("tab", { name: /^skills$/i }));
    expect(screen.getByRole("tabpanel", { name: /^skills$/i })).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: /^assets$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("~/.claude/skills")).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: /^mcp$/i }));
    expect(screen.getByRole("tabpanel", { name: /^mcp$/i })).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /search assets/i }),
    ).toBeVisible();
    expect(screen.getByText("~/.claude.json")).toBeVisible();
  });

  it("does not duplicate Skills management in the header actions", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    expect(
      screen.queryByRole("button", { name: /manage skills/i }),
    ).not.toBeInTheDocument();
  });

  it("launches the selected desktop Agent from the header action", async () => {
    window.api.agent.launch = vi.fn().mockResolvedValue({ success: true });

    await renderWithI18n(<AgentsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open Claude Code" }));

    await waitFor(() =>
      expect(window.api.agent.launch).toHaveBeenCalledWith("claude"),
    );
  });

  it("edits the selected Agent in a modal without leaving the workspace", async () => {
    const updateBuiltinAgentOverride = vi.fn();
    useSettingsStore.setState({
      builtinAgentOverrides: {},
      updateBuiltinAgentOverride,
    });
    const refresh = vi
      .spyOn(useAgentStore.getState(), "refresh")
      .mockResolvedValue(undefined);

    await renderWithI18n(<AgentsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));

    const editItem = screen.getByRole("button", {
      name: /edit agent/i,
    });
    expect(editItem).toBeVisible();
    fireEvent.click(editItem);

    const dialog = screen.getByRole("dialog", { name: /edit claude code/i });
    expect(dialog).toBeVisible();
    const rootInput = within(dialog).getByRole("textbox", {
      name: /root directory/i,
    });
    expect(rootInput).toHaveValue("~/.claude");
    fireEvent.change(rootInput, { target: { value: "~/temporary" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reset$/i }));
    expect(rootInput).toHaveValue("%USERPROFILE%\\.claude");
    fireEvent.change(rootInput, { target: { value: "~/Agents/claude" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(updateBuiltinAgentOverride).toHaveBeenCalledWith(
        "claude",
        expect.objectContaining({ rootPath: "~/Agents/claude" }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /edit claude code/i }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    const refreshItems = screen.getAllByRole("button", { name: /^refresh$/i });
    expect(refreshItems.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(refreshItems[refreshItems.length - 1]);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("edits a custom Agent through the same workspace dialog", async () => {
    const customAgent = {
      ...agents[0],
      id: "agent_team",
      name: "Team Agent",
      isCustom: true,
      paths: {
        ...agents[0].paths,
        root: "~/team-agent",
        skills: "~/team-agent/skills",
      },
    };
    const updateCustomAgent = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Custom agent root path already exists");
      })
      .mockImplementation(() => undefined);
    useAgentStore.setState({
      agents: [customAgent],
      selectedAgentId: customAgent.id,
    });
    useSettingsStore.setState({
      customAgents: [
        {
          id: customAgent.id,
          name: customAgent.name,
          rootPath: "~/team-agent",
          enabled: true,
          skillsRelativePath: "skills",
        },
      ],
      updateCustomAgent,
    });

    await renderWithI18n(<AgentsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit agent/i }));

    const dialog = screen.getByRole("dialog", { name: /edit team agent/i });
    const nameInput = within(dialog).getByRole("textbox", {
      name: /agent name/i,
    });
    const rootInput = within(dialog).getByRole("textbox", {
      name: /root directory/i,
    });
    fireEvent.change(rootInput, { target: { value: "~/temporary" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reset$/i }));
    expect(rootInput).toHaveValue("~/team-agent");
    fireEvent.change(nameInput, { target: { value: "Research Agent" } });
    fireEvent.change(rootInput, { target: { value: "~/research-agent" } });
    fireEvent.click(within(dialog).getByRole("switch", { name: /enabled/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    expect(updateCustomAgent).toHaveBeenLastCalledWith(
      customAgent.id,
      expect.objectContaining({
        enabled: false,
        name: "Research Agent",
        rootPath: "~/research-agent",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /edit team agent/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("enables the shared Appearance tab for Codex skins and Pets", async () => {
    const codexAgent = {
      ...agents[0],
      id: "codex",
      name: "Codex CLI",
      paths: {
        ...agents[0].paths,
        root: "~/.codex",
        skills: "~/.codex/skills",
      },
      capabilities: {
        ...agents[0].capabilities,
        appearance: { status: "supported" as const },
      },
    };
    useAgentStore.setState({ agents: [codexAgent], selectedAgentId: "codex" });
    installWindowMocks({
      api: {
        agent: {
          getAppearance: vi.fn().mockResolvedValue({
            agentId: "codex",
            supported: true,
            engineVersion: "1.2.0",
            adapterLastVerifiedVersion: "26.707.72221",
            activeThemeId: "midnight",
            themeDirectoryPath: "/tmp/themes",
            petDirectoryPath: "/tmp/pets",
            invalidThemeCount: 0,
            invalidPetCount: 0,
            themes: [
              {
                id: "midnight",
                name: "Midnight",
                version: "1",
                directoryPath: "/tmp/themes/midnight",
                compatibleTarget: true,
                lintWarningCount: 0,
              },
            ],
            pets: [
              {
                id: "orbit",
                name: "Orbit",
                description: "Tiny astronaut",
                directoryPath: "/tmp/pets/orbit",
                spritesheetName: "spritesheet.webp",
                spritesheetBytes: 1024,
              },
            ],
          }),
          getAppearanceThemePreview: vi.fn().mockResolvedValue(null),
          getAgentPetPreview: vi.fn().mockResolvedValue(null),
        },
      },
    });

    await renderWithI18n(<AgentsWorkspace />);
    const appearanceTab = screen.getByRole("tab", { name: /appearance/i });
    expect(appearanceTab).toBeEnabled();
    fireEvent.click(appearanceTab);

    expect(
      await screen.findByRole("heading", { name: /codex appearance/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /desktop skins/i }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: /^pets$/i })).toBeVisible();
    expect(screen.getByText("Midnight")).toBeVisible();
    expect(screen.getByText("Orbit")).toBeVisible();
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
    // The credential status appears both in the master list entry and in the
    // built-in detail pane; every rendered occurrence must be visible.
    const credentialStatuses = screen.getAllByText(/managed by agent/i);
    expect(credentialStatuses.length).toBeGreaterThan(0);
    for (const status of credentialStatuses) {
      expect(status).toBeVisible();
    }
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

  it("renders the usage banner on the overview when usage is supported", async () => {
    const claudeWithUsage = {
      ...agents[0],
      capabilities: {
        ...agents[0].capabilities,
        usage: { status: "supported" as const },
      },
    };
    useAgentStore.setState({ agents: [claudeWithUsage, agents[1]] });
    installWindowMocks({
      api: {
        agent: {
          getUsage: vi.fn().mockResolvedValue({
            agentId: "claude",
            adapter: "claude-oauth-v1",
            status: "ok",
            source: "provider",
            metrics: [
              {
                id: "fiveHour",
                label: "5-hour window",
                kind: "window",
                utilization: 42,
                resetsAt: Date.now() + 3_600_000,
              },
              {
                id: "sevenDay",
                label: "7-day window",
                kind: "window",
                utilization: 18,
                resetsAt: null,
              },
            ],
            plan: "claude-pro",
            fetchedAt: 1_700_000_000_000,
          }),
        },
      },
    });

    await renderWithI18n(<AgentsWorkspace />);

    expect(
      screen.queryByRole("tab", { name: /usage/i }),
    ).not.toBeInTheDocument();
    const usageBanner = await screen.findByRole("region", { name: "Usage" });
    expect(
      await within(usageBanner).findByRole("img", {
        name: "5-hour window: 58% remaining",
      }),
    ).toBeVisible();
    expect(
      within(usageBanner).getByRole("img", {
        name: "7-day window: 82% remaining",
      }),
    ).toBeVisible();
    expect(within(usageBanner).getByText("claude-pro")).toBeVisible();
  });

  it("does not render the usage banner or fetch usage when the capability is planned", async () => {
    await renderWithI18n(<AgentsWorkspace />);

    await screen.findByRole("tabpanel", { name: /overview/i });
    expect(
      screen.queryByRole("region", { name: "Usage" }),
    ).not.toBeInTheDocument();
    expect(window.api.agent.getUsage).not.toHaveBeenCalled();
  });

  it("enables only direct asset tabs backed by a configured path", async () => {
    useAgentStore.setState({ selectedAgentId: "cline" });

    await renderWithI18n(<AgentsWorkspace />);

    const skillsTab = screen.getByRole("tab", { name: /^skills$/i });
    expect(skillsTab).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^mcp$/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^rules$/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^plugins$/i })).toBeDisabled();

    fireEvent.click(skillsTab);
    expect(screen.getByRole("tabpanel", { name: /^skills$/i })).toBeVisible();
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
