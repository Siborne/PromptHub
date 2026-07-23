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
      { language: "en" },
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

    const view = await renderWithI18n(<AgentSessionsPanel agent={agent} />);
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
});
