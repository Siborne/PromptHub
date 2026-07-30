import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentCliLifecyclePlan,
  AgentCliLifecycleResult,
} from "@prompthub/shared/types";
import { Spinner } from "../ui/Spinner";

interface AgentCliUpdateReviewProps {
  plan: AgentCliLifecyclePlan | null;
  result: AgentCliLifecycleResult | null;
  isApplying: boolean;
  onApply: () => void;
  onBack: () => void;
}

export function AgentCliUpdateReview({
  plan,
  result,
  isApplying,
  onApply,
  onBack,
}: AgentCliUpdateReviewProps) {
  const { t } = useTranslation();

  if (result) {
    const successful =
      result.status === "applied" || result.status === "no-change";
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-4 text-center">
        {successful ? (
          <CheckCircle2Icon className="h-10 w-10 text-emerald-500" />
        ) : (
          <AlertTriangleIcon className="h-10 w-10 text-amber-500" />
        )}
        <div>
          <p className="font-semibold text-foreground">
            {t(
              `agents.cliDiagnostics.update.status.${result.status}`,
              result.status,
            )}
          </p>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {result.previousVersion} {"\u2192"}{" "}
            {result.currentVersion ??
              t("agents.cliDiagnostics.unknown", "Unknown")}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {t("agents.cliDiagnostics.update.back", "Back to diagnostics")}
        </button>
      </div>
    );
  }

  if (!plan) return null;
  const commandText = [plan.command.executable, ...plan.command.args].join(" ");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border-b border-border pb-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("agents.cliDiagnostics.version", "Version")}
          </p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {plan.currentVersion}
          </p>
        </div>
        <div className="border-b border-border pb-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("agents.cliDiagnostics.source", "Install source")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {t(
              `agents.cliDiagnostics.sources.${plan.installSource}`,
              plan.installSource,
            )}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          {t("agents.cliDiagnostics.update.command", "Command")}
        </p>
        <code className="mt-2 block overflow-x-auto border-y border-border bg-muted/40 px-3 py-3 text-xs text-foreground">
          {commandText}
        </code>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {t(
          "agents.cliDiagnostics.update.notice",
          "PromptHub will run this fixed command, verify the CLI, and attempt to restore the current version if verification fails.",
        )}
      </p>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isApplying}
          className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {t("common.cancel", "Cancel")}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isApplying ? (
            <Spinner size="sm" />
          ) : (
            <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
          )}
          {t("agents.cliDiagnostics.update.confirm", "Update CLI")}
        </button>
      </div>
    </div>
  );
}
