import { describe, expect, it } from "vitest";

import type { AgentUsageMetric } from "@prompthub/shared/types";
import {
  MAX_AGENT_USAGE_METRICS,
  amountFromRemaining,
  amountFromUsed,
  boundUsageMetrics,
  percentageFromRemaining,
  percentageFromUsed,
} from "../../../src/main/services/agent-usage-contract";

function metric(id: string): AgentUsageMetric {
  return {
    id,
    label: id,
    scope: { kind: "account" },
    period: { kind: "lifetime" },
    value: { kind: "unlimited" },
    resetsAt: null,
  };
}

describe("agent usage contract normalization", () => {
  it("normalizes used and remaining percentages into a bounded remaining value", () => {
    expect(percentageFromUsed(25.12345)).toEqual({
      kind: "percentage",
      remainingPercent: 74.877,
    });
    expect(percentageFromUsed(-5)).toEqual({
      kind: "percentage",
      remainingPercent: 100,
    });
    expect(percentageFromRemaining(120)).toEqual({
      kind: "percentage",
      remainingPercent: 100,
    });
    expect(percentageFromRemaining(-1)).toEqual({
      kind: "percentage",
      remainingPercent: 0,
    });
  });

  it("rejects non-finite percentages instead of leaking invalid UI values", () => {
    expect(percentageFromUsed(Number.NaN)).toEqual({ kind: "unknown" });
    expect(percentageFromRemaining(Number.POSITIVE_INFINITY)).toEqual({
      kind: "unknown",
    });
  });

  it("normalizes amount quotas from used and remaining values", () => {
    expect(amountFromUsed(25, 100, "requests")).toEqual({
      kind: "amount",
      remainingPercent: 75,
      remainingAmount: 75,
      limitAmount: 100,
      unit: "requests",
    });
    expect(amountFromUsed(200, 100, "requests")).toMatchObject({
      remainingPercent: 0,
      remainingAmount: 0,
    });
    expect(amountFromRemaining(-10, 100, "credits")).toMatchObject({
      remainingPercent: 0,
      remainingAmount: 0,
    });
    expect(amountFromRemaining(120, 100, "credits")).toMatchObject({
      remainingPercent: 100,
      remainingAmount: 100,
    });
  });

  it("marks invalid amount quotas unknown", () => {
    expect(amountFromUsed(1, 0, "requests")).toEqual({ kind: "unknown" });
    expect(amountFromUsed(Number.NaN, 100, "requests")).toEqual({
      kind: "unknown",
    });
    expect(amountFromRemaining(1, Number.NaN, "credits")).toEqual({
      kind: "unknown",
    });
  });

  it("bounds provider inventories before they reach the renderer", () => {
    const metrics = Array.from(
      { length: MAX_AGENT_USAGE_METRICS + 3 },
      (_, index) => metric(String(index)),
    );
    expect(boundUsageMetrics(metrics)).toHaveLength(MAX_AGENT_USAGE_METRICS);
    expect(boundUsageMetrics(metrics).at(-1)?.id).toBe("63");
  });

  it("bounds dynamic text before provider data reaches the renderer", () => {
    const long = `  Model\u0000${"x".repeat(200)}  `;
    const metrics = [metric(long), metric(long)].map((item) => ({
      ...item,
      label: long,
      scope: { kind: "model" as const, id: long, label: long },
      period: { kind: "provider-defined" as const, label: long },
      value: {
        kind: "amount" as const,
        remainingPercent: 50,
        remainingAmount: 5,
        limitAmount: 10,
        unit: long,
      },
    }));

    const bounded = boundUsageMetrics(metrics);
    expect(bounded[0].id).not.toContain("\u0000");
    expect(bounded[0].id.length).toBeLessThanOrEqual(160);
    expect(bounded[0].label.length).toBeLessThanOrEqual(120);
    expect(bounded[0].scope).toMatchObject({
      kind: "model",
      label: expect.stringMatching(/^Model/),
    });
    expect(bounded[0].value).toMatchObject({
      kind: "amount",
      unit: expect.stringMatching(/^Model/),
    });
  });

  it("supplies bounded fallbacks when provider text contains only whitespace", () => {
    const [bounded] = boundUsageMetrics([
      {
        ...metric(" "),
        label: "\u0000\n",
        scope: { kind: "feature", id: " ", label: "\t" },
        period: { kind: "provider-defined", label: " " },
        value: {
          kind: "amount",
          remainingPercent: 50,
          remainingAmount: 1,
          limitAmount: 2,
          unit: " ",
        },
      },
    ]);

    expect(bounded).toMatchObject({
      id: "quota",
      label: "Quota",
      scope: { kind: "feature", id: "feature", label: "Quota" },
      period: { kind: "provider-defined", label: "Provider quota" },
      value: { kind: "amount", unit: "units" },
    });
  });
});
