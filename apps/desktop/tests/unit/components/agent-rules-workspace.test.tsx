import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ManagedAgentSummary,
  RuleFileContent,
  RuleFileDescriptor,
} from "@prompthub/shared/types";
import { AgentRulesWorkspace } from "../../../src/renderer/components/agent/AgentRulesWorkspace";
import { useRulesStore } from "../../../src/renderer/stores/rules.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const showToast = vi.fn();

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../../src/renderer/components/skill/SkillCodeEditor", () => ({
  SkillCodeEditor: ({
    ariaLabel,
    editable,
    onChange,
    value,
  }: {
    ariaLabel: string;
    editable: boolean;
    onChange: (value: string) => void;
    value: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      readOnly={!editable}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const claudeAgent: ManagedAgentSummary = {
  id: "claude",
  name: "Claude Code",
  icon: "claude",
  isCustom: false,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  status: "installed",
  paths: {
    root: "/Users/test/.claude-work",
    skills: "/Users/test/.claude-work/skills",
    rules: "/Users/test/.claude-work/CLAUDE.md",
    configFiles: [],
    configFileRelativePaths: [],
  },
  capabilities: {
    overview: { status: "supported" },
    provider: { status: "partial" },
    appearance: { status: "unsupported" },
    assets: { status: "partial" },
    configFiles: { status: "partial" },
    sessions: { status: "supported" },
    usage: { status: "supported" },
    maintenance: { status: "partial" },
  },
};

function descriptor(
  overrides: Partial<RuleFileDescriptor> = {},
): RuleFileDescriptor {
  return {
    id: "claude-global",
    platformId: "claude",
    platformName: "Claude Code",
    platformIcon: "claude",
    platformDescription: "Claude rules",
    name: "CLAUDE.md",
    description: "Claude global rules",
    path: "/Users/test/.claude-work/CLAUDE.md",
    exists: true,
    group: "assistant",
    ...overrides,
  };
}

function content(overrides: Partial<RuleFileContent> = {}): RuleFileContent {
  return {
    ...descriptor(overrides),
    content: "# Claude rules",
    versions: [],
    ...overrides,
  };
}

function resetRulesStore(): void {
  useRulesStore.setState({
    availableFiles: [],
    files: [],
    selectedRuleId: null,
    currentFile: null,
    conflictDialogRuleId: null,
    dismissedConflictRuleIds: [],
    searchQuery: "",
    draftContent: "",
    aiInstruction: "",
    aiSummary: null,
    isLoading: false,
    isSaving: false,
    isRewriting: false,
    error: null,
    hasLoadedFiles: false,
  });
}

describe("AgentRulesWorkspace", () => {
  beforeEach(() => {
    showToast.mockReset();
    resetRulesStore();
    useSettingsStore.setState({ disabledPlatformIds: [] });
  });

  it("selects by resolved path and reuses the complete Rules editor save flow", async () => {
    const selected = descriptor({
      id: "custom:claude-work",
      path: "/Users/test/.claude-work/CLAUDE.md",
    });
    const selectedContent = content({
      id: selected.id,
      path: selected.path,
    });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [
        descriptor({ path: "/Users/test/.claude/CLAUDE.md" }),
        selected,
      ],
      files: [descriptor({ path: "/Users/test/.claude/CLAUDE.md" }), selected],
    });
    const save = vi.fn().mockImplementation(
      async (
        _ruleId: string,
        nextContent: string,
      ): Promise<RuleFileContent> => ({
        ...selectedContent,
        content: nextContent,
        versions: [
          {
            id: "saved-1",
            savedAt: "2026-07-30T10:00:00.000Z",
            content: nextContent,
            source: "manual-save",
          },
        ],
      }),
    );
    const { api } = installWindowMocks({
      api: {
        rules: {
          read: vi.fn().mockResolvedValue(selectedContent),
          save,
        },
      },
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    const editor = await screen.findByRole("textbox", {
      name: "Rule Content",
    });
    expect(api.rules.read).toHaveBeenCalledWith("custom:claude-work");
    expect(editor).toHaveValue("# Claude rules");

    fireEvent.change(editor, { target: { value: "# Updated rules" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Save and overwrite file" }),
    );

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(
        "custom:claude-work",
        "# Updated rules",
      );
    });
    expect(showToast).toHaveBeenCalledWith("Saved successfully", "success");
  });

  it("does not render the previous Agent rule while the next file is loading", async () => {
    let resolveRead: ((value: RuleFileContent) => void) | undefined;
    const pendingRead = new Promise<RuleFileContent>((resolve) => {
      resolveRead = resolve;
    });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [descriptor()],
      files: [descriptor()],
      selectedRuleId: "codex-global",
      currentFile: content({
        id: "codex-global",
        platformId: "codex",
        platformName: "Codex",
        name: "AGENTS.md",
        path: "/Users/test/.codex/AGENTS.md",
        content: "# Previous Codex rules",
      }),
      draftContent: "# Previous Codex rules",
    });
    installWindowMocks({
      api: {
        rules: {
          read: vi.fn().mockReturnValue(pendingRead),
        },
      },
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      screen.queryByText("# Previous Codex rules"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Rule Content" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveRead?.(content());
      await pendingRead;
    });

    expect(
      await screen.findByRole("textbox", { name: "Rule Content" }),
    ).toHaveValue("# Claude rules");
  });

  it("performs at most one automatic forced scan when the descriptor is missing", async () => {
    const scan = vi.fn().mockResolvedValue([descriptor()]);
    const { api } = installWindowMocks({
      api: {
        rules: {
          scan,
          read: vi.fn().mockResolvedValue(content()),
        },
      },
    });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [],
      files: [],
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      await screen.findByRole("textbox", { name: "Rule Content" }),
    ).toHaveValue("# Claude rules");
    expect(scan).toHaveBeenCalledTimes(1);
    expect(api.rules.read).toHaveBeenCalledWith("claude-global");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it("asks before creating a declared missing rule and opens the empty editor after confirmation", async () => {
    const missing = descriptor({ exists: false });
    const created = content({ exists: true, content: "" });
    let resolveSave: ((value: RuleFileContent) => void) | undefined;
    const pendingSave = new Promise<RuleFileContent>((resolve) => {
      resolveSave = resolve;
    });
    const read = vi.fn();
    const save = vi.fn().mockReturnValue(pendingSave);
    installWindowMocks({
      api: {
        rules: {
          read,
          save,
        },
      },
    });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [missing],
      files: [],
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      screen.getByRole("heading", { name: "Create CLAUDE.md?" }),
    ).toBeVisible();
    expect(screen.getByText(missing.path)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Rule Content" })).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Create CLAUDE.md" }));

    expect(
      screen.getByRole("button", { name: "Creating CLAUDE.md..." }),
    ).toBeDisabled();
    await act(async () => {
      resolveSave?.(created);
      await pendingSave;
    });

    expect(
      await screen.findByRole("textbox", { name: "Rule Content" }),
    ).toHaveValue("");
    expect(save).toHaveBeenCalledWith("claude-global", "");
    expect(read).not.toHaveBeenCalled();
  });

  it("uses the Agent descriptor's canonical name instead of assuming AGENTS.md", async () => {
    const geminiAgent: ManagedAgentSummary = {
      ...claudeAgent,
      id: "gemini",
      name: "Gemini CLI",
      paths: {
        ...claudeAgent.paths,
        root: "/Users/test/.gemini",
        rules: "/Users/test/.gemini/GEMINI.md",
      },
    };
    const missingGemini = descriptor({
      id: "gemini-global",
      platformId: "gemini",
      platformName: "Gemini CLI",
      name: "GEMINI.md",
      path: "/Users/test/.gemini/GEMINI.md",
      exists: false,
    });
    const { api } = installWindowMocks();
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [missingGemini],
      files: [],
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={geminiAgent} />, {
        language: "en",
      });
    });

    expect(
      screen.getByRole("heading", { name: "Create GEMINI.md?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create GEMINI.md" }),
    ).toBeVisible();
    expect(screen.getByText(missingGemini.path)).toBeVisible();
    expect(api.rules.read).not.toHaveBeenCalled();
    expect(api.rules.save).not.toHaveBeenCalled();
  });

  it("keeps the missing-file prompt available after creation fails", async () => {
    const missing = descriptor({ exists: false });
    const save = vi.fn().mockRejectedValue(new Error("RULE_CREATE_FAILED"));
    installWindowMocks({ api: { rules: { save } } });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [missing],
      files: [],
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Create CLAUDE.md" }));

    expect(
      await screen.findByText(
        "The rules file could not be created. Try again.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create CLAUDE.md" }),
    ).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Rule Content" })).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("opens an existing empty rule without showing the creation prompt", async () => {
    const emptyRule = content({ content: "" });
    const read = vi.fn().mockResolvedValue(emptyRule);
    installWindowMocks({ api: { rules: { read } } });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [descriptor()],
      files: [descriptor()],
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      await screen.findByRole("textbox", { name: "Rule Content" }),
    ).toHaveValue("");
    expect(screen.queryByText("Create CLAUDE.md?")).toBeNull();
    expect(read).toHaveBeenCalledWith("claude-global");
  });

  it("keeps a missing rule scoped and retries only after an explicit action", async () => {
    const scan = vi.fn().mockResolvedValue([]);
    installWindowMocks({
      api: {
        rules: {
          scan,
        },
      },
    });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [],
      files: [],
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      await screen.findByText("No rules file was detected for this Agent."),
    ).toBeVisible();
    expect(scan).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(scan).toHaveBeenCalledTimes(2);
    });
  });

  it("loads the Rules inventory once when the shared store has not initialized", async () => {
    const list = vi.fn().mockResolvedValue([descriptor()]);
    const { api } = installWindowMocks({
      api: {
        rules: {
          list,
          read: vi.fn().mockResolvedValue(content()),
        },
      },
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      await screen.findByRole("textbox", { name: "Rule Content" }),
    ).toHaveValue("# Claude rules");
    expect(list).toHaveBeenCalledTimes(1);
    expect(api.rules.read).toHaveBeenCalledWith("claude-global");
  });

  it("shows a scoped read failure and retries the known descriptor without rescanning", async () => {
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [descriptor()],
      files: [descriptor()],
      selectedRuleId: "claude-global",
      currentFile: null,
      error: "RULE_READ_FAILED",
    });
    const read = vi.fn().mockResolvedValue(content());
    const scan = vi.fn();
    installWindowMocks({
      api: {
        rules: {
          read,
          scan,
        },
      },
    });

    await act(async () => {
      await renderWithI18n(<AgentRulesWorkspace agent={claudeAgent} />, {
        language: "en",
      });
    });

    expect(
      screen.getByText("Asset inventory could not be loaded."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("textbox", { name: "Rule Content" }),
    ).toHaveValue("# Claude rules");
    expect(read).toHaveBeenCalledTimes(1);
    expect(scan).not.toHaveBeenCalled();
  });

  it("supports custom platform fallback, Windows path normalization, and unavailable Agents", async () => {
    const customAgent: ManagedAgentSummary = {
      ...claudeAgent,
      id: "team-agent",
      name: "Team Agent",
      isCustom: true,
      paths: {
        ...claudeAgent.paths,
        rules: "C:\\Users\\Test\\.team\\AGENTS.md\\",
      },
    };
    const customDescriptor = descriptor({
      id: "custom:team-agent",
      platformId: "custom:team-agent",
      platformName: "Team Agent",
      name: "AGENTS.md",
      path: "c:/users/test/.team/agents.md",
    });
    const customContent = content({
      ...customDescriptor,
      content: "# Team rules",
    });
    useRulesStore.setState({
      hasLoadedFiles: true,
      availableFiles: [
        descriptor({
          id: "project:team",
          platformId: "workspace",
          path: customDescriptor.path,
        }),
        customDescriptor,
      ],
      files: [
        descriptor({
          id: "project:team",
          platformId: "workspace",
          path: customDescriptor.path,
        }),
        customDescriptor,
      ],
      selectedRuleId: customDescriptor.id,
      currentFile: customContent,
      draftContent: customContent.content,
    });
    installWindowMocks();

    const view = await renderWithI18n(
      <AgentRulesWorkspace agent={customAgent} />,
      { language: "en" },
    );

    expect(screen.getByRole("textbox", { name: "Rule Content" })).toHaveValue(
      "# Team rules",
    );

    view.rerender(
      <AgentRulesWorkspace
        agent={{
          ...customAgent,
          paths: {
            ...customAgent.paths,
            rules: "/different/custom/path/AGENTS.md",
          },
        }}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Rule Content" })).toHaveValue(
      "# Team rules",
    );

    view.rerender(
      <AgentRulesWorkspace
        agent={{
          ...customAgent,
          paths: { ...customAgent.paths, rules: undefined },
        }}
      />,
    );
    expect(screen.getByText("Not available")).toBeVisible();
  });
});
