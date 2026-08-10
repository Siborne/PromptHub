import type {
  AgentQuotaScope,
  AgentQuotaValue,
  AgentUsageMetric,
} from "@prompthub/shared/types";

export const MAX_AGENT_USAGE_METRICS = 64;
export const ACCOUNT_USAGE_SCOPE: AgentQuotaScope = { kind: "account" };
const MAX_METRIC_ID_LENGTH = 160;
const MAX_METRIC_LABEL_LENGTH = 120;
const MAX_UNIT_LENGTH = 32;

function boundText(value: string, maxLength: number, fallback: string): string {
  const bounded = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return bounded || fallback;
}

function boundScope(scope: AgentQuotaScope): AgentQuotaScope {
  if (scope.kind === "account") return scope;
  return {
    ...scope,
    id: boundText(scope.id, MAX_METRIC_ID_LENGTH, scope.kind),
    label: boundText(scope.label, MAX_METRIC_LABEL_LENGTH, "Quota"),
  };
}

function boundMetricText(metric: AgentUsageMetric): AgentUsageMetric {
  return {
    ...metric,
    id: boundText(metric.id, MAX_METRIC_ID_LENGTH, "quota"),
    label: boundText(metric.label, MAX_METRIC_LABEL_LENGTH, "Quota"),
    scope: boundScope(metric.scope),
    period:
      metric.period.kind === "provider-defined"
        ? {
            ...metric.period,
            label: boundText(
              metric.period.label,
              MAX_METRIC_LABEL_LENGTH,
              "Provider quota",
            ),
          }
        : metric.period,
    value:
      metric.value.kind === "amount"
        ? {
            ...metric.value,
            unit: boundText(metric.value.unit, MAX_UNIT_LENGTH, "units"),
          }
        : metric.value,
  };
}

function clampPercent(value: number): number {
  const bounded = Math.max(0, Math.min(100, value));
  return Math.round(bounded * 1_000) / 1_000;
}

export function percentageFromUsed(usedPercent: number): AgentQuotaValue {
  if (!Number.isFinite(usedPercent)) return { kind: "unknown" };
  return {
    kind: "percentage",
    remainingPercent: clampPercent(100 - usedPercent),
  };
}

export function percentageFromRemaining(
  remainingPercent: number,
): AgentQuotaValue {
  if (!Number.isFinite(remainingPercent)) return { kind: "unknown" };
  return {
    kind: "percentage",
    remainingPercent: clampPercent(remainingPercent),
  };
}

export function amountFromUsed(
  usedAmount: number,
  limitAmount: number,
  unit: string,
): AgentQuotaValue {
  if (
    !Number.isFinite(usedAmount) ||
    !Number.isFinite(limitAmount) ||
    limitAmount <= 0
  ) {
    return { kind: "unknown" };
  }
  const boundedUsed = Math.max(0, Math.min(limitAmount, usedAmount));
  const remainingAmount = limitAmount - boundedUsed;
  return {
    kind: "amount",
    remainingPercent: clampPercent((remainingAmount / limitAmount) * 100),
    remainingAmount,
    limitAmount,
    unit,
  };
}

export function amountFromRemaining(
  remainingAmount: number,
  limitAmount: number,
  unit: string,
): AgentQuotaValue {
  if (
    !Number.isFinite(remainingAmount) ||
    !Number.isFinite(limitAmount) ||
    limitAmount <= 0
  ) {
    return { kind: "unknown" };
  }
  const boundedRemaining = Math.max(0, Math.min(limitAmount, remainingAmount));
  return {
    kind: "amount",
    remainingPercent: clampPercent((boundedRemaining / limitAmount) * 100),
    remainingAmount: boundedRemaining,
    limitAmount,
    unit,
  };
}

export function boundUsageMetrics(
  metrics: AgentUsageMetric[],
): AgentUsageMetric[] {
  return metrics
    .slice(0, MAX_AGENT_USAGE_METRICS)
    .map((metric) => boundMetricText(metric));
}
