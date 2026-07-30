import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentUsageMetric,
  AgentUsageQuota,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentUsageBanner } from "../../../src/renderer/components/agent/AgentUsageBanner";
import { renderWithI18n as renderWithI18nBase } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

function renderWithI18n(ui: ReactElement) {
  return renderWithI18nBase(ui, { settleAsyncEffects: true });
}

const agent: ManagedAgentSummary = {
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

function createMetric(
  overrides: Partial<AgentUsageMetric> & Pick<AgentUsageMetric, "id" | "kind">,
): AgentUsageMetric {
  return {
    label: overrides.id,
    utilization: 0,
    resetsAt: null,
    ...overrides,
  };
}

function createQuota(
  overrides: Partial<AgentUsageQuota> = {},
): AgentUsageQuota {
  return {
    agentId: "claude",
    adapter: "claude-oauth-v1",
    status: "ok",
    source: "provider",
    metrics: [
      createMetric({
        id: "fiveHour",
        label: "5-hour window",
        kind: "window",
        utilization: 42.4,
        resetsAt: Date.now() + (2 * 60 + 5) * 60_000,
      }),
      createMetric({
        id: "sevenDay",
        label: "7-day window",
        kind: "window",
        utilization: 18,
        resetsAt: Date.now() + 3 * 24 * 3_600_000,
      }),
    ],
    plan: "claude-pro",
    fetchedAt: Date.now(),
    ...overrides,
  };
}

describe("AgentUsageBanner", () => {
  beforeEach(() => {
    installWindowMocks();
    window.localStorage.clear();
  });

  it("renders a ring gauge per reported window with countdowns, plan badge and provider note", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(createQuota());

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", { name: "5-hour window: 58% remaining" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "7-day window: 82% remaining" }),
    ).toBeVisible();
    expect(screen.queryByRole("img", { name: /Opus/ })).toBeNull();
    expect(await screen.findByText(/Resets in 2h \d+m/)).toBeVisible();
    expect(screen.getByText(/Resets in 3d 0h/)).toBeVisible();
    expect(screen.getByText("claude-pro")).toBeVisible();
    expect(
      screen.getByText("Usage data reported by the provider"),
    ).toBeVisible();
    expect(window.api.agent.getUsage).toHaveBeenCalledWith("claude");
  });

  it("renders the Opus window only when the provider reports it", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        metrics: [
          ...createQuota().metrics,
          createMetric({
            id: "sevenDayOpus",
            label: "7-day Opus window",
            kind: "window",
            utilization: 95,
          }),
        ],
        plan: null,
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", {
        name: "7-day Opus window: 5% remaining",
      }),
    ).toBeVisible();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.queryByText("claude-pro")).not.toBeInTheDocument();
  });

  it("renders a single ring without empty placeholders when only one window is reported", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        metrics: [
          createMetric({
            id: "sevenDay",
            label: "7-day window",
            kind: "window",
            utilization: 18,
            resetsAt: Date.now() + 3 * 24 * 3_600_000,
          }),
        ],
        plan: null,
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", { name: "7-day window: 82% remaining" }),
    ).toBeVisible();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByRole("img", { name: /5-hour window/ })).toBeNull();
    expect(screen.queryByRole("img", { name: /Opus/ })).toBeNull();
  });

  it("renders window rings and quota bars side by side with i18n labels for known ids", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        agentId: "copilot",
        metrics: [
          createMetric({
            id: "weekly",
            label: "weekly",
            kind: "window",
            utilization: 40,
            resetsAt: Date.now() + 2 * 24 * 3_600_000,
          }),
          createMetric({
            id: "premium",
            label: "premium",
            kind: "quota",
            utilization: 25,
            usedAmount: 250,
            totalAmount: 500,
            unit: "requests",
            resetsAt: Date.now() + 5 * 3_600_000,
          }),
          createMetric({
            id: "chat",
            label: "chat",
            kind: "quota",
            utilization: 90,
            usedAmount: 90,
            totalAmount: 100,
            unit: "requests",
          }),
        ],
        plan: "copilot-pro",
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", { name: "Weekly quota: 60% remaining" }),
    ).toBeVisible();

    const premiumBar = screen.getByRole("progressbar", {
      name: "Premium requests: 75% remaining",
    });
    expect(premiumBar).toHaveAttribute("aria-valuenow", "75");
    expect(premiumBar).toHaveAttribute("aria-valuemin", "0");
    expect(premiumBar).toHaveAttribute("aria-valuemax", "100");

    const chatBar = screen.getByRole("progressbar", {
      name: "Chat requests: 10% remaining",
    });
    expect(chatBar).toHaveAttribute("aria-valuenow", "10");

    expect(screen.getByText("250/500 requests")).toBeVisible();
    expect(screen.getByText(/Resets in 5h \d+m/)).toBeVisible();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
  });

  it("shows provider reset windows as rings instead of progress bars", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        agentId: "gemini",
        metrics: [
          createMetric({
            id: "model:gemini-2.5-pro",
            label: "Gemini 2.5 Pro",
            kind: "window",
            utilization: 30,
          }),
        ],
        plan: null,
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", {
        name: "Gemini 2.5 Pro: 70% remaining",
      }),
    ).toBeVisible();
    expect(screen.getByText("Gemini 2.5 Pro")).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders Antigravity weekly and five-hour pools as rings and only total credits as a progress bar", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        agentId: "antigravity",
        metrics: [
          createMetric({
            id: "antigravity:gemini-weekly:weekly",
            label: "Gemini Models",
            kind: "window",
            utilization: 20,
          }),
          createMetric({
            id: "antigravity:gemini-5h:5h",
            label: "Gemini Models",
            kind: "window",
            utilization: 50,
          }),
          createMetric({
            id: "antigravity:3p-weekly:weekly",
            label: "Claude and GPT models",
            kind: "window",
            utilization: 0,
          }),
          createMetric({
            id: "antigravity:3p-5h:5h",
            label: "Claude and GPT models",
            kind: "window",
            utilization: 75,
          }),
          createMetric({
            id: "promptCredits",
            label: "Monthly prompt credits",
            kind: "quota",
            utilization: 1,
            usedAmount: 500,
            totalAmount: 50_000,
            unit: "credits",
          }),
        ],
        plan: "Google AI Pro",
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", {
        name: "Gemini Models · Weekly quota: 80% remaining",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Gemini Models · 5-hour window: 50% remaining",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Claude and GPT models · Weekly quota: 100% remaining",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Claude and GPT models · 5-hour window: 25% remaining",
      }),
    ).toBeVisible();
    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(
      screen.getByRole("progressbar", {
        name: "Monthly prompt credits: 99% remaining",
      }),
    ).toBeVisible();
    expect(screen.getByText("500/50000 credits")).toBeVisible();
  });

  it("renders the banner for kimi after the usage capability flip", async () => {
    const kimiAgent: ManagedAgentSummary = {
      ...agent,
      id: "kimi",
      name: "Kimi Code",
      paths: {
        root: "~/.kimi-code",
        skills: "~/.kimi-code/skills",
        configFiles: ["~/.kimi-code/config.toml"],
        configFileRelativePaths: ["config.toml"],
      },
    };
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        agentId: "kimi",
        metrics: [
          createMetric({
            id: "weekly",
            label: "weekly",
            kind: "window",
            utilization: 55,
            resetsAt: Date.now() + 2 * 24 * 3_600_000,
          }),
          createMetric({
            id: "rolling",
            label: "rolling",
            kind: "window",
            utilization: 10,
            resetsAt: Date.now() + 3_600_000,
          }),
        ],
        plan: "kimi-pro",
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={kimiAgent} />);

    expect(
      await screen.findByRole("img", { name: "Weekly quota: 45% remaining" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Rolling window: 90% remaining" }),
    ).toBeVisible();
    expect(screen.getByText("kimi-pro")).toBeVisible();
    expect(window.api.agent.getUsage).toHaveBeenCalledWith("kimi");
  });

  it("reloads the quota when the refresh button is clicked", async () => {
    const getUsage = vi.fn().mockResolvedValue(createQuota());
    window.api.agent.getUsage = getUsage;

    await renderWithI18n(<AgentUsageBanner agent={agent} />);
    await screen.findByRole("img", { name: "5-hour window: 58% remaining" });
    expect(getUsage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(getUsage).toHaveBeenCalledTimes(2));
  });

  it("guides sign-in when no Claude Code credentials are detected", async () => {
    const getUsage = vi
      .fn()
      .mockResolvedValue(createQuota({ status: "no-credentials" }));
    window.api.agent.getUsage = getUsage;

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByText("No Claude Code sign-in detected"),
    ).toBeVisible();
    expect(
      screen.getByText("Sign in to Claude Code first, then refresh usage."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(getUsage).toHaveBeenCalledTimes(2));
  });

  it("guides a credential refresh when the token is expired", async () => {
    window.api.agent.getUsage = vi
      .fn()
      .mockResolvedValue(createQuota({ status: "expired" }));

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(await screen.findByText("Credentials expired")).toBeVisible();
    expect(
      screen.getByText("Open Claude Code once to refresh your credentials."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
  });

  it("names the current agent in guided states instead of hardcoding Claude Code", async () => {
    const kimiAgent: ManagedAgentSummary = {
      ...agent,
      id: "kimi",
      name: "Kimi Code",
    };
    window.api.agent.getUsage = vi
      .fn()
      .mockResolvedValue(
        createQuota({ agentId: "kimi", status: "no-credentials" }),
      );

    await renderWithI18n(<AgentUsageBanner agent={kimiAgent} />);

    expect(
      await screen.findByText("No Kimi Code sign-in detected"),
    ).toBeVisible();
    expect(
      screen.getByText("Sign in to Kimi Code first, then refresh usage."),
    ).toBeVisible();
  });

  it("shows the custom provider state without a retry action when a third-party provider is active", async () => {
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        status: "unavailable",
        errorCode: "custom-provider-active",
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(await screen.findByText("Custom provider active")).toBeVisible();
    expect(
      screen.getByText(
        "The default provider is a custom third-party endpoint. Usage quota is only available for the official subscription. Check the Provider & Model tab for the active provider.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Usage unavailable")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
    expect(window.api.agent.getUsage).toHaveBeenCalledWith("claude");
  });

  it("shows the unavailable state when the adapter cannot report usage", async () => {
    window.api.agent.getUsage = vi
      .fn()
      .mockResolvedValue(createQuota({ status: "unavailable" }));

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(await screen.findByText("Usage unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
  });

  it("asks Antigravity users to keep the desktop app running instead of claiming sign-in expired", async () => {
    const antigravityAgent: ManagedAgentSummary = {
      ...agent,
      id: "antigravity",
      name: "Antigravity",
      launchable: true,
    };
    window.api.agent.launch = vi.fn().mockResolvedValue({ success: true });
    window.api.agent.getUsage = vi.fn().mockResolvedValue(
      createQuota({
        agentId: "antigravity",
        status: "unavailable",
        errorCode: "antigravity-not-running",
      }),
    );

    await renderWithI18n(<AgentUsageBanner agent={antigravityAgent} />);

    expect(await screen.findByText("Antigravity is not running")).toBeVisible();
    expect(
      screen.getByText(
        "Keep Antigravity running so PromptHub can read the quota from your current signed-in session, then retry.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Credentials expired")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open Antigravity" }));
    await waitFor(() =>
      expect(window.api.agent.launch).toHaveBeenCalledWith("antigravity"),
    );
  });

  it("shows the unavailable state when the IPC call rejects", async () => {
    window.api.agent.getUsage = vi
      .fn()
      .mockRejectedValue(new Error("ipc failure"));

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(await screen.findByText("Usage unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
  });

  it("renders the banner for a partially supported usage capability", async () => {
    const partialAgent: ManagedAgentSummary = {
      ...agent,
      capabilities: {
        ...agent.capabilities,
        usage: { status: "partial", reason: "quota-window-partial" },
      },
    };
    window.api.agent.getUsage = vi.fn().mockResolvedValue(createQuota());

    await renderWithI18n(<AgentUsageBanner agent={partialAgent} />);

    expect(
      await screen.findByRole("img", { name: "5-hour window: 58% remaining" }),
    ).toBeVisible();
    expect(window.api.agent.getUsage).toHaveBeenCalledWith("claude");
  });

  it("renders placeholder rings immediately and swaps in real data without a layout shift", async () => {
    let resolveUsage: (value: AgentUsageQuota) => void = () => undefined;
    window.api.agent.getUsage = vi.fn(
      () =>
        new Promise<AgentUsageQuota>((resolve) => {
          resolveUsage = resolve;
        }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    const banner = screen.getByRole("region", { name: "Usage" });
    expect(banner.className).toContain("bg-card");
    expect(
      screen.getByRole("img", { name: "5-hour window: 0%" }),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: "7-day window: 0%" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();

    resolveUsage(createQuota());

    expect(
      await screen.findByRole("img", { name: "5-hour window: 58% remaining" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "7-day window: 82% remaining" }),
    ).toBeVisible();
  });

  it("keeps the previous quota visible while a refresh is in flight", async () => {
    let resolveSecond: (value: AgentUsageQuota) => void = () => undefined;
    const getUsage = vi
      .fn()
      .mockResolvedValueOnce(createQuota())
      .mockImplementationOnce(
        () =>
          new Promise<AgentUsageQuota>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    window.api.agent.getUsage = getUsage;

    await renderWithI18n(<AgentUsageBanner agent={agent} />);
    await screen.findByRole("img", { name: "5-hour window: 58% remaining" });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(getUsage).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("img", { name: "5-hour window: 58% remaining" }),
    ).toBeVisible();
    expect(screen.queryByRole("img", { name: /: 0%/ })).toBeNull();

    resolveSecond(createQuota());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled(),
    );
  });

  it("shows the cached quota immediately and replaces it with fresh data", async () => {
    window.localStorage.setItem(
      "prompthub.agent-usage.claude",
      JSON.stringify(
        createQuota({
          metrics: [
            createMetric({
              id: "fiveHour",
              label: "5-hour window",
              kind: "window",
              utilization: 90,
            }),
          ],
        }),
      ),
    );
    let resolveUsage: (value: AgentUsageQuota) => void = () => undefined;
    window.api.agent.getUsage = vi.fn(
      () =>
        new Promise<AgentUsageQuota>((resolve) => {
          resolveUsage = resolve;
        }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      screen.getByRole("img", { name: "5-hour window: 10% remaining" }),
    ).toBeVisible();
    expect(window.api.agent.getUsage).toHaveBeenCalledWith("claude");

    resolveUsage(createQuota());

    expect(
      await screen.findByRole("img", { name: "5-hour window: 58% remaining" }),
    ).toBeVisible();
    await waitFor(() => {
      const raw = window.localStorage.getItem("prompthub.agent-usage.claude");
      expect(raw).not.toBeNull();
      const cached = JSON.parse(raw as string) as AgentUsageQuota;
      const fiveHour = cached.metrics.find(
        (metric) => metric.id === "fiveHour",
      );
      expect(fiveHour?.utilization).toBeCloseTo(42.4);
    });
  });

  it("ignores cached entries for other agents or non-ok statuses", async () => {
    window.localStorage.setItem(
      "prompthub.agent-usage.claude",
      JSON.stringify(createQuota({ agentId: "codex" })),
    );
    window.localStorage.setItem(
      "prompthub.agent-usage.codex",
      JSON.stringify(createQuota({ agentId: "codex", status: "expired" })),
    );
    let resolveUsage: (value: AgentUsageQuota) => void = () => undefined;
    window.api.agent.getUsage = vi.fn(
      () =>
        new Promise<AgentUsageQuota>((resolve) => {
          resolveUsage = resolve;
        }),
    );

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      screen.getByRole("img", { name: "5-hour window: 0%" }),
    ).toBeVisible();
    resolveUsage(createQuota());
    await screen.findByRole("img", { name: "5-hour window: 58% remaining" });
  });

  it("ignores caches written by the old fixed-window contract instead of crashing", async () => {
    window.localStorage.setItem(
      "prompthub.agent-usage.claude",
      JSON.stringify({
        agentId: "claude",
        adapter: "claude-oauth-v1",
        status: "ok",
        source: "provider",
        fiveHour: { utilization: 42.4, resetsAt: null },
        sevenDay: { utilization: 18, resetsAt: null },
        sevenDayOpus: null,
        plan: "claude-pro",
        fetchedAt: Date.now(),
      }),
    );
    window.api.agent.getUsage = vi.fn().mockResolvedValue(createQuota());

    await renderWithI18n(<AgentUsageBanner agent={agent} />);

    expect(
      await screen.findByRole("img", { name: "5-hour window: 58% remaining" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "5-hour window: 0%" }),
    ).not.toBeInTheDocument();
  });

  it.each(["planned", "unsupported"] as const)(
    "does not render or fetch usage when the capability is %s",
    async (status) => {
      const gatedAgent: ManagedAgentSummary = {
        ...agent,
        capabilities: {
          ...agent.capabilities,
          usage: { status, reason: "adapter-pending" },
        },
      };

      await renderWithI18n(<AgentUsageBanner agent={gatedAgent} />);

      expect(
        screen.queryByRole("region", { name: "Usage" }),
      ).not.toBeInTheDocument();
      expect(window.api.agent.getUsage).not.toHaveBeenCalled();
    },
  );
});
