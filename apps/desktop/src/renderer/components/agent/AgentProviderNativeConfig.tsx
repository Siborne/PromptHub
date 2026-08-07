import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AgentProviderNativeConfigSummary } from "@prompthub/shared/types";
import { Button } from "../ui";

function classificationClass(
  classification: AgentProviderNativeConfigSummary["classification"],
): string {
  return classification === "official"
    ? "text-emerald-600 dark:text-emerald-400"
    : classification === "custom"
      ? "text-primary"
      : "text-muted-foreground";
}

function DetailRow({
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
      data-testid="provider-native-card"
      onClick={onSelect}
      aria-current={selected}
      className={`m-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
        selected
          ? "border-primary/30 bg-card shadow-sm ring-1 ring-primary/10"
          : "border-border/70 bg-card hover:border-primary/20 hover:shadow-sm"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <CheckCircle2Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {t("agents.providerProfiles.currentNative.title")}
          </span>
          <span
            className={`shrink-0 text-xs font-medium ${classificationClass(summary.classification)}`}
          >
            {t(
              `agents.providerProfiles.currentNative.classification.${summary.classification}`,
            )}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {summary.model ?? summary.name}
        </span>
      </span>
      <ArrowUpRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/50" />
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
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/[0.12] px-5 py-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-center gap-2 px-4 py-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.currentNative.title")}
              </h2>
              <span
                className={`shrink-0 text-xs font-medium ${classificationClass(summary.classification)}`}
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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onImport} disabled={busy}>
              {busyAction === "import" ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PencilIcon className="h-3.5 w-3.5" />
              )}
              {t("agents.providerProfiles.currentNative.manage")}
            </Button>
            {summary.officialRestoreAvailable ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRestoreOfficial}
                disabled={busy}
              >
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

        <div className="border-t border-border/70 px-4 py-1">
          <dl>
            <DetailRow
              label={t("agents.providerProfiles.currentNative.provider")}
            >
              {summary.providerKind}
            </DetailRow>
            <DetailRow
              label={t("agents.providerProfiles.currentNative.protocol")}
            >
              {summary.protocol}
            </DetailRow>
            <DetailRow
              label={t("agents.providerProfiles.currentNative.endpoint")}
            >
              {summary.endpoint ??
                t("agents.providerProfiles.currentNative.noEndpoint")}
            </DetailRow>
            <DetailRow label={t("agents.providerProfiles.currentNative.model")}>
              {summary.model ??
                t("agents.providerProfiles.currentNative.noModel")}
            </DetailRow>
            <DetailRow
              label={t("agents.providerProfiles.currentNative.credential")}
            >
              {t(
                `agents.providerProfiles.currentNative.credentialStatus.${summary.credential}`,
              )}
            </DetailRow>
          </dl>
        </div>
      </section>
    </div>
  );
}
