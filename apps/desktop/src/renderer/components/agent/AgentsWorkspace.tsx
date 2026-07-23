import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { useAgentStore } from "../../stores/agent.store";
import { ContextMenu } from "../ui/ContextMenu";
import { PlatformIcon } from "../ui/PlatformIcon";
import { AgentAppearancePanel } from "./AgentAppearancePanel";
import { AgentAssetsWorkspace } from "./AgentAssetsWorkspace";
import { AgentConfigFilesPanel } from "./AgentConfigFilesPanel";
import { AgentOverviewPanel } from "./AgentOverviewPanel";
import { AgentProviderModelPanel } from "./AgentProviderModelPanel";
import { AgentSessionsPanel } from "./AgentSessionsPanel";
import { AgentSettingsDialog } from "./AgentSettingsDialog";
import {
  AGENT_WORKSPACE_TABS,
  isAgentAssetDomain,
  isAgentTabEnabled,
  type AgentWorkspaceNavigate,
  type AgentWorkspaceTabKey,
} from "./agent-workspace-tabs";

interface AgentWorkspaceTarget {
  tab: AgentWorkspaceTabKey;
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

function AgentIdentity({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  const isEnterpriseLegacy = agent.lifecycle === "enterprise-legacy";

  return (
    <div className="flex min-w-0 items-center gap-4">
      <span
        data-testid="agent-identity-icon"
        className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md"
      >
        <PlatformIcon platformId={agent.displayIconId || agent.id} size={52} />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold text-foreground">
            {agent.name}
          </h1>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge agent={agent} />
          <span aria-hidden="true" className="text-muted-foreground/45">
            •
          </span>
          <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {agent.paths.root}
          </p>
        </div>
        {isEnterpriseLegacy ? (
          <p className="mt-2 max-w-2xl text-xs leading-5 text-amber-800 dark:text-amber-200">
            {t(
              "agents.geminiConsumerRetired",
              "Consumer access ended on June 18, 2026. Use Antigravity unless you have an enterprise license or paid API key.",
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AgentOverflowMenu({
  onRefresh,
  onEdit,
}: {
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={position !== null}
        aria-label={t("agents.moreActions", "More actions")}
        title={t("agents.moreActions", "More actions")}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition((current) =>
            current ? null : { x: rect.right, y: rect.bottom + 4 },
          );
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreHorizontalIcon aria-hidden="true" className="h-4 w-4" />
      </button>
      {position ? (
        <ContextMenu
          x={position.x}
          y={position.y}
          onClose={() => setPosition(null)}
          items={[
            {
              label: t("agents.refresh", "Refresh"),
              icon: <RefreshCwIcon className="h-4 w-4" />,
              onClick: onRefresh,
            },
            {
              label: t("agents.editAgent", "Edit Agent"),
              icon: <Settings2Icon className="h-4 w-4" />,
              onClick: onEdit,
            },
          ]}
        />
      ) : null}
    </>
  );
}

function AgentHeaderActions({
  agent,
  onLaunch,
  onRefresh,
  onEdit,
}: {
  agent: ManagedAgentSummary;
  onLaunch: () => void;
  onRefresh: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      {agent.launchable ? (
        <button
          type="button"
          onClick={onLaunch}
          aria-label={t("agents.openAgent", { agent: agent.name })}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <ExternalLinkIcon aria-hidden="true" className="h-4 w-4" />
          {t("agents.openAgent", { agent: agent.name })}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRefresh}
        aria-label={t("agents.refresh", "Refresh")}
        title={t("agents.refresh", "Refresh")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
      >
        <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
      </button>
      <AgentOverflowMenu onRefresh={onRefresh} onEdit={onEdit} />
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
      {AGENT_WORKSPACE_TABS.map((tab) => {
        const enabled = isAgentTabEnabled(agent, tab);
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
            className={`shrink-0 border-b-2 px-0.5 py-3.5 text-sm font-medium transition-colors ${selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"} disabled:cursor-not-allowed disabled:opacity-35`}
          >
            {t(tab.labelKey, tab.fallback)}
          </button>
        );
      })}
    </div>
  );
}

function AgentWorkspacePanel({
  agent,
  onNavigate,
  target,
}: {
  agent: ManagedAgentSummary;
  onNavigate: AgentWorkspaceNavigate;
  target: AgentWorkspaceTarget;
}) {
  const { t } = useTranslation();
  const meta =
    AGENT_WORKSPACE_TABS.find((tab) => tab.key === target.tab) ||
    AGENT_WORKSPACE_TABS[0];
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div
        role="tabpanel"
        aria-label={t(meta.labelKey, meta.fallback)}
        className="flex h-full min-h-0 flex-col"
      >
        {target.tab === "overview" ? (
          <AgentOverviewPanel agent={agent} onNavigate={onNavigate} />
        ) : null}
        {isAgentAssetDomain(target.tab) ? (
          <AgentAssetsWorkspace agent={agent} domain={target.tab} />
        ) : null}
        {target.tab === "provider" ? (
          <AgentProviderModelPanel key={agent.id} agent={agent} />
        ) : null}
        {target.tab === "appearance" ? (
          <AgentAppearancePanel key={agent.id} agent={agent} />
        ) : null}
        {target.tab === "configFiles" ? (
          <AgentConfigFilesPanel agent={agent} />
        ) : null}
        {target.tab === "sessions" ? (
          <AgentSessionsPanel key={agent.id} agent={agent} />
        ) : null}
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
  const [target, setTarget] = useState<AgentWorkspaceTarget>({
    tab: "overview",
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const agent = useMemo(
    () => agents.find((item) => item.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId],
  );

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    const tab = AGENT_WORKSPACE_TABS.find((item) => item.key === target.tab);
    if (agent && tab && !isAgentTabEnabled(agent, tab))
      setTarget({ tab: "overview" });
  }, [target.tab, agent]);

  useEffect(() => setIsSettingsOpen(false), [agent?.id]);

  if (!agent) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t("agents.noAgents", "No Agents are available.")}
      </div>
    );
  }

  const handleNavigate: AgentWorkspaceNavigate = (tab) => setTarget({ tab });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card px-6 pb-0 pt-6 shadow-sm app-wallpaper-panel-strong sm:px-8">
        <div className="flex min-h-[5.5rem] flex-wrap items-start justify-between gap-5">
          <AgentIdentity agent={agent} />
          <AgentHeaderActions
            agent={agent}
            onLaunch={() => void window.api.agent.launch(agent.id)}
            onRefresh={() => void refresh()}
            onEdit={() => setIsSettingsOpen(true)}
          />
        </div>
        <AgentTabs
          activeTab={target.tab}
          agent={agent}
          onSelect={(tab) => setTarget({ tab })}
        />
      </header>
      <AgentWorkspacePanel
        target={target}
        agent={agent}
        onNavigate={handleNavigate}
      />
      <AgentSettingsDialog
        agent={agent}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
