import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileJsonIcon,
  Loader2Icon,
  PlusIcon,
  ServerIcon,
  TrashIcon,
} from "lucide-react";

import type { McpTargetPreset } from "@prompthub/core";
import type {
  McpServerConfig,
  McpTargetStatusEntry,
} from "@prompthub/shared/types/mcp";
import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { AgentMcpDetailActions } from "../mcp/AgentMcpDetailActions";
import {
  buildAgentMcpImportDraft,
  findAgentMcpServer,
} from "../mcp/mcp-manager-utils";
import { useMcpStore } from "../../stores/mcp.store";
import { useUIStore } from "../../stores/ui.store";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";
import { matchesManagedAgentTarget } from "./agent-target-matching";
import {
  AgentAssetActionButton,
  AgentAssetCard,
  AgentAssetManagementSurface,
} from "./AgentAssetManagementSurface";
import { useBoundedPage } from "./BoundedListPager";

type AgentMcpFilter = "all" | "managed" | "external" | "enabled" | "disabled";

interface AgentMcpCard {
  key: string;
  preset: McpTargetPreset;
  status: McpTargetStatusEntry;
  serverName: string;
  server: McpServerConfig;
  managedServer?: McpServerConfig;
}

const FILTER_ORDER: AgentMcpFilter[] = [
  "all",
  "managed",
  "external",
  "enabled",
  "disabled",
];

function isAgentPreset(
  preset: McpTargetPreset,
  agent: ManagedAgentSummary,
): boolean {
  return matchesManagedAgentTarget([preset.platformId, preset.target], agent);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getStatusForPreset(
  targetStatus: McpTargetStatusEntry[],
  presetId: string,
): McpTargetStatusEntry | undefined {
  return targetStatus.find((entry) => entry.presetId === presetId);
}

function buildFallbackAgentServer(
  preset: McpTargetPreset,
  name: string,
): McpServerConfig {
  return {
    id: `agent-${preset.id}-${name}`,
    name,
    displayName: name,
    transport: "stdio",
    enabled: true,
    source: { type: "import", id: preset.id, label: preset.label },
    createdAt: 0,
    updatedAt: 0,
  };
}

function getAgentServer(
  preset: McpTargetPreset,
  status: McpTargetStatusEntry,
  name: string,
  managedServer?: McpServerConfig,
): McpServerConfig {
  return (
    status.servers?.find((server) => server.name === name) ??
    managedServer ??
    buildFallbackAgentServer(preset, name)
  );
}

function formatRecord(record?: Record<string, string>): string {
  return Object.entries(record ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function formatInvocation(server: McpServerConfig): string {
  if (server.transport === "stdio") {
    return (
      [server.command, ...(server.args ?? [])].filter(Boolean).join(" ") ||
      server.name
    );
  }
  return server.url || server.name;
}

function buildAgentServerConfig(server: McpServerConfig): string {
  const entry =
    server.transport === "stdio"
      ? {
          command: server.command,
          args: server.args,
          cwd: server.cwd,
          env: server.env,
        }
      : {
          type: server.transport,
          url: server.url,
          headers: server.headers,
        };

  return JSON.stringify(
    {
      mcpServers: {
        [server.name]: Object.fromEntries(
          Object.entries(entry).filter(
            ([, value]) =>
              value !== undefined &&
              (!Array.isArray(value) || value.length > 0) &&
              (typeof value !== "object" ||
                value === null ||
                Object.keys(value).length > 0),
          ),
        ),
      },
    },
    null,
    2,
  );
}

function AgentMcpCardView({
  card,
  isBusy,
  onImport,
  onOpenConfig,
  onOpenDetail,
  onOpenManaged,
  onRemove,
}: {
  card: AgentMcpCard;
  isBusy: boolean;
  onImport: () => void;
  onOpenConfig: () => void;
  onOpenDetail: () => void;
  onOpenManaged?: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { server, managedServer, preset } = card;
  const isManaged = Boolean(managedServer);
  return (
    <AgentAssetCard
      testId="mcp-agent-server-card"
      actionsTestId="mcp-agent-server-actions"
      onOpen={onOpenDetail}
      openLabel={t("mcp.openAgentEntryDetails", {
        name: server.displayName || server.name,
        defaultValue: "Open MCP details {{name}}",
      })}
      actions={
        <>
          <AgentAssetActionButton
            onClick={onOpenConfig}
            aria-label={t("mcp.openAgentConfig", "Open agent config")}
            title={t("mcp.openAgentConfig", "Open agent config")}
          >
            <FileJsonIcon aria-hidden="true" className="h-4 w-4" />
          </AgentAssetActionButton>
          {isManaged && onOpenManaged ? (
            <AgentAssetActionButton
              onClick={onOpenManaged}
              aria-label={t("mcp.openInMyMcp", "Open in My MCP")}
              title={t("mcp.openInMyMcp", "Open in My MCP")}
            >
              <BookOpenIcon aria-hidden="true" className="h-4 w-4" />
            </AgentAssetActionButton>
          ) : (
            <AgentAssetActionButton
              variant="primary"
              onClick={onImport}
              disabled={isBusy}
              aria-label={t("mcp.importToMyMcp", "Import to My MCP")}
              title={t("mcp.importToMyMcp", "Import to My MCP")}
            >
              {isBusy ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <DownloadIcon aria-hidden="true" className="h-4 w-4" />
              )}
            </AgentAssetActionButton>
          )}
          <AgentAssetActionButton
            variant="destructive"
            onClick={onRemove}
            disabled={isBusy}
            aria-label={t("mcp.uninstallFromAgent", "Uninstall from Agent")}
            title={t("mcp.uninstallFromAgent", "Uninstall from Agent")}
          >
            {isBusy ? (
              <Loader2Icon
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <TrashIcon aria-hidden="true" className="h-4 w-4" />
            )}
          </AgentAssetActionButton>
        </>
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ServerIcon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-foreground">
              {server.displayName || server.name}
            </span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                isManaged
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {isManaged ? (
                <CheckCircle2Icon aria-hidden="true" className="h-3 w-3" />
              ) : null}
              {isManaged
                ? t("mcp.managedByPromptHub", "Managed in PromptHub")
                : t("mcp.notInLibrary", "Not in PromptHub library")}
            </span>
          </div>
          <div className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {server.description ||
              t("mcp.defaultDescription", "MCP server configuration")}
          </div>
          <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
            {formatInvocation(server)}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {server.transport}
            </span>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
              {preset.label}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {server.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                server.enabled
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {server.enabled
                ? t("common.enabled", "Enabled")
                : t("common.disabled", "Disabled")}
            </span>
          </div>
        </div>
      </div>
    </AgentAssetCard>
  );
}

function AgentMcpDetailItem({
  label,
  multiline = false,
  value,
}: {
  label: string;
  multiline?: boolean;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-xs text-foreground ${
          multiline
            ? "max-h-32 overflow-auto whitespace-pre-wrap break-words leading-5"
            : "truncate"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function AgentMcpAssetPanel({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const library = useMcpStore((state) => state.library);
  const targetPresets = useMcpStore((state) => state.targetPresets);
  const targetStatus = useMcpStore((state) => state.targetStatus);
  const isLoading = useMcpStore((state) => state.isLoading);
  const error = useMcpStore((state) => state.error);
  const load = useMcpStore((state) => state.load);
  const refreshTargetStatus = useMcpStore((state) => state.refreshTargetStatus);
  const createServer = useMcpStore((state) => state.createServer);
  const removeTargetNames = useMcpStore((state) => state.removeTargetNames);
  const selectServer = useMcpStore((state) => state.selectServer);
  const setSelectedTab = useMcpStore((state) => state.setSelectedTab);
  const setSelectedTargetId = useMcpStore((state) => state.setSelectedTargetId);
  const setAppModule = useUIStore((state) => state.setAppModule);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AgentMcpFilter>("all");
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [busyServerKey, setBusyServerKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<AgentMcpCard | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);

  const scopedPresets = useMemo(
    () => targetPresets.filter((preset) => isAgentPreset(preset, agent)),
    [agent, targetPresets],
  );
  const scopedPresetIds = useMemo(
    () => new Set(scopedPresets.map((preset) => preset.id)),
    [scopedPresets],
  );
  const scopedStatus = useMemo(
    () => targetStatus.filter((status) => scopedPresetIds.has(status.presetId)),
    [scopedPresetIds, targetStatus],
  );
  const serverByName = useMemo(
    () =>
      new Map((library?.servers ?? []).map((server) => [server.name, server])),
    [library?.servers],
  );
  const cards = useMemo<AgentMcpCard[]>(
    () =>
      scopedPresets.flatMap((preset) => {
        const status = getStatusForPreset(scopedStatus, preset.id);
        if (!status) return [];
        return status.serverNames.map((serverName) => {
          const managedServer = serverByName.get(serverName);
          return {
            key: `${preset.id}:${serverName}`,
            preset,
            status,
            serverName,
            managedServer,
            server: getAgentServer(preset, status, serverName, managedServer),
          };
        });
      }),
    [scopedPresets, scopedStatus, serverByName],
  );
  const visibleCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cards.filter((card) => {
      const managed = Boolean(card.managedServer);
      if (filter === "managed" && !managed) return false;
      if (filter === "external" && managed) return false;
      if (filter === "enabled" && !card.server.enabled) return false;
      if (filter === "disabled" && card.server.enabled) return false;
      if (!normalized) return true;
      return [
        card.server.name,
        card.server.displayName,
        card.server.description ?? "",
        card.server.transport,
        card.preset.label,
        card.preset.path,
        formatInvocation(card.server),
      ]
        .join("\n")
        .toLowerCase()
        .includes(normalized);
    });
  }, [cards, filter, query]);
  const page = useBoundedPage(visibleCards, 60, visibleCards);
  const selectedCard = useMemo(
    () => cards.find((card) => card.key === selectedCardKey) ?? null,
    [cards, selectedCardKey],
  );

  useEffect(() => {
    if (!library && !isLoading) void load();
  }, [isLoading, library, load]);

  useEffect(() => {
    if (selectedCardKey && !selectedCard) setSelectedCardKey(null);
  }, [selectedCard, selectedCardKey]);

  if (!agent.paths.mcp) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
        {t("agents.notAvailable", "Not available")}
      </div>
    );
  }

  const openAgentConfig = async (preset: McpTargetPreset): Promise<void> => {
    try {
      const result = await window.electron?.openPath?.(preset.path);
      if (result && !result.success)
        throw new Error(result.error || "Failed to open MCP config");
      showToast(t("mcp.agentConfigOpened", "Agent config opened"), "success");
    } catch (actionError) {
      showToast(getErrorMessage(actionError), "error");
    }
  };

  const refresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await load();
      await refreshTargetStatus();
    } catch (actionError) {
      showToast(getErrorMessage(actionError), "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const openManaged = (server: McpServerConfig): void => {
    setAppModule("mcp");
    setSelectedTab("library");
    selectServer(server.id);
  };

  const importExternal = async (card: AgentMcpCard): Promise<void> => {
    const sourceServer = findAgentMcpServer(
      scopedStatus,
      card.preset.id,
      card.serverName,
    );
    if (!sourceServer) {
      throw new Error(
        t(
          "mcp.agentEntryUnavailable",
          "Agent MCP entry details are unavailable. Refresh Agent MCP and try again.",
        ),
      );
    }
    const server = await createServer(
      buildAgentMcpImportDraft(sourceServer, card.preset),
    );
    setAppModule("mcp");
    setSelectedTab("library");
    selectServer(server.id);
    showToast(t("mcp.imported", "MCP imported"), "success");
  };

  const runServerAction = (
    card: AgentMcpCard,
    action: () => Promise<void> | void,
  ): void => {
    setBusyServerKey(card.key);
    void Promise.resolve(action())
      .catch((actionError) => showToast(getErrorMessage(actionError), "error"))
      .finally(() => setBusyServerKey(null));
  };

  const confirmRemove = (): void => {
    if (!pendingRemoval || isRemoving) return;
    setIsRemoving(true);
    void removeTargetNames({
      target: pendingRemoval.preset.target,
      scope: pendingRemoval.preset.scope,
      path: pendingRemoval.preset.path,
      serverNames: [pendingRemoval.serverName],
    })
      .then(async () => {
        await refreshTargetStatus();
        setSelectedCardKey(null);
        setPendingRemoval(null);
        showToast(t("mcp.removed", "MCP removed"), "success");
      })
      .catch((actionError) => showToast(getErrorMessage(actionError), "error"))
      .finally(() => setIsRemoving(false));
  };

  const filterLabels: Record<AgentMcpFilter, string> = {
    all: t("mcp.agentMcpFilterAll", {
      count: cards.length,
      defaultValue: "{{count}} MCP",
    }),
    managed: t("mcp.agentMcpFilterManaged", {
      count: cards.filter((card) => card.managedServer).length,
      defaultValue: "{{count}} managed",
    }),
    external: t("mcp.agentMcpFilterExternal", {
      count: cards.filter((card) => !card.managedServer).length,
      defaultValue: "{{count}} external",
    }),
    enabled: t("mcp.agentMcpFilterEnabled", {
      count: cards.filter((card) => card.server.enabled).length,
      defaultValue: "{{count}} enabled",
    }),
    disabled: t("mcp.agentMcpFilterDisabled", {
      count: cards.filter((card) => !card.server.enabled).length,
      defaultValue: "{{count}} disabled",
    }),
  };

  if (selectedCard) {
    const isBusy = busyServerKey === selectedCard.key;
    const configContent = buildAgentServerConfig(selectedCard.server);
    return (
      <>
        <div
          data-testid="mcp-agent-entry-detail"
          className="flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-smooth"
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedCardKey(null)}
                aria-label={t("common.back", "Back")}
                title={t("common.back", "Back")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />
              </button>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <ServerIcon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {selectedCard.server.displayName ||
                      selectedCard.server.name}
                  </h2>
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {selectedCard.preset.label}
                  </span>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {selectedCard.preset.path}
                </p>
              </div>
            </div>
            <div
              data-testid="mcp-agent-detail-actions"
              className="flex shrink-0 items-center gap-2"
            >
              <AgentMcpDetailActions
                isImporting={isBusy}
                isManaged={Boolean(selectedCard.managedServer)}
                isUninstalling={
                  isRemoving && pendingRemoval?.key === selectedCard.key
                }
                onImport={
                  selectedCard.managedServer
                    ? undefined
                    : () =>
                        runServerAction(selectedCard, () =>
                          importExternal(selectedCard),
                        )
                }
                onOpenAgentConfig={() =>
                  void openAgentConfig(selectedCard.preset)
                }
                onOpenManagedMcp={
                  selectedCard.managedServer
                    ? () =>
                        openManaged(
                          selectedCard.managedServer as McpServerConfig,
                        )
                    : undefined
                }
                onUninstall={() => setPendingRemoval(selectedCard)}
                t={t}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border border-border bg-card p-5">
                <div className="mb-4 text-sm font-semibold text-foreground">
                  {t("mcp.sourceAndDetails", "Source and details")}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AgentMcpDetailItem
                    label={t("mcp.name", "Name")}
                    value={selectedCard.server.name}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.transport", "Transport")}
                    value={selectedCard.server.transport}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.command", "Command")}
                    value={selectedCard.server.command}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.url", "URL")}
                    value={selectedCard.server.url}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.cwd", "Working Directory")}
                    value={selectedCard.server.cwd}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.args", "Args")}
                    multiline
                    value={selectedCard.server.args?.join("\n")}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.env", "Environment")}
                    multiline
                    value={formatRecord(selectedCard.server.env)}
                  />
                  <AgentMcpDetailItem
                    label={t("mcp.headers", "Headers")}
                    multiline
                    value={formatRecord(selectedCard.server.headers)}
                  />
                </div>
              </section>
              <section className="rounded-md border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileJsonIcon
                    aria-hidden="true"
                    className="h-4 w-4 text-primary"
                  />
                  {t("mcp.copyConfig", "Config preview")}
                </div>
                <pre className="max-h-[32rem] overflow-auto rounded-md border border-border bg-background p-4 text-xs leading-5 text-foreground">
                  {configContent}
                </pre>
              </section>
            </div>
          </div>
        </div>
        <ConfirmDialog
          isOpen={Boolean(pendingRemoval)}
          onClose={() => setPendingRemoval(null)}
          onConfirm={confirmRemove}
          title={t("mcp.uninstallFromAgent", "Uninstall from Agent")}
          message={t("mcp.uninstallFromAgentConfirm", {
            target: pendingRemoval?.preset.label ?? "",
            name: pendingRemoval?.serverName ?? "",
            defaultValue:
              "Remove {{name}} from {{target}}? The managed MCP library will not be changed.",
          })}
          confirmText={t("common.uninstall", "Uninstall")}
          cancelText={t("common.cancel", "Cancel")}
          variant="destructive"
          isLoading={isRemoving}
        />
      </>
    );
  }

  return (
    <>
      <AgentAssetManagementSurface
        domain="mcp"
        title={t("agents.mcp", "MCP")}
        query={query}
        onQueryChange={setQuery}
        searchLabel={t("agents.searchAssets", "Search assets")}
        filters={FILTER_ORDER.map((filterKey) => ({
          key: filterKey,
          label: filterLabels[filterKey],
          testId: `mcp-agent-filter-${filterKey}`,
        }))}
        activeFilter={filter}
        onFilterChange={(filterKey) => setFilter(filterKey as AgentMcpFilter)}
        path={agent.paths.mcp}
        refreshLabel={t("agents.refreshCurrentAsset", "Refresh current view")}
        onRefresh={() => void refresh()}
        isRefreshing={isLoading || isRefreshing}
        alert={
          error ? (
            <div
              role="alert"
              className="mx-5 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {t("mcp.assetLoadFailed", "MCP targets could not be loaded.")}
            </div>
          ) : null
        }
        primaryAction={
          <button
            type="button"
            onClick={() => {
              setAppModule("mcp");
              setSelectedTab("targets");
              setSelectedTargetId(scopedPresets[0]?.id ?? null);
            }}
            disabled={scopedPresets.length === 0}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <PlusIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {t("mcp.addMcp", "Add MCP")}
          </button>
        }
        listTestId="mcp-agent-server-list"
        gridTestId="mcp-agent-grid"
        isLoading={isLoading}
        loadingLabel={t("mcp.loading", "Loading MCP...")}
        isEmpty={visibleCards.length === 0}
        emptyState={
          <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
            <ServerIcon
              aria-hidden="true"
              className="mb-3 h-10 w-10 text-muted-foreground/40"
            />
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {query.trim()
                ? t("mcp.noFilteredAgentMcp", "No matching MCP servers")
                : t("mcp.noServersOnTarget", "No MCP servers configured")}
            </p>
          </div>
        }
        page={page}
      >
        {page.items.map((card) => (
          <AgentMcpCardView
            key={card.key}
            card={card}
            isBusy={busyServerKey === card.key}
            onOpenDetail={() => setSelectedCardKey(card.key)}
            onOpenConfig={() => void openAgentConfig(card.preset)}
            onOpenManaged={
              card.managedServer
                ? () => openManaged(card.managedServer as McpServerConfig)
                : undefined
            }
            onImport={() => runServerAction(card, () => importExternal(card))}
            onRemove={() => setPendingRemoval(card)}
          />
        ))}
      </AgentAssetManagementSurface>
      <ConfirmDialog
        isOpen={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        onConfirm={confirmRemove}
        title={t("mcp.uninstallFromAgent", "Uninstall from Agent")}
        message={t("mcp.uninstallFromAgentConfirm", {
          target: pendingRemoval?.preset.label ?? "",
          name: pendingRemoval?.serverName ?? "",
          defaultValue:
            "Remove {{name}} from {{target}}? The managed MCP library will not be changed.",
        })}
        confirmText={t("common.uninstall", "Uninstall")}
        cancelText={t("common.cancel", "Cancel")}
        variant="destructive"
        isLoading={isRemoving}
      />
    </>
  );
}
