import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LoaderCircleIcon,
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
        className="flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/20 px-1 text-center text-muted-foreground"
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
      className={`group relative h-24 w-20 shrink-0 overflow-hidden rounded-md border bg-card transition-colors ${focused ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/60"}`}
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

function ReviewAction({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted ${active ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

export function ImageGenerationReviewStage(
  props: ImageGenerationReviewStageProps,
) {
  const { t } = useTranslation();
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
    <section className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-4 py-3">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <button
          type="button"
          data-testid="generation-primary-preview"
          onClick={() => props.onOpen(selection)}
          aria-label={t("generation.outputAlt", {
            index: focusedSlot.index + 1,
          })}
          className="flex h-full min-h-56 w-full items-center justify-center overflow-hidden rounded-md bg-muted/15 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src={source}
            alt={t("generation.outputAlt", {
              index: focusedSlot.index + 1,
            })}
            className="max-h-full max-w-full rounded-md object-contain shadow-sm"
          />
        </button>
      </div>

      <div className="mt-3 flex w-full shrink-0 flex-col items-center gap-3">
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
        <div className="flex items-center gap-2">
          <ReviewAction
            label={t("generation.favorite")}
            active={output.favorite}
            onClick={() => props.onToggleFavorite(output)}
          >
            <StarIcon
              className={`h-4 w-4 ${output.favorite ? "fill-current" : ""}`}
              aria-hidden="true"
            />
          </ReviewAction>
          <ReviewAction
            label={t("generation.download")}
            onClick={() => props.onDownload(output)}
          >
            <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          </ReviewAction>
          <ReviewAction
            label={t("generation.copyPrompt")}
            onClick={props.onCopyPrompt}
          >
            <CopyIcon className="h-4 w-4" aria-hidden="true" />
          </ReviewAction>
          {props.canAttach && (
            <ReviewAction
              label={t("prompt.addToPrompt")}
              onClick={() => props.onAttach(output)}
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </ReviewAction>
          )}
        </div>
      </div>
    </section>
  );
}
