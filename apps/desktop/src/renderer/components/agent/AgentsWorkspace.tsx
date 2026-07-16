import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CpuIcon,
  CuboidIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentCapabilityKey,
  AgentCapabilityStatus,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";
import { PlatformIcon } from "../ui/PlatformIcon";
import { AgentAssetDomainPanel } from "./AgentAssetsPanel";
import { AgentConfigFilesPanel } from "./AgentConfigFilesPanel";
import { AgentProviderModelPanel } from "./AgentProviderModelPanel";
import { AgentSessionsPanel } from "./AgentSessionsPanel";
import type { AgentAssetDomain } from "./use-agent-asset-domain";

type AgentWorkspaceTabKey =
  | "overview"
  | "provider"
  | AgentAssetDomain
  | "configFiles"
  | "sessions"
  | "usage"
  | "maintenance";

interface AgentWorkspaceTab {
  capability: AgentCapabilityKey;
  fallback: string;
  key: AgentWorkspaceTabKey;
  labelKey: string;
}

const TABS: AgentWorkspaceTab[] = [
  {
    key: "overview",
    capability: "overview",
    labelKey: "agents.overview",
    fallback: "Overview",
  },
  {
    key: "provider",
    capability: "provider",
    labelKey: "agents.providerAndModel",
    fallback: "Provider & Model",
  },
  {
    key: "skills",
    capability: "assets",
    labelKey: "agents.skills",
    fallback: "Skills",
  },
  {
    key: "mcp",
    capability: "assets",
    labelKey: "agents.mcp",
    fallback: "MCP",
  },
  {
    key: "rules",
    capability: "assets",
    labelKey: "agents.rules",
    fallback: "Rules",
  },
  {
    key: "plugins",
    capability: "assets",
    labelKey: "agents.plugins",
    fallback: "Plugins",
  },
  {
    key: "configFiles",
    capability: "configFiles",
    labelKey: "agents.configFiles",
    fallback: "Config Files",
  },
  {
    key: "sessions",
    capability: "sessions",
    labelKey: "agents.sessions",
    fallback: "Sessions",
  },
  {
    key: "usage",
    capability: "usage",
    labelKey: "agents.usage",
    fallback: "Usage",
  },
  {
    key: "maintenance",
    capability: "maintenance",
    labelKey: "agents.maintenance",
    fallback: "Maintenance",
  },
];

function isAssetDomain(key: AgentWorkspaceTabKey): key is AgentAssetDomain {
  return (
    key === "skills" || key === "mcp" || key === "rules" || key === "plugins"
  );
}

function hasAssetPath(agent: ManagedAgentSummary, key: AgentAssetDomain) {
  return Boolean(agent.paths[key]);
}

function getTabStatus(
  agent: ManagedAgentSummary,
  tab: AgentWorkspaceTab,
): AgentCapabilityStatus {
  if (isAssetDomain(tab.key) && !hasAssetPath(agent, tab.key)) {
    return "unsupported";
  }
  return agent.capabilities[tab.capability].status;
}

function isTabEnabled(agent: ManagedAgentSummary, tab: AgentWorkspaceTab) {
  const status = getTabStatus(agent, tab);
  return status === "supported" || status === "partial";
}

function selectedTabClass(key: AgentWorkspaceTabKey) {
  if (key === "skills")
    return "border-cyan-500 text-cyan-700 dark:text-cyan-300";
  if (key === "mcp") return "border-blue-500 text-blue-700 dark:text-blue-300";
  if (key === "rules")
    return "border-amber-500 text-amber-700 dark:text-amber-300";
  if (key === "plugins")
    return "border-violet-500 text-violet-700 dark:text-violet-300";
  if (key === "configFiles")
    return "border-indigo-500 text-indigo-700 dark:text-indigo-300";
  return "border-primary text-foreground";
}

function StatusBadge({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {agent.isDetected ? (
        <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
      )}
      {t(`agents.${agent.status}`, agent.status)}
    </span>
  );
}

function PathRow({ label, value }: { label: string; value?: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-12 gap-1 border-b border-border/60 px-5 py-3.5 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all font-mono text-xs text-foreground/90">
        {value || t("agents.notAvailable", "Not available")}
      </dd>
    </div>
  );
}

function SummaryCell({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className={`border-b border-border/70 px-5 py-4 last:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0 ${tone}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function CapabilityCell({
  agent,
  tab,
}: {
  agent: ManagedAgentSummary;
  tab: AgentWorkspaceTab;
}) {
  const { t } = useTranslation();
  const status = getTabStatus(agent, tab);
  const available = status === "supported" || status === "partial";
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">
          {t(tab.labelKey, tab.fallback)}
        </p>
        <p
          className={`mt-1 text-xs ${available ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
        >
          {t(`agents.capabilityStatus.${status}`, status)}
        </p>
      </div>
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${available ? "bg-emerald-500" : "bg-muted-foreground/35"}`}
      />
    </div>
  );
}

function OverviewSummary({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("agents.summary", "Summary")}
      className="grid overflow-hidden rounded-md border border-border/80 bg-card shadow-sm sm:grid-cols-2 xl:grid-cols-4"
    >
      <SummaryCell
        label={t("agents.installation", "Installation")}
        tone="bg-emerald-500/[0.06]"
        icon={<ShieldCheckIcon className="h-4 w-4 text-emerald-500" />}
        value={
          <span className="flex items-center gap-2">
            {agent.isDetected ? (
              <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
            )}
            {t(`agents.${agent.status}`, agent.status)}
          </span>
        }
      />
      <SummaryCell
        label={t("agents.provider", "Provider")}
        tone="bg-blue-500/[0.06]"
        icon={<CpuIcon className="h-4 w-4 text-blue-500" />}
        value={t("agents.adapterPending", "Adapter planned")}
      />
      <SummaryCell
        label={t("agents.skills", "Skills")}
        tone="bg-cyan-500/[0.07]"
        icon={
          <CuboidIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
        }
        value={t("agents.pathConfigured", "Path configured")}
      />
      <SummaryCell
        label={t("agents.sessions", "Sessions")}
        tone="bg-violet-500/[0.06]"
        icon={<HistoryIcon className="h-4 w-4 text-violet-500" />}
        value={t("agents.adapterPending", "Adapter planned")}
      />
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

function PathsCapabilitiesPanel({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">
        {t("agents.pathsAndCapabilities", "Paths & capabilities")}
      </h2>
      <div className="mt-3 overflow-hidden rounded-md border border-border/80 bg-card shadow-sm">
        <dl>
          <PathRow
            label={t("agents.rootPath", "Root")}
            value={agent.paths.root}
          />
          <PathRow
            label={t("agents.skillsPath", "Skills")}
            value={agent.paths.skills}
          />
          <PathRow label={t("agents.mcpPath", "MCP")} value={agent.paths.mcp} />
          <PathRow
            label={t("agents.rulesPath", "Rules")}
            value={agent.paths.rules}
          />
          <PathRow
            label={t("agents.pluginsPath", "Plugins")}
            value={agent.paths.plugins}
          />
        </dl>
        <div className="grid border-t border-border/70 bg-muted/15 sm:grid-cols-2 xl:grid-cols-5">
          {TABS.filter((tab) => tab.key !== "overview").map((tab) => (
            <CapabilityCell key={tab.key} agent={agent} tab={tab} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OverviewPanel({ agent }: { agent: ManagedAgentSummary }) {
  return (
    <div className="space-y-7">
      <OverviewSummary agent={agent} />
      <AttentionPanel agent={agent} />
      <PathsCapabilitiesPanel agent={agent} />
    </div>
  );
}

function MaintenancePanel() {
  const { t } = useTranslation();
  const refresh = useAgentStore((state) => state.refresh);
  const requestSettingsSection = useUIStore(
    (state) => state.requestSettingsSection,
  );
  return (
    <section className="rounded-md border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCwIcon className="h-4 w-4" />
          {t("agents.refresh", "Refresh")}
        </button>
        <button
          type="button"
          onClick={() => requestSettingsSection("skill")}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <Settings2Icon className="h-4 w-4" />
          {t("agents.openAgentSettings", "Open Agent settings")}
        </button>
      </div>
    </section>
  );
}

function AgentIdentity({ agent }: { agent: ManagedAgentSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/40 bg-background shadow-sm">
        <PlatformIcon platformId={agent.id} size={52} />
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold text-foreground">
          {agent.name}
        </h1>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge agent={agent} />
          <span aria-hidden="true" className="text-muted-foreground/45">
            •
          </span>
          <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {agent.paths.root}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentHeaderActions({
  onManageSkills,
  onRefresh,
  onSettings,
}: {
  onManageSkills: () => void;
  onRefresh: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const iconButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onManageSkills}
        aria-label={t("agents.manageSkills", "Manage skills")}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <CuboidIcon aria-hidden="true" className="h-4 w-4" />
        {t("agents.manageSkills", "Manage skills")}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        aria-label={t("agents.refresh", "Refresh")}
        title={t("agents.refresh", "Refresh")}
        className={iconButtonClass}
      >
        <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSettings}
        aria-label={t("agents.openAgentSettings", "Open Agent settings")}
        title={t("agents.openAgentSettings", "Open Agent settings")}
        className={iconButtonClass}
      >
        <MoreHorizontalIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function AgentTabs({
  activeTab,
  agent,
  onSelect,
}: {
  activeTab: AgentWorkspaceTabKey;
  agent: ManagedAgentSummary;
  onSelect: (tab: AgentWorkspaceTabKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t("agents.workspaceTabs", "Agent workspace")}
      className="mt-1 flex gap-4 overflow-x-auto"
    >
      {TABS.map((tab) => {
        const enabled = isTabEnabled(agent, tab);
        const selected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={!enabled}
            title={
              enabled
                ? undefined
                : t("agents.adapterPending", "Adapter planned")
            }
            onClick={() => onSelect(tab.key)}
            className={`shrink-0 border-b-2 px-0.5 py-3.5 text-sm font-medium transition-colors ${selected ? selectedTabClass(tab.key) : "border-transparent text-muted-foreground hover:text-foreground"} disabled:cursor-not-allowed disabled:opacity-35`}
          >
            {t(tab.labelKey, tab.fallback)}
          </button>
        );
      })}
    </div>
  );
}

function AgentWorkspacePanel({
  activeTab,
  agent,
}: {
  activeTab: AgentWorkspaceTabKey;
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const meta = TABS.find((tab) => tab.key === activeTab) || TABS[0];
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background px-6 py-7 sm:px-8">
      <div
        role="tabpanel"
        aria-label={t(meta.labelKey, meta.fallback)}
        className="w-full max-w-6xl"
      >
        {activeTab === "overview" ? <OverviewPanel agent={agent} /> : null}
        {activeTab === "provider" ? (
          <AgentProviderModelPanel key={agent.id} agent={agent} />
        ) : null}
        {isAssetDomain(activeTab) ? (
          <AgentAssetDomainPanel agent={agent} domain={activeTab} />
        ) : null}
        {activeTab === "configFiles" ? (
          <AgentConfigFilesPanel agent={agent} />
        ) : null}
        {activeTab === "sessions" ? (
          <AgentSessionsPanel key={agent.id} agent={agent} />
        ) : null}
        {activeTab === "maintenance" ? <MaintenancePanel /> : null}
      </div>
    </main>
  );
}

export function AgentsWorkspace() {
  const { t } = useTranslation();
  const agents = useAgentStore((state) => state.agents);
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const ensureLoaded = useAgentStore((state) => state.ensureLoaded);
  const refresh = useAgentStore((state) => state.refresh);
  const requestSettingsSection = useUIStore(
    (state) => state.requestSettingsSection,
  );
  const [activeTab, setActiveTab] = useState<AgentWorkspaceTabKey>("overview");
  const agent = useMemo(
    () => agents.find((item) => item.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId],
  );

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    const tab = TABS.find((item) => item.key === activeTab);
    if (agent && tab && !isTabEnabled(agent, tab)) setActiveTab("overview");
  }, [activeTab, agent]);

  if (!agent) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t("agents.noAgents", "No Agents are available.")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card px-6 pb-0 pt-6 shadow-sm app-wallpaper-panel-strong sm:px-8">
        <div className="flex min-h-[5.5rem] flex-wrap items-start justify-between gap-5">
          <AgentIdentity agent={agent} />
          <AgentHeaderActions
            onManageSkills={() => setActiveTab("skills")}
            onRefresh={() => void refresh()}
            onSettings={() => requestSettingsSection("skill")}
          />
        </div>
        <AgentTabs
          activeTab={activeTab}
          agent={agent}
          onSelect={setActiveTab}
        />
      </header>
      <AgentWorkspacePanel activeTab={activeTab} agent={agent} />
    </div>
  );
}
