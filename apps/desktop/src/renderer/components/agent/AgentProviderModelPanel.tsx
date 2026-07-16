import { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CpuIcon,
  Loader2Icon,
  SaveIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentModelConfiguration,
  ManagedAgentSummary,
} from "@prompthub/shared/types";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function AgentProviderModelPanel({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AgentModelConfiguration | null>(null);
  const [model, setModel] = useState("");
  const [secondaryModel, setSecondaryModel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setSaved(false);
    window.api.agent
      .getModelConfig(agent.id)
      .then((next) => {
        if (!active) return;
        setConfig(next);
        setModel(next.model || "");
        setSecondaryModel(next.secondaryModel || "");
      })
      .catch(() => active && setError(t("agents.modelLoadFailed")))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [agent.id, t]);

  async function saveModel() {
    if (!model.trim() || !config?.canSetModel) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await window.api.agent.setModelConfig({
        agentId: agent.id,
        model: model.trim(),
        ...(agent.id === "opencode"
          ? { secondaryModel: secondaryModel.trim() || null }
          : {}),
      });
      setConfig(next);
      setModel(next.model || "");
      setSecondaryModel(next.secondaryModel || "");
      setSaved(true);
    } catch {
      setError(t("agents.modelSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        {t("agents.loadingModelConfig")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/70 bg-blue-500/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/12 text-blue-600 dark:text-blue-300">
              <CpuIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("agents.nativeModelConfig")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("agents.nativeModelConfigDesc")}
              </p>
            </div>
          </div>
        </div>
        <dl className="px-5">
          <DetailRow
            label={t("agents.provider")}
            value={config?.provider || t("agents.platformDefault")}
          />
          <DetailRow
            label={t("agents.endpoint")}
            value={config?.endpoint || t("agents.platformDefault")}
          />
          <DetailRow
            label={t("agents.credentials")}
            value={t(
              `agents.credentialStatus.${config?.credentialStatus || "unknown"}`,
            )}
          />
          <DetailRow
            label={t("agents.configSource")}
            value={config?.sourceRelativePath || t("agents.notAvailable")}
          />
        </dl>
      </section>

      <section className="rounded-md border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("agents.modelSelection")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("agents.modelSelectionDesc")}
            </p>
          </div>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="h-4 w-4" />
              {t("agents.modelSaved")}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-foreground">
              {t("agents.defaultModel")}
            </span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              list={`agent-models-${agent.id}`}
              disabled={!config?.canSetModel || isSaving}
              className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              placeholder={t("agents.modelPlaceholder")}
            />
            <datalist id={`agent-models-${agent.id}`}>
              {config?.availableModels.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          {agent.id === "opencode" ? (
            <label className="block">
              <span className="text-xs font-semibold text-foreground">
                {t("agents.secondaryModel")}
              </span>
              <input
                value={secondaryModel}
                onChange={(event) => setSecondaryModel(event.target.value)}
                disabled={!config?.canSetModel || isSaving}
                className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                placeholder={t("agents.optionalModelPlaceholder")}
              />
            </label>
          ) : null}
        </div>

        {config?.formattingMayChange ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            {t("agents.tomlFormattingWarning")}
          </div>
        ) : null}
        {config?.status === "invalid" ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-xs text-destructive">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            {t("agents.invalidModelConfig")}
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/60 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
            {t("agents.secretsStayPrivate")}
          </span>
          <button
            type="button"
            onClick={() => void saveModel()}
            disabled={!config?.canSetModel || !model.trim() || isSaving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon className="h-4 w-4" />
            )}
            {t("agents.saveModel")}
          </button>
        </div>
      </section>
    </div>
  );
}
