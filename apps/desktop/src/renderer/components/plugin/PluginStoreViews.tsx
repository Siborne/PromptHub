import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  PackagePlusIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  PluginImportSourceRequest,
  PluginLibraryEntry,
  PluginMarketEntry,
  PluginMarketPreview,
} from "@prompthub/shared/types/plugin";
import { Modal } from "../ui/Modal";
import {
  MARKET_CATALOG_VIRTUALIZE_THRESHOLD,
  MARKET_GRID_BOTTOM_GUTTER_PX,
  MARKET_GRID_GAP_PX,
  MARKET_GRID_HEADER_HEIGHT_PX,
  MARKET_GRID_ROW_HEIGHT_PX,
  InventoryChips,
  PluginAvatar,
  buildPluginStoreCatalogRows,
  getClassificationLabel,
  getMarketGridColumns,
  getMarketSourceLabel,
  getPluginCategoryLabel,
  getPluginPolicyValueLabel,
  getPluginTrustLabel,
  shouldShowMarketTrustBadge,
} from "./plugin-manager-utils";

export function MarketCard({
  batchMode = false,
  entry,
  isSelected = false,
  installed,
  preview,
  onOpenDetail,
  onToggleSelection,
}: {
  batchMode?: boolean;
  entry: PluginMarketEntry;
  isSelected?: boolean;
  installed: boolean;
  preview?: PluginMarketPreview;
  onOpenDetail: (entry: PluginMarketEntry) => void;
  onToggleSelection: (entry: PluginMarketEntry) => void;
}) {
  const { t } = useTranslation();
  const activeEntry = preview?.entry ?? entry;
  const cardDescription = activeEntry.description || preview?.longDescription;
  const cardLabel = cardDescription
    ? `${activeEntry.displayName}. ${cardDescription}`
    : activeEntry.displayName;

  return (
    <article
      className={`group relative flex items-center gap-3 rounded-xl border app-wallpaper-surface p-3.5 transition-all hover:border-primary/40 hover:shadow-md ${
        isSelected
          ? "border-primary/70 ring-1 ring-primary/30"
          : "border-border"
      }`}
    >
      {batchMode ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection(activeEntry);
          }}
          aria-pressed={isSelected}
          aria-label={
            isSelected
              ? t("plugin.unselectStorePlugin", "Unselect store plugin")
              : t("plugin.selectStorePlugin", "Select store plugin")
          }
          title={
            isSelected
              ? t("plugin.unselectStorePlugin", "Unselect store plugin")
              : t("plugin.selectStorePlugin", "Select store plugin")
          }
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-all active:scale-press-in ${
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card/80 text-muted-foreground/70 hover:border-primary/45 hover:bg-primary/10 hover:text-primary"
          }`}
        >
          {isSelected ? (
            <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3 w-3 rounded-[4px] border border-current" />
          )}
        </button>
      ) : null}

      <button
        type="button"
        aria-label={t("plugin.openPluginDetail", {
          defaultValue: "Open plugin details {{name}}",
          name: activeEntry.displayName,
        })}
        title={cardLabel}
        onClick={() =>
          batchMode ? onToggleSelection(activeEntry) : onOpenDetail(activeEntry)
        }
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <PluginAvatar entry={activeEntry} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
            {activeEntry.displayName}
          </h3>
          {cardDescription ? (
            <p className="mt-0.5 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
              {cardDescription}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {getMarketSourceLabel(
                activeEntry.marketplaceId,
                activeEntry.source.label || activeEntry.marketplaceId,
                t,
              )}
            </span>
            {activeEntry.category ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getPluginCategoryLabel(activeEntry.category, t)}
              </span>
            ) : null}
            {shouldShowMarketTrustBadge(activeEntry) ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {getPluginTrustLabel(activeEntry.trustLevel, t)}
              </span>
            ) : null}
            {installed ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                {t("plugin.installed", "Installed")}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </article>
  );
}

export function PluginStoreCatalog({
  availableEntries,
  batchMode,
  installedEntries,
  marketPreviews,
  onOpenDetail,
  onToggleSelection,
  scrollRef,
  selectedEntryIds,
}: {
  availableEntries: PluginMarketEntry[];
  batchMode: boolean;
  installedEntries: PluginMarketEntry[];
  marketPreviews: Record<string, PluginMarketPreview>;
  onOpenDetail: (entry: PluginMarketEntry) => void;
  onToggleSelection: (entry: PluginMarketEntry) => void;
  scrollRef: RefObject<HTMLDivElement>;
  selectedEntryIds: Set<string>;
}) {
  const { t } = useTranslation();
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const totalCount = installedEntries.length + availableEntries.length;
  const installedLabel = t("plugin.installedSection", "Installed");
  const availableLabel = t("plugin.availableSection", "Available");

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const update = () => {
      setContainerWidth(
        Math.max(0, node.clientWidth || window.innerWidth || 1024),
      );
      setScrollMargin(catalogRef.current?.offsetTop ?? 0);
    };
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [scrollRef]);

  const columns = useMemo(
    () => getMarketGridColumns(containerWidth || 1024),
    [containerWidth],
  );
  const rows = useMemo(
    () =>
      buildPluginStoreCatalogRows({
        availableEntries,
        availableLabel,
        columns,
        installedEntries,
        installedLabel,
      }),
    [
      availableEntries,
      availableLabel,
      columns,
      installedEntries,
      installedLabel,
    ],
  );

  const renderSectionHeader = (
    label: string,
    count: number,
    tone: "installed" | "available",
  ) => (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
        {label}
      </h2>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          tone === "installed"
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-primary/10 text-primary"
        }`}
      >
        {count}
      </span>
    </div>
  );

  const renderCard = (entry: PluginMarketEntry, installed: boolean) => (
    <MarketCard
      key={entry.id}
      batchMode={batchMode}
      entry={entry}
      isSelected={selectedEntryIds.has(entry.id)}
      installed={installed}
      preview={marketPreviews[entry.id]}
      onOpenDetail={onOpenDetail}
      onToggleSelection={onToggleSelection}
    />
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    scrollMargin,
    estimateSize: (index) =>
      rows[index]?.type === "section"
        ? MARKET_GRID_HEADER_HEIGHT_PX
        : MARKET_GRID_ROW_HEIGHT_PX + MARKET_GRID_GAP_PX,
    overscan: 5,
    getItemKey: (index) => rows[index]?.key ?? `plugin-store-row-${index}`,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  if (totalCount <= MARKET_CATALOG_VIRTUALIZE_THRESHOLD) {
    return (
      <div className="space-y-8">
        {installedEntries.length > 0 ? (
          <section>
            {renderSectionHeader(
              installedLabel,
              installedEntries.length,
              "installed",
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {installedEntries.map((entry) => renderCard(entry, true))}
            </div>
          </section>
        ) : null}

        {availableEntries.length > 0 ? (
          <section>
            {renderSectionHeader(
              availableLabel,
              availableEntries.length,
              "available",
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {availableEntries.map((entry) => renderCard(entry, false))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={catalogRef}
      className="relative w-full"
      data-testid="plugin-store-virtual-catalog"
      style={{ height: `${totalHeight + MARKET_GRID_BOTTOM_GUTTER_PX}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            data-testid="plugin-store-virtual-row"
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 right-0"
            style={{
              top: 0,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {row.type === "section" ? (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {row.label}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    row.tone === "installed"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {row.count}
                </span>
              </div>
            ) : (
              <div
                className="grid"
                style={{
                  gap: `${MARKET_GRID_GAP_PX}px`,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {row.entries.map((entry) => renderCard(entry, row.installed))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PluginDetailBadges({
  entry,
  sourceLabel,
}: {
  entry: PluginLibraryEntry | PluginMarketEntry;
  sourceLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
        {sourceLabel}
      </span>
      {entry.category ? (
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
          {getPluginCategoryLabel(entry.category, t)}
        </span>
      ) : null}
      <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
        {getPluginTrustLabel(entry.trustLevel, t)}
      </span>
      {entry.version ? (
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
          v{entry.version}
        </span>
      ) : null}
    </div>
  );
}

export function PluginStoreDetailModal({
  entry,
  installed,
  installing,
  preview,
  previewing,
  onClose,
  onCopyCodexLink,
  onInstall,
}: {
  entry: PluginMarketEntry | null;
  installed: boolean;
  installing: boolean;
  preview?: PluginMarketPreview;
  previewing: boolean;
  onClose: () => void;
  onCopyCodexLink: (entry: PluginMarketEntry) => void;
  onInstall: (entry: PluginMarketEntry) => void;
}) {
  const { t } = useTranslation();

  if (!entry) {
    return null;
  }

  const activeEntry = preview?.entry ?? entry;
  const displayName = preview?.displayName ?? activeEntry.displayName;
  const summaryDescription = preview?.description ?? activeEntry.description;
  const overviewDescription = preview?.longDescription;
  const sourceLabel = getMarketSourceLabel(
    activeEntry.marketplaceId,
    activeEntry.source.label || activeEntry.marketplaceId,
    t,
  );
  const activeInventory = preview?.inventory ?? activeEntry.inventory;
  const codexLink = preview?.codexDetailUrl ?? activeEntry.codexDetailUrl;
  const installDisabled =
    installed || installing || preview?.canInstall === false;

  return (
    <Modal
      isOpen={Boolean(entry)}
      onClose={onClose}
      size="xl"
      showCloseButton
      title={displayName}
      subtitle={summaryDescription}
    >
      <div className="flex min-h-0 flex-col">
        <div className="space-y-4 px-6 py-5">
          <div className="flex items-start gap-4">
            <PluginAvatar entry={activeEntry} size="lg" />
            <div className="min-w-0 flex-1 space-y-3">
              <PluginDetailBadges
                entry={activeEntry}
                sourceLabel={sourceLabel}
              />
              {previewing ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  {t("plugin.loadingPreview", "Loading manifest preview")}
                </div>
              ) : null}
              {preview ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      preview.canInstall
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {getClassificationLabel(preview.classification, t)}
                  </span>
                  {preview.author?.name ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                      {preview.author.name}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {overviewDescription ? (
            <section className="rounded-2xl border border-border bg-background/60 p-4">
              <h3 className="text-sm font-medium text-foreground">
                {t("plugin.overviewTitle", "Overview")}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {overviewDescription}
              </p>
            </section>
          ) : null}

          {activeInventory ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="mb-3 text-sm font-medium text-foreground">
                {t("plugin.inventoryTitle", "Inventory")}
              </div>
              <InventoryChips inventory={activeInventory} />
            </div>
          ) : null}

          {preview?.unsupportedReason ? (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              {preview.unsupportedReason}
            </div>
          ) : null}

          <dl className="grid gap-3 text-sm md:grid-cols-2">
            {activeEntry.policy?.installation ? (
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("plugin.policyInstallation", "Install")}
                </dt>
                <dd className="mt-1 text-foreground">
                  {getPluginPolicyValueLabel(
                    "installation",
                    activeEntry.policy.installation,
                    t,
                  )}
                </dd>
              </div>
            ) : null}
            {activeEntry.policy?.authentication ? (
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("plugin.policyAuth", "Auth")}
                </dt>
                <dd className="mt-1 text-foreground">
                  {getPluginPolicyValueLabel(
                    "authentication",
                    activeEntry.policy.authentication,
                    t,
                  )}
                </dd>
              </div>
            ) : null}
            {preview?.manifestUrl ? (
              <div className="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("plugin.manifestUrl", "Manifest")}
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-foreground">
                  {preview.manifestUrl}
                </dd>
              </div>
            ) : null}
            {activeEntry.source.packagePath ? (
              <div className="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">
                  {t("plugin.packagePath", "Package path")}
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-foreground">
                  {activeEntry.source.packagePath}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="min-w-0 text-xs text-muted-foreground">
            {codexLink ? codexLink : sourceLabel}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {codexLink ? (
              <button
                type="button"
                onClick={() => onCopyCodexLink(activeEntry)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <CopyIcon className="h-4 w-4" />
                {t("plugin.copyCodexLink", "Copy Codex link")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={installDisabled}
              onClick={() => onInstall(activeEntry)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {installing ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : installed ? (
                <CheckCircleIcon className="h-4 w-4" />
              ) : (
                <DownloadIcon className="h-4 w-4" />
              )}
              {installed
                ? t("plugin.installed", "Installed")
                : t("plugin.install", "Install")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function PluginSourcePreviewModal({
  importing,
  onBackToEdit,
  onClose,
  onImport,
  preview,
  request,
}: {
  importing: boolean;
  onBackToEdit: () => void;
  onClose: () => void;
  onImport: () => void;
  preview: PluginMarketPreview | null;
  request: PluginImportSourceRequest | null;
}) {
  const { t } = useTranslation();

  if (!preview || !request) {
    return null;
  }

  const sourceLabel =
    request.label?.trim() ||
    preview.entry.source.label ||
    request.url ||
    t("plugin.customSource", "Custom source");
  const installDisabled = importing || preview.canInstall === false;

  return (
    <Modal
      isOpen={Boolean(preview)}
      onClose={onClose}
      size="xl"
      showCloseButton
      closeOnBackdrop={!importing}
      closeOnEscape={!importing}
      title={t("plugin.confirmSourceImportTitle", "Confirm Plugin import")}
      subtitle={preview.displayName}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <PluginAvatar entry={preview.entry} size="lg" />
          <div className="min-w-0 flex-1 space-y-3">
            <h3 className="text-lg font-semibold text-foreground">
              {preview.displayName}
            </h3>
            {preview.description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {preview.description}
              </p>
            ) : null}
            <PluginDetailBadges
              entry={preview.entry}
              sourceLabel={sourceLabel}
            />
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full px-2.5 py-1 font-medium ${
                  preview.canInstall
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {getClassificationLabel(preview.classification, t)}
              </span>
              {preview.author?.name ? (
                <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                  {preview.author.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {preview.longDescription ? (
          <section className="rounded-2xl border border-border bg-background/60 p-4">
            <h3 className="text-sm font-medium text-foreground">
              {t("plugin.overviewTitle", "Overview")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {preview.longDescription}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-border bg-muted/20 p-4">
          <div className="mb-3 text-sm font-medium text-foreground">
            {t("plugin.inventoryTitle", "Inventory")}
          </div>
          <InventoryChips inventory={preview.inventory} />
        </section>

        {preview.unsupportedReason ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {preview.unsupportedReason}
          </div>
        ) : null}

        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/60 p-3 md:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              {t("plugin.sourceUrlLabel", "Plugin URL")}
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-foreground">
              {request.url}
            </dd>
          </div>
          {request.branch ? (
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <dt className="text-xs font-medium text-muted-foreground">
                {t("plugin.sourceBranchLabel", "Branch")}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-foreground">
                {request.branch}
              </dd>
            </div>
          ) : null}
          {request.packagePath ? (
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <dt className="text-xs font-medium text-muted-foreground">
                {t("plugin.sourcePackagePathLabel", "Package path")}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-foreground">
                {request.packagePath}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onBackToEdit}
            disabled={importing}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("plugin.editSource", "Edit source")}
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={installDisabled}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {importing ? (
              <Loader2Icon
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <PackagePlusIcon aria-hidden="true" className="h-4 w-4" />
            )}
            {t("plugin.importPlugin", "Import Plugin")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
