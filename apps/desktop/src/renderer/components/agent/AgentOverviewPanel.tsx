import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CpuIcon,
  CuboidIcon,
  FileCogIcon,
  FolderOpenIcon,
  HistoryIcon,
  PackageIcon,
  PaletteIcon,
  ServerIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentCapabilityStatus,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { useMcpStore } from "../../stores/mcp.store";
import { usePluginStore } from "../../stores/plugin.store";
import { useRulesStore } from "../../stores/rules.store";
import { useSkillStore } from "../../stores/skill.store";
import { AgentUsageBanner } from "./AgentUsageBanner";
import { type AgentWorkspaceNavigate } from "./agent-workspace-tabs";
import {
  useAgentAssetDomain,
  type AgentAssetDomain,
} from "./use-agent-asset-domain";

function isEnabled(status: AgentCapabilityStatus): boolean {
  return status === "supported" || status === "partial";
}

function assetDomainStatus(
  agent: ManagedAgentSummary,
  domain: AgentAssetDomain,
): AgentCapabilityStatus {
  if (!agent.paths[domain]) return "unsupported";
  return agent.capabilities.assets.status;
}

function NavCellShell({
  icon: Icon,
  label,
  primary,
  primaryClassName,
  secondary,
  secondaryClassName,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  primary: string;
  primaryClassName?: string;
  secondary?: string;
  secondaryClassName?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/15 px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <span
          className={`mt-1 block truncate text-sm font-semibold ${primaryClassName || "text-foreground"}`}
        >
          {primary}
        </span>
        {secondary ? (
          <span
            className={`mt-0.5 block truncate text-xs ${secondaryClassName || "text-muted-foreground"}`}
          >
            {secondary}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon
        aria-hidden="true"
        className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60"
      />
    </button>
  );
}

function DisabledNavCell({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  const { t } = useTranslation();
  const reason = t("agents.adapterPending", "Adapter planned");
  return (
    <div
      aria-disabled="true"
      title={reason}
      className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/15 px-4 py-3.5 opacity-35"
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-foreground">
          —
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {reason}
        </span>
      </span>
    </div>
  );
}

function AssetNavCell({
  agent,
  domain,
  icon,
  isLoading,
  label,
  onSelect,
}: {
  agent: ManagedAgentSummary;
  domain: AgentAssetDomain;
  icon: LucideIcon;
  isLoading: boolean;
  label: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { items } = useAgentAssetDomain(agent, domain);
  const managedCount =
    domain === "skills"
      ? items.filter((item) => item.meta === t("agents.managed", "Managed"))
          .length
      : 0;
  const secondary =
    domain === "skills"
      ? t("agents.overviewNav.managedExternal", {
          managed: managedCount,
          external: items.length - managedCount,
        })
      : t(`agents.capabilityStatus.${assetDomainStatus(agent, domain)}`);
  return (
    <NavCellShell
      icon={icon}
      label={label}
      primary={isLoading ? "—" : String(items.length)}
      secondary={secondary}
      onSelect={onSelect}
    />
  );
}

function SessionsNavCell({
  agent,
  onSelect,
}: {
  agent: ManagedAgentSummary;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setTotal(null);
    setFailed(false);
    window.api.agent
      .listSessions(agent.id, 1)
      .then((result) => {
        if (active) setTotal(result.total);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [agent.id]);
  return (
    <NavCellShell
      icon={HistoryIcon}
      label={t("agents.sessions")}
      primary={
        failed
          ? t("agents.notAvailable", "Not available")
          : total === null
            ? "—"
            : String(total)
      }
      secondary={t(
        `agents.capabilityStatus.${agent.capabilities.sessions.status}`,
      )}
      onSelect={onSelect}
    />
  );
}

function ProviderNavCell({
  agent,
  onSelect,
}: {
  agent: ManagedAgentSummary;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<{
    model: string | null;
    provider: string | null;
    credentialStatus: string;
  } | null>(null);
  const [customProvider, setCustomProvider] = useState<{
    baseUrl: string;
    model: string | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSummary(null);
    setCustomProvider(null);
    setFailed(false);
    window.api.agent
      .getModelConfig(agent.id)
      .then((config) => {
        if (!active) return;
        setSummary({
          model: config.model,
          provider: config.provider,
          credentialStatus: config.credentialStatus,
        });
        // A custom gateway (e.g. Claude's ANTHROPIC_BASE_URL) makes the
        // endpoint the meaningful identity of the active provider.
        if (
          agent.id !== "codex" &&
          config.provider &&
          config.provider !== "anthropic" &&
          config.endpoint
        ) {
          setCustomProvider({
            baseUrl: config.endpoint,
            model: config.model,
          });
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    if (agent.id === "codex") {
      window.api.agent
        .listProviders(agent.id)
        .then((list) => {
          if (!active || list.activeProvider === "openai") return;
          const activeProvider =
            list.providers.find(
              (provider) => provider.id === list.activeProvider,
            ) ?? null;
          if (!activeProvider?.baseUrl) return;
          setCustomProvider({
            baseUrl: activeProvider.baseUrl,
            model: activeProvider.profileModel || list.defaultModel,
          });
        })
        .catch(() => {
          // The provider list only enriches the Codex cell; the model-config
          // summary above remains the fallback when it cannot be loaded.
        });
    }
    return () => {
      active = false;
    };
  }, [agent.id]);
  return (
    <NavCellShell
      icon={CpuIcon}
      label={t("agents.providerAndModel")}
      primary={
        failed
          ? t("agents.notAvailable", "Not available")
          : customProvider
            ? customProvider.baseUrl
            : summary === null
              ? "—"
              : summary.model || summary.provider || "—"
      }
      secondary={
        customProvider
          ? customProvider.model || undefined
          : summary && !failed
            ? t(`agents.credentialStatus.${summary.credentialStatus}`)
            : undefined
      }
      onSelect={onSelect}
    />
  );
}

function AppearanceNavCell({
  agent,
  onSelect,
}: {
  agent: ManagedAgentSummary;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<{
    activeThemeId: string | null;
    themeCount: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSummary(null);
    setFailed(false);
    window.api.agent
      .getAppearance(agent.id)
      .then((overview) => {
        if (!active) return;
        setSummary({
          activeThemeId: overview.activeThemeId,
          themeCount: overview.themes.length,
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [agent.id]);
  return (
    <NavCellShell
      icon={PaletteIcon}
      label={t("agents.appearanceTab")}
      primary={
        failed
          ? t("agents.notAvailable", "Not available")
          : summary === null
            ? "—"
            : summary.activeThemeId || String(summary.themeCount)
      }
      secondary={
        summary && !failed
          ? summary.activeThemeId
            ? t("agents.appearance.activeSkin")
            : t("agents.overviewNav.themeCount", {
                count: summary.themeCount,
              })
          : undefined
      }
      onSelect={onSelect}
    />
  );
}

function OverviewNavGrid({
  agent,
  onNavigate,
}: {
  agent: ManagedAgentSummary;
  onNavigate: AgentWorkspaceNavigate;
}) {
  const { t } = useTranslation();
  const skillScan = useSkillStore((state) => state.agentScanState[agent.id]);
  const mcpLibrary = useMcpStore((state) => state.library);
  const rulesLoaded = useRulesStore((state) => state.hasLoadedFiles);
  const pluginLibrary = usePluginStore((state) => state.library);

  const assetLoading: Record<AgentAssetDomain, boolean> = {
    skills: agent.isDetected && !skillScan?.result,
    mcp: !mcpLibrary,
    rules: !rulesLoaded,
    plugins: !pluginLibrary,
  };
  const assetMeta: Array<{
    domain: AgentAssetDomain;
    icon: LucideIcon;
    label: string;
  }> = [
    { domain: "skills", icon: CuboidIcon, label: t("agents.skills") },
    { domain: "mcp", icon: ServerIcon, label: t("agents.mcp") },
    { domain: "rules", icon: BookOpenIcon, label: t("agents.rules") },
    { domain: "plugins", icon: PackageIcon, label: t("agents.plugins") },
  ];

  const providerStatus = agent.capabilities.provider.status;
  const appearanceStatus = agent.capabilities.appearance.status;
  const sessionsStatus = agent.capabilities.sessions.status;
  const configFilesStatus = agent.capabilities.configFiles.status;

  return (
    <section
      aria-label={t("agents.overview", "Overview")}
      className="rounded-md border border-border/80 bg-card p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {assetMeta.map(({ domain, icon, label }) =>
          isEnabled(assetDomainStatus(agent, domain)) ? (
            <AssetNavCell
              key={domain}
              agent={agent}
              domain={domain}
              icon={icon}
              isLoading={assetLoading[domain]}
              label={label}
              onSelect={() => onNavigate(domain)}
            />
          ) : (
            <DisabledNavCell key={domain} icon={icon} label={label} />
          ),
        )}
        {isEnabled(sessionsStatus) ? (
          <SessionsNavCell
            agent={agent}
            onSelect={() => onNavigate("sessions")}
          />
        ) : (
          <DisabledNavCell icon={HistoryIcon} label={t("agents.sessions")} />
        )}
        {isEnabled(providerStatus) ? (
          <ProviderNavCell
            agent={agent}
            onSelect={() => onNavigate("provider")}
          />
        ) : (
          <DisabledNavCell
            icon={CpuIcon}
            label={t("agents.providerAndModel")}
          />
        )}
        {isEnabled(appearanceStatus) ? (
          <AppearanceNavCell
            agent={agent}
            onSelect={() => onNavigate("appearance")}
          />
        ) : (
          <DisabledNavCell
            icon={PaletteIcon}
            label={t("agents.appearanceTab")}
          />
        )}
        {isEnabled(configFilesStatus) ? (
          <NavCellShell
            icon={FileCogIcon}
            label={t("agents.configFiles")}
            primary={String(agent.paths.configFileRelativePaths.length)}
            secondary={t(`agents.capabilityStatus.${configFilesStatus}`)}
            onSelect={() => onNavigate("configFiles")}
          />
        ) : (
          <DisabledNavCell icon={FileCogIcon} label={t("agents.configFiles")} />
        )}
      </div>
    </section>
  );
}

function AttentionPanel({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  if (agent.isDetected) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">
        {t("agents.needsAttention", "Needs attention")}
      </h2>
      <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
        <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("agents.agentNotDetected", "Agent not detected")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("agents.agentNotDetectedDesc")}
          </p>
        </div>
      </div>
    </section>
  );
}

function PathRow({ label, value }: { label: string; value?: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-12 gap-1 border-b border-border/60 px-5 py-3.5 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 break-all font-mono text-xs text-foreground/90">
          {value || t("agents.notAvailable", "Not available")}
        </span>
        {value ? (
          <button
            type="button"
            aria-label={t("agents.openPathFolder", { label })}
            onClick={() => void window.electron?.openPath?.(value)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FolderOpenIcon aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </dd>
    </div>
  );
}

function PathsPanel({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">
        {t("agents.pathConfiguration", "Paths")}
      </h2>
      <div className="mt-3 overflow-hidden rounded-md border border-border/80 bg-card shadow-sm">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-open:rotate-180"
            />
            {t("agents.pathDetailsToggle", "Path details")}
          </summary>
          <dl className="border-t border-border/60">
            <PathRow
              label={t("agents.rootPath", "Root")}
              value={agent.paths.root}
            />
            <PathRow
              label={t("agents.skillsPath", "Skills")}
              value={agent.paths.skills}
            />
            <PathRow
              label={t("agents.mcpPath", "MCP")}
              value={agent.paths.mcp}
            />
            <PathRow
              label={t("agents.rulesPath", "Rules")}
              value={agent.paths.rules}
            />
            <PathRow
              label={t("agents.pluginsPath", "Plugins")}
              value={agent.paths.plugins}
            />
          </dl>
        </details>
      </div>
    </section>
  );
}

export function AgentOverviewPanel({
  agent,
  onNavigate,
}: {
  agent: ManagedAgentSummary;
  onNavigate: AgentWorkspaceNavigate;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-card">
        <AgentUsageBanner agent={agent} />
        <div className="space-y-6 px-5 py-4">
          <AttentionPanel agent={agent} />
          <OverviewNavGrid agent={agent} onNavigate={onNavigate} />
          <PathsPanel agent={agent} />
        </div>
      </div>
    </div>
  );
}
