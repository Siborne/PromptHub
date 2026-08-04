import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  Grid2X2Icon,
  LayoutGridIcon,
  ListIcon,
  RefreshCwIcon,
  Settings2Icon,
  SquareIcon,
} from "lucide-react";
import type { GenerationBatchManifest } from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";

export type GenerationGalleryFilter = "current" | "all" | "favorite" | "failed";
export type GenerationGalleryDensity = "compact" | "large" | "list";

interface ImageGenerationGalleryToolbarProps {
  filter: GenerationGalleryFilter;
  onFilterChange: (filter: GenerationGalleryFilter) => void;
  selectedBatch?: GenerationBatchManifest;
  failedCount: number;
  sortNewest: boolean;
  onSortNewestChange: (sortNewest: boolean) => void;
  density: GenerationGalleryDensity;
  onDensityChange: (density: GenerationGalleryDensity) => void;
  onCancelBatch: () => void;
  onRetryFailed: () => void;
}

interface GalleryOptionsProps {
  sortNewest: boolean;
  onSortNewestChange: (sortNewest: boolean) => void;
  density: GenerationGalleryDensity;
  onDensityChange: (density: GenerationGalleryDensity) => void;
}

function useDismissibleMenu(
  open: boolean,
  close: () => void,
  rootRef: React.RefObject<HTMLDivElement>,
) {
  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, open, rootRef]);
}

function DensityButtons({ density, onDensityChange }: GalleryOptionsProps) {
  const { t } = useTranslation();
  const options = [
    ["compact", Grid2X2Icon, t("generation.compactGrid")],
    ["large", LayoutGridIcon, t("generation.largeGrid")],
    ["list", ListIcon, t("generation.listView")],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-1">
      {options.map(([value, Icon, label]) => (
        <button
          type="button"
          key={value}
          onClick={() => onDensityChange(value)}
          aria-label={label}
          aria-pressed={density === value}
          title={label}
          className={`relative flex h-9 items-center justify-center rounded ${density === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {density === value && (
            <CheckIcon className="absolute right-1 top-1 h-2.5 w-2.5" />
          )}
        </button>
      ))}
    </div>
  );
}

function GalleryOptionsMenu(props: GalleryOptionsProps) {
  const { t } = useTranslation();
  const sortLabel = props.sortNewest
    ? t("generation.latestFirst")
    : t("generation.oldestFirst");
  return (
    <div
      role="menu"
      aria-label={t("generation.galleryOptions")}
      className="absolute right-0 top-full z-30 mt-1 w-52 rounded-md border border-border bg-popover p-2 shadow-lg"
    >
      <button
        type="button"
        onClick={() => props.onSortNewestChange(!props.sortNewest)}
        className="flex h-9 w-full items-center justify-between rounded px-2 text-sm hover:bg-accent hover:text-accent-foreground"
        aria-label={sortLabel}
      >
        <span>{sortLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div className="my-2 h-px bg-border" />
      <DensityButtons {...props} />
    </div>
  );
}

function GalleryOptions(props: GalleryOptionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissibleMenu(open, close, rootRef);
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("generation.galleryOptions")}
        title={t("generation.galleryOptions")}
        className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${open ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >
        <Settings2Icon className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && <GalleryOptionsMenu {...props} />}
    </div>
  );
}

function GalleryFilterTabs({
  filter,
  onFilterChange,
  selectedBatch,
  failedCount,
}: Pick<
  ImageGenerationGalleryToolbarProps,
  "filter" | "onFilterChange" | "selectedBatch" | "failedCount"
>) {
  const { t } = useTranslation();
  const filters = [
    [
      "current",
      t("generation.currentBatchTab", {
        done: selectedBatch?.counts.succeeded ?? 0,
        total: selectedBatch?.targetCount ?? 0,
      }),
    ],
    ["all", t("generation.allWorks")],
    ["favorite", t("generation.favorite")],
    ["failed", t("generation.failedCount", { count: failedCount })],
  ] as const;
  return (
    <nav
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      aria-label={t("generation.workbench")}
    >
      {filters.map(([value, label]) => (
        <button
          type="button"
          key={value}
          onClick={() => onFilterChange(value)}
          className={`h-8 shrink-0 rounded-md px-2.5 text-xs transition-colors ${filter === value ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export function ImageGenerationGalleryToolbar(
  props: ImageGenerationGalleryToolbarProps,
) {
  const { t } = useTranslation();
  const running = Boolean(
    props.selectedBatch &&
    ["queued", "running"].includes(props.selectedBatch.status),
  );
  const retryable = Boolean(
    props.selectedBatch &&
    !running &&
    props.selectedBatch.counts.failed + props.selectedBatch.counts.interrupted >
      0,
  );
  return (
    <section
      data-testid="generation-gallery-toolbar"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4"
    >
      <GalleryFilterTabs {...props} />
      <div className="flex shrink-0 items-center gap-1.5">
        {running && (
          <ToolbarIconButton
            label={t("generation.cancel")}
            onClick={props.onCancelBatch}
            icon={<SquareIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        )}
        {retryable && (
          <ToolbarIconButton
            label={t("generation.retryFailed")}
            onClick={props.onRetryFailed}
            icon={<RefreshCwIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        )}
        <GalleryOptions {...props} />
      </div>
    </section>
  );
}

function ToolbarIconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}
