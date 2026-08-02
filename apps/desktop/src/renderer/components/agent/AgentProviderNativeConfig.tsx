import {
  CheckCircle2Icon,
  FileInputIcon,
  KeyRoundIcon,
  Loader2Icon,
  RotateCcwIcon,
  RouteIcon,
  ShieldQuestionIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AgentProviderNativeConfigSummary } from "@prompthub/shared/types";
import { Button } from "../ui";

function classificationClass(
  classification: AgentProviderNativeConfigSummary["classification"],
): string {
  if (classification === "official") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (classification === "custom") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

function NativeDetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function AgentProviderNativeListItem({
  summary,
  selected,
  onSelect,
}: {
  summary: AgentProviderNativeConfigSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`block w-full overflow-hidden border-b border-l-2 border-border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-l-primary bg-accent"
          : "border-l-transparent hover:bg-accent/60"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {t("agents.providerProfiles.currentNative.title")}
        </span>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${classificationClass(summary.classification)}`}
        >
          {t(
            `agents.providerProfiles.currentNative.classification.${summary.classification}`,
          )}
        </span>
      </span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {summary.model ?? summary.name}
      </span>
    </button>
  );
}

export function AgentProviderNativeDetail({
  summary,
  busyAction,
  onImport,
  onRestoreOfficial,
}: {
  summary: AgentProviderNativeConfigSummary;
  busyAction: string | null;
  onImport: () => void;
  onRestoreOfficial: () => void;
}) {
  const { t } = useTranslation();
  const busy = busyAction !== null;
  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
            {summary.classification === "official" ? (
              <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
            ) : summary.classification === "custom" ? (
              <RouteIcon className="h-4 w-4 text-primary" />
            ) : (
              <ShieldQuestionIcon className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.currentNative.title")}
              </h2>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${classificationClass(summary.classification)}`}
              >
                {t(
                  `agents.providerProfiles.currentNative.classification.${summary.classification}`,
                )}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {summary.name}
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onImport}
            disabled={busy}
          >
            {busyAction === "import" ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileInputIcon className="h-3.5 w-3.5" />
            )}
            {t("agents.providerProfiles.currentNative.save")}
          </Button>
          {summary.officialRestoreAvailable ? (
            <Button size="sm" onClick={onRestoreOfficial} disabled={busy}>
              {busyAction === "restore-official" ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcwIcon className="h-3.5 w-3.5" />
              )}
              {t("agents.providerProfiles.currentNative.restoreOfficial")}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            {t("agents.providerProfiles.currentNative.details")}
          </h3>
          <dl className="mt-2">
            <NativeDetailRow
              label={t("agents.providerProfiles.currentNative.provider")}
            >
              {summary.providerKind}
            </NativeDetailRow>
            <NativeDetailRow
              label={t("agents.providerProfiles.currentNative.protocol")}
            >
              {summary.protocol}
            </NativeDetailRow>
            <NativeDetailRow
              label={t("agents.providerProfiles.currentNative.endpoint")}
            >
              {summary.endpoint ??
                t("agents.providerProfiles.currentNative.noEndpoint")}
            </NativeDetailRow>
            <NativeDetailRow
              label={t("agents.providerProfiles.currentNative.model")}
            >
              {summary.model ??
                t("agents.providerProfiles.currentNative.noModel")}
            </NativeDetailRow>
            <NativeDetailRow
              label={t("agents.providerProfiles.currentNative.credential")}
            >
              <span className="inline-flex items-center gap-1.5">
                <KeyRoundIcon className="h-4 w-4 text-muted-foreground" />
                {t(
                  `agents.providerProfiles.currentNative.credentialStatus.${summary.credential}`,
                )}
              </span>
            </NativeDetailRow>
          </dl>
        </section>
        <p className="mt-5 max-w-2xl border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">
          {t("agents.providerProfiles.currentNative.securityHint")}
        </p>
      </div>
    </>
  );
}
