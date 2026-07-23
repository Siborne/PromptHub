import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  GaugeIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentUsageMetric,
  AgentUsageQuota,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import {
  getAgentRemainingTone,
  useAgentUsage,
  type AgentUsageTone,
} from "./use-agent-usage";

const RING_TONE_STROKE_CLASS: Record<AgentUsageTone, string> = {
  normal: "text-primary",
  warning: "text-amber-500",
  critical: "text-destructive",
};

const BAR_TONE_FILL_CLASS: Record<AgentUsageTone, string> = {
  normal: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-destructive",
};

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MAX_VISIBLE_METRICS = 5;

const KNOWN_METRIC_LABEL_KEYS: Record<string, string> = {
  fiveHour: "agents.usageTab.fiveHourWindow",
  sevenDay: "agents.usageTab.sevenDayWindow",
  sevenDayOpus: "agents.usageTab.sevenDayOpusWindow",
  weekly: "agents.usageTab.weeklyWindow",
  rolling: "agents.usageTab.rollingWindow",
  premium: "agents.usageTab.premiumRequests",
  chat: "agents.usageTab.chatRequests",
  promptCredits: "agents.usageTab.promptCredits",
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

function resolveMetricLabel(metric: AgentUsageMetric, t: TranslateFn): string {
  if (metric.id.startsWith("antigravity:")) {
    const windowLabel = metric.id.endsWith(":weekly")
      ? t("agents.usageTab.weeklyWindow")
      : metric.id.endsWith(":5h")
        ? t("agents.usageTab.fiveHourWindow")
        : null;
    if (windowLabel) return `${metric.label} · ${windowLabel}`;
  }
  const key = KNOWN_METRIC_LABEL_KEYS[metric.id];
  return key ? t(key) : metric.label;
}

function remainingPercent(utilization: number): number {
  return Math.min(100, Math.max(0, 100 - Math.round(utilization)));
}

function formatResetCountdown(resetsAt: number | null, t: TranslateFn): string {
  if (!resetsAt) return t("agents.notAvailable");
  const remainingMs = resetsAt - Date.now();
  if (remainingMs <= 0) return t("agents.usageTab.resetDue");
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    return t("agents.usageTab.resetsInDaysHours", {
      days: Math.floor(hours / 24),
      hours: hours % 24,
    });
  }
  return t("agents.usageTab.resetsInHoursMinutes", { hours, minutes });
}

function UsageRing({
  label,
  metric,
  placeholder = false,
}: {
  label: string;
  metric: AgentUsageMetric;
  placeholder?: boolean;
}) {
  const { t } = useTranslation();
  const remaining = placeholder ? 0 : remainingPercent(metric.utilization);
  const filled = (remaining / 100) * RING_CIRCUMFERENCE;
  const tone: AgentUsageTone = placeholder
    ? "normal"
    : getAgentRemainingTone(remaining);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg
          role="img"
          aria-label={
            placeholder
              ? t("agents.usageTab.ringLabel", {
                  window: label,
                  utilization: 0,
                })
              : t("agents.usageTab.ringRemainingLabel", {
                  window: label,
                  remaining,
                })
          }
          viewBox="0 0 64 64"
          className="h-16 w-16"
        >
          <circle
            cx="32"
            cy="32"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeOpacity={0.35}
            className="text-muted"
          />
          <circle
            cx="32"
            cy="32"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${RING_CIRCUMFERENCE - filled}`}
            transform="rotate(-90 32 32)"
            className={`transition-[stroke-dasharray] duration-700 ease-out ${
              placeholder
                ? "text-muted-foreground"
                : RING_TONE_STROKE_CLASS[tone]
            }`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
          {remaining}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">
          {label}
          <span className="font-normal text-muted-foreground">
            {" · "}
            {t("agents.usageTab.remainingLabel")}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatResetCountdown(metric.resetsAt, t)}
        </p>
      </div>
    </div>
  );
}

function UsageQuotaBar({
  label,
  metric,
}: {
  label: string;
  metric: AgentUsageMetric;
}) {
  const { t } = useTranslation();
  const remaining = remainingPercent(metric.utilization);
  const tone = getAgentRemainingTone(remaining);
  const hasAmount =
    metric.usedAmount !== undefined && metric.totalAmount !== undefined;
  return (
    <div className="flex min-h-7 items-center gap-3">
      <span className="w-32 shrink-0 truncate text-xs font-semibold text-foreground">
        {label}
      </span>
      <div
        role="progressbar"
        aria-label={t("agents.usageTab.ringRemainingLabel", {
          window: label,
          remaining,
        })}
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${BAR_TONE_FILL_CLASS[tone]}`}
          style={{ width: `${remaining}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold text-foreground">
        {remaining}%
      </span>
      {hasAmount ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("agents.usageTab.quotaUsedOf", {
            used: metric.usedAmount,
            total: metric.totalAmount,
            unit: metric.unit ?? "",
          })}
        </span>
      ) : null}
      {metric.resetsAt ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatResetCountdown(metric.resetsAt, t)}
        </span>
      ) : null}
    </div>
  );
}

function QuotaContent({
  quota,
  isLoading,
  onRefresh,
}: {
  quota: AgentUsageQuota | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const placeholder = quota === null;
  let windowMetrics: AgentUsageMetric[] = [];
  let quotaMetrics: AgentUsageMetric[] = [];
  let hiddenQuotaCount = 0;
  if (placeholder) {
    windowMetrics = [
      {
        id: "fiveHour",
        label: t("agents.usageTab.fiveHourWindow"),
        kind: "window",
        utilization: 100,
        resetsAt: null,
      },
      {
        id: "sevenDay",
        label: t("agents.usageTab.sevenDayWindow"),
        kind: "window",
        utilization: 100,
        resetsAt: null,
      },
    ];
  } else {
    const metrics = Array.isArray(quota.metrics) ? quota.metrics : [];
    windowMetrics = metrics.filter(
      (metric) =>
        metric.kind === "window" ||
        metric.usedAmount === undefined ||
        metric.totalAmount === undefined,
    );
    const sortedQuotas = metrics
      .filter(
        (metric) =>
          metric.kind === "quota" &&
          metric.usedAmount !== undefined &&
          metric.totalAmount !== undefined,
      )
      .sort(
        (left, right) =>
          remainingPercent(left.utilization) -
          remainingPercent(right.utilization),
      );
    const quotaBudget = Math.max(0, MAX_VISIBLE_METRICS - windowMetrics.length);
    quotaMetrics = sortedQuotas.slice(0, quotaBudget);
    hiddenQuotaCount = sortedQuotas.length - quotaMetrics.length;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      {windowMetrics.map((metric) => (
        <UsageRing
          key={metric.id}
          label={resolveMetricLabel(metric, t)}
          metric={metric}
          placeholder={placeholder}
        />
      ))}
      {quotaMetrics.length > 0 ? (
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          {quotaMetrics.map((metric) => (
            <UsageQuotaBar
              key={metric.id}
              label={resolveMetricLabel(metric, t)}
              metric={metric}
            />
          ))}
          {hiddenQuotaCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("agents.usageTab.moreMetrics", { count: hiddenQuotaCount })}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-3">
        {quota?.plan ? (
          <span className="inline-flex items-center rounded-md border border-border/70 bg-muted/15 px-2.5 py-1 font-mono text-xs text-muted-foreground">
            {quota.plan}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {t("agents.usageTab.providerReported")}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label={t("agents.refresh")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}

function GuidedState({
  title,
  description,
  primaryAction,
  onRetry,
}: {
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <AlertTriangleIcon
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-amber-500"
      />
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {description}
      </p>
      {primaryAction ? (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <ExternalLinkIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {primaryAction.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
      >
        <RefreshCwIcon aria-hidden="true" className="h-3.5 w-3.5" />
        {t("agents.usageTab.retry")}
      </button>
    </div>
  );
}

function CustomProviderState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <GaugeIcon
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
      <p className="text-xs font-semibold text-foreground">
        {t("agents.usageTab.customProviderTitle")}
      </p>
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {t("agents.usageTab.customProviderDesc")}
      </p>
    </div>
  );
}

function AgentUsageBannerContent({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  const { quota, isLoading, hasError, refresh } = useAgentUsage(agent.id);

  const status = hasError ? "unavailable" : quota?.status;
  const isCustomProviderActive =
    !hasError &&
    quota?.status === "unavailable" &&
    quota.errorCode === "custom-provider-active";
  const isAntigravityNotRunning =
    !hasError &&
    quota?.status === "unavailable" &&
    quota.errorCode === "antigravity-not-running";

  return (
    <section
      aria-label={t("agents.usage")}
      className="border-b border-border bg-card px-5 py-4"
    >
      {quota?.status === "ok" ? (
        <QuotaContent quota={quota} isLoading={isLoading} onRefresh={refresh} />
      ) : null}

      {quota?.status !== "ok" && isLoading ? (
        <QuotaContent quota={null} isLoading={isLoading} onRefresh={refresh} />
      ) : null}

      {!isLoading && status === "no-credentials" ? (
        <GuidedState
          title={t("agents.usageTab.noCredentialsTitle", {
            agent: agent.name,
          })}
          description={t("agents.usageTab.noCredentialsDesc", {
            agent: agent.name,
          })}
          onRetry={refresh}
        />
      ) : null}

      {!isLoading && status === "expired" ? (
        <GuidedState
          title={t("agents.usageTab.expiredTitle")}
          description={t("agents.usageTab.expiredDesc", {
            agent: agent.name,
          })}
          onRetry={refresh}
        />
      ) : null}

      {!isLoading && isCustomProviderActive ? <CustomProviderState /> : null}

      {!isLoading && isAntigravityNotRunning ? (
        <GuidedState
          title={t("agents.usageTab.antigravityNotRunningTitle")}
          description={t("agents.usageTab.antigravityNotRunningDesc")}
          primaryAction={
            agent.launchable
              ? {
                  label: t("agents.openAgent", { agent: agent.name }),
                  onClick: () => void window.api.agent.launch(agent.id),
                }
              : undefined
          }
          onRetry={refresh}
        />
      ) : null}

      {!isLoading &&
      status === "unavailable" &&
      !isCustomProviderActive &&
      !isAntigravityNotRunning ? (
        <GuidedState
          title={t("agents.usageTab.unavailableTitle")}
          description={t("agents.usageTab.unavailableDesc")}
          onRetry={refresh}
        />
      ) : null}
    </section>
  );
}

export function AgentUsageBanner({ agent }: { agent: ManagedAgentSummary }) {
  const usageStatus = agent.capabilities.usage.status;
  if (usageStatus !== "supported" && usageStatus !== "partial") {
    return null;
  }
  return <AgentUsageBannerContent agent={agent} />;
}
