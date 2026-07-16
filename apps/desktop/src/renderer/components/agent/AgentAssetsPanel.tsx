import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  CuboidIcon,
  PackageIcon,
  RefreshCwIcon,
  ServerIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import {
  useAgentAssetDomain,
  type AgentAssetDomain,
  type AgentAssetItem,
} from "./use-agent-asset-domain";

const DOMAIN_STYLE: Record<
  AgentAssetDomain,
  {
    Icon: LucideIcon;
    badgeClass: string;
    iconClass: string;
    panelClass: string;
  }
> = {
  skills: {
    Icon: CuboidIcon,
    panelClass: "border-cyan-500/30 bg-cyan-500/[0.07]",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    iconClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  },
  mcp: {
    Icon: ServerIcon,
    panelClass: "border-blue-500/30 bg-blue-500/[0.07]",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    iconClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  rules: {
    Icon: BookOpenIcon,
    panelClass: "border-amber-500/30 bg-amber-500/[0.08]",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  plugins: {
    Icon: PackageIcon,
    panelClass: "border-violet-500/30 bg-violet-500/[0.07]",
    badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    iconClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
};

const DOMAIN_COPY = {
  skills: {
    heading: ["agents.skillsInstalled", "Skills installed"],
    description: [
      "agents.skillsInstalledDesc",
      "Skills detected in this Agent's configured directory.",
    ],
    empty: [
      "agents.noSkillsDetected",
      "No skills were detected for this Agent.",
    ],
  },
  mcp: {
    heading: ["agents.mcpServers", "MCP servers"],
    description: [
      "agents.mcpServersDesc",
      "MCP servers currently configured for this Agent.",
    ],
    empty: [
      "agents.noMcpDetected",
      "No MCP servers were detected for this Agent.",
    ],
  },
  rules: {
    heading: ["agents.rulesFiles", "Rules files"],
    description: [
      "agents.rulesFilesDesc",
      "Rule files associated with this Agent and their sync state.",
    ],
    empty: [
      "agents.noRulesDetected",
      "No rules file was detected for this Agent.",
    ],
  },
  plugins: {
    heading: ["agents.installedPlugins", "Installed plugins"],
    description: [
      "agents.installedPluginsDesc",
      "Plugins detected for this Agent and their installed versions.",
    ],
    empty: [
      "agents.noPluginsDetected",
      "No plugins were detected for this Agent.",
    ],
  },
} as const;

function AssetInventory({
  emptyLabel,
  Icon,
  items,
}: {
  emptyLabel: string;
  Icon: LucideIcon;
  items: AgentAssetItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          {emptyLabel}
        </p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border/70">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-accent/45"
        >
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {item.label}
          </span>
          {item.meta ? (
            <span className="shrink-0 rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {item.meta}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AgentAssetDomainPanel({
  agent,
  domain,
}: {
  agent: ManagedAgentSummary;
  domain: AgentAssetDomain;
}) {
  const { t } = useTranslation();
  const { items, refresh } = useAgentAssetDomain(agent, domain);
  const style = DOMAIN_STYLE[domain];
  const copy = DOMAIN_COPY[domain];
  const path = agent.paths[domain];
  return (
    <section className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm">
      <header
        className={`flex flex-wrap items-start justify-between gap-5 border-b px-5 py-5 ${style.panelClass}`}
      >
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${style.iconClass}`}
          >
            <style.Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold text-foreground">
                {t(...copy.heading)}
              </h2>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${style.badgeClass}`}
              >
                {items.length}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t(...copy.description)}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-foreground/70">
              {path || t("agents.notAvailable", "Not available")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label={t("agents.refreshCurrentAsset", "Refresh current view")}
          title={t("agents.refreshCurrentAsset", "Refresh current view")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        >
          <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <AssetInventory
        emptyLabel={t(...copy.empty)}
        Icon={style.Icon}
        items={items}
      />
    </section>
  );
}
