import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  StarIcon,
  XCircleIcon,
} from "lucide-react";
import type {
  GenerationBatchManifest,
  GenerationOutputRecord,
} from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";
import { resolveLocalGenerationImageSrc } from "../../utils/media-url";

interface ReviewSelection {
  batchId: string;
  output: GenerationOutputRecord;
}

interface ImageGenerationReviewStageProps {
  batch: GenerationBatchManifest;
  focusedOutputId: string;
  selectedOutputKeys: Set<string>;
  canAttach: boolean;
  onFocus: (outputId: string) => void;
  onOpen: (selection: ReviewSelection) => void;
  onToggleSelect: (selection: ReviewSelection) => void;
  onToggleFavorite: (output: GenerationOutputRecord) => void;
  onDownload: (output: GenerationOutputRecord) => void;
  onCopyPrompt: () => void;
  onAttach: (output: GenerationOutputRecord) => void;
  onContinue: (output: GenerationOutputRecord) => void;
}

function getSlotStateLabel(
  status: GenerationBatchManifest["slots"][number]["status"],
  t: ReturnType<typeof useTranslation>["t"],
) {
  return status === "failed"
    ? t("generation.failed")
    : status === "running"
      ? t("generation.generating")
      : t(`generation.${status}`);
}

function ReviewThumbnail({
  batch,
  slotIndex,
  focusedOutputId,
  selectedOutputKeys,
  onFocus,
  onToggleSelect,
}: Pick<
  ImageGenerationReviewStageProps,
  | "batch"
  | "focusedOutputId"
  | "selectedOutputKeys"
  | "onFocus"
  | "onToggleSelect"
> & { slotIndex: number }) {
  const { t } = useTranslation();
  const slot = batch.slots[slotIndex];
  const output = slot.output;

  if (!output) {
    return (
      <div
        data-testid="generation-review-thumbnail"
        className="flex aspect-video w-[clamp(112px,13vw,180px)] shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/20 px-1 text-center text-muted-foreground"
      >
        {slot.status === "running" ? (
          <LoaderCircleIcon
            className="h-5 w-5 animate-spin text-primary"
            aria-hidden="true"
          />
        ) : slot.status === "failed" || slot.status === "interrupted" ? (
          <XCircleIcon
            className="h-5 w-5 text-destructive"
            aria-hidden="true"
          />
        ) : (
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        )}
        <span className="line-clamp-2 text-[10px] leading-4">
          {getSlotStateLabel(slot.status, t)}
        </span>
        <span className="text-[10px] opacity-70">{slotIndex + 1}</span>
      </div>
    );
  }

  const key = `${batch.id}:${output.id}`;
  const selected = selectedOutputKeys.has(key);
  const focused = output.id === focusedOutputId;
  const selection = { batchId: batch.id, output };
  return (
    <div
      data-testid="generation-review-thumbnail"
      className={`group relative aspect-video w-[clamp(112px,13vw,180px)] shrink-0 overflow-hidden rounded-md border bg-card transition-colors ${focused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/60"}`}
    >
      <button
        type="button"
        onClick={(event) => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            onToggleSelect(selection);
          } else {
            onFocus(output.id);
          }
        }}
        className="block h-full w-full"
        aria-label={t(
          focused ? "generation.selectedPreview" : "generation.outputAlt",
          { index: slotIndex + 1 },
        )}
      >
        <img
          src={resolveLocalGenerationImageSrc(`${batch.id}/${output.fileName}`)}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t("generation.selectImage", { index: slotIndex + 1 })}
        onClick={() => onToggleSelect(selection)}
        className={`absolute left-1.5 top-1.5 h-5 w-5 items-center justify-center rounded border shadow-sm ${selected ? "flex border-primary bg-primary text-primary-foreground" : "hidden border-white/80 bg-background/90 text-transparent group-hover:flex group-focus-within:flex"}`}
      >
        <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {output.favorite && (
        <StarIcon
          className="pointer-events-none absolute bottom-1.5 left-1.5 h-4 w-4 fill-current text-amber-500 drop-shadow"
          aria-hidden="true"
        />
      )}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-background/85 px-1 text-[10px] font-medium">
        {slotIndex + 1}
      </span>
    </div>
  );
}

function ReviewActionsMenu({
  output,
  canAttach,
  onToggleFavorite,
  onDownload,
  onCopyPrompt,
  onAttach,
  openRequest,
}: Pick<
  ImageGenerationReviewStageProps,
  "canAttach" | "onToggleFavorite" | "onDownload" | "onCopyPrompt" | "onAttach"
> & { output: GenerationOutputRecord; openRequest: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

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
  }, [close, open]);

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  const action = (callback: () => void) => () => {
    callback();
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("generation.moreActions")}
        title={t("generation.moreActions")}
        className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs shadow-sm transition-colors ${open ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/95 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >
        <MoreHorizontalIcon className="h-4 w-4" aria-hidden="true" />
        {t("generation.more")}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("generation.moreActions")}
          className="absolute left-1/2 top-full z-30 mt-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-popover p-1.5 shadow-xl"
        >
          <MenuAction
            label={t("generation.favorite")}
            onClick={action(() => onToggleFavorite(output))}
            active={output.favorite}
            icon={
              <StarIcon
                className={`h-4 w-4 ${output.favorite ? "fill-current" : ""}`}
                aria-hidden="true"
              />
            }
          />
          <MenuAction
            label={t("generation.download")}
            onClick={action(() => onDownload(output))}
            icon={<DownloadIcon className="h-4 w-4" aria-hidden="true" />}
          />
          <MenuAction
            label={t("generation.copyPrompt")}
            onClick={action(onCopyPrompt)}
            icon={<CopyIcon className="h-4 w-4" aria-hidden="true" />}
          />
          {canAttach && (
            <MenuAction
              label={t("prompt.addToPrompt")}
              onClick={action(() => onAttach(output))}
              icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuAction({
  label,
  onClick,
  icon,
  active = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${active ? "text-amber-500" : "text-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ImageGenerationReviewStage(
  props: ImageGenerationReviewStageProps,
) {
  const { t } = useTranslation();
  const [contextMenuRequested, setContextMenuRequested] = useState(0);
  const focusedSlot = props.batch.slots.find(
    (slot) => slot.output?.id === props.focusedOutputId,
  );
  const output = focusedSlot?.output;
  if (!output || !focusedSlot) return null;
  const selection = { batchId: props.batch.id, output };
  const source = resolveLocalGenerationImageSrc(
    `${props.batch.id}/${output.fileName}`,
  );

  return (
    <section className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-5 py-4">
      <div className="relative z-20 mb-3 shrink-0">
        <ReviewActionsMenu
          output={output}
          openRequest={contextMenuRequested}
          canAttach={props.canAttach}
          onToggleFavorite={props.onToggleFavorite}
          onDownload={props.onDownload}
          onCopyPrompt={props.onCopyPrompt}
          onAttach={props.onAttach}
        />
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <button
          type="button"
          data-testid="generation-primary-preview"
          onClick={() => props.onOpen(selection)}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenuRequested((value) => value + 1);
          }}
          aria-label={t("generation.outputAlt", {
            index: focusedSlot.index + 1,
          })}
          className="flex h-full min-h-56 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/10 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src={source}
            alt={t("generation.outputAlt", {
              index: focusedSlot.index + 1,
            })}
            className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
          />
        </button>
      </div>

      <div className="mt-3 flex w-full shrink-0 flex-col items-center gap-2.5">
        <div className="flex max-w-full gap-2 overflow-x-auto px-1 py-1">
          {props.batch.slots.map((slot, slotIndex) => (
            <ReviewThumbnail
              key={`${props.batch.id}:${slot.index}`}
              batch={props.batch}
              slotIndex={slotIndex}
              focusedOutputId={props.focusedOutputId}
              selectedOutputKeys={props.selectedOutputKeys}
              onFocus={props.onFocus}
              onToggleSelect={props.onToggleSelect}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => props.onContinue(output)}
          className="flex h-9 items-center gap-2 self-end rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t("generation.continueFromImage")}
          <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
