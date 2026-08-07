import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentUsageQuota } from "@prompthub/shared/types";
import { AgentUsagePopover } from "../../../src/renderer/components/agent/AgentUsagePopover";
import {
  AGENT_USAGE_POPOVER_AGENTS,
  formatAgentUsagePlan,
  getPrimaryUsageMetric,
  getRemainingPercent,
  loadAgentUsageBatch,
} from "../../../src/renderer/components/agent/agent-usage-popover-model";
import { renderWithI18n as renderWithI18nBase } from "../../helpers/i18n";

function renderWithI18n(ui: ReactElement) {
  return renderWithI18nBase(ui, { settleAsyncEffects: true });
}

function quota(
  agentId: string,
  overrides: Partial<AgentUsageQuota> = {},
): AgentUsageQuota {
  return {
    agentId,
    adapter: `${agentId}-test`,
    status: "ok",
    source: "provider",
    plan: "pro",
    fetchedAt: 1_800_000_000_000,
    metrics: [
      {
        id: "weekly",
        label: "Weekly quota",
        kind: "window",
        utilization: 66,
        resetsAt: 1_800_086_400_000,
      },
      {
        id: "fiveHour",
        label: "5-hour window",
        kind: "window",
        utilization: 20,
        resetsAt: 1_800_007_200_000,
      },
    ],
    ...overrides,
  };
}

describe("Agent usage popover", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sanitizes failed adapters and clamps provider percentages", async () => {
    const getUsage = vi.fn(async () => {
      throw new Error("private provider failure");
    });
    const items = await loadAgentUsageBatch({ getUsage });

    expect(items).toHaveLength(6);
    expect(items.every((item) => item.status === "unavailable")).toBe(true);
    expect(getUsage).toHaveBeenCalledWith("claude", { forceRefresh: false });
    expect(JSON.stringify(items)).not.toContain("private provider failure");
    expect(getRemainingPercent(Number.NaN)).toBe(0);
    expect(getRemainingPercent(-20)).toBe(100);
    expect(getRemainingPercent(130)).toBe(0);
    expect(getRemainingPercent(33.6)).toBe(66);
    expect(getPrimaryUsageMetric(quota("codex"))).toMatchObject({
      id: "weekly",
    });
    expect(formatAgentUsagePlan("LEVEL_INTERMEDIATE")).toBe("Intermediate");
    expect(formatAgentUsagePlan("chatgpt_pro")).toBe("Chatgpt Pro");
    expect(formatAgentUsagePlan("  ")).toBe("");
    expect(
      getPrimaryUsageMetric(
        quota("codex", {
          metrics: [
            {
              id: "weekly",
              label: "Weekly quota",
              kind: "window",
              utilization: 10,
              resetsAt: null,
            },
            {
              id: "fiveHour",
              label: "5-hour window",
              kind: "window",
              utilization: 90,
              resetsAt: null,
            },
          ],
        }),
      ),
    ).toMatchObject({ id: "fiveHour" });
  });

  it("loads the fixed inventory with two workers and publishes settled items", async () => {
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];
    const getUsage = vi.fn(
      (agentId: string, options?: { forceRefresh?: boolean }) =>
        new Promise<AgentUsageQuota>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          releases.push(() => {
            active -= 1;
            resolve(quota(agentId));
          });
          expect(options).toEqual({ forceRefresh: true });
        }),
    );
    const onItem = vi.fn();
    const pending = loadAgentUsageBatch({
      forceRefresh: true,
      getUsage,
      onItem,
    });

    expect(getUsage).toHaveBeenCalledTimes(2);
    while (releases.length > 0 || getUsage.mock.calls.length < 6) {
      releases.shift()?.();
      await Promise.resolve();
    }
    const items = await pending;

    expect(maxActive).toBe(2);
    expect(items.map((item) => item.agentId)).toEqual(
      AGENT_USAGE_POPOVER_AGENTS.map((item) => item.id),
    );
    expect(onItem).toHaveBeenCalledTimes(6);
  });

  it("deduplicates an in-flight refresh and ignores results after unmount", async () => {
    let resolveUsage: ((value: AgentUsageQuota) => void) | undefined;
    const pending = new Promise<AgentUsageQuota>((resolve) => {
      resolveUsage = resolve;
    });
    window.api.agent.getUsage = vi.fn(() => pending);

    const view = await renderWithI18n(<AgentUsagePopover />);
    expect(window.api.agent.getUsage).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Refresh quotas" }));
    expect(window.api.agent.getUsage).toHaveBeenCalledTimes(2);

    view.unmount();
    resolveUsage?.(quota("codex"));
    await waitFor(() => {
      expect(window.api.agent.getUsage).toHaveBeenCalledTimes(6);
    });
  });

  it("renders CodexBar-style compact cards with inline remaining values and provider states", async () => {
    window.localStorage.setItem(
      "prompthub.agent-usage.codex",
      JSON.stringify(quota("codex")),
    );
    window.api.agent.getUsage = vi.fn(async (agentId: string) => {
      if (agentId === "claude" || agentId === "copilot") {
        return quota(agentId, {
          status: "no-credentials",
          metrics: [],
          plan: null,
        });
      }
      if (agentId === "kimi" || agentId === "gemini") {
        return quota(agentId, {
          status: "expired",
          metrics: [],
          plan: null,
        });
      }
      return quota(agentId);
    });

    await renderWithI18n(<AgentUsagePopover />);

    expect(screen.getByRole("heading", { name: "Agent quotas" })).toBeVisible();
    expect(screen.getByText("Codex")).toBeVisible();
    expect(screen.getAllByAltText("codex icon")).toHaveLength(2);
    expect(screen.getAllByText("34% remaining").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pro").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("progressbar", {
        name: "Codex, Weekly quota: 34% remaining",
      }),
    ).toHaveAttribute("aria-valuenow", "34");
    expect(
      screen
        .getByRole("progressbar", {
          name: "Codex, Weekly quota: 34% remaining",
        })
        .querySelector(".h-1"),
    ).toHaveClass("block", "w-full");

    expect(await screen.findAllByText("Not connected")).toHaveLength(2);
    expect(screen.getAllByText("Credentials expired")).toHaveLength(2);
    expect(screen.queryByText("0% remaining")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Codex quota" })).toHaveClass(
      "px-4",
    );
  });

  it("uses the transparent native-material shell on macOS", async () => {
    const userAgent = vi
      .spyOn(window.navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)");
    window.api.agent.getUsage = vi.fn(async (agentId: string) =>
      quota(agentId),
    );

    const view = await renderWithI18n(<AgentUsagePopover />);
    try {
      const shell = screen.getByRole("main");
      expect(shell).toHaveAttribute("data-material", "native");
      expect(shell).toHaveClass("rounded-xl", "bg-transparent", "shadow-none");
    } finally {
      view.unmount();
      userAgent.mockRestore();
    }
  });

  it("expands secondary metrics and force refreshes without replacing the cached row with loading", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    window.api.agent.getUsage = vi.fn(async (agentId: string) =>
      quota(agentId),
    );
    await renderWithI18n(<AgentUsagePopover />);

    const expand = await screen.findByRole("button", {
      name: "Show Codex quota details",
    });
    fireEvent.click(expand);
    expect(screen.getByText("5-hour window")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Refresh quotas" }));
    await waitFor(() => {
      expect(window.api.agent.getUsage).toHaveBeenCalledWith("codex", {
        forceRefresh: true,
      });
    });
    expect(screen.getByText("Codex")).toBeVisible();
    expect(screen.getAllByText(/Resets in 2h 0m/).length).toBeGreaterThan(0);
    now.mockRestore();
  });

  it("uses warning and critical progress colors for constrained quotas", async () => {
    window.api.agent.getUsage = vi.fn(async (agentId: string) =>
      quota(agentId, {
        metrics:
          agentId === "codex"
            ? [
                {
                  id: "custom",
                  label: "Custom credits",
                  kind: "credits",
                  utilization: 95,
                  resetsAt: null,
                },
                {
                  id: "weekly",
                  label: "Weekly quota",
                  kind: "window",
                  utilization: 80,
                  resetsAt: Date.now() - 1,
                },
                {
                  id: "chat",
                  label: "Chat requests",
                  kind: "credits",
                  utilization: 10,
                  resetsAt: null,
                },
              ]
            : [
                {
                  id: "custom",
                  label: "Custom credits",
                  kind: "credits",
                  utilization: 80,
                  resetsAt: null,
                },
              ],
      }),
    );

    await renderWithI18n(<AgentUsagePopover />);

    const codexProgress = await screen.findByRole("progressbar", {
      name: "Codex, Custom credits: 5% remaining",
    });
    const kimiProgress = screen.getByRole("progressbar", {
      name: "Kimi Code, Custom credits: 20% remaining",
    });
    expect(codexProgress.querySelector(".bg-destructive")).toBeInTheDocument();
    expect(kimiProgress.querySelector(".bg-amber-500")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show Codex quota details" }),
    );
    expect(screen.getByText("5% remaining")).toBeVisible();
    expect(screen.getAllByText("20% remaining").length).toBeGreaterThan(0);
    expect(screen.getByText("Reset pending")).toBeVisible();
  });

  it("preserves a successful cached row when its provider refresh is unavailable", async () => {
    window.localStorage.setItem(
      "prompthub.agent-usage.codex",
      JSON.stringify(quota("codex")),
    );
    window.api.agent.getUsage = vi.fn(async (agentId: string) =>
      quota(agentId, {
        status: "unavailable",
        metrics: [],
        plan: null,
      }),
    );

    await renderWithI18n(<AgentUsagePopover />);

    expect(await screen.findByText("Weekly quota · Cached")).toBeVisible();
    expect(screen.getAllByText("34% remaining").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Usage unavailable")).toHaveLength(5);
  });
});
