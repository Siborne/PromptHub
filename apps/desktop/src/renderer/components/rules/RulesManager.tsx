import { useEffect, useMemo, useState } from "react";
import type { RuleFileId } from "@prompthub/shared/types";
import {
  AlertCircleIcon,
  BookOpenIcon,
  FolderIcon,
  FolderOpenIcon,
  HistoryIcon,
  MinusIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useRulesStore } from "../../stores/rules.store";
import { useToast } from "../ui/Toast";
import { PlatformIcon } from "../ui/PlatformIcon";
import { generateTextDiff } from "../skill/detail-utils";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";
import { RuleAiRewriteDialog } from "./RuleAiRewriteDialog";
import { RuleHistoryDialog } from "./RuleHistoryDialog";
import { RuleMarkdownWorkspace } from "./RuleMarkdownWorkspace";
import { revealRuleFile } from "./rule-open-location";

export function RulesManager() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const currentFile = useRulesStore((state) => state.currentFile);
  const draftContent = useRulesStore((state) => state.draftContent);
  const isLoading = useRulesStore((state) => state.isLoading);
  const isSaving = useRulesStore((state) => state.isSaving);
  const isRewriting = useRulesStore((state) => state.isRewriting);
  const error = useRulesStore((state) => state.error);
  const hasLoadedFiles = useRulesStore((state) => state.hasLoadedFiles);
  const loadFiles = useRulesStore((state) => state.loadFiles);
  const setDraftContent = useRulesStore((state) => state.setDraftContent);
  const saveCurrentRule = useRulesStore((state) => state.saveCurrentRule);
  const resolveCurrentRuleConflict = useRulesStore(
    (state) => state.resolveCurrentRuleConflict,
  );
  const dismissConflictDialog = useRulesStore(
    (state) => state.dismissConflictDialog,
  );
  const conflictDialogRuleId = useRulesStore(
    (state) => state.conflictDialogRuleId,
  );
  const deleteRuleVersion = useRulesStore((state) => state.deleteRuleVersion);

  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ruleId: string;
    versionId: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [pendingConflictStrategy, setPendingConflictStrategy] = useState<
    "use-managed" | "use-target" | null
  >(null);
  const [conflictViewMode, setConflictViewMode] = useState<
    "diff" | "side-by-side"
  >("diff");

  useEffect(() => {
    if (!hasLoadedFiles) {
      void loadFiles();
    }
  }, [hasLoadedFiles, loadFiles]);

  useEffect(() => {
    setIsAiDialogOpen(false);
    setIsHistoryDialogOpen(false);
    setConflictViewMode("diff");
  }, [currentFile?.id]);

  // Dialog visibility is store-controlled (conflictDialogRuleId), not a pure
  // derivation of out-of-sync. Closing only clears the store flag + dismiss list.
  const syncConflictFile =
    currentFile &&
    conflictDialogRuleId === currentFile.id &&
    currentFile.syncStatus === "out-of-sync" &&
    typeof currentFile.targetContent === "string"
      ? currentFile
      : null;

  const handleDismissConflict = () => {
    if (!syncConflictFile || isResolvingConflict) {
      return;
    }
    dismissConflictDialog(syncConflictFile.id);
    setPendingConflictStrategy(null);
  };

  const conflictDiff = useMemo(() => {
    if (!syncConflictFile) return null;
    return generateTextDiff(
      syncConflictFile.content || "",
      syncConflictFile.targetContent || "",
    );
  }, [syncConflictFile]);

  const conflictDiffStats = useMemo(() => {
    if (!conflictDiff) return { added: 0, removed: 0 };
    return {
      added: conflictDiff.filter((line) => line.type === "add").length,
      removed: conflictDiff.filter((line) => line.type === "remove").length,
    };
  }, [conflictDiff]);

  const hasChanges = currentFile ? draftContent !== currentFile.content : false;
  // The version whose content matches the saved file = "current saved" version
  const currentSavedVersionId = useMemo(() => {
    if (!currentFile?.versions.length) return null;
    return (
      currentFile.versions.find((v) => v.content === currentFile.content)?.id ??
      null
    );
  }, [currentFile]);

  const diffStats = useMemo(() => {
    if (!currentFile) {
      return { added: 0, removed: 0 };
    }
    const diff = generateTextDiff(currentFile.content, draftContent);
    return {
      added: diff.filter((line) => line.type === "add").length,
      removed: diff.filter((line) => line.type === "remove").length,
    };
  }, [currentFile, draftContent]);

  const handleSave = async () => {
    try {
      await saveCurrentRule();
      showToast(t("toast.saved", "Saved successfully"), "success");
    } catch (saveError) {
      showToast(
        saveError instanceof Error
          ? saveError.message
          : t("common.saveFailed", "Save failed"),
        "error",
      );
    }
  };

  const handleOpenLocation = async () => {
    if (!currentFile?.path) {
      return;
    }

    const result = await revealRuleFile(
      currentFile.path,
      window.electron?.openPath,
    );
    if (!result.success) {
      showToast(
        result.error ||
          t("rules.openLocationFailed", "Failed to open location"),
        "error",
      );
    }
  };

  const handleResolveConflict = async (
    strategy: "use-managed" | "use-target",
  ) => {
    setIsResolvingConflict(true);
    try {
      await resolveCurrentRuleConflict(strategy);
      setPendingConflictStrategy(null);
      showToast(
        strategy === "use-managed"
          ? t(
              "rules.conflictResolvedUseManaged",
              "Kept the PromptHub version and synced it to the external file",
            )
          : t(
              "rules.conflictResolvedUseTarget",
              "Kept the external file version and synced it to PromptHub",
            ),
        "success",
      );
    } catch (resolveError) {
      showToast(
        resolveError instanceof Error
          ? resolveError.message
          : t("rules.conflictResolveFailed", "Failed to resolve rule conflict"),
        "error",
      );
    } finally {
      setIsResolvingConflict(false);
      setPendingConflictStrategy(null);
    }
  };

  return (
    <>
      <div className="flex h-full min-h-0 bg-background animate-in fade-in duration-base ease-enter">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            key={currentFile?.id ?? "rules-empty"}
            className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-bottom-1 duration-base ease-enter"
          >
            <div className="border-b border-border bg-card px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {currentFile?.platformId === "workspace" ? (
                      <FolderIcon className="h-4 w-4 text-primary" />
                    ) : currentFile ? (
                      <PlatformIcon
                        platformId={currentFile.platformId}
                        size={16}
                        className="h-4 w-4"
                      />
                    ) : (
                      <BookOpenIcon className="h-4 w-4 text-primary" />
                    )}
                    <span className="truncate">
                      {currentFile?.platformName || t("rules.title", "Rules")}
                    </span>
                  </div>
                  <h3 className="mt-1.5 truncate text-xl font-semibold text-foreground">
                    {currentFile?.name ||
                      t("rules.pathUnknown", "No file selected")}
                  </h3>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAiDialogOpen(true)}
                    disabled={!currentFile || isRewriting}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SparklesIcon
                      aria-hidden="true"
                      className="h-4 w-4 text-primary"
                    />
                    {t("rules.aiRewriteAction", "Improve with AI")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHistoryDialogOpen(true)}
                    disabled={!currentFile}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <HistoryIcon
                      aria-hidden="true"
                      className="h-4 w-4 text-primary"
                    />
                    {t("rules.versionTitle", "History")}
                    {currentFile?.versions.length ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        {currentFile.versions.length}
                      </span>
                    ) : null}
                  </button>
                  {currentFile?.path ? (
                    <button
                      type="button"
                      onClick={() => void handleOpenLocation()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={t("rules.openLocation", "Open Location")}
                      aria-label={t("rules.openLocation", "Open Location")}
                    >
                      <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!currentFile || isSaving || !hasChanges}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <SaveIcon aria-hidden="true" className="h-4 w-4" />
                    {isSaving
                      ? t("common.saving", "Saving...")
                      : t("rules.saveAndOverwrite", "Save and overwrite file")}
                  </button>
                </div>
              </div>

              {currentFile?.path ? (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span
                    className="min-w-0 truncate text-muted-foreground"
                    title={currentFile.path}
                  >
                    {currentFile.path}
                  </span>
                  <span
                    className={
                      hasChanges
                        ? "shrink-0 font-medium text-amber-600 dark:text-amber-400"
                        : "shrink-0 text-muted-foreground"
                    }
                  >
                    {hasChanges
                      ? t(
                          "rules.draftUnsavedStatus",
                          "Draft has unsaved changes",
                        )
                      : t(
                          "rules.draftSyncedStatus",
                          "Draft matches the saved file",
                        )}
                  </span>
                </div>
              ) : null}

              {/* Compact diff stats in middle header when there are changes */}
              {hasChanges ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <PlusIcon className="h-3 w-3" />
                    {diffStats.added} {t("rules.diffAdded", "Added")}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                    <MinusIcon className="h-3 w-3" />
                    {diffStats.removed} {t("rules.diffRemoved", "Removed")}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Editor */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
              {error ? (
                <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{error}</div>
                </div>
              ) : null}

              <div className="min-h-0 flex-1">
                {isLoading && !currentFile ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("common.loading", "Loading...")}
                  </div>
                ) : (
                  <div key="editor" className="h-full min-h-0 overflow-hidden">
                    <RuleMarkdownWorkspace
                      path={currentFile?.path || "RULES.md"}
                      value={draftContent}
                      editable={!isRewriting}
                      isRewriting={isRewriting}
                      onChange={setDraftContent}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <RuleAiRewriteDialog
        isOpen={isAiDialogOpen}
        onClose={() => setIsAiDialogOpen(false)}
      />
      <RuleHistoryDialog
        currentContent={draftContent}
        currentSavedVersionId={currentSavedVersionId}
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        onDelete={(versionId) => {
          if (!currentFile) return;
          setDeleteConfirm({ ruleId: currentFile.id, versionId });
        }}
        onRestore={(version) => {
          setDraftContent(version.content);
          setIsHistoryDialogOpen(false);
          showToast(
            t("rules.versionRestoreDone", "Snapshot restored to draft"),
            "success",
          );
        }}
        versions={currentFile?.versions ?? []}
      />
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          setIsDeleting(true);
          void (async () => {
            try {
              await deleteRuleVersion(
                deleteConfirm.ruleId as RuleFileId,
                deleteConfirm.versionId,
              );
              showToast(t("rules.versionDeleteDone"), "success");
            } catch {
              showToast(t("common.error"), "error");
            } finally {
              setIsDeleting(false);
              setDeleteConfirm(null);
            }
          })();
        }}
        title={t("rules.versionDeleteAction")}
        message={t("rules.versionDeleteConfirmMessage")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
        isLoading={isDeleting}
      />
      <Modal
        isOpen={Boolean(syncConflictFile)}
        onClose={handleDismissConflict}
        title={t("rules.conflictTitle", "Rule conflict")}
        subtitle={t(
          "rules.conflictMessage",
          "Choose which version to keep. The other will be overwritten.",
        )}
        size="full"
        closeOnBackdrop={!isResolvingConflict}
        closeOnEscape={!isResolvingConflict}
        headerActions={
          syncConflictFile ? (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground">
                {syncConflictFile.platformId === "workspace" ? (
                  <FolderIcon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-primary"
                  />
                ) : (
                  <PlatformIcon
                    platformId={syncConflictFile.platformId}
                    size={14}
                    className="h-3.5 w-3.5"
                  />
                )}
                {syncConflictFile.platformName}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {syncConflictFile.name}
              </span>
            </div>
          ) : null
        }
      >
        {syncConflictFile ? (
          <div className="-mx-6 -mb-6 -mt-2 flex max-h-[calc(85vh-5.5rem)] flex-col">
            <div className="shrink-0 space-y-3 px-6">
              <p
                className="truncate font-mono text-[11px] text-muted-foreground"
                title={syncConflictFile.path || undefined}
              >
                {syncConflictFile.path ||
                  t("rules.pathUnknown", "Path unavailable")}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label={t("rules.conflictViewMode", "Compare mode")}
                  className="inline-flex rounded-lg border border-border bg-background p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={conflictViewMode === "diff"}
                    onClick={() => setConflictViewMode("diff")}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      conflictViewMode === "diff"
                        ? "bg-muted text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("rules.conflictViewDiff", "Diff")}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={conflictViewMode === "side-by-side"}
                    onClick={() => setConflictViewMode("side-by-side")}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      conflictViewMode === "side-by-side"
                        ? "bg-muted text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("rules.conflictViewSideBySide", "Side by side")}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{conflictDiffStats.added}
                  </span>
                  <span className="text-destructive">
                    -{conflictDiffStats.removed}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-6 py-3">
              {conflictViewMode === "diff" && conflictDiff ? (
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                    <span>
                      {t(
                        "rules.conflictDiffLegend",
                        "− PromptHub · + External file",
                      )}
                    </span>
                    <span>
                      {conflictDiffStats.added === 0 &&
                      conflictDiffStats.removed === 0
                        ? t("rules.conflictNoDiff", "No line differences")
                        : t(
                            "rules.conflictDiffCount",
                            "{{added}} added · {{removed}} removed",
                            {
                              added: conflictDiffStats.added,
                              removed: conflictDiffStats.removed,
                            },
                          )}
                    </span>
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                    data-testid="rules-conflict-diff-scroll"
                  >
                    <div className="font-mono text-xs leading-relaxed">
                      {conflictDiff.map((line, idx) => (
                        <div
                          key={`${line.type}-${idx}-${line.oldLineNum ?? 0}-${line.newLineNum ?? 0}`}
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
                              {line.type !== "add"
                                ? (line.oldLineNum ?? "")
                                : ""}
                            </span>
                            <span className="w-10 px-2 py-0.5 text-right">
                              {line.type !== "remove"
                                ? (line.newLineNum ?? "")
                                : ""}
                            </span>
                          </div>
                          <span
                            className={`w-5 shrink-0 py-0.5 text-center font-bold select-none ${
                              line.type === "add"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : line.type === "remove"
                                  ? "text-destructive"
                                  : "text-muted-foreground/30"
                            }`}
                          >
                            {line.type === "add"
                              ? "+"
                              : line.type === "remove"
                                ? "-"
                                : " "}
                          </span>
                          <span
                            className={`min-w-0 flex-1 whitespace-pre-wrap break-all py-0.5 pr-3 ${
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
              ) : (
                <div className="grid h-full gap-3 overflow-hidden md:grid-cols-2">
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
                    <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-muted/20 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        {t("rules.conflictPromptHubVersion", "PromptHub")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {(syncConflictFile.content || "").split("\n").length}{" "}
                        {t("rules.conflictLines", "lines")}
                      </span>
                    </div>
                    <pre
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-muted-foreground"
                      data-testid="rules-conflict-managed-scroll"
                    >
                      {syncConflictFile.content ||
                        t("rules.emptyHint", "Rule content will appear here.")}
                    </pre>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
                    <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-muted/20 px-3 py-2">
                      <span className="text-xs font-medium text-foreground">
                        {t("rules.conflictExternalVersion", "External file")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {
                          (syncConflictFile.targetContent || "").split("\n")
                            .length
                        }{" "}
                        {t("rules.conflictLines", "lines")}
                      </span>
                    </div>
                    <pre
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-muted-foreground"
                      data-testid="rules-conflict-external-scroll"
                    >
                      {syncConflictFile.targetContent ||
                        t("rules.emptyHint", "Rule content will appear here.")}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={isResolvingConflict}
                onClick={handleDismissConflict}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isResolvingConflict}
                onClick={() => setPendingConflictStrategy("use-managed")}
              >
                {t("rules.conflictUseManaged", "Keep PromptHub")}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={isResolvingConflict}
                onClick={() => setPendingConflictStrategy("use-target")}
              >
                {isResolvingConflict
                  ? t("common.saving", "Saving...")
                  : t("rules.conflictUseTarget", "Keep external")}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <ConfirmDialog
        isOpen={pendingConflictStrategy !== null}
        onClose={() => setPendingConflictStrategy(null)}
        onConfirm={() => {
          if (!pendingConflictStrategy) return;
          void handleResolveConflict(pendingConflictStrategy);
        }}
        title={
          pendingConflictStrategy === "use-managed"
            ? t(
                "rules.conflictConfirmUseManagedTitle",
                "Keep PromptHub version?",
              )
            : t("rules.conflictConfirmUseTargetTitle", "Keep external version?")
        }
        message={
          pendingConflictStrategy === "use-managed"
            ? t(
                "rules.conflictConfirmUseManagedMessage",
                "Overwrite the external file with the PromptHub copy for {{platformName}}.",
                {
                  platformName:
                    syncConflictFile?.platformName ??
                    currentFile?.platformName ??
                    "",
                },
              )
            : t(
                "rules.conflictConfirmUseTargetMessage",
                "Overwrite the PromptHub copy with the external file for {{platformName}}.",
                {
                  platformName:
                    syncConflictFile?.platformName ??
                    currentFile?.platformName ??
                    "",
                },
              )
        }
        confirmText={
          pendingConflictStrategy === "use-managed"
            ? t("rules.conflictConfirmUseManagedAction", "Overwrite external")
            : t("rules.conflictConfirmUseTargetAction", "Overwrite PromptHub")
        }
        cancelText={t("common.cancel")}
        isLoading={isResolvingConflict}
      />
    </>
  );
}
