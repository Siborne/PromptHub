import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  Grid2X2Icon,
  HardDriveIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  StarIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { resolveGenerationPrompt } from "@prompthub/core/image-generation-workbench";
import type {
  GenerationBatchManifest,
  GenerationOutputRecord,
} from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "../../stores/prompt.store";
import { useSettingsStore } from "../../stores/settings.store";
import {
  cancelGenerationBatch,
  copyGenerationOutputToPromptMedia,
  getSupportedGenerationAspectRatios,
  loadGenerationBatches,
  retryGenerationBatch,
  setGenerationOutputFavorite,
  startGenerationBatch,
  subscribeGenerationBatches,
  supportsGenerationReferenceImages,
} from "../../services/generation-workbench-runner";
import { resolveLocalGenerationImageSrc } from "../../utils/media-url";
import { useToast } from "../ui/Toast";
import { ImageGenerationComposer } from "./ImageGenerationComposer";
import {
  getGenerationBatchProgress,
  ImageGenerationBatchRail,
} from "./ImageGenerationBatchRail";
import { ImageGenerationBatchSwitcher } from "./ImageGenerationBatchSwitcher";
import { ImageGenerationLightbox } from "./ImageGenerationLightbox";

type GalleryFilter = "current" | "all" | "favorite" | "failed";
type GalleryDensity = "compact" | "large" | "list";

interface SelectedOutput {
  batchId: string;
  output: GenerationOutputRecord;
}

interface GalleryOutputEntry {
  batch: GenerationBatchManifest;
  output: GenerationOutputRecord;
}

interface OutputTileProps {
  batch: GenerationBatchManifest;
  slotIndex: number;
  density: GalleryDensity;
  selected: boolean;
  onOpen: (selection: SelectedOutput) => void;
  onToggleSelect: (selection: SelectedOutput) => void;
}

function OutputTile({
  batch,
  slotIndex,
  density,
  selected,
  onOpen,
  onToggleSelect,
}: OutputTileProps) {
  const { t } = useTranslation();
  const slot = batch.slots[slotIndex];
  const output = slot.output;

  if (output) {
    const selection: SelectedOutput = { batchId: batch.id, output };
    const src = resolveLocalGenerationImageSrc(
      `${batch.id}/${output.fileName}`,
    );
    return (
      <div
        className={`group relative min-w-0 overflow-hidden rounded-md border bg-card transition-colors ${density === "list" ? "flex h-24 items-stretch" : "aspect-[4/5]"} ${selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/60"}`}
      >
        <button
          type="button"
          onClick={(event) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              onToggleSelect(selection);
            } else {
              onOpen(selection);
            }
          }}
          className={`${density === "list" ? "flex w-full items-stretch" : "block h-full w-full"} text-left`}
          aria-label={t("generation.outputAlt", { index: slotIndex + 1 })}
        >
          <img
            src={src}
            alt={t("generation.outputAlt", { index: slotIndex + 1 })}
            className={`${density === "list" ? "w-24 shrink-0" : "w-full"} h-full object-cover`}
            loading="lazy"
          />
          {density === "list" && (
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 bg-card px-4">
              <span className="truncate text-sm font-medium">
                {batch.title}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {batch.model.name || batch.model.model}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(output.createdAt).toLocaleString()}
              </span>
            </div>
          )}
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={t("generation.selectImage", { index: slotIndex + 1 })}
          onClick={() => onToggleSelect(selection)}
          className={`absolute left-2 top-2 h-5 w-5 items-center justify-center rounded border shadow-sm ${selected ? "flex border-primary bg-primary text-primary-foreground" : "hidden border-white/80 bg-background/90 text-transparent group-hover:flex group-focus-within:flex"}`}
        >
          <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span
          className="pointer-events-none absolute right-2 top-2 text-base font-medium text-white drop-shadow"
          aria-hidden="true"
        >
          {String(slotIndex + 1).padStart(2, "0")}
        </span>
        {output.favorite && (
          <span className="pointer-events-none absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-amber-500 shadow-sm">
            <StarIcon className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </span>
        )}
      </div>
    );
  }

  const failed = slot.status === "failed";
  const running = slot.status === "running";
  const stateClass = failed
    ? "border-destructive/35 bg-destructive/[0.035] text-destructive"
    : running
      ? "border-primary/30 bg-primary/[0.025] text-muted-foreground"
      : "border-dashed border-border bg-card text-muted-foreground";
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-md border ${density === "list" ? "h-24" : "aspect-[4/5]"} ${stateClass}`}
    >
      {failed ? (
        <XCircleIcon className="h-7 w-7" aria-hidden="true" />
      ) : running ? (
        <LoaderCircleIcon
          className="h-8 w-8 animate-spin text-primary"
          aria-hidden="true"
        />
      ) : (
        <ImageIcon className="h-7 w-7" aria-hidden="true" />
      )}
      <div className="text-center">
        <div className="text-sm font-medium">
          {failed
            ? t("generation.failed")
            : running
              ? t("generation.generating")
              : t(`generation.${slot.status}`)}
        </div>
        <div className="mt-1 text-xs opacity-75">
          {slotIndex + 1} / {batch.targetCount}
        </div>
      </div>
    </div>
  );
}

export function ImageGenerationWorkbench() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const updatePrompt = usePromptStore((state) => state.updatePrompt);
  const prompts = usePromptStore((state) => state.prompts).filter(
    (item) => item.promptType === "image",
  );
  const models = useSettingsStore((state) => state.aiModels).filter(
    (model) => model.type === "image" || model.capabilities?.imageGeneration,
  );
  const [batches, setBatches] = useState<GenerationBatchManifest[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [count, setCount] = useState(8);
  const [ratio, setRatio] = useState("1:1");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [selectedOutputKeys, setSelectedOutputKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [primaryOutputKey, setPrimaryOutputKey] = useState<string | null>(null);
  const [lightboxKey, setLightboxKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("current");
  const [galleryDensity, setGalleryDensity] =
    useState<GalleryDensity>("compact");
  const [sortNewest, setSortNewest] = useState(true);
  const [composerCollapsed, setComposerCollapsed] = useState(false);

  useEffect(
    () => subscribeGenerationBatches((next) => setBatches([...next])),
    [],
  );
  useEffect(() => {
    void loadGenerationBatches().then((next) => {
      setSelectedBatchId((current) => current ?? next[0]?.id ?? null);
    });
  }, []);
  const firstModelId = models[0]?.id;
  useEffect(() => {
    if (!modelId && firstModelId) setModelId(firstModelId);
  }, [firstModelId, modelId]);
  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) ?? batches[0],
    [batches, selectedBatchId],
  );
  const selectedModel = models.find((model) => model.id === modelId);
  const sourcePrompt = prompts.find((item) => item.id === selectedPromptId);
  const references = sourcePrompt?.images?.slice(0, 2) ?? [];
  const supportedRatios = useMemo(
    () =>
      selectedModel
        ? getSupportedGenerationAspectRatios(selectedModel)
        : ["1:1"],
    [selectedModel],
  );
  const referencesSupported =
    references.length === 0 ||
    Boolean(selectedModel && supportsGenerationReferenceImages(selectedModel));
  useEffect(() => {
    if (!supportedRatios.includes(ratio)) {
      setRatio(supportedRatios[0] ?? "1:1");
    }
  }, [ratio, supportedRatios]);
  const requiredVariablesReady =
    sourcePrompt?.variables
      .filter((variable) => variable.required)
      .every((variable) => variableValues[variable.name]?.trim()) ?? true;
  const resolvedPrompt = resolveGenerationPrompt(prompt, variableValues);
  const valid = Boolean(
    resolvedPrompt.trim() &&
    selectedModel &&
    referencesSupported &&
    requiredVariablesReady &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= 100,
  );

  const visibleTiles = useMemo(() => {
    const source =
      galleryFilter === "current" && selectedBatch ? [selectedBatch] : batches;
    return source
      .flatMap((batch) =>
        batch.slots
          .filter((slot) => {
            if (galleryFilter === "favorite") return slot.output?.favorite;
            if (galleryFilter === "failed")
              return slot.status === "failed" || slot.status === "interrupted";
            return true;
          })
          .map((slot) => ({ batch, slotIndex: slot.index })),
      )
      .sort((left, right) => {
        const dateOrder = left.batch.createdAt.localeCompare(
          right.batch.createdAt,
        );
        if (dateOrder !== 0) return sortNewest ? -dateOrder : dateOrder;
        return sortNewest
          ? right.slotIndex - left.slotIndex
          : left.slotIndex - right.slotIndex;
      });
  }, [batches, galleryFilter, selectedBatch, sortNewest]);
  const galleryOutputs = useMemo<GalleryOutputEntry[]>(
    () =>
      visibleTiles.flatMap(({ batch, slotIndex }) => {
        const output = batch.slots[slotIndex].output;
        return output ? [{ batch, output }] : [];
      }),
    [visibleTiles],
  );
  const selectedOutputs = useMemo(
    () =>
      batches.flatMap((batch) =>
        batch.slots.flatMap((slot) => {
          if (!slot.output) return [];
          const key = `${batch.id}:${slot.output.id}`;
          return selectedOutputKeys.has(key)
            ? [{ batch, output: slot.output, key }]
            : [];
        }),
      ),
    [batches, selectedOutputKeys],
  );
  const primaryOutput =
    selectedOutputs.find((item) => item.key === primaryOutputKey) ??
    selectedOutputs[0];
  const lightboxIndex = lightboxKey
    ? galleryOutputs.findIndex(
        (entry) => `${entry.batch.id}:${entry.output.id}` === lightboxKey,
      )
    : -1;
  const lightboxEntry =
    lightboxIndex >= 0 ? galleryOutputs[lightboxIndex] : null;

  const selectPrompt = (id: string) => {
    setSelectedPromptId(id);
    const source = prompts.find((item) => item.id === id);
    setPrompt(source?.userPrompt ?? "");
    setVariableValues(
      Object.fromEntries(
        source?.variables.map((variable) => [
          variable.name,
          variable.defaultValue ?? "",
        ]) ?? [],
      ),
    );
  };

  const resetDraft = () => {
    setSelectedPromptId("");
    setPrompt("");
    setVariableValues({});
    setSelectedOutputKeys(new Set());
    setPrimaryOutputKey(null);
    setSubmitError("");
  };

  const submit = async () => {
    if (!valid || !selectedModel) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const batch = await startGenerationBatch(
        {
          title: sourcePrompt?.title || prompt.trim().slice(0, 60),
          sourcePromptId: sourcePrompt?.id,
          sourcePromptVersion: sourcePrompt?.currentVersion,
          prompt: resolvedPrompt,
          variableValues,
          referenceImages: references.map((fileName) => ({
            source: "prompt" as const,
            fileName,
          })),
          model: {
            id: selectedModel.id,
            provider: selectedModel.provider,
            model: selectedModel.model,
            name: selectedModel.name,
          },
          targetCount: count,
          aspectRatio: ratio,
          quality,
        },
        selectedModel,
      );
      setSelectedBatchId(batch.id);
      setGalleryFilter("current");
      setComposerCollapsed(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("common.error");
      setSubmitError(message);
      showToast(t("generation.submitFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadOutputs = (entries: GalleryOutputEntry[]) => {
    entries.forEach(({ batch, output }) => {
      const anchor = document.createElement("a");
      anchor.href = resolveLocalGenerationImageSrc(
        `${batch.id}/${output.fileName}`,
      );
      anchor.download = `${batch.title}-${output.slotIndex + 1}.${output.fileName.split(".").pop() ?? "png"}`;
      anchor.click();
    });
  };

  const toggleFavorites = async (entries: GalleryOutputEntry[]) => {
    if (entries.length === 0) return;
    const favorite = entries.some((entry) => !entry.output.favorite);
    await Promise.all(
      entries.map(({ batch, output }) =>
        setGenerationOutputFavorite(batch.id, output.id, favorite),
      ),
    );
  };

  const attachOutputs = async (entries: GalleryOutputEntry[]) => {
    const imagesByPrompt = new Map<string, string[]>();
    for (const { batch, output } of entries) {
      if (!batch.sourcePromptId) continue;
      if (!prompts.some((item) => item.id === batch.sourcePromptId)) continue;
      const image = await copyGenerationOutputToPromptMedia(
        batch.id,
        output.id,
      );
      imagesByPrompt.set(batch.sourcePromptId, [
        ...(imagesByPrompt.get(batch.sourcePromptId) ?? []),
        image,
      ]);
    }
    await Promise.all(
      [...imagesByPrompt].map(async ([promptId, images]) => {
        const target = prompts.find((item) => item.id === promptId);
        if (!target) return;
        await updatePrompt(promptId, {
          images: Array.from(new Set([...(target.images ?? []), ...images])),
        });
      }),
    );
    showToast(t("generation.attachedToPrompt"), "success");
  };

  const copyExecutionPrompt = async (batch: GenerationBatchManifest) => {
    await navigator.clipboard.writeText(batch.resolvedPrompt);
    showToast(t("generation.promptCopied"), "success");
  };

  const retryFailed = async () => {
    if (!selectedBatch) return;
    const batchModel = models.find(
      (model) => model.id === selectedBatch.model.id,
    );
    if (batchModel) await retryGenerationBatch(selectedBatch, batchModel);
  };

  const toggleOutputSelection = (selection: SelectedOutput) => {
    const key = `${selection.batchId}:${selection.output.id}`;
    const next = new Set(selectedOutputKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedOutputKeys(next);
    setPrimaryOutputKey(
      next.has(key) ? key : ([...next][next.size - 1] ?? null),
    );
  };

  const clearSelection = () => {
    setSelectedOutputKeys(new Set());
    setPrimaryOutputKey(null);
  };

  const openLightbox = (selection: SelectedOutput) => {
    setLightboxKey(`${selection.batchId}:${selection.output.id}`);
  };

  const stepLightbox = (delta: number) => {
    if (galleryOutputs.length === 0) return;
    const current = lightboxIndex >= 0 ? lightboxIndex : 0;
    const nextIndex =
      (current + delta + galleryOutputs.length) % galleryOutputs.length;
    const next = galleryOutputs[nextIndex];
    setLightboxKey(`${next.batch.id}:${next.output.id}`);
  };

  const selectBatch = (id: string) => {
    setSelectedBatchId(id);
    setGalleryFilter("current");
    setSelectedOutputKeys(new Set());
    setPrimaryOutputKey(null);
  };

  const startNewBatch = () => {
    resetDraft();
    setComposerCollapsed(false);
  };

  const composerProps = {
    prompts,
    models,
    selectedPromptId,
    onSelectPrompt: selectPrompt,
    modelId,
    onModelChange: setModelId,
    ratio,
    supportedRatios,
    onRatioChange: setRatio,
    quality,
    onQualityChange: setQuality,
    count,
    onCountChange: setCount,
    prompt,
    onPromptChange: setPrompt,
    sourcePrompt,
    variableValues,
    onVariableChange: (name: string, value: string) =>
      setVariableValues((current) => ({ ...current, [name]: value })),
    resolvedPrompt,
    references,
    referencesSupported,
    valid,
    submitting,
    submitError,
    onSubmit: () => void submit(),
  };

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-card">
      <aside
        data-testid="generation-batch-rail"
        className="flex w-64 shrink-0 flex-col border-r border-border bg-card"
      >
        <ImageGenerationBatchRail
          batches={batches}
          selectedBatch={selectedBatch}
          onSelectBatch={selectBatch}
          onNewBatch={startNewBatch}
        />
      </aside>

      <main
        data-testid="generation-gallery"
        className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-5">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="shrink-0 text-lg font-semibold">
              {t("generation.workbench")}
            </h1>
            {selectedBatch && (
              <ImageGenerationBatchSwitcher
                batches={batches}
                selectedBatch={selectedBatch}
                onSelectBatch={selectBatch}
              />
            )}
          </div>
          <nav
            className="flex h-full min-w-0 shrink-0 items-center gap-6 overflow-hidden text-sm max-[1199px]:gap-4 max-[1199px]:text-xs"
            aria-label={t("generation.workbench")}
          >
            {(
              [
                [
                  "current",
                  t("generation.currentBatchTab", {
                    done: selectedBatch?.counts.succeeded ?? 0,
                    total: selectedBatch?.targetCount ?? 0,
                  }),
                ],
                ["all", t("generation.allWorks")],
                ["favorite", t("generation.favorite")],
                [
                  "failed",
                  t("generation.failedCount", {
                    count: batches.reduce(
                      (sum, batch) =>
                        sum + batch.counts.failed + batch.counts.interrupted,
                      0,
                    ),
                  }),
                ],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => setGalleryFilter(value)}
                className={`relative h-full whitespace-nowrap ${galleryFilter === value ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
                {galleryFilter === value && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </nav>
        </header>

        {selectedBatch &&
          ["queued", "running"].includes(selectedBatch.status) && (
            <div
              className="h-1 shrink-0 bg-muted"
              role="progressbar"
              aria-label={t("generation.batchProgress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={getGenerationBatchProgress(selectedBatch)}
            >
              <div
                className="h-full bg-primary"
                style={{
                  width: `${getGenerationBatchProgress(selectedBatch)}%`,
                }}
              />
            </div>
          )}

        <section
          data-testid="generation-gallery-toolbar"
          className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-border bg-card px-5"
        >
          {selectedBatch &&
            ["queued", "running"].includes(selectedBatch.status) && (
              <button
                type="button"
                onClick={() => void cancelGenerationBatch(selectedBatch.id)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                title={t("generation.cancel")}
                aria-label={t("generation.cancel")}
              >
                <SquareIcon className="h-3.5 w-3.5" />
              </button>
            )}
          {selectedBatch &&
            !["queued", "running"].includes(selectedBatch.status) &&
            selectedBatch.counts.failed + selectedBatch.counts.interrupted >
              0 && (
              <button
                type="button"
                onClick={() => void retryFailed()}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                title={t("generation.retryFailed")}
                aria-label={t("generation.retryFailed")}
              >
                <RefreshCwIcon className="h-3.5 w-3.5" />
              </button>
            )}
          <button
            type="button"
            onClick={() => setSortNewest((value) => !value)}
            className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-xs"
            aria-label={
              sortNewest
                ? t("generation.latestFirst")
                : t("generation.oldestFirst")
            }
          >
            {sortNewest
              ? t("generation.latestFirst")
              : t("generation.oldestFirst")}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <div className="flex h-8 overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setGalleryDensity("compact")}
              className={`flex w-8 items-center justify-center ${galleryDensity === "compact" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              aria-label={t("generation.compactGrid")}
              aria-pressed={galleryDensity === "compact"}
            >
              <Grid2X2Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setGalleryDensity("large")}
              className={`flex w-8 items-center justify-center border-l border-border ${galleryDensity === "large" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              aria-label={t("generation.largeGrid")}
              aria-pressed={galleryDensity === "large"}
            >
              <LayoutGridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setGalleryDensity("list")}
              className={`flex w-8 items-center justify-center border-l border-border ${galleryDensity === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              aria-label={t("generation.listView")}
              aria-pressed={galleryDensity === "list"}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-y-auto bg-card p-4">
          {visibleTiles.length > 0 ? (
            <div
              className={`grid gap-3 ${galleryDensity === "compact" ? "grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : galleryDensity === "large" ? "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1"}`}
            >
              {visibleTiles.map(({ batch, slotIndex }) => (
                <OutputTile
                  key={`${batch.id}:${slotIndex}`}
                  batch={batch}
                  slotIndex={slotIndex}
                  density={galleryDensity}
                  selected={Boolean(
                    batch.slots[slotIndex].output &&
                    selectedOutputKeys.has(
                      `${batch.id}:${batch.slots[slotIndex].output?.id}`,
                    ),
                  )}
                  onOpen={openLightbox}
                  onToggleSelect={toggleOutputSelection}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
              <span className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border bg-card">
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="max-w-sm space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {t("generation.empty")}
                </p>
                <p className="flex items-center justify-center gap-1.5 text-xs">
                  <HardDriveIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("generation.localOnly")}
                </p>
              </div>
            </div>
          )}
        </div>

        {selectedOutputs.length > 0 && (
          <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
            <span className="text-sm">
              {t("generation.selectedCount", {
                count: selectedOutputs.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleFavorites(selectedOutputs)}
                aria-pressed={selectedOutputs.every(
                  (item) => item.output.favorite,
                )}
                className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm"
              >
                <StarIcon
                  className={`h-4 w-4 ${selectedOutputs.every((item) => item.output.favorite) ? "fill-current text-amber-500" : ""}`}
                />
                {t("generation.favorite")}
              </button>
              {selectedOutputs.some(
                (item) =>
                  item.batch.sourcePromptId &&
                  prompts.some(
                    (promptItem) => promptItem.id === item.batch.sourcePromptId,
                  ),
              ) && (
                <button
                  type="button"
                  onClick={() => void attachOutputs(selectedOutputs)}
                  className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm"
                >
                  <ImageIcon className="h-4 w-4" />
                  {t("prompt.addToPrompt")}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  primaryOutput && void copyExecutionPrompt(primaryOutput.batch)
                }
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border"
                title={t("generation.copyPrompt")}
                aria-label={t("generation.copyPrompt")}
              >
                <CopyIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => downloadOutputs(selectedOutputs)}
                className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm"
              >
                <DownloadIcon className="h-4 w-4" />
                {t("generation.download")}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="flex h-9 w-9 items-center justify-center text-muted-foreground"
                aria-label={t("common.close")}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {composerCollapsed ? (
        <aside
          data-testid="generation-config-panel"
          className="flex w-10 shrink-0 flex-col items-center border-l border-border bg-card py-3"
        >
          <button
            type="button"
            onClick={() => setComposerCollapsed(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("generation.expandSettings")}
            title={t("generation.expandSettings")}
          >
            <SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </aside>
      ) : (
        <aside
          data-testid="generation-config-panel"
          className="flex w-[clamp(300px,32vw,352px)] min-w-[300px] shrink-0 flex-col border-l border-border bg-card"
        >
          <ImageGenerationComposer
            {...composerProps}
            onClose={() => setComposerCollapsed(true)}
          />
        </aside>
      )}

      {lightboxEntry && (
        <ImageGenerationLightbox
          batch={lightboxEntry.batch}
          output={lightboxEntry.output}
          position={lightboxIndex + 1}
          total={galleryOutputs.length}
          canAttach={Boolean(
            lightboxEntry.batch.sourcePromptId &&
            prompts.some(
              (item) => item.id === lightboxEntry.batch.sourcePromptId,
            ),
          )}
          onClose={() => setLightboxKey(null)}
          onPrevious={() => stepLightbox(-1)}
          onNext={() => stepLightbox(1)}
          onToggleFavorite={() => void toggleFavorites([lightboxEntry])}
          onDownload={() => downloadOutputs([lightboxEntry])}
          onCopyPrompt={() => void copyExecutionPrompt(lightboxEntry.batch)}
          onAttach={() => void attachOutputs([lightboxEntry])}
        />
      )}
    </div>
  );
}
