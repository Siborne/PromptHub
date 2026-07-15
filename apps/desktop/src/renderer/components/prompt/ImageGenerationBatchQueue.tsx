import { ImageIcon, PlusIcon } from "lucide-react";
import type {
  GenerationBatchManifest,
  GenerationOutputRecord,
} from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";
import { resolveLocalGenerationImageSrc } from "../../utils/media-url";

interface ImageGenerationBatchQueueProps {
  batches: GenerationBatchManifest[];
  selectedBatch?: GenerationBatchManifest;
  selectedOutput: {
    batchId: string;
    output: GenerationOutputRecord;
  } | null;
  onSelectBatch: (id: string) => void;
  onNewBatch: () => void;
}

function BatchThumbnail({ batch }: { batch: GenerationBatchManifest }) {
  const outputs = batch.slots
    .flatMap((slot) => (slot.output ? [slot.output] : []))
    .slice(0, 4);
  return (
    <div className="grid h-12 w-16 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded bg-muted">
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

export function ImageGenerationBatchQueue({
  batches,
  selectedBatch,
  selectedOutput,
  onSelectBatch,
  onNewBatch,
}: ImageGenerationBatchQueueProps) {
  const { t } = useTranslation();
  const detailBatch = selectedOutput
    ? batches.find((batch) => batch.id === selectedOutput.batchId)
    : selectedBatch;
  const detailOutput = selectedOutput?.output;

  return (
    <aside className="hidden w-[292px] shrink-0 flex-col border-l border-border bg-background min-[980px]:flex">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">{t("generation.batchQueue")}</h2>
        <button
          type="button"
          onClick={onNewBatch}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:opacity-80"
        >
          <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t("generation.newBatch")}
        </button>
      </div>

      <div className="max-h-[48%] min-h-[170px] space-y-2 overflow-y-auto border-b border-border p-3">
        {batches.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
            {t("generation.noBatch")}
          </div>
        ) : (
          batches.map((batch) => {
            const settled =
              batch.counts.succeeded +
              batch.counts.failed +
              batch.counts.cancelled +
              batch.counts.interrupted;
            const progress = Math.round((settled / batch.targetCount) * 100);
            return (
              <button
                type="button"
                key={batch.id}
                onClick={() => onSelectBatch(batch.id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${selectedBatch?.id === batch.id ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate text-sm font-medium">
                    {batch.title}
                  </div>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    v{batch.sourcePromptVersion ?? batch.version}
                  </span>
                </div>
                <div className="mt-2 flex gap-3">
                  <BatchThumbnail batch={batch} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {batch.counts.succeeded} / {batch.targetCount}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded bg-muted">
                      <div
                        className={`h-full ${batch.status === "failed" ? "bg-destructive" : batch.status === "succeeded" ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-2 truncate text-[11px] text-muted-foreground">
                      {t(`generation.status.${batch.status}`)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {detailBatch ? (
          <div className="space-y-4">
            {detailOutput && (
              <img
                src={resolveLocalGenerationImageSrc(
                  `${detailBatch.id}/${detailOutput.fileName}`,
                )}
                alt={t("generation.outputAlt", {
                  index: detailOutput.slotIndex + 1,
                })}
                className="aspect-[4/5] w-24 rounded-md border border-border object-cover"
              />
            )}
            <div>
              <div className="text-[11px] text-muted-foreground">
                {t("generation.sourcePrompt")}
              </div>
              <div className="mt-1 text-sm font-medium">
                {detailBatch.title}
              </div>
            </div>
            <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-xs">
              <dt className="text-muted-foreground">{t("generation.model")}</dt>
              <dd className="truncate">
                {detailBatch.model.name || detailBatch.model.model}
              </dd>
              <dt className="text-muted-foreground">{t("generation.ratio")}</dt>
              <dd>{detailBatch.parameters.aspectRatio || "-"}</dd>
              <dt className="text-muted-foreground">
                {t("generation.createdAt")}
              </dt>
              <dd>{new Date(detailBatch.createdAt).toLocaleString()}</dd>
            </dl>
            <div>
              <div className="text-[11px] text-muted-foreground">
                {t("generation.executionPrompt")}
              </div>
              <p className="mt-1 line-clamp-5 text-xs leading-5 text-foreground">
                {detailBatch.resolvedPrompt}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t("generation.noSelection")}
          </div>
        )}
      </div>
    </aside>
  );
}
