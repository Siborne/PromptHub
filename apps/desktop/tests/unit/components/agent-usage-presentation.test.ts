import { describe, expect, it } from "vitest";

import {
  buildAgentUsagePresentation,
  formatAgentUsagePlan,
  getAgentUsageTone,
  getAgentUsageVisual,
  getPrimaryUsageMetric,
  getUsageMetricRemainingPercent,
} from "../../../src/renderer/components/agent/agent-usage-presentation";

function percentageMetric(
  id: string,
  remainingPercent: number,
  scope:
    | { kind: "account" }
    | { kind: "model-group"; id: string; label: string }
    | { kind: "feature"; id: string; label: string }
    | { kind: "model"; id: string; label: string } = { kind: "account" },
) {
  return {
    id,
    label: id,
    scope,
    period: { kind: "rolling" as const, durationSeconds: 18_000 },
    value: { kind: "percentage" as const, remainingPercent },
    resetsAt: null,
  };
}

describe("agent usage presentation", () => {
  it("formats Grok and Kimi native membership tiers as public plan names", () => {
    expect(formatAgentUsagePlan("XPremium")).toBe("X Premium");
    expect(formatAgentUsagePlan("x_premium_plus")).toBe("X Premium+");
    expect(formatAgentUsagePlan("supergrok_heavy")).toBe("SuperGrok Heavy");
    expect(formatAgentUsagePlan("LEVEL_INTERMEDIATE")).toBe("Allegretto");
    expect(formatAgentUsagePlan("LEVEL_")).toBe("");
    expect(formatAgentUsagePlan("PRO")).toBe("Pro");
    expect(formatAgentUsagePlan("Team")).toBe("Team");
    expect(formatAgentUsagePlan("team_enterprise")).toBe("Team Enterprise");
    expect(formatAgentUsagePlan("--")).toBe("");
  });

  it("groups metrics by semantic scope without parsing Agent-specific ids", () => {
    const metrics = [
      percentageMetric("account", 80),
      percentageMetric("opaque-a", 60, {
        kind: "model-group",
        id: "gemini",
        label: "Gemini Models",
      }),
      percentageMetric("opaque-b", 40, {
        kind: "model-group",
        id: "gemini",
        label: "Gemini Models",
      }),
    ];

    const presentation = buildAgentUsagePresentation(metrics);

    expect(presentation.groups).toHaveLength(2);
    expect(presentation.groups[0]).toMatchObject({
      key: "account",
      metrics: [{ id: "account" }],
    });
    expect(presentation.groups[1]).toMatchObject({
      key: "model-group:gemini",
      label: "Gemini Models",
      metrics: [{ id: "opaque-a" }, { id: "opaque-b" }],
    });
  });

  it("selects the lowest finite remaining quota and ignores unlimited values", () => {
    const quota = {
      schemaVersion: 2 as const,
      agentId: "copilot",
      adapter: "test",
      status: "ok" as const,
      source: "provider" as const,
      plan: null,
      fetchedAt: 1,
      metrics: [
        {
          ...percentageMetric("healthy", 80),
          value: { kind: "unlimited" as const },
        },
        percentageMetric("critical", 7),
        percentageMetric("warning", 25),
      ],
    };

    expect(getPrimaryUsageMetric(quota)?.id).toBe("critical");
    expect(getUsageMetricRemainingPercent(quota.metrics[0])).toBeNull();
  });

  it("bounds model rows while retaining all aggregate groups", () => {
    const account = percentageMetric("account", 90);
    const models = Array.from({ length: 12 }, (_, index) =>
      percentageMetric(`model-${index}`, 100 - index, {
        kind: "model",
        id: `model-${index}`,
        label: `Model ${index}`,
      }),
    );

    const collapsed = buildAgentUsagePresentation([account, ...models]);
    const expanded = buildAgentUsagePresentation([account, ...models], {
      expanded: true,
    });

    expect(collapsed.groups.flatMap((group) => group.metrics)).toHaveLength(5);
    expect(collapsed.hiddenModelCount).toBe(8);
    expect(expanded.groups.flatMap((group) => group.metrics)).toHaveLength(13);
    expect(expanded.hiddenModelCount).toBe(0);
  });

  it("orders semantic groups and finite model rows independently of input order", () => {
    const presentation = buildAgentUsagePresentation([
      percentageMetric("model-healthy", 90, {
        kind: "model",
        id: "healthy",
        label: "Healthy",
      }),
      percentageMetric("feature", 50, {
        kind: "feature",
        id: "chat",
        label: "Chat",
      }),
      percentageMetric("account", 80),
      percentageMetric("model-critical", 5, {
        kind: "model",
        id: "critical",
        label: "Critical",
      }),
    ]);

    expect(presentation.groups.map((group) => group.key)).toEqual([
      "account",
      "features",
      "models",
    ]);
    expect(
      presentation.groups.at(-1)?.metrics.map((metric) => metric.id),
    ).toEqual(["model-critical", "model-healthy"]);
  });

  it("orders every period family and places unknown models after finite ones", () => {
    const accountMetrics = [
      {
        ...percentageMetric("lifetime", 80),
        period: { kind: "lifetime" as const },
      },
      {
        ...percentageMetric("provider", 80),
        period: { kind: "provider-defined" as const, label: "provider" },
      },
      {
        ...percentageMetric("daily", 80),
        period: { kind: "calendar" as const, unit: "day" as const },
      },
      {
        ...percentageMetric("rolling", 80),
        period: { kind: "rolling" as const, durationSeconds: null },
      },
    ];
    const unknownModel = {
      ...percentageMetric("unknown-model", 80, {
        kind: "model",
        id: "unknown",
        label: "Unknown",
      }),
      value: { kind: "unknown" as const },
    };
    const presentation = buildAgentUsagePresentation([
      unknownModel,
      ...accountMetrics,
      percentageMetric("finite-model", 50, {
        kind: "model",
        id: "finite",
        label: "Finite",
      }),
    ]);

    expect(presentation.groups[0].metrics.map((metric) => metric.id)).toEqual([
      "rolling",
      "daily",
      "provider",
      "lifetime",
    ]);
    expect(
      presentation.groups.at(-1)?.metrics.map((metric) => metric.id),
    ).toEqual(["finite-model", "unknown-model"]);
  });

  it("clamps display values, handles invalid amounts, and maps threshold tones", () => {
    const high = percentageMetric("high", 150);
    const low = percentageMetric("low", -20);
    const invalid = {
      ...percentageMetric("invalid", 50),
      value: {
        kind: "amount" as const,
        remainingPercent: Number.NaN,
        remainingAmount: 1,
        limitAmount: 2,
        unit: "credits",
      },
    };

    expect(getUsageMetricRemainingPercent(high)).toBe(100);
    expect(getUsageMetricRemainingPercent(low)).toBe(0);
    expect(getUsageMetricRemainingPercent(invalid)).toBeNull();
    expect(getAgentUsageTone(10)).toBe("critical");
    expect(getAgentUsageTone(30)).toBe("warning");
    expect(getAgentUsageTone(31)).toBe("normal");
  });

  it("selects compact rings for finite resettable windows regardless of value shape", () => {
    const base = percentageMetric("visual", 50);
    expect(
      getAgentUsageVisual({
        ...base,
        value: { kind: "unknown" },
      }),
    ).toBe("bar");
    expect(getAgentUsageVisual(base)).toBe("ring");
    expect(
      getAgentUsageVisual({
        ...base,
        period: { kind: "calendar", unit: "day" },
      }),
    ).toBe("ring");
    expect(
      getAgentUsageVisual({
        ...base,
        period: { kind: "calendar", unit: "week" },
      }),
    ).toBe("ring");
    expect(
      getAgentUsageVisual({
        ...base,
        period: { kind: "calendar", unit: "month" },
      }),
    ).toBe("bar");
    expect(getAgentUsageVisual({ ...base, period: { kind: "lifetime" } })).toBe(
      "bar",
    );
    expect(
      getAgentUsageVisual({
        ...base,
        value: {
          kind: "amount",
          remainingPercent: 50,
          remainingAmount: 5,
          limitAmount: 10,
          unit: "credits",
        },
      }),
    ).toBe("ring");
    expect(
      getAgentUsageVisual({
        ...base,
        period: { kind: "calendar", unit: "week" },
        value: {
          kind: "amount",
          remainingPercent: 50,
          remainingAmount: 5,
          limitAmount: 10,
          unit: "requests",
        },
      }),
    ).toBe("ring");
    expect(
      getAgentUsageVisual({
        ...base,
        period: { kind: "calendar", unit: "month" },
        value: {
          kind: "amount",
          remainingPercent: 50,
          remainingAmount: 5,
          limitAmount: 10,
          unit: "credits",
        },
      }),
    ).toBe("bar");
  });

  it("uses stable ids to order otherwise equal aggregate and model metrics", () => {
    const aggregates = [
      percentageMetric("b", 50),
      percentageMetric("a", 50),
    ].map((item) => ({ ...item, label: "Same" }));
    const models = [
      percentageMetric("model-b", 50, {
        kind: "model",
        id: "b",
        label: "Same",
      }),
      percentageMetric("model-a", 50, {
        kind: "model",
        id: "a",
        label: "Same",
      }),
      {
        ...percentageMetric("model-unknown", 50, {
          kind: "model",
          id: "unknown",
          label: "Same",
        }),
        value: { kind: "unknown" as const },
      },
    ].map((item) => ({ ...item, label: "Same" }));
    const presentation = buildAgentUsagePresentation([
      ...aggregates,
      ...models,
    ]);

    expect(presentation.groups[0].metrics.map((item) => item.id)).toEqual([
      "a",
      "b",
    ]);
    expect(presentation.groups[1].metrics.map((item) => item.id)).toEqual([
      "model-a",
      "model-b",
      "model-unknown",
    ]);
  });

  it("enforces the global metric cap and falls back to non-numeric primary values", () => {
    const metrics = Array.from({ length: 70 }, (_, index) =>
      percentageMetric(`metric-${index}`, index),
    );
    const bounded = buildAgentUsagePresentation(metrics, { expanded: true });
    expect(bounded.groups.flatMap((group) => group.metrics)).toHaveLength(64);
    expect(bounded.truncatedCount).toBe(6);

    const fallbackQuota = {
      schemaVersion: 2 as const,
      agentId: "copilot",
      adapter: "test",
      status: "ok" as const,
      source: "provider" as const,
      plan: null,
      fetchedAt: 1,
      metrics: [
        {
          ...percentageMetric("unlimited", 0),
          value: { kind: "unlimited" as const },
        },
      ],
    };
    expect(getPrimaryUsageMetric(fallbackQuota)?.id).toBe("unlimited");
    expect(getPrimaryUsageMetric({ ...fallbackQuota, metrics: [] })).toBeNull();
  });
});
