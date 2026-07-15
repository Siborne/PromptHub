import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  Grid2X2Icon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  LoaderCircleIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
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
import {
  resolveLocalGenerationImageSrc,
  resolveLocalImageSrc,
} from "../../utils/media-url";
import { useToast } from "../ui/Toast";
import { ImageGenerationBatchQueue } from "./ImageGenerationBatchQueue";

type GalleryFilter = "current" | "all" | "favorite" | "failed";
type GalleryDensity = "compact" | "large" | "list";

interface SelectedOutput {
  batchId: string;
  output: GenerationOutputRecord;
}

interface OutputTileProps {
  batch: GenerationBatchManifest;
  slotIndex: number;
  density: GalleryDensity;
  selected: boolean;
  onSelect: (selection: SelectedOutput | null) => void;
}

function OutputTile({
  batch,
  slotIndex,
  density,
  selected,
  onSelect,
}: OutputTileProps) {
  const { t } = useTranslation();
  const slot = batch.slots[slotIndex];
  const output = slot.output;

  if (output) {
    const src = resolveLocalGenerationImageSrc(
      `${batch.id}/${output.fileName}`,
    );
    return (
      <button
        type="button"
        onClick={() => onSelect({ batchId: batch.id, output })}
        className={`group relative min-w-0 overflow-hidden rounded-md border bg-muted text-left transition-colors ${density === "list" ? "h-28" : "aspect-[4/5]"} ${selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/60"}`}
        aria-label={t("generation.outputAlt", { index: slotIndex + 1 })}
        aria-pressed={selected}
      >
        <img
          src={src}
          alt={t("generation.outputAlt", { index: slotIndex + 1 })}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <span
          className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border shadow-sm ${selected ? "border-primary bg-primary text-primary-foreground" : "border-white/80 bg-background/90 text-transparent"}`}
        >
          <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="absolute right-2 top-2 text-base font-medium text-white drop-shadow">
          {String(slotIndex + 1).padStart(2, "0")}
        </span>
      </button>
    );
  }

  const failed = slot.status === "failed";
  const running = slot.status === "running";
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-md border ${density === "list" ? "h-28" : "aspect-[4/5]"} ${failed ? "border-destructive/35 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-muted-foreground"}`}
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

function LabeledControl({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="mb-1.5 block text-[11px] text-muted-foreground">
        {label}
      </span>
      {children}
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("current");
  const [galleryDensity, setGalleryDensity] =
    useState<GalleryDensity>("compact");
  const [sortNewest, setSortNewest] = useState(true);
  const [multiSelect, setMultiSelect] = useState(false);

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
  const activeBatches = batches.filter(
    (batch) => batch.status === "running" || batch.status === "queued",
  ).length;

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
  const selectedOutput = primaryOutput
    ? { batchId: primaryOutput.batch.id, output: primaryOutput.output }
    : null;

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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("common.error");
      setSubmitError(message);
      showToast(t("generation.submitFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBatchForOutput = primaryOutput?.batch;

  const downloadOutput = () => {
    selectedOutputs.forEach(({ batch, output }) => {
      const anchor = document.createElement("a");
      anchor.href = resolveLocalGenerationImageSrc(
        `${batch.id}/${output.fileName}`,
      );
      anchor.download = `${batch.title}-${output.slotIndex + 1}.${output.fileName.split(".").pop() ?? "png"}`;
      anchor.click();
    });
  };

  const toggleFavorite = async () => {
    if (selectedOutputs.length === 0) return;
    const favorite = selectedOutputs.some((item) => !item.output.favorite);
    await Promise.all(
      selectedOutputs.map(({ batch, output }) =>
        setGenerationOutputFavorite(batch.id, output.id, favorite),
      ),
    );
  };

  const attachToSourcePrompt = async () => {
    const imagesByPrompt = new Map<string, string[]>();
    for (const { batch, output } of selectedOutputs) {
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

  const copyExecutionPrompt = async () => {
    if (!selectedBatchForOutput) return;
    await navigator.clipboard.writeText(selectedBatchForOutput.resolvedPrompt);
    showToast(t("generation.promptCopied"), "success");
  };

  const retryFailed = async () => {
    if (!selectedBatch) return;
    const batchModel = models.find(
      (model) => model.id === selectedBatch.model.id,
    );
    if (batchModel) await retryGenerationBatch(selectedBatch, batchModel);
  };

  const selectOutput = (selection: SelectedOutput | null) => {
    if (!selection) {
      setSelectedOutputKeys(new Set());
      setPrimaryOutputKey(null);
      return;
    }
    const key = `${selection.batchId}:${selection.output.id}`;
    if (!multiSelect) {
      const isSelected = selectedOutputKeys.has(key);
      setSelectedOutputKeys(isSelected ? new Set() : new Set([key]));
      setPrimaryOutputKey(isSelected ? null : key);
      return;
    }
    const next = new Set(selectedOutputKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedOutputKeys(next);
    setPrimaryOutputKey(
      next.has(key) ? key : ([...next][next.size - 1] ?? null),
    );
  };

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        <section className="shrink-0 border-b border-border bg-background">
          <div className="flex h-14 items-center gap-3 px-4">
            <h1 className="text-xl font-semibold">
              {t("generation.workbench")}
            </h1>
            <span
              className={`h-2 w-2 rounded-full ${activeBatches > 0 ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
            <span className="text-sm text-muted-foreground">
              {t("generation.runningCount", { count: activeBatches })}
            </span>
          </div>

          <div
            data-testid="generation-config"
            className="grid items-end gap-3 px-4 pb-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
            }}
          >
            <LabeledControl
              label={t("generation.sourcePrompt")}
              className="col-span-2"
            >
              <select
                value={selectedPromptId}
                onChange={(event) => selectPrompt(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("generation.adhocPrompt")}</option>
                {prompts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </LabeledControl>
            <LabeledControl
              label={t("generation.model")}
              className="col-span-2"
            >
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("generation.selectModel")}</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name || model.model}
                  </option>
                ))}
              </select>
            </LabeledControl>
            <LabeledControl label={t("generation.ratio")}>
              <select
                value={ratio}
                onChange={(event) => setRatio(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {supportedRatios.map((supportedRatio) => (
                  <option key={supportedRatio}>{supportedRatio}</option>
                ))}
              </select>
            </LabeledControl>
            <LabeledControl label={t("generation.quality")}>
              <select
                value={quality}
                onChange={(event) =>
                  setQuality(event.target.value as "standard" | "hd")
                }
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="standard">{t("generation.standard")}</option>
                <option value="hd">{t("generation.high")}</option>
              </select>
            </LabeledControl>
            <LabeledControl label={t("generation.count")}>
              <div className="flex h-9 overflow-hidden rounded-md border border-input bg-background">
                <button
                  type="button"
                  onClick={() => setCount((value) => Math.max(1, value - 1))}
                  className="flex w-8 items-center justify-center border-r border-border hover:bg-muted"
                  aria-label={t("generation.decreaseCount")}
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <input
                  aria-label={t("generation.count")}
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setCount((value) => Math.min(100, value + 1))}
                  className="flex w-8 items-center justify-center border-l border-border hover:bg-muted"
                  aria-label={t("generation.increaseCount")}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </LabeledControl>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!valid || submitting}
              className="flex h-9 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <PlayIcon className="h-4 w-4" aria-hidden="true" />
              {t("generation.start")}
            </button>
          </div>
        </section>

        <section className="grid shrink-0 grid-cols-[minmax(0,1fr)_180px_96px] border-b border-border bg-background">
          <div className="min-w-0 border-r border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">
                {t("generation.resolvedPrompt")}
              </span>
              {sourcePrompt && sourcePrompt.variables.length > 0 && (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                  {t("generation.variableCount", {
                    count: sourcePrompt.variables.length,
                  })}
                </span>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t("generation.promptPlaceholder")}
              className={`${promptExpanded ? "h-24" : "h-12"} mt-1 w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground/60`}
            />
            {sourcePrompt && sourcePrompt.variables.length > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {sourcePrompt.variables.map((variable) => (
                  <input
                    key={variable.name}
                    aria-label={variable.label || variable.name}
                    value={variableValues[variable.name] ?? ""}
                    onChange={(event) =>
                      setVariableValues((current) => ({
                        ...current,
                        [variable.name]: event.target.value,
                      }))
                    }
                    placeholder={`${variable.label || variable.name}${variable.required ? " *" : ""}`}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPromptExpanded((value) => !value)}
              className="mt-1 flex items-center gap-1 text-xs text-primary"
            >
              {promptExpanded ? t("common.collapse") : t("common.expand")}
              <ChevronDownIcon
                className={`h-3.5 w-3.5 ${promptExpanded ? "rotate-180" : ""}`}
              />
            </button>
            {submitError && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {submitError}
              </p>
            )}
          </div>
          <div className="border-r border-border px-3 py-3">
            <div className="text-[11px] text-muted-foreground">
              {t("generation.referenceImages")}
            </div>
            <div className="mt-2 flex gap-2">
              {references.length > 0 ? (
                references.map((image) => (
                  <img
                    key={image}
                    src={resolveLocalImageSrc(image)}
                    alt=""
                    className="h-12 w-12 rounded-md border border-border object-cover"
                  />
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("generation.none")}
                </span>
              )}
            </div>
            {!referencesSupported && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {t("generation.referenceUnsupported")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPromptExpanded((value) => !value)}
            className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <SlidersHorizontalIcon className="h-5 w-5" aria-hidden="true" />
            {t("generation.advanced")}
          </button>
        </section>

        <section
          data-testid="generation-gallery-toolbar"
          className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 border-b border-border px-4"
        >
          <div className="flex h-12 shrink-0 items-center gap-7 text-sm">
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
          </div>
          <div className="flex h-10 shrink-0 items-center gap-2">
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
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={multiSelect}
                onChange={(event) => {
                  setMultiSelect(event.target.checked);
                  setSelectedOutputKeys(new Set());
                  setPrimaryOutputKey(null);
                }}
                className="h-4 w-4 accent-primary"
              />
              {t("generation.multiSelect")}
            </label>
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {visibleTiles.length > 0 ? (
            <div
              className={`grid gap-3 ${galleryDensity === "compact" ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : galleryDensity === "large" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}
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
                  onSelect={selectOutput}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10" aria-hidden="true" />
              <p className="text-sm">{t("generation.empty")}</p>
            </div>
          )}
        </div>

        {selectedOutputs.length > 0 && (
          <div className="flex h-14 shrink-0 items-center justify-between border-t border-border bg-background px-4">
            <span className="text-sm">
              {t("generation.selectedCount", {
                count: selectedOutputs.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleFavorite()}
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
                  onClick={() => void attachToSourcePrompt()}
                  className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm"
                >
                  <ImageIcon className="h-4 w-4" />
                  {t("prompt.addToPrompt")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyExecutionPrompt()}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border"
                title={t("generation.copyPrompt")}
              >
                <CopyIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={downloadOutput}
                className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm"
              >
                <DownloadIcon className="h-4 w-4" />
                {t("generation.download")}
              </button>
              <button
                type="button"
                onClick={() => selectOutput(null)}
                className="flex h-9 w-9 items-center justify-center text-muted-foreground"
                aria-label={t("common.close")}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      <ImageGenerationBatchQueue
        batches={batches}
        selectedBatch={selectedBatch}
        selectedOutput={selectedOutput}
        onSelectBatch={(id) => {
          setSelectedBatchId(id);
          setGalleryFilter("current");
          setSelectedOutputKeys(new Set());
          setPrimaryOutputKey(null);
        }}
        onNewBatch={resetDraft}
      />
    </div>
  );
}
