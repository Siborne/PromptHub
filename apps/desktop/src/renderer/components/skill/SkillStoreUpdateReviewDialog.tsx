import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FilePlus2Icon,
  FileTextIcon,
  Loader2Icon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react";
import type { TFunction } from "i18next";
import type {
  CloudStoreDiff,
  SkillSafetyReport,
} from "@prompthub/shared/types";
import type { RegistrySkillUpdateCheck } from "../../services/skill-store-update";
import { generateTextDiff } from "./detail-utils";

interface SkillStoreUpdateReviewDialogProps {
  check: RegistrySkillUpdateCheck | null;
  cloudDiff?: CloudStoreDiff | null;
  safetyReport?: SkillSafetyReport | null;
  overwriteLocalChanges: boolean;
  isLoading: boolean;
  t: TFunction;
  onClose: () => void;
  onConfirm: () => void;
}

const MAX_SOURCE_LINES = 600;
const MAX_RENDERED_DIFF_LINES = 260;

function getComparableContent(check: RegistrySkillUpdateCheck): {
  local: string;
  remote: string;
  truncated: boolean;
} {
  const local = check.installedSkill?.content ?? check.installedSkill?.instructions ?? "";
  const remote = check.remoteContent ?? "";
  const localLines = local.split("\n");
  const remoteLines = remote.split("\n");
  const truncated =
    localLines.length > MAX_SOURCE_LINES || remoteLines.length > MAX_SOURCE_LINES;
  return {
    local: localLines.slice(0, MAX_SOURCE_LINES).join("\n"),
    remote: remoteLines.slice(0, MAX_SOURCE_LINES).join("\n"),
    truncated,
  };
}

function getChangedFileNames(diff: CloudStoreDiff | null | undefined): string[] {
  if (!diff) return [];
  return [...new Set([...diff.added, ...diff.modified, ...diff.removed])];
}

export function SkillStoreUpdateReviewDialog({
  check,
  cloudDiff,
  safetyReport,
  overwriteLocalChanges,
  isLoading,
  t,
  onClose,
  onConfirm,
}: SkillStoreUpdateReviewDialogProps) {
  const comparableContent = useMemo(
    () => (check ? getComparableContent(check) : null),
    [check],
  );
  const textDiff = useMemo(() => {
    if (!comparableContent) return [];
    return generateTextDiff(comparableContent.local, comparableContent.remote);
  }, [comparableContent]);
  const changedLines = textDiff.filter((line) => line.type !== "unchanged");
  const renderedDiff = textDiff.slice(0, MAX_RENDERED_DIFF_LINES);
  const changedFiles = getChangedFileNames(cloudDiff);
  const isBlocked = safetyReport?.level === "blocked";

  if (!check) return null;

  const skillName =
    check.registrySkill?.name || check.installedSkill?.name || "Skill";
  const skillVersion = check.registrySkill?.version || "latest";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        role="presentation"
        aria-hidden="true"
        onClick={isLoading ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-store-update-review-title"
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border app-wallpaper-panel-strong shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <h2
              id="skill-store-update-review-title"
              className="text-base font-semibold text-foreground"
            >
              {t("skill.updateReviewTitle", "Review Skill update")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {skillName} · {skillVersion}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label={t("common.close", "Close")}
            title={t("common.close", "Close")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <XIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <FileTextIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("skill.updateReviewContent", "SKILL.md")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("skill.updateReviewChangedLines", "{{count}} changed lines", {
                  count: changedLines.length,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                {safetyReport?.level === "safe" ? (
                  <CheckCircle2Icon className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                ) : (
                  <ShieldAlertIcon className="h-4 w-4 text-amber-600" aria-hidden="true" />
                )}
                {t("skill.updateReviewSafety", "Safety scan")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {safetyReport
                  ? safetyReport.level
                  : t("skill.updateReviewSafetyPending", "Not run")}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <FilePlus2Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {t("skill.updateReviewPackage", "Package")}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {cloudDiff
                  ? t("skill.updateReviewChangedFiles", "{{count}} changed files", {
                      count: changedFiles.length,
                    })
                  : t("skill.updateReviewSourceContent", "Source content changed")}
              </p>
            </div>
          </div>

          {changedFiles.length > 0 && (
            <section className="rounded-xl border border-border p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("skill.updateReviewFiles", "Changed files")}
              </h3>
              <ul className="mt-2 grid gap-1 text-xs text-foreground sm:grid-cols-2">
                {changedFiles.slice(0, 40).map((file) => (
                  <li key={file} className="truncate font-mono">
                    {file}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("skill.updateReviewDiff", "Latest diff")}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                +{textDiff.filter((line) => line.type === "add").length} / -
                {textDiff.filter((line) => line.type === "remove").length}
              </span>
            </div>
            <pre className="max-h-72 overflow-auto bg-background p-3 text-[11px] leading-5">
              {renderedDiff.map((line, index) => (
                <div
                  key={`${line.type}-${index}`}
                  className={
                    line.type === "add"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : line.type === "remove"
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : "text-muted-foreground"
                  }
                >
                  <span className="mr-2 inline-block w-3 select-none text-center opacity-70">
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  </span>
                  {line.content || " "}
                </div>
              ))}
              {renderedDiff.length === 0 && (
                <span className="text-muted-foreground">
                  {t("skill.updateReviewNoTextDiff", "No SKILL.md line diff available.")}
                </span>
              )}
            </pre>
            {(renderedDiff.length < textDiff.length || comparableContent?.truncated) && (
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                {t(
                  "skill.updateReviewDiffTruncated",
                  "The preview is truncated. The complete package will be checked before it is written.",
                )}
              </p>
            )}
          </section>

          {safetyReport && (
            <section
              className={`rounded-xl border p-3 ${
                isBlocked
                  ? "border-red-500/30 bg-red-500/5"
                  : safetyReport.level === "high-risk"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-emerald-500/20 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-start gap-2">
                {isBlocked ? (
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-red-600" aria-hidden="true" />
                ) : (
                  <ShieldAlertIcon className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
                )}
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-foreground">
                    {t("skill.updateReviewSafetyResult", "Safety result")}: {safetyReport.level}
                  </p>
                  <p className="mt-1 text-muted-foreground">{safetyReport.summary}</p>
                </div>
              </div>
            </section>
          )}

          {overwriteLocalChanges && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {t(
                "skill.updateReviewOverwriteWarning",
                "This action will replace local changes after you confirm.",
              )}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || isBlocked}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <DownloadIcon className="h-4 w-4" aria-hidden="true" />
            )}
            {overwriteLocalChanges
              ? t("skill.updateReviewConfirmOverwrite", "Overwrite and update")
              : t("skill.updateReviewConfirm", "Confirm update")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
