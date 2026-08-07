import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2Icon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";

import { BoundedListPager, type BoundedPage } from "./BoundedListPager";

export interface AgentAssetFilterOption {
  key: string;
  label: string;
  testId: string;
}

interface AgentAssetManagementSurfaceProps<T> {
  domain: "skills" | "mcp" | "plugins";
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  filters: AgentAssetFilterOption[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
  refreshLabel: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  primaryAction?: ReactNode;
  alert?: ReactNode;
  listTestId?: string;
  gridTestId: string;
  isLoading: boolean;
  loadingLabel: string;
  isEmpty: boolean;
  emptyState: ReactNode;
  page: BoundedPage<T>;
  children: ReactNode;
}

function filterChipClass(isActive: boolean): string {
  return isActive
    ? "shrink-0 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary shadow-sm"
    : "shrink-0 whitespace-nowrap rounded-full border border-border bg-background/60 px-2.5 py-1 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary";
}

export function AgentAssetPrimaryAction({
  label,
  ...buttonProps
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
}) {
  return (
    <button
      type="button"
      {...buttonProps}
      className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <PlusIcon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

export function AgentAssetManagementSurface<T>({
  domain,
  query,
  onQueryChange,
  searchLabel,
  filters,
  activeFilter,
  onFilterChange,
  refreshLabel,
  onRefresh,
  isRefreshing,
  primaryAction,
  alert,
  listTestId,
  gridTestId,
  isLoading,
  loadingLabel,
  isEmpty,
  emptyState,
  page,
  children,
}: AgentAssetManagementSurfaceProps<T>) {
  return (
    <div
      data-testid="agent-asset-management-surface"
      data-domain={domain}
      className="relative flex min-h-0 flex-1 flex-col"
    >
      {alert}
      <div
        data-testid="agent-asset-toolbar"
        className="flex shrink-0 flex-nowrap items-center gap-3 border-b border-border px-5 py-3"
      >
        <label className="relative block w-44 shrink-0 sm:w-56 lg:w-64">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label={searchLabel}
            placeholder={searchLabel}
            className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <div
          data-testid="agent-asset-toolbar-filters"
          className="scrollbar-hide flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto text-xs"
        >
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              data-testid={filter.testId}
              aria-pressed={activeFilter === filter.key}
              onClick={() => onFilterChange(filter.key)}
              className={filterChipClass(activeFilter === filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={refreshLabel}
          title={refreshLabel}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </button>
        {primaryAction}
      </div>

      <div
        data-testid={listTestId}
        className="min-h-0 flex-1 overflow-y-auto p-5"
      >
        {isLoading && page.total === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2Icon
              aria-hidden="true"
              className="mr-2 h-4 w-4 animate-spin"
            />
            {loadingLabel}
          </div>
        ) : isEmpty ? (
          emptyState
        ) : (
          <div data-testid={gridTestId} className="grid gap-3 sm:grid-cols-2">
            {children}
          </div>
        )}
      </div>
      <BoundedListPager page={page} />
    </div>
  );
}

interface AgentAssetCardProps {
  testId: string;
  actionsTestId: string;
  openLabel?: string;
  onOpen: () => void;
  children: ReactNode;
  actions: ReactNode;
}

export function AgentAssetCard({
  testId,
  actionsTestId,
  openLabel,
  onOpen,
  children,
  actions,
}: AgentAssetCardProps) {
  return (
    <article
      data-testid={testId}
      className="group flex h-[232px] flex-col rounded-md border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        className="min-h-0 min-w-0 flex-1 overflow-hidden text-left"
      >
        {children}
      </button>
      <div
        data-testid={actionsTestId}
        className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3"
      >
        {actions}
      </div>
    </article>
  );
}

interface AgentAssetCardContentProps {
  icon: ReactNode;
  iconTestId: string;
  title: ReactNode;
  status?: ReactNode;
  description: ReactNode;
  source: ReactNode;
  metadata: ReactNode;
  supplementary?: ReactNode;
}

export function AgentAssetCardContent({
  icon,
  iconTestId,
  title,
  status,
  description,
  source,
  metadata,
  supplementary,
}: AgentAssetCardContentProps) {
  return (
    <div
      data-testid="agent-asset-card-content"
      className="flex h-full min-w-0 items-start gap-3 overflow-hidden"
    >
      <div data-testid="agent-asset-card-avatar" className="shrink-0">
        <span
          data-testid={iconTestId}
          className="block h-10 w-10 overflow-hidden rounded-xl"
        >
          {icon}
        </span>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          data-testid="agent-asset-card-title-row"
          className="flex h-6 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
        >
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
            {title}
          </span>
          {status ? <span className="shrink-0">{status}</span> : null}
        </div>
        <div
          data-testid="agent-asset-card-description"
          className="mt-1 line-clamp-2 h-10 text-sm leading-5 text-muted-foreground"
        >
          {description}
        </div>
        <div
          data-testid="agent-asset-card-source"
          className="mt-1.5 h-4 truncate font-mono text-[11px] text-muted-foreground"
        >
          {source}
        </div>
        <div
          data-testid="agent-asset-card-metadata"
          className="mt-2 flex h-10 flex-wrap content-start items-start gap-1.5 overflow-hidden"
        >
          {metadata}
          {supplementary}
        </div>
      </div>
    </div>
  );
}

type AgentAssetActionVariant = "default" | "primary" | "destructive";

interface AgentAssetActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AgentAssetActionVariant;
}

const ACTION_VARIANT_CLASSES: Record<AgentAssetActionVariant, string> = {
  default:
    "border border-border text-muted-foreground hover:bg-accent hover:text-foreground",
  primary: "bg-primary text-white hover:bg-primary/90",
  destructive:
    "border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10",
};

export function AgentAssetActionButton({
  variant = "default",
  className = "",
  type = "button",
  ...props
}: AgentAssetActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-60 ${ACTION_VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
