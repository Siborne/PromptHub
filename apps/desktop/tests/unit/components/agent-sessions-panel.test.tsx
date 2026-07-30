import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSessionsPanel } from "../../../src/renderer/components/agent/AgentSessionsPanel";
import type {
  AgentSessionEntry,
  AgentSessionListResult,
  AgentSessionMetadata,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

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
  });

  it("pages metadata and progressively mounts a long transcript", async () => {
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
    installWindowMocks({
      api: {
        agent: {
          listSessions,
          readSession: vi.fn().mockResolvedValue({
            agentId: "codex",
            adapter: "codex-rollout-jsonl-v1",
            sessionId: "session-0",
            entries: Array.from({ length: 120 }, (_, index) => entry(index)),
            parseErrors: 0,
            truncated: true,
          }),
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
    expect(await screen.findByText("Message 79")).toBeVisible();
    expect(screen.queryByText("Message 80")).not.toBeInTheDocument();
    expect(screen.getByText(/bounded preview/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /Session 0/ })).toHaveStyle({
      contentVisibility: "auto",
    });

    fireEvent.click(screen.getByRole("button", { name: "Show more messages" }));
    expect(await screen.findByText("Message 119")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Load more sessions" }));
    await waitFor(() =>
      expect(listSessions).toHaveBeenNthCalledWith(2, "codex", 50, 50),
    );
    expect(await screen.findByText("Session 99")).toBeVisible();
    expect(screen.getByText("100 / 120")).toBeVisible();
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
});
