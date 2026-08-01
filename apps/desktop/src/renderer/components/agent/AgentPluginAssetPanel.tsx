import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FolderOpenIcon,
  Loader2Icon,
  MinusCircleIcon,
  PlugIcon,
  SendIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react";

import type {
  PluginDistributeMode,
  PluginLibraryEntry,
  PluginTargetCompatibility,
  PluginTargetInstalledPlugin,
} from "@prompthub/shared/types/plugin";
import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { AgentPluginDetailPage } from "../plugin/AgentPluginDetailPage";
import { PluginAgentTargetPicker } from "../plugin/PluginAgentTargetPicker";
import { PluginFullDetailPage } from "../plugin/PluginFullDetailPage";
import {
  type AgentPluginFilter,
  getPluginCategoryLabel,
  getPluginDisplayTags,
  getPluginTrustLabel,
  InventoryChips,
  PluginAvatar,
} from "../plugin/plugin-manager-utils";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useToast } from "../ui/Toast";
import { usePluginStore } from "../../stores/plugin.store";
import { useUIStore } from "../../stores/ui.store";
import { matchesManagedAgentTarget } from "./agent-target-matching";
import {
  AgentAssetActionButton,
  AgentAssetCard,
  AgentAssetCardContent,
  AgentAssetManagementSurface,
} from "./AgentAssetManagementSurface";
import { useBoundedPage } from "./BoundedListPager";

function isAgentPluginTarget(
  target: PluginTargetCompatibility,
  agent: ManagedAgentSummary,
): boolean {
  return matchesManagedAgentTarget([target.id], agent);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type AgentPluginTargetCard = {
  kind: "target";
  key: string;
  target: PluginTargetCompatibility;
  plugin: PluginTargetInstalledPlugin;
  managedPlugin: PluginLibraryEntry | null;
};

type AgentPluginLibraryCard = {
  kind: "library";
  key: string;
  plugin: PluginLibraryEntry;
  isDistributed: boolean;
};

type AgentPluginCard = AgentPluginTargetCard | AgentPluginLibraryCard;

const FILTER_ORDER: AgentPluginFilter[] = [
  "all",
  "my-plugins",
  "agent-installed",
  "distributed",
  "pending",
];

function getPluginLocalPath(plugin: PluginLibraryEntry): string {
  return (
    plugin.localPackagePath ??
    plugin.source.localPackagePath ??
    plugin.managedPath ??
    plugin.localRepositoryPath ??
    plugin.source.localRepositoryPath ??
    ""
  );
}

function isPluginDistributedToAgent(
  plugin: PluginLibraryEntry,
  targets: PluginTargetCompatibility[],
): boolean {
  const targetIds = new Set(targets.map((target) => target.id));
  return (plugin.distributedTargetIds ?? []).some((id) => targetIds.has(id));
}

function matchesPluginQuery(card: AgentPluginCard, query: string): boolean {
  if (!query) return true;
  const values =
    card.kind === "target"
      ? [
          card.plugin.name,
          card.plugin.displayName,
          card.plugin.description,
          card.plugin.version,
          card.plugin.sourcePath,
          card.target.displayName,
        ]
      : [
          card.plugin.name,
          card.plugin.displayName,
          card.plugin.description,
          card.plugin.author?.name,
          getPluginLocalPath(card.plugin),
          card.plugin.category,
          ...getPluginDisplayTags(card.plugin),
        ];
  return values.filter(Boolean).join("\n").toLowerCase().includes(query);
}

function AgentPluginTargetCardView({
  card,
  isImporting,
  onImport,
  onOpenDetail,
  onOpenFolder,
  onOpenManaged,
}: {
  card: AgentPluginTargetCard;
  isImporting: boolean;
  onImport: () => void;
  onOpenDetail: () => void;
  onOpenFolder: () => void;
  onOpenManaged?: () => void;
}) {
  const { t } = useTranslation();
  const { plugin, managedPlugin, target } = card;

  return (
    <AgentAssetCard
      testId="agent-plugin-target-card"
      actionsTestId="agent-plugin-target-card-actions"
      onOpen={onOpenDetail}
      openLabel={t("plugin.openPluginDetail", {
        defaultValue: "Open Plugin details {{name}}",
        name: plugin.displayName,
      })}
      actions={
        <>
          {plugin.sourcePath ? (
            <AgentAssetActionButton
              onClick={onOpenFolder}
              aria-label={t("plugin.openPluginFolder", "Open Plugin folder")}
              title={t("plugin.openPluginFolder", "Open Plugin folder")}
            >
              <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
            </AgentAssetActionButton>
          ) : null}
          {managedPlugin && onOpenManaged ? (
            <AgentAssetActionButton
              onClick={onOpenManaged}
              aria-label={t("plugin.openInMyPlugins", "Open in My Plugins")}
              title={t("plugin.openInMyPlugins", "Open in My Plugins")}
            >
              <BookOpenIcon aria-hidden="true" className="h-4 w-4" />
            </AgentAssetActionButton>
          ) : (
            <AgentAssetActionButton
              variant="primary"
              onClick={onImport}
              disabled={isImporting || !plugin.sourcePath}
              aria-label={t("plugin.importToMyPlugins", "Import to My Plugins")}
              title={t("plugin.importToMyPlugins", "Import to My Plugins")}
              className="disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <DownloadIcon aria-hidden="true" className="h-4 w-4" />
              )}
            </AgentAssetActionButton>
          )}
        </>
      }
    >
      <AgentAssetCardContent
        icon={
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <PlugIcon aria-hidden="true" className="h-5 w-5" />
          </span>
        }
        iconTestId="agent-plugin-asset-icon"
        title={plugin.displayName}
        status={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <CheckCircle2Icon aria-hidden="true" className="h-3 w-3" />
            {t("plugin.inAgentPluginTarget", "Installed in Agent")}
          </span>
        }
        description={
          plugin.description ||
          plugin.version ||
          t("plugin.noDescription", "No description provided")
        }
        source={plugin.sourcePath || target.displayName}
        metadata={
          <>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
              {target.displayName}
            </span>
            {managedPlugin ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                {t("plugin.inMyPlugins", "In My Plugins")}
              </span>
            ) : null}
            <InventoryChips inventory={plugin.inventory} />
          </>
        }
      />
    </AgentAssetCard>
  );
}

function AgentPluginLibraryCardView({
  card,
  isRemovingDistribution,
  onDelete,
  onDistribute,
  onOpenDetail,
  onOpenFolder,
  onOpenManaged,
  onRemoveDistribution,
  onToggleFavorite,
}: {
  card: AgentPluginLibraryCard;
  isRemovingDistribution: boolean;
  onDelete: () => void;
  onDistribute: () => void;
  onOpenDetail: () => void;
  onOpenFolder: () => void;
  onOpenManaged: () => void;
  onRemoveDistribution: () => void;
  onToggleFavorite: () => void;
}) {
  const { t } = useTranslation();
  const { plugin, isDistributed } = card;
  const localPath = getPluginLocalPath(plugin);

  return (
    <AgentAssetCard
      testId="agent-plugin-library-card"
      actionsTestId="agent-plugin-library-card-actions"
      onOpen={onOpenDetail}
      openLabel={t("plugin.openPluginDetail", {
        defaultValue: "Open Plugin details {{name}}",
        name: plugin.displayName,
      })}
      actions={
        <>
          <AgentAssetActionButton
            onClick={onOpenManaged}
            aria-label={t("plugin.openInMyPlugins", "Open in My Plugins")}
            title={t("plugin.openInMyPlugins", "Open in My Plugins")}
          >
            <BookOpenIcon aria-hidden="true" className="h-4 w-4" />
          </AgentAssetActionButton>
          {localPath ? (
            <AgentAssetActionButton
              onClick={onOpenFolder}
              aria-label={t("plugin.openPluginFolder", "Open Plugin folder")}
              title={t("plugin.openPluginFolder", "Open Plugin folder")}
            >
              <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
            </AgentAssetActionButton>
          ) : null}
          <AgentAssetActionButton
            onClick={onToggleFavorite}
            aria-label={
              plugin.isFavorite
                ? t("plugin.removeFromFavorites", {
                    defaultValue: "Remove {{name}} from favorites",
                    name: plugin.displayName,
                  })
                : t("plugin.addToFavorites", {
                    defaultValue: "Add {{name}} to favorites",
                    name: plugin.displayName,
                  })
            }
            title={
              plugin.isFavorite
                ? t("plugin.removeFavorite", "Remove Favorite")
                : t("plugin.addFavorite", "Add Favorite")
            }
            className={
              plugin.isFavorite ? "text-amber-500" : "hover:text-amber-500"
            }
          >
            <StarIcon
              aria-hidden="true"
              className={`h-4 w-4 ${plugin.isFavorite ? "fill-current" : ""}`}
            />
          </AgentAssetActionButton>
          {isDistributed ? (
            <AgentAssetActionButton
              variant="destructive"
              onClick={onRemoveDistribution}
              disabled={isRemovingDistribution}
              aria-label={t("plugin.removePluginFromAgent", {
                agent: "Agent",
                defaultValue: "Remove {{name}} from Agent",
                name: plugin.displayName,
              })}
              title={t("plugin.removeFromAgent", "Remove from Agent")}
            >
              {isRemovingDistribution ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <MinusCircleIcon aria-hidden="true" className="h-4 w-4" />
              )}
            </AgentAssetActionButton>
          ) : (
            <AgentAssetActionButton
              variant="primary"
              onClick={onDistribute}
              aria-label={t("plugin.distributePluginToAgent", {
                agent: "Agent",
                defaultValue: "Distribute {{name}} to Agent",
                name: plugin.displayName,
              })}
              title={t("plugin.distributePlugin", "Distribute Plugin")}
            >
              <SendIcon aria-hidden="true" className="h-4 w-4" />
            </AgentAssetActionButton>
          )}
          <AgentAssetActionButton
            variant="destructive"
            onClick={onDelete}
            aria-label={t("plugin.deletePlugin", "Delete Plugin")}
            title={t("plugin.deletePlugin", "Delete Plugin")}
          >
            <TrashIcon aria-hidden="true" className="h-4 w-4" />
          </AgentAssetActionButton>
        </>
      }
    >
      <AgentAssetCardContent
        icon={<PluginAvatar entry={plugin} size="sm" />}
        iconTestId="agent-plugin-asset-icon"
        title={plugin.displayName}
        status={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
            <CheckCircle2Icon aria-hidden="true" className="h-3 w-3" />
            {t("plugin.inMyPlugins", "In My Plugins")}
          </span>
        }
        description={
          plugin.description ||
          plugin.author?.name ||
          t("plugin.noDescription", "No description provided")
        }
        source={localPath || plugin.source.kind}
        metadata={
          <>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {isDistributed
                ? t("plugin.distributedToAgent", "Distributed to Agent")
                : t("plugin.pendingDistribution", "Pending distribution")}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {getPluginTrustLabel(plugin.trustLevel, t)}
            </span>
            {plugin.category ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {getPluginCategoryLabel(plugin.category, t)}
              </span>
            ) : null}
            {getPluginDisplayTags(plugin)
              .slice(0, 3)
              .map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
          </>
        }
        supplementary={<InventoryChips inventory={plugin.inventory} />}
      />
    </AgentAssetCard>
  );
}

export function AgentPluginAssetPanel({
  agent,
  onDetailOpenChange,
}: {
  agent: ManagedAgentSummary;
  onDetailOpenChange?: (isOpen: boolean) => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const library = usePluginStore((state) => state.library);
  const targetMatrix = usePluginStore((state) => state.targetMatrix);
  const isLoading = usePluginStore((state) => state.isLoading);
  const error = usePluginStore((state) => state.error);
  const load = usePluginStore((state) => state.load);
  const importLocalPluginPackage = usePluginStore(
    (state) => state.importLocalPluginPackage,
  );
  const distributePlugin = usePluginStore((state) => state.distributePlugin);
  const removePluginDistribution = usePluginStore(
    (state) => state.removePluginDistribution,
  );
  const deletePlugin = usePluginStore((state) => state.deletePlugin);
  const updatePluginMetadata = usePluginStore(
    (state) => state.updatePluginMetadata,
  );
  const setAppModule = useUIStore((state) => state.setAppModule);
  const setSelectedTab = usePluginStore((state) => state.setSelectedTab);

  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [selectedTargetPlugin, setSelectedTargetPlugin] = useState<{
    target: PluginTargetCompatibility;
    plugin: PluginTargetInstalledPlugin;
  } | null>(null);
  const [pickerPlugin, setPickerPlugin] = useState<PluginLibraryEntry | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<PluginLibraryEntry | null>(
    null,
  );
  const [pendingRemoveDistribution, setPendingRemoveDistribution] = useState<{
    plugin: PluginLibraryEntry;
    target: PluginTargetCompatibility;
  } | null>(null);
  const [importingTargetPluginId, setImportingTargetPluginId] = useState<
    string | null
  >(null);
  const [removingLibraryPluginId, setRemovingLibraryPluginId] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AgentPluginFilter>("all");

  const scopedTargets = useMemo(
    () => targetMatrix.filter((target) => isAgentPluginTarget(target, agent)),
    [agent, targetMatrix],
  );
  const installedPlugins = library?.plugins ?? [];
  const selectedPlugin = useMemo(
    () =>
      installedPlugins.find((plugin) => plugin.id === selectedPluginId) ?? null,
    [installedPlugins, selectedPluginId],
  );

  const targetPluginCards = useMemo<AgentPluginTargetCard[]>(
    () =>
      scopedTargets.flatMap((target) =>
        (target.installedPlugins ?? []).map((plugin) => ({
          kind: "target" as const,
          key: `target:${target.id}:${plugin.id}`,
          target,
          plugin,
          managedPlugin:
            installedPlugins.find(
              (entry) =>
                entry.source.sourceId === target.id &&
                entry.name.toLowerCase() === plugin.name.toLowerCase(),
            ) ?? null,
        })),
      ),
    [installedPlugins, scopedTargets],
  );

  const distributedLibraryPlugins = useMemo(
    () =>
      installedPlugins.filter((plugin) =>
        isPluginDistributedToAgent(plugin, scopedTargets),
      ),
    [installedPlugins, scopedTargets],
  );

  const pendingLibraryPlugins = useMemo(
    () =>
      installedPlugins.filter(
        (plugin) => !isPluginDistributedToAgent(plugin, scopedTargets),
      ),
    [installedPlugins, scopedTargets],
  );

  const visibleCards = useMemo<AgentPluginCard[]>(() => {
    const libraryCards = (
      filter === "all" || filter === "my-plugins"
        ? installedPlugins
        : filter === "distributed"
          ? distributedLibraryPlugins
          : filter === "pending"
            ? pendingLibraryPlugins
            : []
    ).map<AgentPluginLibraryCard>((plugin) => ({
      kind: "library",
      key: `library:${plugin.id}`,
      plugin,
      isDistributed: isPluginDistributedToAgent(plugin, scopedTargets),
    }));
    const targetCards =
      filter === "all" || filter === "agent-installed" ? targetPluginCards : [];
    const cards = [...targetCards, ...libraryCards];
    const normalized = query.trim().toLowerCase();
    return normalized
      ? cards.filter((card) => matchesPluginQuery(card, normalized))
      : cards;
  }, [
    distributedLibraryPlugins,
    filter,
    installedPlugins,
    pendingLibraryPlugins,
    query,
    scopedTargets,
    targetPluginCards,
  ]);

  const pluginPage = useBoundedPage(visibleCards, 60, visibleCards);

  useEffect(() => {
    if (!library && !isLoading) {
      void load();
    }
  }, [isLoading, library, load]);

  useEffect(() => {
    if (selectedPluginId && !selectedPlugin) {
      setSelectedPluginId(null);
    }
  }, [selectedPlugin, selectedPluginId]);

  useEffect(() => {
    if (
      selectedTargetPlugin &&
      !targetPluginCards.some(
        (card) =>
          card.target.id === selectedTargetPlugin.target.id &&
          card.plugin.id === selectedTargetPlugin.plugin.id,
      )
    ) {
      setSelectedTargetPlugin(null);
    }
  }, [selectedTargetPlugin, targetPluginCards]);

  useEffect(() => {
    onDetailOpenChange?.(Boolean(selectedPlugin || selectedTargetPlugin));
  }, [onDetailOpenChange, selectedPlugin, selectedTargetPlugin]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  if (!agent.paths.plugins) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
        {t("agents.notAvailable", "Not available")}
      </div>
    );
  }

  const reportError = (actionError: unknown): void => {
    showToast(getErrorMessage(actionError), "error");
  };

  const refresh = (): void => {
    void load({ force: true }).catch(reportError);
  };

  const importTargetPlugin = async (
    target: PluginTargetCompatibility,
    plugin: PluginTargetInstalledPlugin,
  ): Promise<void> => {
    if (!plugin.sourcePath) {
      showToast(
        t(
          "plugin.targetPluginSourceUnavailable",
          "This Agent Plugin does not expose a local source path.",
        ),
        "error",
      );
      return;
    }
    setImportingTargetPluginId(plugin.id);
    try {
      await importLocalPluginPackage({
        sourcePath: plugin.sourcePath,
        sourceTargetId: target.id,
        sourceTargetName: target.displayName,
      });
      await load({ force: true });
      showToast(t("plugin.importSuccess", "Plugin imported"), "success");
    } catch (actionError) {
      reportError(actionError);
    } finally {
      setImportingTargetPluginId(null);
    }
  };

  const distribute = async (
    plugin: PluginLibraryEntry,
    targetIds: string[],
    mode: PluginDistributeMode,
  ): Promise<void> => {
    await distributePlugin(plugin.id, targetIds, mode);
    await load({ force: true });
    showToast(t("plugin.distributeSuccess", "Plugin distributed"), "success");
    setPickerPlugin(null);
  };

  const removeDistribution = async (
    plugin: PluginLibraryEntry,
    target: PluginTargetCompatibility,
  ): Promise<void> => {
    setRemovingLibraryPluginId(plugin.id);
    try {
      await removePluginDistribution(plugin.id, [target.id]);
      await load({ force: true });
      showToast(
        t("plugin.removeFromAgentSuccess", "Plugin removed from Agent"),
        "success",
      );
    } finally {
      setRemovingLibraryPluginId(null);
    }
  };

  const openPathWithError = async (path: string): Promise<void> => {
    if (!path) {
      return;
    }
    try {
      const result = await window.electron?.openPath?.(path);
      if (result && !result.success) {
        throw new Error(
          result.error ||
            t("plugin.openPluginFolderFailed", "Failed to open Plugin folder"),
        );
      }
    } catch (actionError) {
      reportError(actionError);
    }
  };

  const openPluginLibrary = (): void => {
    setSelectedPluginId(null);
    setSelectedTargetPlugin(null);
    setAppModule("plugin");
    setSelectedTab("library");
  };

  const openStore = (): void => {
    setSelectedPluginId(null);
    setSelectedTargetPlugin(null);
    setAppModule("plugin");
    setSelectedTab("market");
  };

  const filterLabels: Record<AgentPluginFilter, string> = {
    all: t("plugin.agentPluginFilterAll", {
      count: targetPluginCards.length + installedPlugins.length,
      defaultValue: "{{count}} Plugins",
    }),
    "my-plugins": t("plugin.agentPluginFilterMyPlugins", {
      count: installedPlugins.length,
      defaultValue: "{{count}} My Plugins",
    }),
    "agent-installed": t("plugin.agentPluginFilterAgentInstalled", {
      count: targetPluginCards.length,
      defaultValue: "{{count}} installed in Agent",
    }),
    distributed: t("plugin.agentPluginFilterDistributed", {
      count: distributedLibraryPlugins.length,
      defaultValue: "{{count}} distributed",
    }),
    pending: t("plugin.agentPluginFilterPending", {
      count: pendingLibraryPlugins.length,
      defaultValue: "{{count}} pending",
    }),
  };

  const deleteDialog = (
    <ConfirmDialog
      isOpen={Boolean(pendingDelete)}
      onClose={() => setPendingDelete(null)}
      onConfirm={() => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        void deletePlugin(pendingDelete.id, {
          removeDistributedTargets: true,
        })
          .then(() => {
            setPendingDelete(null);
            setSelectedPluginId(null);
            showToast(t("plugin.deleteSuccess", "Plugin deleted"), "success");
          })
          .catch(reportError)
          .finally(() => setIsDeleting(false));
      }}
      title={t("plugin.deletePlugin", "Delete Plugin")}
      message={t("plugin.deleteConfirmMessage", {
        name: pendingDelete?.displayName ?? "",
        defaultValue: "Delete {{name}} from My Plugins?",
      })}
      confirmText={t("common.delete", "Delete")}
      cancelText={t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={isDeleting}
    />
  );

  const removeDistributionDialog = (
    <ConfirmDialog
      isOpen={Boolean(pendingRemoveDistribution)}
      onClose={() => {
        if (!removingLibraryPluginId) {
          setPendingRemoveDistribution(null);
        }
      }}
      onConfirm={() => {
        if (!pendingRemoveDistribution) return;
        void removeDistribution(
          pendingRemoveDistribution.plugin,
          pendingRemoveDistribution.target,
        )
          .then(() => setPendingRemoveDistribution(null))
          .catch(reportError);
      }}
      title={t(
        "plugin.removePluginFromAgentConfirmTitle",
        "Remove Plugin from Agent",
      )}
      message={t("plugin.removePluginFromAgentConfirmDescription", {
        agent: pendingRemoveDistribution?.target.displayName ?? "",
        defaultValue:
          "Remove {{name}} from {{agent}}? This only removes the distributed Plugin package and keeps My Plugins unchanged.",
        name: pendingRemoveDistribution?.plugin.displayName ?? "",
      })}
      confirmText={t("plugin.removeFromAgent", "Remove from Agent")}
      cancelText={t("common.cancel", "Cancel")}
      variant="destructive"
      isLoading={
        pendingRemoveDistribution
          ? removingLibraryPluginId === pendingRemoveDistribution.plugin.id
          : false
      }
    />
  );

  if (selectedTargetPlugin) {
    const { plugin, target } = selectedTargetPlugin;
    const managedPlugin =
      targetPluginCards.find(
        (card) => card.target.id === target.id && card.plugin.id === plugin.id,
      )?.managedPlugin ?? null;
    return (
      <AgentPluginDetailPage
        isImporting={importingTargetPluginId === plugin.id}
        managedPlugin={managedPlugin}
        plugin={plugin}
        target={target}
        onBack={() => setSelectedTargetPlugin(null)}
        onImport={() => importTargetPlugin(target, plugin)}
        onOpenFolder={() => openPathWithError(plugin.sourcePath ?? "")}
        onOpenManagedPlugin={managedPlugin ? openPluginLibrary : undefined}
        onOpenStore={openStore}
      />
    );
  }

  if (selectedPlugin) {
    return (
      <>
        <PluginFullDetailPage
          plugin={selectedPlugin}
          targetMatrix={scopedTargets}
          agentContext={{
            isManaged: true,
            platformId: agent.id,
            platformName: agent.name,
            sourcePath:
              selectedPlugin.localPackagePath ??
              selectedPlugin.managedPath ??
              selectedPlugin.localRepositoryPath ??
              "",
          }}
          onBack={() => setSelectedPluginId(null)}
          onDelete={(plugin) => setPendingDelete(plugin)}
          onDistribute={(targetIds, mode) =>
            distribute(selectedPlugin, targetIds, mode)
          }
          onRemoveDistribution={(target) =>
            removeDistribution(selectedPlugin, target)
          }
          onToggleFavorite={async (plugin) => {
            await updatePluginMetadata(plugin.id, {
              isFavorite: !plugin.isFavorite,
            });
          }}
          onOpenStore={openStore}
        />
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <AgentAssetManagementSurface
        domain="plugins"
        query={query}
        onQueryChange={setQuery}
        searchLabel={t("agents.searchAssets", "Search assets")}
        filters={FILTER_ORDER.map((filterKey) => ({
          key: filterKey,
          label: filterLabels[filterKey],
          testId: `agent-plugin-filter-${filterKey}`,
        }))}
        activeFilter={filter}
        onFilterChange={(filterKey) =>
          setFilter(filterKey as AgentPluginFilter)
        }
        path={agent.paths.plugins}
        refreshLabel={t("agents.refreshCurrentAsset", "Refresh current view")}
        onRefresh={() => void refresh()}
        isRefreshing={isLoading}
        alert={
          error ? (
            <div
              role="alert"
              className="mx-5 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {t("plugin.assetLoadFailed", "Plugins could not be loaded.")}
            </div>
          ) : null
        }
        gridTestId="agent-plugin-grid"
        isLoading={isLoading}
        loadingLabel={t("plugin.scanningPlugin", "Loading Plugins...")}
        isEmpty={visibleCards.length === 0}
        emptyState={
          <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {query.trim()
                ? t("plugin.noFilteredAgentPlugins", "No matching Plugins")
                : t("plugin.noMyPluginsForAgent", "No Plugins for this Agent")}
            </p>
            <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              {query.trim()
                ? t(
                    "plugin.noFilteredAgentPluginsDesc",
                    "Change the search or filter to see other packages.",
                  )
                : t(
                    "plugin.noMyPluginsForAgentDesc",
                    "Install Plugin bundles from the store or refresh this Agent.",
                  )}
            </p>
          </div>
        }
        page={pluginPage}
      >
        {pluginPage.items.map((card) =>
          card.kind === "target" ? (
            <AgentPluginTargetCardView
              key={card.key}
              card={card}
              isImporting={importingTargetPluginId === card.plugin.id}
              onImport={() => void importTargetPlugin(card.target, card.plugin)}
              onOpenDetail={() => {
                setSelectedPluginId(null);
                setSelectedTargetPlugin({
                  target: card.target,
                  plugin: card.plugin,
                });
              }}
              onOpenFolder={() =>
                void openPathWithError(card.plugin.sourcePath ?? "")
              }
              onOpenManaged={card.managedPlugin ? openPluginLibrary : undefined}
            />
          ) : (
            <AgentPluginLibraryCardView
              key={card.key}
              card={card}
              isRemovingDistribution={
                removingLibraryPluginId === card.plugin.id
              }
              onDelete={() => setPendingDelete(card.plugin)}
              onDistribute={() => setPickerPlugin(card.plugin)}
              onOpenDetail={() => {
                setSelectedTargetPlugin(null);
                setSelectedPluginId(card.plugin.id);
              }}
              onOpenFolder={() =>
                void openPathWithError(getPluginLocalPath(card.plugin))
              }
              onOpenManaged={openPluginLibrary}
              onRemoveDistribution={() => {
                const target = scopedTargets.find((entry) =>
                  (card.plugin.distributedTargetIds ?? []).includes(entry.id),
                );
                if (target) {
                  setPendingRemoveDistribution({
                    plugin: card.plugin,
                    target,
                  });
                }
              }}
              onToggleFavorite={() =>
                void updatePluginMetadata(card.plugin.id, {
                  isFavorite: !card.plugin.isFavorite,
                })
              }
            />
          ),
        )}
      </AgentAssetManagementSurface>
      <PluginAgentTargetPicker
        isOpen={Boolean(pickerPlugin)}
        onClose={() => setPickerPlugin(null)}
        onDistribute={distribute}
        plugin={pickerPlugin}
        plugins={pickerPlugin ? [pickerPlugin] : []}
        targetMatrix={scopedTargets}
      />
      {deleteDialog}
      {removeDistributionDialog}
    </>
  );
}
