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
import {
  AgentProviderDetailHeader,
  AgentProviderDetailRow,
  AgentProviderDetailSection,
  AgentProviderDetailSurface,
  providerWorkbenchListItemClass,
} from "./AgentProviderWorkbenchLayout";

function classificationClass(
  classification: AgentProviderNativeConfigSummary["classification"],
): string {
  return classification === "official"
    ? "text-emerald-600 dark:text-emerald-400"
    : classification === "custom"
      ? "text-primary"
      : "text-muted-foreground";
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
      className={providerWorkbenchListItemClass(
        selected,
        "m-1 flex w-[calc(100%-0.5rem)] items-center gap-3 px-3 py-2.5",
      )}
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
    <AgentProviderDetailSurface>
      <AgentProviderDetailSection>
        <AgentProviderDetailHeader>
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
        </AgentProviderDetailHeader>

        <div className="border-t border-border/70 px-4 py-1">
          <dl>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.currentNative.provider")}
            >
              {summary.providerKind}
            </AgentProviderDetailRow>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.currentNative.protocol")}
            >
              {summary.protocol}
            </AgentProviderDetailRow>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.currentNative.endpoint")}
            >
              {summary.endpoint ??
                t("agents.providerProfiles.currentNative.noEndpoint")}
            </AgentProviderDetailRow>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.currentNative.model")}
            >
              {summary.model ??
                t("agents.providerProfiles.currentNative.noModel")}
            </AgentProviderDetailRow>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.currentNative.credential")}
            >
              {t(
                `agents.providerProfiles.currentNative.credentialStatus.${summary.credential}`,
              )}
            </AgentProviderDetailRow>
          </dl>
        </div>
      </AgentProviderDetailSection>
    </AgentProviderDetailSurface>
  );
}
