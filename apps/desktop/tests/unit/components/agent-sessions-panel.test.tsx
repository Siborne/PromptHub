import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSessionsPanel } from "../../../src/renderer/components/agent/AgentSessionsPanel";
import { ToastProvider } from "../../../src/renderer/components/ui/Toast";
import { copyTextToClipboard } from "../../../src/renderer/utils/clipboard";
import type {
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

vi.mock("../../../src/renderer/utils/clipboard", () => ({
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const agent = {
  id: "codex",
  name: "ChatGPT",
  icon: "codex",
  isCustom: false,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  launchable: true,
  status: "installed",
  paths: { root: "/Users/test/.codex" },
  capabilities: {},
} as ManagedAgentSummary;

function metadata(index: number): AgentSessionMetadata {
  return {
    id: `session-${index}`,
    title: `Session ${index}`,
    projectLabel: "PromptHub",
    projectPath: "/workspace/PromptHub",
    createdAt: index,
    updatedAt: index,
    model: null,
    messageCount: 120,
    sourcePath: null,
    resume: null,
  };
}

function entry(index: number): AgentSessionEntry {
  return {
    id: `entry-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    timestamp: index,
    text: `Message ${index}`,
  };
}

describe("AgentSessionsPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(copyTextToClipboard).mockClear();
  });

  it("pages metadata and provides fast transcript pagination", async () => {
    const allSessions = Array.from({ length: 120 }, (_, index) =>
      metadata(index),
    );
    const listSessions = vi.fn(
      async (_agentId: string, limit: number, offset = 0) => ({
        agentId: "codex",
        adapter: "codex-rollout-jsonl-v1",
        sessions: allSessions.slice(offset, offset + limit),
        total: allSessions.length,
        hasMore: offset + limit < allSessions.length,
      }),
    );
    const readSession = vi.fn(
      async (
        _agentId: string,
        _sessionId: string,
        options?: { cursor?: string },
      ) => ({
        agentId: "codex",
        adapter: "codex-rollout-jsonl-v1",
        sessionId: "session-0",
        entries: options?.cursor
          ? Array.from({ length: 40 }, (_, index) => entry(index + 80))
          : Array.from({ length: 80 }, (_, index) => entry(index)),
        parseErrors: 0,
        truncated: !options?.cursor,
        nextCursor: options?.cursor ? null : "cursor-page-2",
      }),
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions,
          readSession,
        },
      },
    });

    await renderWithI18n(<AgentSessionsPanel agent={agent} />, {
      language: "en",
      settleAsyncEffects: true,
    });

    expect(
      await screen.findByRole("button", { name: /Session 0/ }),
    ).toBeVisible();
    expect(listSessions).toHaveBeenNthCalledWith(1, "codex", 50, 0);
    expect(screen.getByText("50 / 120")).toBeVisible();
    expect(await screen.findByText("Message 19")).toBeVisible();
    expect(screen.queryByText("Message 20")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("conversation-transcript-pagination"),
    ).toHaveTextContent("Page 1 of 4+");
    expect(screen.queryByText(/bounded preview/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Session 0/ })).toHaveStyle({
      contentVisibility: "auto",
    });
    const selectedSessionButton = screen.getByRole("button", {
      name: /Session 0/,
    });
    expect(selectedSessionButton).toHaveClass("text-foreground");
    expect(selectedSessionButton).not.toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );

    fireEvent.click(screen.getByRole("button", { name: "Message page 4" }));
    expect(await screen.findByText("Message 79")).toBeVisible();
    expect(screen.queryByText("Message 59")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next message page" }));
    expect(await screen.findByText("Message 99")).toBeVisible();
    expect(screen.queryByText("Message 100")).not.toBeInTheDocument();
    expect(readSession).toHaveBeenLastCalledWith("codex", "session-0", {
      cursor: "cursor-page-2",
      limit: 80,
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more sessions" }));
    await waitFor(() =>
      expect(listSessions).toHaveBeenNthCalledWith(2, "codex", 50, 50),
    );
    expect(await screen.findByText("Session 99")).toBeVisible();
    expect(screen.getByText("100 / 120")).toBeVisible();
  });

  it("skips duplicate transcript cursor pages instead of showing an empty page", async () => {
    const firstPageEntries = Array.from({ length: 80 }, (_, index) =>
      entry(index),
    );
    const finalPageEntries = Array.from({ length: 20 }, (_, index) => ({
      ...entry(index + 80),
      role: "assistant" as const,
    }));
    const readSession = vi.fn(
      async (
        _agentId: string,
        _sessionId: string,
        options?: { cursor?: string },
      ) => {
        if (!options?.cursor) {
          return {
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessionId: "session-0",
            entries: firstPageEntries,
            parseErrors: 0,
            truncated: false,
            nextCursor: "duplicate-page",
          };
        }
        if (options.cursor === "duplicate-page") {
          return {
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessionId: "session-0",
            entries: firstPageEntries,
            parseErrors: 0,
            truncated: false,
            nextCursor: "final-page",
          };
        }
        return {
          agentId: "codex",
          adapter: "codex-rollout-jsonl-v1",
          sessionId: "session-0",
          entries: finalPageEntries,
          parseErrors: 0,
          truncated: false,
          nextCursor: null,
        };
      },
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessions: [metadata(0)],
            total: 1,
            hasMore: false,
          }),
          readSession,
        },
      },
    });

    await renderWithI18n(<AgentSessionsPanel agent={agent} />, {
      language: "en",
      settleAsyncEffects: true,
    });

    await screen.findByText("Message 0");
    fireEvent.click(screen.getByRole("button", { name: "Message page 4" }));
    await screen.findByText("Message 79");
    fireEvent.click(screen.getByRole("button", { name: "Next message page" }));

    await waitFor(() => {
      expect(readSession).toHaveBeenCalledWith("codex", "session-0", {
        cursor: "duplicate-page",
        limit: 80,
      });
      expect(readSession).toHaveBeenCalledWith("codex", "session-0", {
        cursor: "final-page",
        limit: 80,
      });
      expect(screen.getByTestId("conversation-transcript")).toHaveTextContent(
        "Message 99",
      );
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    });
  });

  it("clamps pagination when a native cursor stops advancing", async () => {
    const firstPageEntries = Array.from({ length: 80 }, (_, index) =>
      entry(index),
    );
    const readSession = vi.fn(
      async (
        _agentId: string,
        _sessionId: string,
        _options?: { cursor?: string },
      ) => ({
        agentId: "codex",
        adapter: "codex-rollout-jsonl-v1",
        sessionId: "session-0",
        entries: firstPageEntries,
        parseErrors: 0,
        truncated: false,
        nextCursor: "stuck-page",
      }),
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessions: [metadata(0)],
            total: 1,
            hasMore: false,
          }),
          readSession,
        },
      },
    });

    await renderWithI18n(<AgentSessionsPanel agent={agent} />, {
      language: "en",
      settleAsyncEffects: true,
    });

    await screen.findByText("Message 0");
    fireEvent.click(screen.getByRole("button", { name: "Message page 4" }));
    await screen.findByText("Message 79");
    fireEvent.click(screen.getByRole("button", { name: "Next message page" }));

    await waitFor(() => {
      expect(readSession).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Page 4 of 4")).toBeInTheDocument();
      expect(screen.getByTestId("conversation-transcript")).toHaveTextContent(
        "Message 79",
      );
    });
  });

  it("resumes natively, previews cross-Agent continuation, and exports history", async () => {
    const session = {
      ...metadata(1),
      resume: {
        executable: "codex",
        args: ["resume", "session-1"],
        cwd: "/workspace/PromptHub",
      },
    };
    const resumeConversation = vi.fn().mockResolvedValue({
      status: "launched",
      mode: "native-resume",
    });
    const handoffPreview = {
      sourceAgentId: "codex",
      sourceSessionId: "session-1",
      sourceTitle: "Session 1",
      targetAgentId: "claude",
      projectId: "project-1",
      projectPath: "/workspace/PromptHub",
      previewToken: "00000000-0000-4000-8000-000000000001",
      payload: "# Portable handoff\n\nContinue the updater fix.",
      payloadDigest: `sha256:${"a".repeat(64)}`,
      transport: "direct",
      cliCommand:
        "cd '/workspace/PromptHub' && claude '# Portable handoff\n\nContinue the updater fix.'",
    };
    const previewConversationHandoff = vi
      .fn()
      .mockResolvedValue(handoffPreview);
    const continueConversationInAgent = vi.fn().mockResolvedValue({
      status: "launched",
      mode: "cross-agent",
    });
    const exportConversation = vi.fn().mockResolvedValue({
      canceled: false,
      filePath: "/tmp/session.md",
    });
    installWindowMocks({
      api: {
        agent: {
          listSessions: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessions: [session],
            total: 1,
            hasMore: false,
          }),
          readSession: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessionId: "session-1",
            entries: [
              entry(0),
              entry(1),
              { ...entry(2), role: "system", text: "System context" },
              { ...entry(3), role: "tool", text: "Tool result" },
            ],
            parseErrors: 0,
            truncated: false,
          }),
          listConversationMetadata: vi.fn().mockResolvedValue([]),
          resumeConversation,
          previewConversationHandoff,
          continueConversationInAgent,
          exportConversation,
        },
      },
    });
    const claude = {
      ...agent,
      id: "claude",
      name: "Claude Code",
    } as ManagedAgentSummary;
    const antigravity = {
      ...agent,
      id: "antigravity",
      name: "Antigravity",
      launchable: true,
    } as ManagedAgentSummary;
    const copilot = {
      ...agent,
      id: "copilot",
      name: "GitHub Copilot",
      launchable: false,
    } as ManagedAgentSummary;

    await renderWithI18n(
      <ToastProvider>
        <AgentSessionsPanel
          agent={agent}
          agents={[agent, claude, antigravity, copilot]}
          projects={[
            {
              id: "project-1",
              name: "PromptHub",
              rootPath: "/workspace/PromptHub",
              scanPaths: [],
              createdAt: 1,
              updatedAt: 1,
            },
          ]}
        />
      </ToastProvider>,
      { language: "en", settleAsyncEffects: true },
    );

    expect(screen.getByLabelText("Filter by project")).toHaveAttribute(
      "aria-haspopup",
      "listbox",
    );
    expect(screen.getByLabelText("Conversation status")).toHaveAttribute(
      "aria-haspopup",
      "listbox",
    );
    expect(
      document.querySelector('select[aria-label="Filter by project"]'),
    ).toBeNull();
    expect(
      document.querySelector('select[aria-label="Conversation status"]'),
    ).toBeNull();
    const primaryActions = screen.getByTestId("conversation-primary-actions");
    expect(primaryActions.querySelectorAll("button")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Continue in ChatGPT" }),
    ).toHaveClass("h-9", "bg-primary");
    expect(
      screen
        .getByRole("button", { name: "Continue in ChatGPT" })
        .querySelector(".lucide-square-terminal"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Continue elsewhere" }),
    ).toHaveClass("h-9");
    expect(
      screen.getByRole("button", { name: "Export conversation" }),
    ).toHaveClass("h-9", "w-9");
    const toolbar = screen.getByTestId("conversation-continuation-toolbar");
    expect(toolbar).not.toHaveClass("rounded-xl", "border");
    expect(
      screen.queryByLabelText("Continue with Agent"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByTestId("conversation-message-entry-0"),
    ).toHaveClass("flex", "flex-row-reverse");
    expect(screen.getByTestId("conversation-transcript")).toHaveClass(
      "space-y-2.5",
      "py-4",
    );
    expect(screen.queryByText("/workspace/PromptHub")).not.toBeInTheDocument();
    expect(screen.getByTestId("conversation-avatar-entry-0")).toHaveClass(
      "rounded-full",
    );
    expect(screen.getByTestId("conversation-bubble-entry-0")).toHaveClass(
      "rounded-2xl",
      "bg-primary",
    );
    expect(
      screen
        .getByTestId("conversation-bubble-entry-0")
        .querySelector(".agent-conversation-markdown"),
    ).not.toHaveClass("mt-2");
    expect(screen.getByTestId("conversation-message-entry-1")).toHaveClass(
      "flex",
    );
    expect(screen.getByTestId("conversation-avatar-entry-1")).toHaveClass(
      "rounded-full",
    );
    expect(screen.getByTestId("conversation-bubble-entry-1")).toHaveClass(
      "rounded-2xl",
      "bg-white",
    );
    expect(screen.getByTestId("conversation-message-entry-2")).toHaveClass(
      "mx-auto",
      "rounded-2xl",
      "bg-white",
    );
    expect(
      screen.getByTestId("conversation-message-entry-2").querySelector(".mt-1"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByTestId("conversation-message-entry-2")
        .querySelector(".agent-conversation-markdown"),
    ).not.toHaveClass("mt-2");
    expect(screen.getByTestId("conversation-message-entry-3")).toHaveClass(
      "mx-auto",
      "rounded-2xl",
      "bg-white",
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Continue in ChatGPT" }),
    );
    await waitFor(() =>
      expect(resumeConversation).toHaveBeenCalledWith({
        agentId: "codex",
        sessionId: "session-1",
      }),
    );
    expect(
      await screen.findByText("Opened ChatGPT in Terminal."),
    ).toBeVisible();
    expect(
      screen.getByText("Opened ChatGPT in Terminal.").closest("section"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue elsewhere" }));
    expect(await screen.findByText("Continue in another Agent")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Continue with Agent"));
    expect(
      screen.getByRole("option", { name: "Antigravity" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "GitHub Copilot" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Claude Code" }));
    fireEvent.click(screen.getByLabelText("Project for continuation"));
    fireEvent.click(
      screen
        .getAllByRole("option", { name: "PromptHub" })
        .find(
          (option) =>
            option.tagName === "BUTTON" &&
            option.getAttribute("aria-selected") === "true",
        )!,
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview handoff" }));
    expect(await screen.findByText("Review handoff context")).toBeVisible();
    expect(screen.getByText(/Continue the updater fix/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Copy CLI command" }));
    await waitFor(() =>
      expect(copyTextToClipboard).toHaveBeenCalledWith(
        "cd '/workspace/PromptHub' && claude '# Portable handoff\n\nContinue the updater fix.'",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Continue in Claude Code" }),
    );
    await waitFor(() =>
      expect(continueConversationInAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAgentId: "claude",
          confirmedPayloadDigest: `sha256:${"a".repeat(64)}`,
        }),
      ),
    );
    expect(
      await screen.findByText("Started a new conversation in Claude Code."),
    ).toBeVisible();

    previewConversationHandoff.mockResolvedValueOnce({
      ...handoffPreview,
      targetAgentId: "antigravity",
      transport: "launch",
      cliCommand: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue elsewhere" }));
    fireEvent.click(screen.getByLabelText("Continue with Agent"));
    fireEvent.click(screen.getByRole("option", { name: "Antigravity" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview handoff" }));
    expect(
      await screen.findByText(
        "PromptHub will copy the handoff context and open Antigravity. Paste it to continue in the selected project.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy handoff context" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Copy context and open Antigravity" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy handoff context" }),
    );
    await waitFor(() =>
      expect(copyTextToClipboard).toHaveBeenLastCalledWith(
        handoffPreview.payload,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy context and open Antigravity" }),
    );
    await waitFor(() =>
      expect(continueConversationInAgent).toHaveBeenLastCalledWith(
        expect.objectContaining({ targetAgentId: "antigravity" }),
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Export conversation" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Markdown" }));
    await waitFor(() =>
      expect(exportConversation).toHaveBeenCalledWith({
        agentId: "codex",
        sessionId: "session-1",
        format: "markdown",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export conversation" }),
      ).toBeEnabled(),
    );
    expect(await screen.findByText("Conversation exported.")).toBeVisible();
  });

  it("edits PromptHub metadata and soft-removes a native conversation", async () => {
    const current = metadata(2);
    const updateConversationMetadata = vi.fn().mockResolvedValue({
      id: "metadata-2",
      agentId: "codex",
      sessionId: current.id,
      title: "Renamed conversation",
      projectId: null,
      projectPath: current.projectPath,
      tags: ["release"],
      note: "Keep this context",
      favorite: false,
      archivedAt: null,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 2,
    });
    const deleteConversation = vi.fn().mockResolvedValue({
      ...(await updateConversationMetadata({})),
      deletedAt: 3,
    });
    updateConversationMetadata.mockClear();
    installWindowMocks({
      api: {
        agent: {
          listSessions: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessions: [current],
            total: 1,
            hasMore: false,
          }),
          readSession: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessionId: current.id,
            entries: [],
            parseErrors: 0,
            truncated: false,
          }),
          listConversationMetadata: vi.fn().mockResolvedValue([]),
          resumeConversation: vi.fn(),
          updateConversationMetadata,
          deleteConversation,
          exportConversation: vi.fn(),
        },
      },
    });

    await renderWithI18n(
      <ToastProvider>
        <AgentSessionsPanel agent={agent} />
      </ToastProvider>,
      {
        language: "en",
        settleAsyncEffects: true,
      },
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "More conversation actions",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit details" }));
    expect(screen.getByRole("dialog")).toHaveClass(
      "app-wallpaper-panel-strong",
    );
    expect(
      screen.getByText(
        "Archiving hides this conversation from Active. The native transcript stays untouched and can be found in Archived.",
      ),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Renamed conversation" },
    });
    fireEvent.change(screen.getByLabelText("Tags (comma separated)"), {
      target: { value: "release" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Keep this context" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Archive in PromptHub" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(updateConversationMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Renamed conversation",
          tags: ["release"],
          note: "Keep this context",
          archived: true,
        }),
      ),
    );
    expect((await screen.findAllByText("Renamed conversation")).length).toBe(1);
    fireEvent.click(
      screen.getByRole("button", { name: "More conversation actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Remove from history" }),
    );
    await waitFor(() =>
      expect(deleteConversation).toHaveBeenCalledWith({
        agentId: "codex",
        sessionId: current.id,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Renamed conversation/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("explains a successful native-source empty result", async () => {
    installWindowMocks({
      api: {
        agent: {
          listSessions: vi.fn().mockResolvedValue({
            agentId: "opencode",
            adapter: "opencode-cli-v1",
            sessions: [],
            total: 0,
            hasMore: false,
          }),
        },
      },
    });

    await renderWithI18n(
      <AgentSessionsPanel
        agent={{ ...agent, id: "opencode", name: "OpenCode" }}
      />,
      { language: "en", settleAsyncEffects: true },
    );

    expect(await screen.findByText("No sessions found.")).toBeVisible();
    expect(
      screen.getByText(/OpenCode's native local history returned no sessions/i),
    ).toBeVisible();
  });

  it("ignores a metadata page that resolves after the selected Agent changes", async () => {
    let resolvePendingPage: ((value: AgentSessionListResult) => void) | null =
      null;
    const pageResult = (
      sessions: AgentSessionMetadata[],
      hasMore: boolean,
    ): AgentSessionListResult => ({
      agentId: "codex",
      adapter: "codex-rollout-jsonl-v1",
      sessions,
      total: 51,
      hasMore,
    });
    const listSessions = vi.fn(
      async (agentId: string, limit: number, offset = 0) => {
        if (agentId === "opencode") {
          return {
            ...pageResult([], false),
            agentId,
            adapter: "opencode-cli-v1",
          };
        }
        if (offset === 0) {
          return pageResult(
            Array.from({ length: limit }, (_, index) => metadata(index)),
            true,
          );
        }
        return new Promise<AgentSessionListResult>((resolve) => {
          resolvePendingPage = resolve;
        });
      },
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions,
          readSession: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessionId: "session-0",
            entries: [],
            parseErrors: 0,
            truncated: false,
          }),
        },
      },
    });

    const view = await renderWithI18n(<AgentSessionsPanel agent={agent} />, {
      settleAsyncEffects: true,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Load more sessions" }),
    );
    await waitFor(() => expect(resolvePendingPage).not.toBeNull());
    view.rerender(
      <AgentSessionsPanel
        agent={{ ...agent, id: "opencode", name: "OpenCode" }}
      />,
    );
    expect(await screen.findByText("No sessions found.")).toBeVisible();
    await act(async () => {
      resolvePendingPage?.(pageResult([metadata(50)], false));
    });

    expect(screen.queryByText("Session 50")).not.toBeInTheDocument();
  });

  it("requires explicit opt-in and exposes scoped progress cancellation", async () => {
    let progressListener:
      | ((progress: {
          agentId: string;
          requestId: string;
          processed: number;
          total: number;
        }) => void)
      | null = null;
    let resolveRefresh:
      | ((value: {
          supported: boolean;
          enabled: boolean;
          lastStatus: "ok";
          lastScannedAt: number;
          lastErrorCode: null;
        }) => void)
      | null = null;
    const setSessionIndexEnabled = vi.fn().mockResolvedValue({
      supported: true,
      enabled: true,
      lastStatus: "idle",
      lastScannedAt: null,
      lastErrorCode: null,
    });
    const refreshSessionIndex = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const cancelSessionIndex = vi.fn().mockResolvedValue(true);
    installWindowMocks({
      api: {
        agent: {
          getSessionIndexState: vi.fn().mockResolvedValue({
            supported: true,
            enabled: false,
            lastStatus: null,
            lastScannedAt: null,
            lastErrorCode: null,
          }),
          setSessionIndexEnabled,
          refreshSessionIndex,
          cancelSessionIndex,
          onSessionIndexProgress: vi.fn((listener) => {
            progressListener = listener;
            return () => {
              progressListener = null;
            };
          }),
          listSessions: vi.fn().mockResolvedValue({
            agentId: "claude",
            adapter: "claude-jsonl-v1",
            sessions: [],
            total: 0,
            hasMore: false,
          }),
        },
      },
    });

    await renderWithI18n(
      <AgentSessionsPanel
        agent={{ ...agent, id: "claude", name: "Claude Code" }}
      />,
      { language: "en", settleAsyncEffects: true },
    );
    const toggle = await screen.findByRole("switch", {
      name: "Enable local session indexing",
    });
    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText(
        "Caches redacted session metadata locally to make search and paging faster. Transcript text stays in the Agent's files and is read only when opened.",
      ),
    ).toBeVisible();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(setSessionIndexEnabled).toHaveBeenCalledWith({
        agentId: "claude",
        enabled: true,
      }),
    );
    await waitFor(() => expect(refreshSessionIndex).toHaveBeenCalled());
    const request = refreshSessionIndex.mock.calls[0]![0];
    act(() => {
      progressListener?.({
        agentId: "claude",
        requestId: request.requestId,
        processed: 1,
        total: 3,
      });
    });
    expect(await screen.findByText("Indexing 1 / 3")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel session indexing" }),
    );
    expect(cancelSessionIndex).toHaveBeenCalledWith({
      requestId: request.requestId,
    });

    await act(async () => {
      resolveRefresh?.({
        supported: true,
        enabled: true,
        lastStatus: "ok",
        lastScannedAt: 100,
        lastErrorCode: null,
      });
    });
  });

  it("debounces indexed search through the main-process list contract", async () => {
    const listSessions = vi.fn(
      async (
        _agentId: string,
        _limit: number,
        _offset: number,
        search?: string,
      ) => ({
        agentId: "gemini",
        adapter: "gemini-json-v1",
        sessions: search === "review" ? [metadata(7)] : [],
        total: search === "review" ? 1 : 0,
        hasMore: false,
      }),
    );
    installWindowMocks({
      api: {
        agent: {
          getSessionIndexState: vi.fn().mockResolvedValue({
            supported: true,
            enabled: true,
            lastStatus: "ok",
            lastScannedAt: 100,
            lastErrorCode: null,
          }),
          listSessions,
          readSession: vi.fn().mockResolvedValue({
            agentId: "gemini",
            adapter: "gemini-json-v1",
            sessionId: "session-7",
            entries: [],
            parseErrors: 0,
            truncated: false,
          }),
        },
      },
    });

    await renderWithI18n(
      <AgentSessionsPanel
        agent={{ ...agent, id: "gemini", name: "Gemini CLI" }}
      />,
      { language: "en", settleAsyncEffects: true },
    );
    const search = await screen.findByRole("textbox", {
      name: "Search sessions",
    });
    fireEvent.change(search, { target: { value: "review" } });
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith("gemini", 50, 0, "review"),
    );
    expect(
      await screen.findByRole("button", { name: /Session 7/ }),
    ).toBeVisible();
  });

  it("keeps Copilot matches found only in visible turn text", async () => {
    const listSessions = vi.fn(
      async (
        _agentId: string,
        _limit: number,
        _offset: number,
        _search?: string,
      ) => ({
        agentId: "copilot",
        adapter: "copilot-session-store-v1",
        sessions: [metadata(1)],
        total: 1,
        hasMore: false,
      }),
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions,
          readSession: vi.fn().mockResolvedValue({
            agentId: "copilot",
            adapter: "copilot-session-store-v1",
            sessionId: "session-1",
            entries: [],
            parseErrors: 0,
            truncated: false,
          }),
        },
      },
    });

    await renderWithI18n(
      <AgentSessionsPanel
        agent={{ ...agent, id: "copilot", name: "GitHub Copilot" }}
      />,
      { language: "en", settleAsyncEffects: true },
    );
    const search = await screen.findByRole("textbox", {
      name: "Search sessions",
    });
    fireEvent.change(search, { target: { value: "private" } });
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith(
        "copilot",
        50,
        0,
        "private",
      ),
    );
    expect(
      await screen.findByRole("button", { name: /Session 1/ }),
    ).toBeVisible();
  });

  it("keeps Cline matches found only in visible turn text", async () => {
    const listSessions = vi.fn(
      async (
        _agentId: string,
        _limit: number,
        _offset: number,
        _search?: string,
      ) => ({
        agentId: "cline",
        adapter: "cline-session-snapshot-v1",
        sessions: [metadata(1)],
        total: 1,
        hasMore: false,
      }),
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions,
          readSession: vi.fn().mockResolvedValue({
            agentId: "cline",
            adapter: "cline-session-snapshot-v1",
            sessionId: "session-1",
            entries: [],
            parseErrors: 0,
            truncated: false,
          }),
        },
      },
    });

    await renderWithI18n(
      <AgentSessionsPanel agent={{ ...agent, id: "cline", name: "Cline" }} />,
      { language: "en", settleAsyncEffects: true },
    );
    const search = await screen.findByRole("textbox", {
      name: "Search sessions",
    });
    fireEvent.change(search, { target: { value: "private" } });
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith("cline", 50, 0, "private"),
    );
    expect(
      await screen.findByRole("button", { name: /Session 1/ }),
    ).toBeVisible();
  });

  it("keeps Cursor matches found only in visible turn text", async () => {
    const listSessions = vi.fn(
      async (
        _agentId: string,
        _limit: number,
        _offset: number,
        _search?: string,
      ) => ({
        agentId: "cursor",
        adapter: "cursor-agent-transcript-v1",
        sessions: [metadata(1)],
        total: 1,
        hasMore: false,
      }),
    );
    installWindowMocks({
      api: {
        agent: {
          listSessions,
          readSession: vi.fn().mockResolvedValue({
            agentId: "cursor",
            adapter: "cursor-agent-transcript-v1",
            sessionId: "session-1",
            entries: [],
            parseErrors: 0,
            truncated: false,
          }),
        },
      },
    });

    await renderWithI18n(
      <AgentSessionsPanel agent={{ ...agent, id: "cursor", name: "Cursor" }} />,
      { language: "en", settleAsyncEffects: true },
    );
    const search = await screen.findByRole("textbox", {
      name: "Search sessions",
    });
    fireEvent.change(search, { target: { value: "private" } });
    await waitFor(() =>
      expect(listSessions).toHaveBeenLastCalledWith("cursor", 50, 0, "private"),
    );
    expect(
      await screen.findByRole("button", { name: /Session 1/ }),
    ).toBeVisible();
  });
});
