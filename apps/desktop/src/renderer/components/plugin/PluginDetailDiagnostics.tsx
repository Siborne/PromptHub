import { useMemo } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  Loader2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  PluginInventorySummary,
  PluginPackageHealthCheck,
} from "@prompthub/shared/types/plugin";
import { PLUGIN_INVENTORY_KEYS } from "@prompthub/shared/types/plugin";
import type { SkillSafetyReport } from "@prompthub/shared/types";
import { groupSkillSafetyFindings } from "../skill/detail-utils";
import {
  getSkillSafetyFindingTitle,
  getSkillSafetyLevelLabel,
} from "../skill/safety-i18n";

export function getPackageHealthLabel(
  check: PluginPackageHealthCheck | undefined,
  isChecking: boolean,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (isChecking) {
    return t("plugin.packageCheckChecking", "Checking...");
  }
  if (!check) {
    return t("plugin.packageCheckNotChecked", "Not checked");
  }
  switch (check.status) {
    case "ok":
      return t("plugin.packageCheckOk", "Package OK");
    case "not-installed":
      return t("plugin.packageCheckNotInstalled", "Not installed");
    case "missing-package":
      return t("plugin.packageCheckMissingPackage", "Package missing");
    case "missing-manifest":
      return t("plugin.packageCheckMissingManifest", "Manifest missing");
    case "invalid":
      return t("plugin.packageCheckNeedsReview", "Needs review");
    default:
      return t("plugin.packageCheckNeedsReview", "Needs review");
  }
}

export function getPackageHealthTone(
  check: PluginPackageHealthCheck | undefined,
  isChecking: boolean,
): string {
  if (isChecking) {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  if (!check) {
    return "border-border bg-muted/40 text-muted-foreground";
  }
  if (check.status === "ok") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  }
  return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300";
}

export function PluginPackageHealthPanel({
  check,
  isChecking,
  localPackagePath,
  onRunCheck,
}: {
  check?: PluginPackageHealthCheck;
  isChecking: boolean;
  localPackagePath: string;
  onRunCheck: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const label = getPackageHealthLabel(check, isChecking, t);
  const tone = getPackageHealthTone(check, isChecking);
  const details = check?.findings ?? [];

  return (
    <section className="rounded-2xl border border-border app-wallpaper-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("plugin.packageCheckTitle", "Package Check")}
          </h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t(
              "plugin.packageCheckDescription",
              "Static check for local package files, manifest paths, and symlink boundaries.",
            )}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          {isChecking ? (
            <Loader2Icon
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : check?.status === "ok" ? (
            <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangleIcon aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {label}
        </span>
      </div>

      <button
        type="button"
        onClick={() => void onRunCheck()}
        disabled={isChecking || !localPackagePath}
        className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t("plugin.runPackageCheck", "Run package check")}
        title={t("plugin.runPackageCheck", "Run package check")}
      >
        {isChecking ? (
          <Loader2Icon
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : (
          <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {t("plugin.runPackageCheck", "Run package check")}
      </button>

      {check ? (
        <div className="mt-4 space-y-3 text-xs">
          {check.packagePath ? (
            <div>
              <div className="font-semibold text-muted-foreground">
                {t("plugin.packagePathLabel", "Package path")}
              </div>
              <div className="mt-1 break-all rounded-lg bg-muted/50 px-2.5 py-2 text-foreground/80">
                {check.packagePath}
              </div>
            </div>
          ) : null}
          {check.manifestPath ? (
            <div>
              <div className="font-semibold text-muted-foreground">
                {t("plugin.manifestPathLabel", "Manifest path")}
              </div>
              <div className="mt-1 break-all rounded-lg bg-muted/50 px-2.5 py-2 text-foreground/80">
                {check.manifestPath}
              </div>
            </div>
          ) : null}
          {details.length > 0 ? (
            <div className="space-y-2">
              <div className="font-semibold text-muted-foreground">
                {t("plugin.packageCheckFindings", "Findings")}
              </div>
              {details.map((finding, index) => (
                <div
                  key={`${finding.code}-${index}`}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-red-700 dark:text-red-200"
                >
                  <div className="font-semibold">{finding.code}</div>
                  <div className="mt-1 leading-5">{finding.message}</div>
                  {finding.path ? (
                    <div className="mt-1 break-all text-red-700/80 dark:text-red-200/80">
                      {finding.path}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-emerald-500/10 px-2.5 py-2 text-emerald-700 dark:text-emerald-200">
              {t(
                "plugin.packageCheckNoFindings",
                "No package boundary issues found.",
              )}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function getPluginSafetyTone(
  level?: SkillSafetyReport["level"],
): string {
  if (level === "safe") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (level === "warn") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (level === "high-risk" || level === "blocked") {
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300";
  }
  return "border-border bg-background text-muted-foreground";
}

export function formatPluginInventorySummary(
  inventory?: PluginInventorySummary,
): string {
  if (!inventory) {
    return "-";
  }
  const parts = PLUGIN_INVENTORY_KEYS.map((key) => ({
    key,
    count: inventory[key] ?? 0,
  }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.count} ${item.key}`);
  return parts.length > 0 ? parts.join(", ") : "0";
}

export function SourceUpdateDiffRow({
  current,
  currentLabel,
  label,
  next,
  sourceLabel,
}: {
  current: string | undefined;
  currentLabel: string;
  label: string;
  next: string | undefined;
  sourceLabel: string;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-[9rem_1fr_1fr]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
          {currentLabel}
        </div>
        <div className="break-words text-sm text-foreground">
          {current?.trim() || "-"}
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
          {sourceLabel}
        </div>
        <div className="break-words text-sm font-medium text-foreground">
          {next?.trim() || "-"}
        </div>
      </div>
    </div>
  );
}

export function PluginSafetyAssessmentPanel({
  isScanning,
  onRunSafetyAssessment,
  report,
}: {
  isScanning: boolean;
  onRunSafetyAssessment: () => void | Promise<void>;
  report?: SkillSafetyReport;
}) {
  const { t, i18n } = useTranslation();
  const groupedFindings = useMemo(
    () => groupSkillSafetyFindings(report?.findings ?? []),
    [report?.findings],
  );
  const tone = getPluginSafetyTone(report?.level);

  return (
    <section className="rounded-2xl border border-border app-wallpaper-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("plugin.safetyAssessment", "Safety Assessment")}
          </h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {t(
              "plugin.safetyAssessmentHint",
              "AI review of static Plugin metadata, source provenance, inventory, and package signals. It never executes Plugin code.",
            )}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
        >
          {isScanning ? (
            <ShieldAlertIcon
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-pulse"
            />
          ) : report?.level === "safe" ? (
            <ShieldCheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
          ) : report ? (
            <ShieldAlertIcon aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <ShieldIcon aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {isScanning
            ? t("plugin.safetyScanning", "Scanning...")
            : report
              ? getSkillSafetyLevelLabel(t, report.level)
              : t("plugin.safetyNoReport", "Not assessed")}
        </span>
      </div>

      {report ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-6 text-foreground/90">
                {report.summary}
              </p>
              {report.score !== undefined ? (
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold text-foreground">
                    {report.score}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("plugin.safetyScore", "Score")} / 100
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                {t("plugin.safetyFilesChecked", "{{count}} item(s) checked", {
                  count: report.checkedFileCount,
                })}
              </span>
              <span>
                {t("plugin.safetyScanMethod", "Method")}:{" "}
                {t("plugin.safetyScanMethodAI", "AI-assisted")}
              </span>
              <span>
                {t("plugin.safetyScanTime", "Scanned")}:{" "}
                {new Date(report.scannedAt).toLocaleString(
                  i18n.language || undefined,
                )}
              </span>
            </div>
          </div>

          {groupedFindings.length > 0 ? (
            <div className="space-y-2">
              {groupedFindings.map((finding) => (
                <div
                  key={`${finding.code}-${finding.severity}`}
                  className="rounded-xl border border-border bg-background/70 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {getSkillSafetyFindingTitle(t, finding)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        finding.severity === "high"
                          ? "bg-red-500/15 text-red-700 dark:text-red-300"
                          : finding.severity === "warn"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {finding.severity === "high"
                        ? t("skill.safetySeverityHigh", "High")
                        : finding.severity === "warn"
                          ? t("skill.safetySeverityWarn", "Warning")
                          : t("skill.safetySeverityInfo", "Info")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {finding.detail}
                  </p>
                  {finding.evidences[0] ? (
                    <code className="mt-2 block break-all rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                      {finding.evidences[0]}
                    </code>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {t("plugin.safetyNoFindings", "No issues found")}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t(
            "plugin.safetyNoReportDescription",
            "Run a safety assessment before distributing unfamiliar Plugin packages.",
          )}
        </p>
      )}

      <button
        type="button"
        onClick={() => void onRunSafetyAssessment()}
        disabled={isScanning}
        className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t("plugin.runSafetyAssessment", "Run safety assessment")}
        title={t("plugin.runSafetyAssessment", "Run safety assessment")}
      >
        {isScanning ? (
          <Loader2Icon
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin"
          />
        ) : (
          <ShieldIcon aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {isScanning
          ? t("plugin.safetyScanning", "Scanning...")
          : t("plugin.runSafetyAssessment", "Run safety assessment")}
      </button>
    </section>
  );
}
