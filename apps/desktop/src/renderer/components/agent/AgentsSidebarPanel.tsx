import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDownIcon,
  ChevronRightIcon,
  PinIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ManagedAgentFilter } from "@prompthub/shared/types";
import { filterManagedAgents } from "../../services/managed-agents";
import { useAgentStore } from "../../stores/agent.store";
import { PlatformIcon } from "../ui/PlatformIcon";

function statusClass(status: "installed" | "configured" | "not-detected") {
  if (status === "installed") return "bg-emerald-500";
  if (status === "configured") return "bg-amber-500";
  return "bg-muted-foreground/40";
}

export function AgentsSidebarPanel() {
  const { t } = useTranslation();
  const [sortMode, setSortMode] = useState<"recommended" | "name">(
    "recommended",
  );
  const agents = useAgentStore((state) => state.agents);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const searchQuery = useAgentStore((state) => state.searchQuery);
  const filter = useAgentStore((state) => state.filter);
  const isLoading = useAgentStore((state) => state.isLoading);
  const ensureLoaded = useAgentStore((state) => state.ensureLoaded);
  const refresh = useAgentStore((state) => state.refresh);
  const selectAgent = useAgentStore((state) => state.selectAgent);
  const setSearchQuery = useAgentStore((state) => state.setSearchQuery);
  const setFilter = useAgentStore((state) => state.setFilter);
  const togglePinned = useAgentStore((state) => state.togglePinned);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const visibleAgents = useMemo(() => {
    const filtered = filterManagedAgents(agents, searchQuery, filter);
    return sortMode === "name"
      ? [...filtered].sort((left, right) => left.name.localeCompare(right.name))
      : filtered;
  }, [agents, filter, searchQuery, sortMode]);

  const filters: Array<{ value: ManagedAgentFilter; label: string }> = [
    { value: "all", label: t("agents.filterAll", "All Agents") },
    { value: "installed", label: t("agents.filterInstalled", "Installed") },
    { value: "configured", label: t("agents.filterConfigured", "Configured") },
    { value: "custom", label: t("agents.filterCustom", "Custom") },
    {
      value: "needs-attention",
      label: t("agents.filterNeedsAttention", "Needs attention"),
    },
    {
      value: "not-detected",
      label: t("agents.filterNotDetected", "Not detected"),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar-background/35">
      <div className="border-b border-border/70 px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("agents.title", "Agents")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("agents.agentCount", "{{count}} available", {
                count: agents.length,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label={t("agents.refresh", "Refresh")}
            title={t("agents.refresh", "Refresh")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground disabled:opacity-50"
            disabled={isLoading}
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <label className="relative block">
          <SearchIcon
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("agents.searchPlaceholder", "Search Agents")}
            className="h-10 w-full rounded-md border border-border bg-background/70 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="relative block">
            <SlidersHorizontalIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as ManagedAgentFilter)
              }
              aria-label={t("agents.filterLabel", "Filter Agents")}
              className="h-10 w-full appearance-none rounded-md border border-border bg-background/70 pl-9 pr-2 text-xs text-foreground outline-none focus:border-primary"
            >
              {filters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block">
            <ArrowUpDownIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value as "recommended" | "name")
              }
              aria-label={t("agents.sortLabel", "Sort Agents")}
              className="h-10 w-full appearance-none rounded-md border border-border bg-background/70 pl-9 pr-2 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="recommended">
                {t("agents.sortRecommended", "Recommended")}
              </option>
              <option value="name">{t("agents.sortName", "Name")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {visibleAgents.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t("agents.noAgentsFound", "No Agents match this view.")}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAgents.map((agent) => {
              const selected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`group relative overflow-hidden rounded-md border transition-colors ${
                    selected
                      ? "border-primary/70 bg-primary/10 shadow-sm"
                      : "border-border/70 bg-background/45 hover:border-border hover:bg-accent/45"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={agent.name}
                    onClick={() => selectAgent(agent.id)}
                    className="flex min-h-[4.5rem] w-full items-center gap-3 px-3 py-2.5 pr-14 text-left"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/60">
                      <PlatformIcon platformId={agent.id} size={34} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {agent.name}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${statusClass(agent.status)}`}
                        />
                        {t(`agents.${agent.status}`, agent.status)}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground/75">
                        {agent.paths.root}
                      </span>
                    </span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground/60"}`}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={
                      agent.isPinned
                        ? t("agents.unpin", "Unpin")
                        : t("agents.pin", "Pin")
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePinned(agent.id);
                    }}
                    className={`absolute right-7 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-accent ${
                      agent.isPinned
                        ? "text-primary"
                        : "text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
                    }`}
                  >
                    <PinIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
