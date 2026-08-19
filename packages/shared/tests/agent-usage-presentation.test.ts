import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  AgentUsageMetric,
  AgentUsageQuota,
} from "@prompthub/shared/types";
import {
  formatAgentUsagePlan,
  getPrimaryUsageMetric,
  getUsageMetricRemainingPercent,
} from "@prompthub/shared/utils/agent-usage-presentation";

function metric(id: string, remainingPercent: number): AgentUsageMetric {
  return {
    id,
    label: id,
    scope: { kind: "account" },
    period: { kind: "calendar", unit: "week" },
    value: { kind: "percentage", remainingPercent },
    resetsAt: null,
  };
}

describe("shared Agent usage presentation", () => {
  it("normalizes known and generic plan identifiers", () => {
    assert.equal(formatAgentUsagePlan("LEVEL_INTERMEDIATE"), "Allegretto");
    assert.equal(formatAgentUsagePlan("x_premium_plus"), "X Premium+");
    assert.equal(formatAgentUsagePlan("chatgpt_pro"), "Chatgpt Pro");
    assert.equal(formatAgentUsagePlan("PRO"), "Pro");
    assert.equal(formatAgentUsagePlan("Team"), "Team");
    assert.equal(formatAgentUsagePlan("team_enterprise"), "Team Enterprise");
    assert.equal(formatAgentUsagePlan("LEVEL_"), "");
    assert.equal(formatAgentUsagePlan("--"), "");
  });

  it("clamps remaining percentages and chooses the most constrained metric", () => {
    const quota: AgentUsageQuota = {
      schemaVersion: 2,
      agentId: "codex",
      adapter: "test",
      status: "ok",
      source: "provider",
      plan: null,
      fetchedAt: 1,
      metrics: [metric("weekly", 120), metric("rolling", 12.4)],
    };

    assert.equal(getUsageMetricRemainingPercent(quota.metrics[0]), 100);
    assert.equal(getUsageMetricRemainingPercent(quota.metrics[1]), 12);
    assert.equal(
      getUsageMetricRemainingPercent({
        ...quota.metrics[1],
        value: {
          kind: "amount",
          remainingPercent: -5,
          remainingAmount: 0,
          limitAmount: 10,
          unit: "credits",
        },
      }),
      0,
    );
    assert.equal(getPrimaryUsageMetric(quota)?.id, "rolling");
    assert.equal(getPrimaryUsageMetric({ ...quota, metrics: [] }), null);
  });

  it("does not invent percentages for unknown or unlimited values", () => {
    const unknown: AgentUsageMetric = {
      ...metric("unknown", 0),
      value: { kind: "unknown" },
    };
    const unlimited: AgentUsageMetric = {
      ...metric("unlimited", 0),
      value: { kind: "unlimited" },
    };

    assert.equal(getUsageMetricRemainingPercent(unknown), null);
    assert.equal(getUsageMetricRemainingPercent(unlimited), null);
    assert.equal(
      getUsageMetricRemainingPercent({
        ...metric("invalid", 0),
        value: { kind: "percentage", remainingPercent: Number.NaN },
      }),
      null,
    );
    const fallbackQuota: AgentUsageQuota = {
      schemaVersion: 2,
      agentId: "codex",
      adapter: "test",
      status: "ok",
      source: "provider",
      plan: null,
      fetchedAt: 1,
      metrics: [unknown, unlimited],
    };
    assert.equal(getPrimaryUsageMetric(fallbackQuota)?.id, "unknown");
  });
});
