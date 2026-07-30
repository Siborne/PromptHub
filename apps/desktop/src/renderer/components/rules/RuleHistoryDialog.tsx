import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CirclePlusIcon,
  GitCompareArrowsIcon,
  HistoryIcon,
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { RuleVersionSnapshot } from "@prompthub/shared/types";
import { generateTextDiff } from "../skill/detail-utils";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const VISIBLE_SNAPSHOTS_LIMIT = 5;

interface RuleHistoryDialogProps {
  currentContent: string;
  currentSavedVersionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (versionId: string) => void;
  onRestore: (version: RuleVersionSnapshot) => void;
  versions: RuleVersionSnapshot[];
}

function getVersionPreview(version: RuleVersionSnapshot): string {
  return (
    version.content
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function getVersionSourceLabel(
  version: RuleVersionSnapshot,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (version.source === "manual-save") {
    return t("rules.versionSourceManualSave", "Saved");
  }
  if (version.source === "ai-rewrite") {
    return t("rules.versionSourceAiRewrite", "AI Draft");
  }
  return t("rules.versionSourceCreate", "Created");
}

function VersionSourceBadge({ version }: { version: RuleVersionSnapshot }) {
  const { t } = useTranslation();
  const SourceIcon =
    version.source === "manual-save"
      ? SaveIcon
      : version.source === "ai-rewrite"
        ? SparklesIcon
        : CirclePlusIcon;

  return (
    <span
      data-testid="rule-version-source"
      className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      <SourceIcon aria-hidden="true" className="h-3 w-3" />
      {getVersionSourceLabel(version, t)}
    </span>
  );
}

function VersionRow({
  currentSavedVersionId,
  isSelected,
  onDelete,
  onSelect,
  version,
}: {
  currentSavedVersionId: string | null;
  isSelected: boolean;
  onDelete: () => void;
  onSelect: () => void;
  version: RuleVersionSnapshot;
}) {
  const { t } = useTranslation();
  const isCurrent = version.id === currentSavedVersionId;

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg border p-2 transition-colors ${
        isSelected
          ? "border-primary/40 bg-primary/8"
          : "border-border bg-background hover:border-primary/25 hover:bg-accent/30"
      }`}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className="min-w-0 flex-1 px-1 py-1 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            {new Date(version.savedAt).toLocaleString()}
          </span>
          {isCurrent ? (
            <span
              data-testid="rule-version-current"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2Icon aria-hidden="true" className="h-3 w-3" />
              {t("rules.versionCurrentLabel", "Current")}
            </span>
          ) : null}
          <VersionSourceBadge version={version} />
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {getVersionPreview(version) ||
            t("rules.emptyHint", "Rule content will appear here.")}
        </span>
      </button>
      {!isCurrent ? (
        <button
          type="button"
          aria-label={t("rules.versionDeleteAction", "Delete snapshot")}
          onClick={onDelete}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2Icon aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function HistoryToggle({
  hiddenCount,
  showAll,
  onToggle,
}: {
  hiddenCount: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      aria-expanded={showAll}
      onClick={onToggle}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
    >
      {showAll ? (
        <>
          <ChevronUpIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {t("rules.versionShowLess", "Show less")}
        </>
      ) : (
        <>
          <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {t("rules.versionShowMore", "Show {{count}} more", {
            count: hiddenCount,
          })}
        </>
      )}
    </button>
  );
}

function EmptyHistory() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-2 text-center">
      <HistoryIcon
        aria-hidden="true"
        className="h-7 w-7 text-muted-foreground/50"
      />
      <p className="text-sm text-muted-foreground">
        {t("rules.versionEmpty", "No snapshots yet.")}
      </p>
    </div>
  );
}

function SnapshotDiff({
  currentContent,
  version,
}: {
  currentContent: string;
  version: RuleVersionSnapshot;
}) {
  const { t } = useTranslation();
  const lines = useMemo(
    () => generateTextDiff(version.content, currentContent),
    [currentContent, version.content],
  );
  const stats = useMemo(
    () => ({
      added: lines.filter((line) => line.type === "add").length,
      removed: lines.filter((line) => line.type === "remove").length,
    }),
    [lines],
  );
  const hasDifferences = stats.added > 0 || stats.removed > 0;

  return (
    <div
      data-testid="rule-history-diff"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <GitCompareArrowsIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-primary"
          />
          <span className="font-medium text-foreground">
            {t("rules.diffSnapshotHeader", "Snapshot vs Current Draft")}
          </span>
          <span className="truncate text-muted-foreground">
            {new Date(version.savedAt).toLocaleString()}
          </span>
        </div>
        {hasDifferences ? (
          <span className="flex items-center gap-3">
            <span className="text-emerald-600 dark:text-emerald-400">
              +{stats.added}
            </span>
            <span className="text-destructive">-{stats.removed}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t("rules.conflictNoDiff", "No line differences")}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="min-w-max font-mono text-xs leading-relaxed">
          {lines.map((line, index) => (
            <div
              key={`${line.type}-${index}-${line.oldLineNum ?? 0}-${line.newLineNum ?? 0}`}
              className={`flex items-start ${
                line.type === "add"
                  ? "bg-emerald-500/10"
                  : line.type === "remove"
                    ? "bg-destructive/10"
                    : "hover:bg-muted/30"
              }`}
            >
              <div className="flex shrink-0 select-none border-r border-border/40 text-muted-foreground/50">
                <span className="w-10 px-2 py-0.5 text-right">
                  {line.type !== "add" ? line.oldLineNum : ""}
                </span>
                <span className="w-10 px-2 py-0.5 text-right">
                  {line.type !== "remove" ? line.newLineNum : ""}
                </span>
              </div>
              <span
                className={`w-6 shrink-0 py-0.5 text-center font-bold select-none ${
                  line.type === "add"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : line.type === "remove"
                      ? "text-destructive"
                      : "text-muted-foreground/30"
                }`}
              >
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </span>
              <span
                className={`min-w-0 flex-1 whitespace-pre pr-4 ${
                  line.type === "add"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : line.type === "remove"
                      ? "text-destructive"
                      : "text-foreground/85"
                }`}
              >
                {line.content || " "}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RuleHistoryDialog({
  currentContent,
  currentSavedVersionId,
  isOpen,
  onClose,
  onDelete,
  onRestore,
  versions,
}: RuleHistoryDialogProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ?? null;
  const visibleVersions = showAll
    ? versions
    : versions.slice(0, VISIBLE_SNAPSHOTS_LIMIT);

  useEffect(() => {
    if (!isOpen) {
      setShowAll(false);
      setSelectedVersionId(null);
      return;
    }

    setSelectedVersionId(
      versions.find((version) => version.id !== currentSavedVersionId)?.id ??
        versions[0]?.id ??
        null,
    );
  }, [currentSavedVersionId, isOpen, versions]);

  const handleRestore = (version: RuleVersionSnapshot) => {
    onRestore(version);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("rules.versionTitle", "History")}
      subtitle={t(
        "rules.versionHint",
        "Select a snapshot to compare it with the current draft before restoring.",
      )}
      size="2xl"
    >
      {!versions.length ? (
        <EmptyHistory />
      ) : (
        <div className="-m-6 flex h-[min(66vh,680px)] min-h-[400px] flex-col overflow-hidden md:flex-row">
          <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-border bg-card md:w-[280px] md:border-r md:border-b-0">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {visibleVersions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  currentSavedVersionId={currentSavedVersionId}
                  isSelected={version.id === selectedVersionId}
                  onDelete={() => onDelete(version.id)}
                  onSelect={() => setSelectedVersionId(version.id)}
                />
              ))}
              {versions.length > VISIBLE_SNAPSHOTS_LIMIT ? (
                <HistoryToggle
                  hiddenCount={versions.length - VISIBLE_SNAPSHOTS_LIMIT}
                  showAll={showAll}
                  onToggle={() => setShowAll((value) => !value)}
                />
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            {selectedVersion ? (
              <>
                <div className="min-h-0 flex-1">
                  <SnapshotDiff
                    currentContent={currentContent}
                    version={selectedVersion}
                  />
                </div>
                <div className="flex shrink-0 justify-end border-t border-border bg-card px-4 py-3">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleRestore(selectedVersion)}
                  >
                    <RotateCcwIcon aria-hidden="true" className="h-4 w-4" />
                    {t("rules.versionRestoreToDraft", "Restore to Draft")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                <GitCompareArrowsIcon
                  aria-hidden="true"
                  className="h-8 w-8 opacity-40"
                />
                <p className="text-sm">
                  {t(
                    "rules.versionSelectToCompare",
                    "Select a snapshot to compare with the current draft.",
                  )}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
