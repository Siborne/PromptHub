import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentUsageMetric,
  AgentUsageQuota,
} from "@prompthub/shared/types";
import { AgentUsagePopover } from "../../../src/renderer/components/agent/AgentUsagePopover";
import {
  AGENT_USAGE_POPOVER_AGENTS,
  formatAgentUsagePlan,
  getPrimaryUsageMetric,
  loadAgentUsageBatch,
} from "../../../src/renderer/components/agent/agent-usage-popover-model";
import { renderWithI18n as renderWithI18nBase } from "../../helpers/i18n";

function renderWithI18n(ui: ReactElement) {
  return renderWithI18nBase(ui, { settleAsyncEffects: true });
}

function percentageMetric(
  id: string,
  label: string,
  remainingPercent: number,
  resetsAt: number | null = null,
): AgentUsageMetric {
  return {
    id,
    label,
    scope: { kind: "account" },
    period:
      id === "weekly"
        ? { kind: "calendar", unit: "week" }
        : {
            kind: "rolling",
            durationSeconds: id === "fiveHour" ? 18_000 : null,
          },
    value: { kind: "percentage", remainingPercent },
    resetsAt,
  };
}

function quota(
  agentId: string,
  overrides: Partial<AgentUsageQuota> = {},
): AgentUsageQuota {
  return {
    schemaVersion: 2,
    agentId,
    adapter: `${agentId}-test`,
    status: "ok",
    source: "provider",
    plan: "pro",
    fetchedAt: 1_800_000_000_000,
    metrics: [
      percentageMetric("weekly", "Weekly quota", 34, 1_800_086_400_000),
      percentageMetric("fiveHour", "5-hour window", 80, 1_800_007_200_000),
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
    expect(getPrimaryUsageMetric(quota("codex"))).toMatchObject({
      id: "weekly",
    });
    expect(formatAgentUsagePlan("LEVEL_INTERMEDIATE")).toBe("Allegretto");
    expect(formatAgentUsagePlan("LEVEL_STANDARD")).toBe("Moderato");
    expect(formatAgentUsagePlan("LEVEL_ADVANCED")).toBe("Allegro");
    expect(formatAgentUsagePlan("LEVEL_PREMIUM")).toBe("Vivace");
    expect(formatAgentUsagePlan("chatgpt_pro")).toBe("Chatgpt Pro");
    expect(formatAgentUsagePlan("  ")).toBe("");
    expect(
      getPrimaryUsageMetric(
        quota("codex", {
          metrics: [
            percentageMetric("weekly", "Weekly quota", 90),
            percentageMetric("fiveHour", "5-hour window", 10),
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

  it("renders semantic compact quota rows and provider states", async () => {
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
    expect(screen.getAllByText("pro").length).toBeGreaterThan(0);
    const codexArticle = screen.getByRole("article", { name: "Codex quota" });
    const codexProgress = within(codexArticle).getByRole("progressbar", {
      name: "Weekly quota: 34% remaining",
    });
    expect(codexProgress).toHaveAttribute("aria-valuenow", "34");
    expect(codexProgress).toHaveAttribute("data-usage-visual", "ring");

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

  it("distinguishes an empty provider response from loading and failure", async () => {
    window.api.agent.getUsage = vi.fn(async (agentId: string) =>
      quota(agentId, { metrics: [] }),
    );

    await renderWithI18n(<AgentUsagePopover />);

    expect(
      await screen.findAllByText("The provider did not report a quota."),
    ).toHaveLength(6);
    expect(screen.queryByText("Usage unavailable")).not.toBeInTheDocument();
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
                percentageMetric("custom", "Custom credits", 5),
                percentageMetric("weekly", "Weekly quota", 20, Date.now() - 1),
                percentageMetric("chat", "Chat requests", 90),
              ]
            : [percentageMetric("custom", "Custom credits", 20)],
      }),
    );

    await renderWithI18n(<AgentUsagePopover />);

    const codexProgress = within(
      await screen.findByRole("article", { name: "Codex quota" }),
    ).getByRole("progressbar", {
      name: "Custom credits: 5% remaining",
    });
    const kimiProgress = within(
      screen.getByRole("article", { name: "Kimi Code quota" }),
    ).getByRole("progressbar", {
      name: "Custom credits: 20% remaining",
    });
    expect(
      codexProgress.querySelector(".text-destructive"),
    ).toBeInTheDocument();
    expect(kimiProgress.querySelector(".text-amber-500")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show Codex quota details" }),
    );
    expect(screen.getByText("5%")).toBeVisible();
    expect(screen.getAllByText("20%").length).toBeGreaterThan(0);
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

    expect(await screen.findByText("Cached")).toBeVisible();
    expect(screen.getByText("Weekly quota")).toBeVisible();
    expect(
      screen.getByRole("progressbar", {
        name: "Weekly quota: 34% remaining",
      }),
    ).toHaveAttribute("data-usage-visual", "ring");
    expect(screen.getAllByText("Usage unavailable")).toHaveLength(5);
  });
});
