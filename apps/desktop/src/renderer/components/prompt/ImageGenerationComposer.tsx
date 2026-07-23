import {
  AlertCircleIcon,
  HardDriveIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import type { Prompt } from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";
import type { AIModelConfig } from "../../stores/settings.store";
import { resolveLocalImageSrc } from "../../utils/media-url";

interface ImageGenerationComposerProps {
  prompts: Prompt[];
  models: AIModelConfig[];
  selectedPromptId: string;
  onSelectPrompt: (id: string) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  ratio: string;
  supportedRatios: string[];
  onRatioChange: (ratio: string) => void;
  quality: "standard" | "hd";
  onQualityChange: (quality: "standard" | "hd") => void;
  count: number;
  onCountChange: (count: number) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  sourcePrompt?: Prompt;
  variableValues: Record<string, string>;
  onVariableChange: (name: string, value: string) => void;
  resolvedPrompt: string;
  references: string[];
  referencesSupported: boolean;
  valid: boolean;
  submitting: boolean;
  submitError: string;
  onSubmit: () => void;
  onClose?: () => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

const controlClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/10";

export function ImageGenerationComposer({
  prompts,
  models,
  selectedPromptId,
  onSelectPrompt,
  modelId,
  onModelChange,
  ratio,
  supportedRatios,
  onRatioChange,
  quality,
  onQualityChange,
  count,
  onCountChange,
  prompt,
  onPromptChange,
  sourcePrompt,
  variableValues,
  onVariableChange,
  resolvedPrompt,
  references,
  referencesSupported,
  valid,
  submitting,
  submitError,
  onSubmit,
  onClose,
}: ImageGenerationComposerProps) {
  const { t } = useTranslation();

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-card">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">{t("generation.settings")}</h2>
        <div className="flex items-center gap-2">
          <span className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[10px] text-muted-foreground">
            <HardDriveIcon className="h-3 w-3" aria-hidden="true" />
            {t("generation.localOnly")}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("generation.collapseSettings")}
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <FieldLabel>{t("generation.sourcePrompt")}</FieldLabel>
          <select
            value={selectedPromptId}
            onChange={(event) => onSelectPrompt(event.target.value)}
            className={controlClass}
          >
            <option value="">{t("generation.adhocPrompt")}</option>
            {prompts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>{t("generation.model")}</FieldLabel>
          <select
            value={modelId}
            onChange={(event) => onModelChange(event.target.value)}
            className={controlClass}
          >
            <option value="">{t("generation.selectModel")}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name || model.model}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2">
          <div className="min-w-0">
            <FieldLabel>{t("generation.ratio")}</FieldLabel>
            <select
              value={ratio}
              onChange={(event) => onRatioChange(event.target.value)}
              className={`${controlClass} px-2`}
            >
              {supportedRatios.map((supportedRatio) => (
                <option key={supportedRatio}>{supportedRatio}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <FieldLabel>{t("generation.quality")}</FieldLabel>
            <select
              value={quality}
              onChange={(event) =>
                onQualityChange(event.target.value as "standard" | "hd")
              }
              className={`${controlClass} px-2`}
            >
              <option value="standard">{t("generation.standard")}</option>
              <option value="hd">{t("generation.high")}</option>
            </select>
          </div>
          <div className="min-w-0">
            <FieldLabel>{t("generation.count")}</FieldLabel>
            <div className="flex h-10 overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
              <button
                type="button"
                onClick={() => onCountChange(Math.max(1, count - 1))}
                className="flex w-8 shrink-0 items-center justify-center border-r border-border hover:bg-muted"
                aria-label={t("generation.decreaseCount")}
              >
                <MinusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <input
                aria-label={t("generation.count")}
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(event) => onCountChange(Number(event.target.value))}
                className="min-w-0 flex-1 bg-transparent px-1 text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => onCountChange(Math.min(100, count + 1))}
                className="flex w-8 shrink-0 items-center justify-center border-l border-border hover:bg-muted"
                aria-label={t("generation.increaseCount")}
              >
                <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>{t("generation.executionPrompt")}</FieldLabel>
            {sourcePrompt && sourcePrompt.variables.length > 0 && (
              <span className="mb-1.5 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t("generation.variableCount", {
                  count: sourcePrompt.variables.length,
                })}
              </span>
            )}
          </div>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder={t("generation.promptPlaceholder")}
            className="h-32 w-full resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {sourcePrompt && sourcePrompt.variables.length > 0 && (
          <div className="space-y-2">
            <FieldLabel>{t("generation.resolvedPrompt")}</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {sourcePrompt.variables.map((variable) => (
                <label
                  key={variable.name}
                  className="flex h-8 min-w-0 items-center gap-1 rounded-md border border-border bg-background px-2"
                >
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {variable.label || variable.name}
                  </span>
                  <input
                    aria-label={variable.label || variable.name}
                    value={variableValues[variable.name] ?? ""}
                    onChange={(event) =>
                      onVariableChange(variable.name, event.target.value)
                    }
                    placeholder={variable.required ? "*" : ""}
                    className="min-w-8 flex-1 bg-transparent text-xs outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="line-clamp-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs leading-5 text-foreground">
              {resolvedPrompt || t("generation.none")}
            </p>
          </div>
        )}

        <div>
          <FieldLabel>{t("generation.referenceImages")}</FieldLabel>
          {references.length > 0 ? (
            <div className="flex gap-2">
              {references.map((image, index) => (
                <img
                  key={image}
                  src={resolveLocalImageSrc(image)}
                  alt={t("generation.referenceImageAlt", { index: index + 1 })}
                  className="h-16 w-16 rounded-md border border-border object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="flex h-14 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              {t("generation.none")}
            </div>
          )}
          {!referencesSupported && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {t("generation.referenceUnsupported")}
            </p>
          )}
        </div>

        {models.length === 0 && (
          <div
            role="alert"
            className="flex min-h-9 items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-300"
          >
            <AlertCircleIcon
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {t("settings.noImageModelHint")}
          </div>
        )}
        {submitError && (
          <p role="alert" className="text-xs text-destructive">
            {submitError}
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t border-border p-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!valid || submitting}
          className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayIcon className="h-4 w-4" aria-hidden="true" />
          {t("generation.start")}
        </button>
      </footer>
    </section>
  );
}
