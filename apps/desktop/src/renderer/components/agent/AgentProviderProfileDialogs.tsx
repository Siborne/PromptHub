import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RotateCcwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderActivationExecutionResult,
  AgentProviderActivationPlan,
  AgentProviderComparableValue,
  AgentProviderFieldResolution,
  AgentProviderImportPreview,
} from "@prompthub/shared/types";
import { Button, Modal } from "../ui";

function displayValue(value: AgentProviderComparableValue | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value || "—";
  return JSON.stringify(value);
}

function warningLabel(warning: string, t: (key: string) => string): string {
  return warning === "native-formatting-may-change"
    ? t("agents.providerProfiles.import.formattingWarning")
    : warning;
}

export function AgentProviderImportDialog({
  preview,
  busy,
  onClose,
  onAdopt,
}: {
  preview: AgentProviderImportPreview | null;
  busy: boolean;
  onClose: () => void;
  onAdopt: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={preview !== null}
      onClose={onClose}
      title={t("agents.providerProfiles.import.title")}
      subtitle={preview?.profile.name}
      size="xl"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      {preview ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(preview.state.values).map(([field, value]) => (
              <div
                key={field}
                className="rounded-md border border-border bg-muted/20 px-3 py-2.5"
              >
                <dt className="text-xs font-semibold text-muted-foreground">
                  {field}
                </dt>
                <dd className="mt-1 break-all text-sm text-foreground">
                  {displayValue(value)}
                </dd>
              </div>
            ))}
          </dl>
          {preview.warnings.length > 0 ? (
            <div className="mt-4 space-y-2">
              {preview.warnings.map((warning) => (
                <p
                  key={warning}
                  className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs text-muted-foreground"
                >
                  <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-500" />
                  {warningLabel(warning, t)}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {t("agents.providerProfiles.import.explicitHint")}
          </p>
          <div className="mt-6 flex justify-end gap-3 border-t border-border/60 pt-4">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void onAdopt()} disabled={busy}>
              {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
              {t("agents.providerProfiles.import.create")}
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

const REVIEW_STATUSES = new Set(["backfill", "external-modified", "conflict"]);

function resultMessage(
  result: AgentProviderActivationExecutionResult,
  t: (key: string) => string,
): string {
  if (result.status === "verified") {
    return t("agents.providerProfiles.activation.verified");
  }
  if (result.status === "rolled-back" && result.rollback?.restored) {
    return t("agents.providerProfiles.activation.restored");
  }
  return t("agents.providerProfiles.activation.failed");
}

function resultClass(result: AgentProviderActivationExecutionResult): string {
  return result.status === "verified"
    ? "border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300"
    : "border-destructive/30 bg-destructive/[0.06] text-destructive";
}

export function AgentProviderActivationDialog({
  plan,
  result,
  busy,
  errorCode,
  onClose,
  onActivate,
}: {
  plan: AgentProviderActivationPlan | null;
  result: AgentProviderActivationExecutionResult | null;
  busy: boolean;
  errorCode: string | null;
  onClose: () => void;
  onActivate: (resolutions: AgentProviderFieldResolution[]) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [resolutions, setResolutions] = useState<
    Record<string, AgentProviderFieldResolution["action"]>
  >({});

  useEffect(() => setResolutions({}), [plan?.currentDigest, plan?.profileId]);

  const reviewFields = useMemo(
    () =>
      plan?.decisions
        .filter((decision) => REVIEW_STATUSES.has(decision.status))
        .map((decision) => decision.field) ?? [],
    [plan],
  );
  const allResolved = reviewFields.every((field) => resolutions[field]);
  const hasApply =
    plan?.decisions.some((decision) => decision.status === "apply") ||
    Object.values(resolutions).includes("use-profile");
  const canActivate =
    Boolean(plan) &&
    plan!.blockedReasons.length === 0 &&
    allResolved &&
    hasApply &&
    !result;

  function choose(
    field: string,
    action: AgentProviderFieldResolution["action"],
  ) {
    setResolutions((current) => ({ ...current, [field]: action }));
  }

  function submit(): void {
    const selected = Object.entries(resolutions).map(([field, action]) => ({
      field,
      action,
    }));
    void onActivate(selected);
  }

  return (
    <Modal
      isOpen={plan !== null}
      onClose={onClose}
      title={t("agents.providerProfiles.activation.title")}
      subtitle={plan?.platformId}
      size="2xl"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      {plan ? (
        <>
          {plan.blockedReasons.length > 0 ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-xs text-destructive">
              <p className="font-semibold">
                {t("agents.providerProfiles.activation.blocked")}
              </p>
              <ul className="mt-1 list-inside list-disc">
                {plan.blockedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
              <span>{t("agents.providerProfiles.activation.field")}</span>
              <span>{t("agents.providerProfiles.activation.current")}</span>
              <span>{t("agents.providerProfiles.activation.profile")}</span>
            </div>
            <ul>
              {plan.decisions.map((decision) => {
                const needsReview = REVIEW_STATUSES.has(decision.status);
                return (
                  <li
                    key={decision.field}
                    className="border-b border-border/60 px-3 py-3 last:border-0"
                  >
                    <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-foreground">
                          {decision.field}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(
                            `agents.providerProfiles.activation.status.${decision.status}`,
                          )}
                        </p>
                      </div>
                      <code className="break-all text-xs text-foreground">
                        {displayValue(decision.current)}
                      </code>
                      <code className="break-all text-xs text-foreground">
                        {displayValue(decision.desired)}
                      </code>
                    </div>
                    {needsReview ? (
                      <fieldset className="mt-3 flex flex-wrap gap-4">
                        <legend className="sr-only">
                          {t("agents.providerProfiles.activation.resolve", {
                            field: decision.field,
                          })}
                        </legend>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="radio"
                            name={`provider-resolution-${decision.field}`}
                            checked={
                              resolutions[decision.field] === "preserve-current"
                            }
                            onChange={() =>
                              choose(decision.field, "preserve-current")
                            }
                          />
                          {t(
                            "agents.providerProfiles.activation.preserveCurrent",
                          )}
                        </label>
                        <label className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="radio"
                            name={`provider-resolution-${decision.field}`}
                            checked={
                              resolutions[decision.field] === "use-profile"
                            }
                            onChange={() =>
                              choose(decision.field, "use-profile")
                            }
                          />
                          {t("agents.providerProfiles.activation.useProfile")}
                        </label>
                      </fieldset>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {t("agents.providerProfiles.activation.backupHint")}
          </p>

          {result ? (
            <div
              role="status"
              className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${resultClass(result)}`}
            >
              {result.status === "verified" ? (
                <CheckCircle2Icon className="h-4 w-4 shrink-0" />
              ) : (
                <RotateCcwIcon className="h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-semibold">{resultMessage(result, t)}</p>
                {result.errorCode ? (
                  <code className="mt-1 block text-xs">{result.errorCode}</code>
                ) : null}
              </div>
            </div>
          ) : null}

          {!result && errorCode ? (
            <p className="mt-4 text-xs text-destructive">
              {t("agents.providerProfiles.errors.operation")}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-3 border-t border-border/60 pt-4">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {result ? t("common.close") : t("common.cancel")}
            </Button>
            {!result ? (
              <Button onClick={submit} disabled={!canActivate || busy}>
                {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
                {t("agents.providerProfiles.activation.activate")}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
