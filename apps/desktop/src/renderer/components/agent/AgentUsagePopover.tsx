import { ChevronDown, RefreshCw } from "lucide-react";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AgentUsageMetric,
  AgentUsageQuota,
} from "@prompthub/shared/types";
import { useSettingsStore } from "../../stores/settings.store";
import { getRendererPlatform } from "../../services/runtime-platform";
import { PlatformIcon } from "../ui/PlatformIcon";
import {
  AGENT_USAGE_POPOVER_AGENTS,
  formatAgentUsagePlan,
  getPrimaryUsageMetric,
  getRemainingPercent,
  loadAgentUsageBatch,
} from "./agent-usage-popover-model";
import { readCachedAgentUsage, writeCachedAgentUsage } from "./use-agent-usage";

interface UsageRowState {
  quota: AgentUsageQuota | null;
  isLoading: boolean;
  hasError: boolean;
}

const METRIC_KEYS: Record<string, string> = {
  fiveHour: "agents.usageTab.fiveHourWindow",
  sevenDay: "agents.usageTab.sevenDayWindow",
  sevenDayOpus: "agents.usageTab.sevenDayOpusWindow",
  weekly: "agents.usageTab.weeklyWindow",
  rolling: "agents.usageTab.rollingWindow",
  premium: "agents.usageTab.premiumRequests",
  chat: "agents.usageTab.chatRequests",
  promptCredits: "agents.usageTab.promptCredits",
};

function createInitialState(): Record<string, UsageRowState> {
  return Object.fromEntries(
    AGENT_USAGE_POPOVER_AGENTS.map(({ id }) => {
      const quota = readCachedAgentUsage(id);
      return [id, { quota, isLoading: quota === null, hasError: false }];
    }),
  );
}

function usePopoverTheme(): void {
  const themeMode = useSettingsStore((state) => state.themeMode);
  useEffect(() => {
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)",
    ).matches;
    document.documentElement.classList.toggle(
      "dark",
      themeMode === "dark" || (themeMode === "system" && prefersDark),
    );
  }, [themeMode]);
}

function usePopoverUsage() {
  const [rows, setRows] = useState(createInitialState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeRef = useRef(true);
  const loadRef = useRef<Promise<void> | null>(null);

  const load = useCallback((forceRefresh: boolean) => {
    if (loadRef.current) return loadRef.current;
    if (forceRefresh) setIsRefreshing(true);
    const pending = loadAgentUsageBatch({
      forceRefresh,
      getUsage: window.api.agent.getUsage,
      onItem: (quota) => {
        if (!activeRef.current) return;
        setRows((current) => {
          const previous = current[quota.agentId];
          const preserveCached =
            quota.status === "unavailable" && previous?.quota?.status === "ok";
          if (!preserveCached) writeCachedAgentUsage(quota);
          return {
            ...current,
            [quota.agentId]: {
              quota: preserveCached ? previous.quota : quota,
              isLoading: false,
              hasError: preserveCached || quota.status === "unavailable",
            },
          };
        });
      },
    }).then(() => undefined);
    loadRef.current = pending.finally(() => {
      loadRef.current = null;
      if (activeRef.current) setIsRefreshing(false);
    });
    return loadRef.current;
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void load(false);
    return () => {
      activeRef.current = false;
    };
  }, [load]);

  return { isRefreshing, load, rows };
}

function metricLabel(metric: AgentUsageMetric, t: TFunction) {
  const key = METRIC_KEYS[metric.id];
  return key ? t(key) : metric.label;
}

function resetLabel(metric: AgentUsageMetric, t: TFunction) {
  if (metric.resetsAt === null) return "";
  const remainingMinutes = Math.max(
    0,
    Math.ceil((metric.resetsAt - Date.now()) / 60_000),
  );
  if (remainingMinutes === 0) return t("agents.usageTab.resetDue");
  const days = Math.floor(remainingMinutes / 1_440);
  const hours = Math.floor((remainingMinutes % 1_440) / 60);
  if (days > 0) {
    return t("agents.usageTab.resetsInDaysHours", { days, hours });
  }
  return t("agents.usageTab.resetsInHoursMinutes", {
    hours,
    minutes: remainingMinutes % 60,
  });
}

function statusText(
  quota: AgentUsageQuota | null,
  isLoading: boolean,
  t: TFunction,
) {
  if (isLoading && !quota) return t("agents.usageTab.loading");
  if (quota?.status === "no-credentials")
    return t("agents.usageTab.notConnected");
  if (quota?.status === "expired") return t("agents.usageTab.expiredShort");
  return t("agents.usageTab.unavailableTitle");
}

function UsageProgress({ remaining }: { remaining: number }) {
  const color =
    remaining <= 10
      ? "bg-destructive"
      : remaining <= 30
        ? "bg-amber-500"
        : "bg-primary";
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-foreground/10">
      <span
        className={`block h-full rounded-full ${color}`}
        style={{ width: `${remaining}%` }}
      />
    </span>
  );
}

function AgentUsageRow({
  id,
  name,
  state,
}: {
  id: string;
  name: string;
  state: UsageRowState;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const valid = state.quota?.status === "ok" && state.quota.metrics.length > 0;
  const primary = valid ? getPrimaryUsageMetric(state.quota!) : null;
  const remaining = primary ? getRemainingPercent(primary.utilization) : null;
  const primaryLabel = primary ? metricLabel(primary, t) : "";
  const toggleLabel = t(
    expanded
      ? "agents.usagePopover.hideDetails"
      : "agents.usagePopover.showDetails",
    { agent: name },
  );
  const plan = state.quota?.plan
    ? formatAgentUsagePlan(state.quota.plan)
    : null;
  const reset = primary ? resetLabel(primary, t) : "";
  const remainingLabel = t("agents.usageTab.remainingLabel");

  return (
    <article
      aria-label={t("agents.usagePopover.agentLabel", { agent: name })}
      className="border-b border-border/70 px-4 py-3 last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <PlatformIcon platformId={id} size={26} className="rounded-md" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {name}
        </h2>
        {plan ? (
          <span
            className="max-w-28 truncate text-xs text-muted-foreground"
            title={plan}
          >
            {plan}
          </span>
        ) : null}
        {state.quota && state.quota.metrics.length > 1 ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : (
          <span />
        )}
      </div>
      {primary && remaining !== null ? (
        <div
          role="progressbar"
          aria-label={t("agents.usagePopover.progressLabel", {
            agent: name,
            metric: primaryLabel,
            remaining,
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={remaining}
          className="mt-2 pl-9"
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-foreground">
              {primaryLabel}
              {state.hasError ? ` · ${t("agents.usagePopover.cached")}` : ""}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {remaining}% {remainingLabel}
            </span>
          </div>
          <UsageProgress remaining={remaining} />
          {reset ? (
            <div className="mt-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
              {reset}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 pl-9 text-xs text-muted-foreground">
          {statusText(state.quota, state.isLoading, t)}
        </p>
      )}
      {expanded && state.quota ? (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2 pl-9 text-xs">
          {state.quota.metrics
            .filter((metric) => metric.id !== primary?.id)
            .map((metric) => {
              const metricReset = resetLabel(metric, t);
              const metricRemaining = getRemainingPercent(metric.utilization);
              return (
                <div key={metric.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {metricLabel(metric, t)}
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {metricRemaining}% {remainingLabel}
                    </span>
                  </div>
                  <UsageProgress remaining={metricRemaining} />
                  {metricReset ? (
                    <div className="text-right text-[11px] tabular-nums text-muted-foreground">
                      {metricReset}
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      ) : null}
    </article>
  );
}

export function AgentUsagePopover() {
  usePopoverTheme();
  const { t } = useTranslation();
  const { isRefreshing, load, rows } = usePopoverUsage();
  const agents = useMemo(() => AGENT_USAGE_POPOVER_AGENTS, []);
  const usesNativeMaterial = getRendererPlatform() === "darwin";
  const shellClassName = usesNativeMaterial
    ? "rounded-xl border border-border/70 bg-transparent shadow-none"
    : "rounded-lg border border-border bg-popover shadow-xl";

  return (
    <main
      data-material={usesNativeMaterial ? "native" : "fallback"}
      className={`flex h-screen flex-col overflow-hidden text-popover-foreground ${shellClassName}`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <h1 className="text-sm font-semibold">
            {t("agents.usagePopover.title")}
          </h1>
        </div>
        <button
          type="button"
          aria-label={t("agents.usagePopover.refresh")}
          title={t("agents.usagePopover.refresh")}
          disabled={isRefreshing}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          onClick={() => void load(true)}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </button>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto">
        {agents.map((agent) => (
          <AgentUsageRow
            key={agent.id}
            id={agent.id}
            name={agent.name}
            state={rows[agent.id]}
          />
        ))}
      </section>
    </main>
  );
}
