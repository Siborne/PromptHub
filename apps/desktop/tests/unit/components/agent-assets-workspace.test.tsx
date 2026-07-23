import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentScannedSkill,
  ManagedAgentSummary,
  ScannedSkill,
  Skill,
} from "@prompthub/shared/types";
import { AgentAssetsWorkspace } from "../../../src/renderer/components/agent/AgentAssetsWorkspace";
import { useMcpStore } from "../../../src/renderer/stores/mcp.store";
import { usePluginStore } from "../../../src/renderer/stores/plugin.store";
import { useRulesStore } from "../../../src/renderer/stores/rules.store";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { useUIStore } from "../../../src/renderer/stores/ui.store";
import {
  createScannedSkillFixture,
  createSkillFixture,
} from "../../fixtures/skills";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const showToast = vi.fn();

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../../src/renderer/components/skill/SkillFullDetailPage", () => ({
  SkillFullDetailPage: ({
    agentContext,
    onBack,
  }: {
    agentContext?: {
      installMode: string;
      isManaged?: boolean;
      platformId: string;
      sourcePath: string;
    } | null;
    onBack?: () => void;
  }) => (
    <div data-testid="skill-full-detail-page">
      <span data-testid="detail-platform-id">{agentContext?.platformId}</span>
      <span data-testid="detail-source-path">{agentContext?.sourcePath}</span>
      <span data-testid="detail-install-mode">{agentContext?.installMode}</span>
      <span data-testid="detail-is-managed">
        {String(agentContext?.isManaged)}
      </span>
      <button type="button" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

vi.mock(
  "../../../src/renderer/components/skill/SkillLibraryImportModal",
  () => ({
    SkillLibraryImportModal: ({
      isOpen,
      title,
      fixedTargetDirs,
    }: {
      isOpen: boolean;
      title?: string;
      fixedTargetDirs?: string[];
    }) =>
      isOpen ? (
        <div data-testid="skill-library-import-modal">
          <span data-testid="import-modal-title">{title}</span>
          <span data-testid="import-modal-targets">
            {(fixedTargetDirs ?? []).join("|")}
          </span>
        </div>
      ) : null,
  }),
);

const claudeAgent: ManagedAgentSummary = {
  id: "claude",
  name: "Claude Code",
  icon: "Sparkles",
  isCustom: false,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  status: "installed",
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
    overview: { status: "supported" },
    provider: { status: "partial", reason: "model-config-only" },
    appearance: {
      status: "unsupported",
      reason: "appearance-adapter-unavailable",
    },
    assets: { status: "partial", reason: "asset-paths-only" },
    configFiles: { status: "partial", reason: "direct-file-editing" },
    sessions: { status: "supported" },
    usage: { status: "supported" },
    maintenance: { status: "partial", reason: "refresh-and-settings" },
  },
};

function createAgentSkill(
  overrides: Partial<AgentScannedSkill> & { localPath: string },
): AgentScannedSkill {
  return {
    ...createScannedSkillFixture({
      localPath: overrides.localPath,
      filePath: `${overrides.localPath}/SKILL.md`,
    }),
    installMode: "copy",
    ...overrides,
    platformSkillPath: overrides.platformSkillPath ?? overrides.localPath,
  };
}

function seedSkillScan(
  scannedSkills: AgentScannedSkill[],
  librarySkills: Skill[] = [
    createSkillFixture({ local_repo_path: "/Users/demo/skills/write" }),
  ],
) {
  useSkillStore.setState({
    skills: librarySkills,
    agentScanState: {
      claude: {
        result: {
          platform: null as never,
          skillsDir: "~/.claude/skills",
          scannedSkills,
        },
        isScanning: false,
      },
    },
  });
}

function seedStores() {
  seedSkillScan([
    createAgentSkill({ localPath: "/Users/demo/skills/write" }),
    createAgentSkill({
      name: "ext-one",
      localPath: "~/.claude/skills/ext-one",
    }),
  ]);
  useMcpStore.setState({
    library: {
      kind: "prompthub-mcp-library",
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      servers: [],
      bindings: [],
    },
    targetPresets: [
      {
        id: "preset-claude",
        target: "claude",
        scope: "global",
        label: "Claude Code",
        path: "~/.claude.json",
        platformId: "claude",
      },
    ],
    targetStatus: [
      {
        presetId: "preset-claude",
        path: "~/.claude.json",
        exists: true,
        serverNames: ["fs", "web"],
      },
    ],
  });
  useRulesStore.setState({
    hasLoadedFiles: true,
    files: [
      {
        id: "claude-global",
        platformId: "claude",
        platformName: "Claude Code",
        platformIcon: "Sparkles",
        platformDescription: "Global Claude rules",
        name: "CLAUDE.md",
        description: "Global Claude rules",
        path: "~/.claude/CLAUDE.md",
        exists: true,
        group: "assistant",
      },
    ],
  });
  usePluginStore.setState({
    library: {
      kind: "prompthub-plugin-library",
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      plugins: [],
    },
    targetMatrix: [
      {
        id: "claude",
        displayName: "Claude Code",
        status: "native",
        enabled: true,
        installedPlugins: [
          {
            id: "plugin-formatter",
            name: "formatter",
            displayName: "Formatter",
            version: "1.2.0",
            inventory: {
              skills: 0,
              mcpServers: 0,
              apps: 0,
              commands: 0,
              hooks: 0,
              agents: 0,
              assets: 0,
              docs: 0,
              lspServers: 0,
              scripts: 0,
            },
          },
        ],
      },
    ],
  });
}

function cardFor(name: string): Element {
  const card = screen.getByText(name).closest("article");
  if (!card) {
    throw new Error(`No skill card rendered for "${name}"`);
  }
  return card;
}

describe("AgentAssetsWorkspace", () => {
  beforeEach(() => {
    showToast.mockClear();
    installWindowMocks();
    seedStores();
    useUIStore.setState({ appModule: "agents", viewMode: "prompt" });
    useSkillStore.setState({
      storeView: "agents",
      selectedSkillId: null,
      scanAgentPlatformSkills: vi.fn().mockResolvedValue({
        platform: null,
        skillsDir: "~/.claude/skills",
        scannedSkills: [],
      }),
      importScannedSkills: vi.fn().mockResolvedValue({
        importedCount: 1,
        importedSkills: [],
        skipped: [],
        failed: [],
      }),
      loadDeployedStatus: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("renders the requested domain without a secondary assets menu", async () => {
    const view = await renderWithI18n(
      <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
    );

    expect(
      screen.queryByRole("navigation", { name: /^assets$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("write")).toBeVisible();
    expect(screen.getByText("ext-one")).toBeVisible();
    expect(screen.getByText("~/.claude/skills")).toBeVisible();

    view.rerender(<AgentAssetsWorkspace agent={claudeAgent} domain="mcp" />);
    expect(screen.getByText("fs")).toBeVisible();
    expect(screen.getByText("web")).toBeVisible();
    expect(screen.getAllByText("Configured")).toHaveLength(2);
    expect(screen.queryByText("ext-one")).not.toBeInTheDocument();
    expect(screen.getByText("~/.claude.json")).toBeVisible();

    view.rerender(<AgentAssetsWorkspace agent={claudeAgent} domain="rules" />);
    expect(screen.getByText("CLAUDE.md")).toBeVisible();

    view.rerender(
      <AgentAssetsWorkspace agent={claudeAgent} domain="plugins" />,
    );
    expect(screen.getByText("Formatter")).toBeVisible();
    expect(screen.getByText("1.2.0")).toBeVisible();
  });

  it("filters only the active domain through the toolbar search", async () => {
    await renderWithI18n(
      <AgentAssetsWorkspace agent={claudeAgent} domain="mcp" />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /search assets/i }), {
      target: { value: "web" },
    });

    expect(screen.getByText("web")).toBeVisible();
    expect(screen.queryByText("fs")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /search assets/i }), {
      target: { value: "" },
    });
    expect(screen.getByText("fs")).toBeVisible();
  });

  it("shows the unavailable state when a direct domain has no path", async () => {
    const limitedAgent: ManagedAgentSummary = {
      ...claudeAgent,
      paths: {
        root: "~/.claude",
        skills: "~/.claude/skills",
        mcp: "~/.claude.json",
        configFiles: [],
        configFileRelativePaths: [],
      },
    };

    await renderWithI18n(
      <AgentAssetsWorkspace agent={limitedAgent} domain="rules" />,
    );

    expect(screen.getByText("Not available")).toBeVisible();
    expect(screen.queryByText("ext-one")).not.toBeInTheDocument();
  });

  it("refreshes the active domain through its owning store loader", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    useMcpStore.setState({ load });

    await renderWithI18n(
      <AgentAssetsWorkspace agent={claudeAgent} domain="mcp" />,
    );
    expect(load).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /refresh current view/i }),
    );

    expect(load).toHaveBeenCalledTimes(1);
  });

  describe("skills domain cards", () => {
    it("renders badges for managed, external, symlink, copy and built-in cards", async () => {
      seedSkillScan([
        createAgentSkill({
          localPath: "/Users/demo/skills/write",
          tags: ["alpha", "beta", "gamma", "delta"],
        }),
        createAgentSkill({
          name: "ext-one",
          localPath: "~/.claude/skills/ext-one",
        }),
        createAgentSkill({
          name: "link-one",
          localPath: "~/.claude/skills/link-one",
          installMode: "symlink",
          isPromptHubManagedLink: true,
          symlinkTargetPath: "/managed/storage/link-one",
        }),
        createAgentSkill({
          name: "builtin-one",
          localPath: "~/.claude/skills/builtin-one",
          isPlatformBuiltin: true,
        }),
        createAgentSkill({
          name: "compatible-one",
          localPath: "~/.agents/skills/compatible-one",
          isReadOnlyDiscovery: true,
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      const managedCard = cardFor("write");
      expect(within(managedCard).getByText("In My Skills")).toBeVisible();
      expect(within(managedCard).getByText("Copy install")).toBeVisible();
      expect(within(managedCard).getByText("alpha")).toBeVisible();
      expect(within(managedCard).getByText("beta")).toBeVisible();
      expect(within(managedCard).getByText("gamma")).toBeVisible();
      expect(within(managedCard).queryByText("delta")).not.toBeInTheDocument();

      const externalCard = cardFor("ext-one");
      expect(within(externalCard).getByText("External install")).toBeVisible();
      expect(
        within(externalCard).queryByText("In My Skills"),
      ).not.toBeInTheDocument();

      const symlinkCard = cardFor("link-one");
      expect(within(symlinkCard).getByText("Symlink install")).toBeVisible();
      expect(
        within(symlinkCard).queryByText("External install"),
      ).not.toBeInTheDocument();

      const builtinCard = cardFor("builtin-one");
      expect(within(builtinCard).getByText("Built-in")).toBeVisible();
      expect(
        within(builtinCard).queryByRole("button", {
          name: /uninstall from agent/i,
        }),
      ).not.toBeInTheDocument();
      expect(
        within(externalCard).getByRole("button", {
          name: /uninstall from agent/i,
        }),
      ).toBeVisible();

      const compatibilityCard = cardFor("compatible-one");
      expect(
        within(compatibilityCard).getByText("Compatible source"),
      ).toBeVisible();
      expect(
        within(compatibilityCard).queryByRole("button", {
          name: /uninstall from agent/i,
        }),
      ).not.toBeInTheDocument();
    });

    it("falls back to the local path when a card has no description", async () => {
      seedSkillScan([
        createAgentSkill({
          name: "nodesc",
          localPath: "~/.claude/skills/nodesc",
          description: "",
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      expect(
        within(cardFor("nodesc")).getByText("~/.claude/skills/nodesc"),
      ).toBeVisible();
    });

    it("filters cards through the toolbar chips", async () => {
      seedSkillScan([
        createAgentSkill({ localPath: "/Users/demo/skills/write" }),
        createAgentSkill({
          name: "ext-one",
          localPath: "~/.claude/skills/ext-one",
        }),
        createAgentSkill({
          name: "link-one",
          localPath: "~/.claude/skills/link-one",
          installMode: "symlink",
          isPromptHubManagedLink: true,
          symlinkTargetPath: "/managed/storage/link-one",
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(screen.getByTestId("agent-skill-asset-filter-managed"));
      expect(screen.getByText("write")).toBeVisible();
      expect(screen.queryByText("ext-one")).not.toBeInTheDocument();
      expect(screen.queryByText("link-one")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("agent-skill-asset-filter-unmanaged"));
      expect(screen.queryByText("write")).not.toBeInTheDocument();
      expect(screen.getByText("ext-one")).toBeVisible();
      expect(screen.getByText("link-one")).toBeVisible();

      fireEvent.click(screen.getByTestId("agent-skill-asset-filter-copy"));
      expect(screen.getByText("write")).toBeVisible();
      expect(screen.queryByText("ext-one")).not.toBeInTheDocument();
      expect(screen.queryByText("link-one")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("agent-skill-asset-filter-symlink"));
      expect(screen.queryByText("write")).not.toBeInTheDocument();
      expect(screen.queryByText("ext-one")).not.toBeInTheDocument();
      expect(screen.getByText("link-one")).toBeVisible();

      fireEvent.click(screen.getByTestId("agent-skill-asset-filter-all"));
      expect(screen.getByText("write")).toBeVisible();
      expect(screen.getByText("ext-one")).toBeVisible();
      expect(screen.getByText("link-one")).toBeVisible();
    });

    it("imports an unmanaged card into My Skills and rescans the agent", async () => {
      const importScannedSkills = vi.fn().mockResolvedValue({
        importedCount: 1,
        importedSkills: [createSkillFixture()],
        skipped: [],
        failed: [],
      });
      const scanAgentPlatformSkills = vi.fn().mockResolvedValue({
        platform: null,
        skillsDir: "~/.claude/skills",
        scannedSkills: [],
      });
      const loadDeployedStatus = vi.fn().mockResolvedValue(undefined);
      useSkillStore.setState({
        importScannedSkills,
        scanAgentPlatformSkills,
        loadDeployedStatus,
      });
      seedSkillScan([
        createAgentSkill({
          name: "ext-one",
          localPath: "~/.claude/skills/ext-one",
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(
        within(cardFor("ext-one")).getByRole("button", {
          name: /import to my skills/i,
        }),
      );

      await waitFor(() => expect(importScannedSkills).toHaveBeenCalledTimes(1));
      const [importedSkills, userTags, importMode] = importScannedSkills.mock
        .calls[0] as [
        ScannedSkill[],
        Record<string, string[]> | undefined,
        string,
      ];
      expect(importedSkills).toHaveLength(1);
      expect(importedSkills[0]?.localPath).toBe("~/.claude/skills/ext-one");
      expect(userTags).toBeUndefined();
      expect(importMode).toBe("copy");
      await waitFor(() =>
        expect(scanAgentPlatformSkills).toHaveBeenCalledWith("claude"),
      );
      expect(loadDeployedStatus).toHaveBeenCalledWith({ force: true });
    });

    it("hydrates empty instructions from SKILL.md before importing", async () => {
      const readLocalFileByPath = vi
        .fn()
        .mockResolvedValue({ content: "# Hydrated body" });
      installWindowMocks({ api: { skill: { readLocalFileByPath } } });
      const importScannedSkills = vi.fn().mockResolvedValue({
        importedCount: 1,
        importedSkills: [createSkillFixture()],
        skipped: [],
        failed: [],
      });
      useSkillStore.setState({ importScannedSkills });
      seedSkillScan([
        createAgentSkill({
          name: "empty-body",
          localPath: "~/.claude/skills/empty-body",
          instructions: "",
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(
        within(cardFor("empty-body")).getByRole("button", {
          name: /import to my skills/i,
        }),
      );

      await waitFor(() => expect(importScannedSkills).toHaveBeenCalledTimes(1));
      expect(readLocalFileByPath).toHaveBeenCalledWith(
        "~/.claude/skills/empty-body",
        "SKILL.md",
      );
      const [importedSkills] = importScannedSkills.mock.calls[0] as [
        ScannedSkill[],
      ];
      expect(importedSkills[0]?.instructions).toBe("# Hydrated body");
    });

    it("uninstalls a non-built-in card after confirmation and rescans", async () => {
      const { api } = installWindowMocks();
      const scanAgentPlatformSkills = vi.fn().mockResolvedValue({
        platform: null,
        skillsDir: "~/.claude/skills",
        scannedSkills: [],
      });
      const loadDeployedStatus = vi.fn().mockResolvedValue(undefined);
      useSkillStore.setState({ scanAgentPlatformSkills, loadDeployedStatus });
      seedSkillScan([
        createAgentSkill({
          name: "ext-one",
          localPath: "~/.claude/skills/ext-one",
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(
        within(cardFor("ext-one")).getByRole("button", {
          name: /uninstall from agent/i,
        }),
      );

      expect(
        await screen.findByText(/Remove this skill folder/i),
      ).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Uninstall" }));

      await waitFor(() =>
        expect(api.skill.uninstallPlatformSkill).toHaveBeenCalledWith(
          "claude",
          "~/.claude/skills/ext-one",
        ),
      );
      await waitFor(() =>
        expect(scanAgentPlatformSkills).toHaveBeenCalledWith("claude"),
      );
      expect(loadDeployedStatus).toHaveBeenCalledWith({ force: true });
    });

    it("opens the card folder through the electron bridge", async () => {
      const { electron } = installWindowMocks();
      seedSkillScan([
        createAgentSkill({ localPath: "/Users/demo/skills/write" }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(
        within(cardFor("write")).getByRole("button", { name: /open folder/i }),
      );

      expect(electron.openPath).toHaveBeenCalledWith(
        "/Users/demo/skills/write",
      );
    });

    it("jumps to the Skills module when opening a managed card in My Skills", async () => {
      seedSkillScan([
        createAgentSkill({ localPath: "/Users/demo/skills/write" }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(
        within(cardFor("write")).getByRole("button", {
          name: /open in my skills/i,
        }),
      );

      expect(useSkillStore.getState().storeView).toBe("my-skills");
      expect(useSkillStore.getState().selectedSkillId).toBe("skill-write");
      expect(useUIStore.getState().appModule).toBe("skill");
    });

    it("opens the library install modal with the agent skills dir as fixed target", async () => {
      seedSkillScan([
        createAgentSkill({ localPath: "/Users/demo/skills/write" }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      expect(
        screen.queryByTestId("skill-library-import-modal"),
      ).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", { name: /install my skill/i }),
      );

      expect(screen.getByTestId("skill-library-import-modal")).toBeVisible();
      expect(screen.getByTestId("import-modal-title")).toHaveTextContent(
        "Install My Skill",
      );
      expect(screen.getByTestId("import-modal-targets")).toHaveTextContent(
        "~/.claude/skills",
      );
    });

    it("opens the full detail page on card click and returns to the grid", async () => {
      seedSkillScan([
        createAgentSkill({ localPath: "/Users/demo/skills/write" }),
        createAgentSkill({
          name: "ext-one",
          localPath: "~/.claude/skills/ext-one",
        }),
      ]);

      await renderWithI18n(
        <AgentAssetsWorkspace agent={claudeAgent} domain="skills" />,
      );

      fireEvent.click(
        within(cardFor("write")).getByRole("button", { name: /write/i }),
      );

      expect(await screen.findByTestId("skill-full-detail-page")).toBeVisible();
      expect(screen.getByTestId("detail-platform-id")).toHaveTextContent(
        "claude",
      );
      expect(screen.getByTestId("detail-source-path")).toHaveTextContent(
        "/Users/demo/skills/write",
      );
      expect(screen.getByTestId("detail-install-mode")).toHaveTextContent(
        "copy",
      );
      expect(screen.getByTestId("detail-is-managed")).toHaveTextContent("true");
      expect(
        screen.queryByTestId("agent-skill-asset-card"),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Back" }));

      expect(
        screen.queryByTestId("skill-full-detail-page"),
      ).not.toBeInTheDocument();
      expect(screen.getAllByTestId("agent-skill-asset-card")).toHaveLength(2);
    });
  });
});
