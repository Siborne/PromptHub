import {
  CheckCircle2Icon,
  KeyRoundIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  TestTubeIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentModelCatalogProvider,
  AgentPiThinkingLevel,
  AgentProviderModelTestResult,
} from "@prompthub/shared/types";
import { Button } from "../ui";

const THINKING_LEVELS: AgentPiThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function formatTokenCount(value?: number): string | null {
  if (!value) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

interface AgentPiProviderDetailProps {
  provider: AgentModelCatalogProvider;
  currentModel: string | null;
  thinkingLevel: AgentPiThinkingLevel | null;
  isDefaultProvider: boolean;
  busyAction: string | null;
  onSetDefault: (providerId: string, modelId: string) => void;
  onSetThinking: (level: AgentPiThinkingLevel) => void;
  onAddModel: () => void;
  onSetCredential: () => void;
  modelTestResult: {
    modelId: string;
    result: AgentProviderModelTestResult;
  } | null;
  onEditProvider: () => void;
  onEditModel: (model: AgentModelCatalogProvider["models"][number]) => void;
  onTestModel: (modelId: string) => void;
  onRemoveProvider: () => void;
  onRemoveModel: (modelId: string) => void;
}

export function AgentPiProviderDetail({
  provider,
  currentModel,
  thinkingLevel,
  isDefaultProvider,
  busyAction,
  onSetThinking,
  onSetDefault,
  onAddModel,
  onSetCredential,
  modelTestResult,
  onEditProvider,
  onEditModel,
  onTestModel,
  onRemoveProvider,
  onRemoveModel,
}: AgentPiProviderDetailProps) {
  const { t } = useTranslation();
  const busy = busyAction !== null;
  const sourceLabel = t(
    provider.source === "custom"
      ? "agents.piModels.sourceCustom"
      : "agents.piModels.sourceBuiltIn",
  );
  const credentialLabel = provider.credentialSource
    ? t(`agents.piModels.credentialSources.${provider.credentialSource}`)
    : t("agents.piModels.credentialMissing");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/[0.12] px-5 py-5">
      <section
        className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        aria-labelledby="pi-provider-heading"
      >
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("agents.piModels.providerSection")}
            </p>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
              <h2
                id="pi-provider-heading"
                className="truncate text-lg font-semibold tracking-tight text-foreground"
              >
                {provider.id}
              </h2>
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {sourceLabel}
              </span>
              {isDefaultProvider ? (
                <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {t("agents.piModels.currentDefault")}
                </span>
              ) : null}
            </div>
            {provider.endpoint ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {provider.endpoint}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {provider.source === "custom" ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={onEditProvider}
                disabled={busy}
              >
                <PencilIcon className="h-3.5 w-3.5" />
                {t("common.edit")}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={onSetCredential}
              disabled={busy}
            >
              <KeyRoundIcon className="h-3.5 w-3.5" />
              {t("agents.piModels.credentialSet")}
            </Button>
            {provider.source === "custom" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemoveProvider}
                disabled={busy}
                aria-label={t("agents.piModels.removeProvider")}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <dl className="grid border-t border-border/70 sm:grid-cols-2 xl:grid-cols-4">
          <MetadataItem
            label={t("agents.piModels.apiType")}
            value={provider.api ?? t("agents.piModels.platformDefault")}
          />
          <MetadataItem
            label={t("agents.piModels.endpointLabel")}
            value={provider.endpoint ?? t("agents.piModels.platformEndpoint")}
          />
          <MetadataItem
            label={t("agents.piModels.configurationSource")}
            value={sourceLabel}
          />
          <MetadataItem
            label={t("agents.piModels.credentialLabel")}
            value={credentialLabel}
          />
        </dl>
      </section>

      <section
        className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        aria-labelledby="pi-provider-models-heading"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3
              id="pi-provider-models-heading"
              className="text-sm font-semibold text-foreground"
            >
              {t("agents.piModels.modelsSection")}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("agents.piModels.modelsCount", {
                count: provider.models.length,
              })}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onAddModel}
            disabled={busy}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t("agents.piModels.addModel")}
          </Button>
        </div>

        {provider.models.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t("agents.piModels.noModels")}
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {provider.models.map((model) => {
              const isCurrent = isDefaultProvider && model.id === currentModel;
              return (
                <li key={`${model.source}-${model.id}`} className="px-4 py-3.5">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <code className="truncate text-sm font-semibold text-foreground">
                          {model.id}
                        </code>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {model.source === "custom"
                            ? t("agents.piModels.customTag")
                            : t("agents.providerDetail.builtInBadge")}
                        </span>
                        {isCurrent ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {t("agents.piModels.currentDefault")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {model.name ? <span>{model.name}</span> : null}
                        {model.reasoning ? (
                          <span>{t("agents.piModels.reasoning")}</span>
                        ) : null}
                        {model.maxTokens ? (
                          <span>
                            {t("agents.piModels.maxTokens", {
                              size: formatTokenCount(model.maxTokens),
                            })}
                          </span>
                        ) : null}
                        {formatTokenCount(model.contextWindow) ? (
                          <span>
                            {t("agents.piModels.contextWindow", {
                              size: formatTokenCount(model.contextWindow),
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onTestModel(model.id)}
                        disabled={busy}
                      >
                        {busyAction === `test-model:${model.id}` ? (
                          <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TestTubeIcon className="h-3.5 w-3.5" />
                        )}
                        {t("agents.piModels.testModel")}
                      </Button>
                      {!isCurrent ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onSetDefault(provider.id, model.id)}
                          disabled={busy}
                        >
                          {busyAction === "set-default" ? (
                            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                          )}
                          {t("agents.piModels.setDefault")}
                        </Button>
                      ) : null}
                      {model.source === "custom" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditModel(model)}
                          disabled={busy}
                          aria-label={t("agents.piModels.editModel")}
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {model.source === "custom" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemoveModel(model.id)}
                          disabled={busy}
                          aria-label={t("agents.piModels.removeModel")}
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {modelTestResult?.modelId === model.id ? (
                    <div
                      role="status"
                      className="mt-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <span
                        className={
                          modelTestResult.result.status === "ok"
                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                            : "font-semibold text-amber-600 dark:text-amber-400"
                        }
                      >
                        {t(
                          `agents.providerProfiles.modelTest.status.${modelTestResult.result.status}`,
                        )}
                      </span>
                      <span className="ml-3">
                        {t("agents.providerProfiles.modelTest.total", {
                          ms: modelTestResult.result.totalMs,
                        })}
                      </span>
                    </div>
                  ) : null}
                  {isCurrent ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                        <ShieldCheckIcon className="h-4 w-4 text-primary" />
                        {t("agents.piModels.thinkingLevel")}
                      </div>
                      <select
                        aria-label={t("agents.piModels.thinkingLevel")}
                        value={thinkingLevel ?? "medium"}
                        onChange={(event) =>
                          onSetThinking(
                            event.target.value as AgentPiThinkingLevel,
                          )
                        }
                        disabled={busy}
                        className="h-8 min-w-32 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {THINKING_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border/70 px-4 py-3 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd
        className="mt-1 truncate text-sm font-medium text-foreground"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
