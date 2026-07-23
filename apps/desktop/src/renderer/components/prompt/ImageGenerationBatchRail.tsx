import {
  CheckCircle2Icon,
  CircleDashedIcon,
  ImageIcon,
  LoaderCircleIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { GenerationBatchManifest } from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";
import { resolveLocalGenerationImageSrc } from "../../utils/media-url";

interface ImageGenerationBatchRailProps {
  batches: GenerationBatchManifest[];
  selectedBatch?: GenerationBatchManifest;
  onSelectBatch: (id: string) => void;
  onNewBatch: () => void;
}

export function getGenerationBatchProgress(
  batch: GenerationBatchManifest,
): number {
  if (batch.targetCount <= 0) return 0;
  const settled =
    batch.counts.succeeded +
    batch.counts.failed +
    batch.counts.cancelled +
    batch.counts.interrupted;
  return Math.round((settled / batch.targetCount) * 100);
}

function BatchThumbnail({ batch }: { batch: GenerationBatchManifest }) {
  const outputs = batch.slots
    .flatMap((slot) => (slot.output ? [slot.output] : []))
    .slice(0, 4);
  return (
    <div className="grid h-12 w-16 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded border border-border bg-card">
      {outputs.length > 0 ? (
        outputs.map((output) => (
          <img
            key={output.id}
            src={resolveLocalGenerationImageSrc(
              `${batch.id}/${output.fileName}`,
            )}
            alt=""
            className="h-full min-h-0 w-full object-cover"
          />
        ))
      ) : (
        <ImageIcon
          className="col-span-2 m-auto h-5 w-5 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function BatchStatusIcon({
  status,
}: {
  status: GenerationBatchManifest["status"];
}) {
  if (status === "succeeded") {
    return (
      <CheckCircle2Icon
        className="h-3.5 w-3.5 text-emerald-500"
        aria-hidden="true"
      />
    );
  }
  if (status === "failed" || status === "partially_succeeded") {
    return (
      <TriangleAlertIcon
        className="h-3.5 w-3.5 text-destructive"
        aria-hidden="true"
      />
    );
  }
  if (status === "running" || status === "cancelling") {
    return (
      <LoaderCircleIcon
        className="h-3.5 w-3.5 animate-spin text-primary"
        aria-hidden="true"
      />
    );
  }
  return (
    <CircleDashedIcon
      className="h-3.5 w-3.5 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

function BatchRailItem({
  batch,
  selected,
  onSelect,
}: {
  batch: GenerationBatchManifest;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const progress = getGenerationBatchProgress(batch);
  const progressColor =
    batch.status === "failed"
      ? "bg-destructive"
      : batch.status === "succeeded"
        ? "bg-emerald-500"
        : "bg-primary";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full rounded-md border p-3 text-left transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:bg-muted/40"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium">
          {batch.title}
        </div>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          v{batch.sourcePromptVersion ?? batch.version}
        </span>
      </div>
      <div className="mt-2.5 flex gap-3">
        <BatchThumbnail batch={batch} />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {batch.counts.succeeded} / {batch.targetCount}
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="mt-2 h-1 overflow-hidden rounded bg-muted"
            role="progressbar"
            aria-label={batch.title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className={`h-full ${progressColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <BatchStatusIcon status={batch.status} />
            <span className="truncate">
              {t(`generation.status.${batch.status}`)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function BatchRailEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-border bg-card">
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-xs">{t("generation.noBatch")}</span>
    </div>
  );
}

export function ImageGenerationBatchRail({
  batches,
  selectedBatch,
  onSelectBatch,
  onNewBatch,
}: ImageGenerationBatchRailProps) {
  const { t } = useTranslation();
  return (
    <section className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">{t("generation.batches")}</h2>
        <button
          type="button"
          onClick={onNewBatch}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("generation.newBatch")}
          title={t("generation.newBatch")}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      {batches.length === 0 ? (
        <BatchRailEmptyState />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {batches.map((batch) => (
            <BatchRailItem
              key={batch.id}
              batch={batch}
              selected={selectedBatch?.id === batch.id}
              onSelect={() => onSelectBatch(batch.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
