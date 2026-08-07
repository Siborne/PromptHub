import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeftIcon,
  CopyIcon,
  DownloadIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  SquareTerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentConversationHandoffPreview,
  AgentConversationMetadata,
  AgentSessionMetadata,
  ManagedAgentSummary,
  SkillProject,
} from "@prompthub/shared/types";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import { PlatformIcon } from "../ui/PlatformIcon";
import { Select, type SelectOption } from "../ui/Select";
import { useToast } from "../ui/Toast";
import { copyTextToClipboard } from "../../utils/clipboard";

const DIRECT_HANDOFF_AGENT_IDS = new Set(["claude", "codex"]);

interface AgentConversationActionsProps {
  agent: ManagedAgentSummary;
  agents: ManagedAgentSummary[];
  projects: SkillProject[];
  session: AgentSessionMetadata;
  metadata: AgentConversationMetadata | null;
  onMetadataChange(metadata: AgentConversationMetadata): void;
  onError(message: string | null): void;
}

export function AgentConversationActions({
  agent,
  agents,
  projects,
  session,
  metadata,
  onMetadataChange,
  onError,
}: AgentConversationActionsProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const targets = useMemo(
    () =>
      agents.filter(
        (candidate) => candidate.id !== agent.id && candidate.isDetected,
      ),
    [agent.id, agents],
  );
  const inferredProject = useMemo(
    () =>
      projects.find(
        (project) =>
          project.id === metadata?.projectId ||
          project.rootPath === metadata?.projectPath ||
          project.rootPath === session.projectPath,
      ),
    [metadata?.projectId, metadata?.projectPath, projects, session.projectPath],
  );
  const [targetAgentId, setTargetAgentId] = useState(targets[0]?.id || "");
  const [projectId, setProjectId] = useState(inferredProject?.id || "");
  const [preview, setPreview] =
    useState<AgentConversationHandoffPreview | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChoosingHandoff, setIsChoosingHandoff] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const targetOptions = useMemo(
    () =>
      targets.map((candidate) => ({
        value: candidate.id,
        labelText: candidate.name,
        label: (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border/70 bg-background shadow-sm">
              <PlatformIcon
                platformId={candidate.displayIconId || candidate.id}
                size={18}
              />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {candidate.name}
            </span>
            <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
              {DIRECT_HANDOFF_AGENT_IDS.has(candidate.id)
                ? t("agents.handoffDirect", "Direct handoff")
                : candidate.launchable
                  ? t("agents.handoffOpenAndCopy", "Open + context")
                  : t("agents.handoffCopyOnly", "Copy context")}
            </span>
          </span>
        ),
      })),
    [t, targets],
  );
  const projectOptions = useMemo(
    () => [
      {
        value: "",
        labelText: t(
          "agents.currentSessionProject",
          "Current session directory",
        ),
        label: (
          <OptionLabel
            icon={<FolderIcon className="h-3.5 w-3.5" />}
            text={t(
              "agents.currentSessionProject",
              "Current session directory",
            )}
          />
        ),
      },
      ...projects.map((candidate) => ({
        value: candidate.id,
        labelText: candidate.name,
        label: (
          <OptionLabel
            icon={<FolderIcon className="h-3.5 w-3.5" />}
            text={candidate.name}
          />
        ),
      })),
    ],
    [projects, t],
  );

  useEffect(() => {
    setTargetAgentId(targets[0]?.id || "");
  }, [session.id, targets]);

  useEffect(() => {
    setProjectId(inferredProject?.id || "");
  }, [inferredProject?.id, session.id]);

  const target = targets.find((candidate) => candidate.id === targetAgentId);
  const project = projects.find((candidate) => candidate.id === projectId);
  const projectPath =
    project?.rootPath || metadata?.projectPath || session.projectPath || "";

  const run = async (operation: () => Promise<void>) => {
    setIsWorking(true);
    onError(null);
    try {
      await operation();
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "";
      onError(
        /HANDOFF_PREVIEW_(?:EXPIRED|STALE)/.test(errorCode)
          ? t(
              "agents.handoffPreviewExpired",
              "The handoff preview expired or changed. Generate a new preview and try again.",
            )
          : t("agents.conversationActionFailed", "Conversation action failed."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const requestPreview = () =>
    run(async () => {
      if (!target || !projectPath) {
        onError(
          t(
            "agents.continuationProjectRequired",
            "Choose a project before continuing this conversation.",
          ),
        );
        return;
      }
      const next = await window.api.agent.previewConversationHandoff({
        sourceAgentId: agent.id,
        sourceSessionId: session.id,
        targetAgentId: target.id,
        projectId: project?.id || metadata?.projectId || null,
        projectPath,
      });
      setIsChoosingHandoff(false);
      setPreview(next);
    });

  const confirmHandoff = () =>
    preview &&
    run(async () => {
      const result = await window.api.agent.continueConversationInAgent({
        ...preview,
        confirmedPayloadDigest: preview.payloadDigest,
      });
      if (result.errorCode) {
        onError(
          result.errorCode === "AGENT_CONVERSATION_CONTEXT_COPY_FAILED"
            ? t(
                "agents.handoffCopyFailed",
                "The handoff context could not be copied.",
              )
            : t(
                "agents.handoffLaunchFailedAfterCopy",
                "The target Agent could not be opened. The handoff context is still copied for manual continuation.",
              ),
        );
      } else if (preview.transport === "launch") {
        showToast(
          t("agents.handoffOpened", "Copied context and opened {{agent}}.", {
            agent: target?.name || preview.targetAgentId,
          }),
          "success",
        );
      } else {
        showToast(
          t(
            "agents.handoffStarted",
            "Started a new conversation in {{agent}}.",
            {
              agent: target?.name || preview.targetAgentId,
            },
          ),
          "success",
        );
      }
      setPreview(null);
    });

  const exportConversation = (format: "markdown" | "json") =>
    run(async () => {
      const result = await window.api.agent.exportConversation({
        agentId: agent.id,
        sessionId: session.id,
        format,
      });
      if (!result.canceled) {
        showToast(
          t("agents.conversationExported", "Conversation exported."),
          "success",
        );
      }
    });

  return (
    <>
      <div
        data-testid="conversation-continuation-toolbar"
        className="flex min-h-9 items-center gap-2"
      >
        <div
          data-testid="conversation-primary-actions"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <PrimaryActionButton
            label={t("agents.continueInCurrentAgent", "Continue in {{agent}}", {
              agent: agent.name,
            })}
            icon={<SquareTerminalIcon className="h-4 w-4" />}
            primary
            disabled={isWorking || !session.resume}
            onClick={() =>
              void run(async () => {
                await window.api.agent.resumeConversation({
                  agentId: agent.id,
                  sessionId: session.id,
                });
                showToast(
                  t("agents.resumeStarted", "Opened {{agent}} in Terminal.", {
                    agent: agent.name,
                  }),
                  "success",
                );
              })
            }
          />
          <PrimaryActionButton
            label={t("agents.handoffConversation", "Continue elsewhere")}
            icon={<ArrowRightLeftIcon className="h-4 w-4" />}
            disabled={isWorking || targets.length === 0}
            onClick={() => setIsChoosingHandoff(true)}
          />
        </div>
        <div className="relative">
          <IconActionButton
            label={t("agents.exportConversation", "Export conversation")}
            icon={<DownloadIcon className="h-4 w-4" />}
            expanded={isExportOpen}
            onClick={() => {
              setIsMoreOpen(false);
              setIsExportOpen((open) => !open);
            }}
          />
          {isExportOpen ? (
            <ExportActionsMenu
              onClose={() => setIsExportOpen(false)}
              onExport={(format) => void exportConversation(format)}
            />
          ) : null}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label={t(
              "agents.moreConversationActions",
              "More conversation actions",
            )}
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            title={t(
              "agents.moreConversationActions",
              "More conversation actions",
            )}
            onClick={() => {
              setIsExportOpen(false);
              setIsMoreOpen((open) => !open);
            }}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </button>
          {isMoreOpen ? (
            <ConversationActionsMenu
              deleted={Boolean(metadata?.deletedAt)}
              onClose={() => setIsMoreOpen(false)}
              onEdit={() => setIsEditing(true)}
              onRestore={() =>
                void run(async () => {
                  onMetadataChange(
                    await window.api.agent.restoreConversation({
                      agentId: agent.id,
                      sessionId: session.id,
                    }),
                  );
                })
              }
              onDelete={() =>
                void run(async () => {
                  onMetadataChange(
                    await window.api.agent.deleteConversation({
                      agentId: agent.id,
                      sessionId: session.id,
                    }),
                  );
                })
              }
            />
          ) : null}
        </div>
      </div>

      {isChoosingHandoff ? (
        <HandoffTargetDialog
          targetAgentId={targetAgentId}
          projectId={projectId}
          targetOptions={targetOptions}
          projectOptions={projectOptions}
          canContinue={Boolean(targetAgentId && projectPath)}
          isWorking={isWorking}
          onTargetChange={setTargetAgentId}
          onProjectChange={setProjectId}
          onCancel={() => setIsChoosingHandoff(false)}
          onContinue={() => void requestPreview()}
        />
      ) : null}
      {preview ? (
        <HandoffDialog
          preview={preview}
          targetName={target?.name || preview.targetAgentId}
          isWorking={isWorking}
          onCancel={() => setPreview(null)}
          onCopy={() =>
            void run(async () => {
              const copyValue =
                preview.transport === "direct" && preview.cliCommand
                  ? preview.cliCommand
                  : preview.payload;
              await copyTextToClipboard(copyValue);
              showToast(
                preview.transport === "direct"
                  ? t("agents.cliCommandCopied", "CLI command copied.")
                  : t("agents.handoffContextCopied", "Handoff context copied."),
                "success",
              );
            })
          }
          onConfirm={() => void confirmHandoff()}
        />
      ) : null}
      {isEditing ? (
        <ConversationEditDialog
          agentId={agent.id}
          metadata={metadata}
          projects={projects}
          session={session}
          onCancel={() => setIsEditing(false)}
          onSaved={(next) => {
            onMetadataChange(next);
            setIsEditing(false);
          }}
          onError={onError}
        />
      ) : null}
    </>
  );
}

function IconActionButton({
  label,
  icon,
  expanded,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  expanded: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {icon}
    </button>
  );
}

function PrimaryActionButton({
  label,
  icon,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick(): void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
          : "border border-border/80 bg-background text-foreground hover:border-primary/30 hover:bg-accent"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ConversationActionsMenu({
  deleted,
  onClose,
  onEdit,
  onRestore,
  onDelete,
}: {
  deleted: boolean;
  onClose(): void;
  onEdit(): void;
  onRestore(): void;
  onDelete(): void;
}) {
  const { t } = useTranslation();
  const run = (action: () => void) => {
    onClose();
    action();
  };
  return (
    <div
      role="menu"
      className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-border/80 bg-popover p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
    >
      <MenuAction
        label={t("agents.editConversation", "Edit details")}
        icon={<PencilIcon className="h-4 w-4" />}
        onClick={() => run(onEdit)}
      />
      <div className="my-1 h-px bg-border/70" />
      <MenuAction
        label={t(
          deleted ? "agents.restoreConversation" : "agents.deleteConversation",
          deleted ? "Restore" : "Remove from history",
        )}
        icon={
          deleted ? (
            <RotateCcwIcon className="h-4 w-4" />
          ) : (
            <Trash2Icon className="h-4 w-4" />
          )
        }
        destructive={!deleted}
        onClick={() => run(deleted ? onRestore : onDelete)}
      />
    </div>
  );
}

function ExportActionsMenu({
  onClose,
  onExport,
}: {
  onClose(): void;
  onExport(format: "markdown" | "json"): void;
}) {
  const { t } = useTranslation();
  const exportAs = (format: "markdown" | "json") => {
    onClose();
    onExport(format);
  };
  return (
    <div
      role="menu"
      className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-border/80 bg-popover p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
    >
      <MenuAction
        label={t("agents.exportMarkdown", "Export Markdown")}
        icon={<FileTextIcon className="h-4 w-4" />}
        onClick={() => exportAs("markdown")}
      />
      <MenuAction
        label={t("agents.exportJson", "Export JSON")}
        icon={<FileJsonIcon className="h-4 w-4" />}
        onClick={() => exportAs("json")}
      />
    </div>
  );
}

function MenuAction({
  label,
  icon,
  onClick,
  destructive = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick(): void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-medium transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent"
      }`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function HandoffTargetDialog({
  targetAgentId,
  projectId,
  targetOptions,
  projectOptions,
  canContinue,
  isWorking,
  onTargetChange,
  onProjectChange,
  onCancel,
  onContinue,
}: {
  targetAgentId: string;
  projectId: string;
  targetOptions: SelectOption[];
  projectOptions: SelectOption[];
  canContinue: boolean;
  isWorking: boolean;
  onTargetChange(value: string): void;
  onProjectChange(value: string): void;
  onCancel(): void;
  onContinue(): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-target-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ArrowRightLeftIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="handoff-target-title"
              className="text-base font-semibold text-foreground"
            >
              {t("agents.handoffDialogTitle", "Continue in another Agent")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t(
                "agents.handoffDialogHint",
                "Choose a target Agent and working directory, then review the context before continuing.",
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("common.close", "Close")}
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <Select
            ariaLabel={t("agents.continueWithAgent", "Continue with Agent")}
            value={targetAgentId}
            onChange={onTargetChange}
            options={targetOptions}
            triggerClassName="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <Select
            ariaLabel={t(
              "agents.continuationProject",
              "Project for continuation",
            )}
            value={projectId}
            onChange={onProjectChange}
            options={projectOptions}
            triggerClassName="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg border border-border px-4 text-xs font-semibold text-foreground hover:bg-accent"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={!canContinue || isWorking}
            onClick={onContinue}
            className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("agents.previewHandoff", "Preview handoff")}
          </button>
        </div>
      </div>
    </div>
  );
}

function HandoffDialog({
  preview,
  targetName,
  isWorking,
  onCancel,
  onCopy,
  onConfirm,
}: {
  preview: AgentConversationHandoffPreview;
  targetName: string;
  isWorking: boolean;
  onCancel(): void;
  onCopy(): void;
  onConfirm(): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-center border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("agents.reviewHandoff", "Review handoff context")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {preview.transport === "direct"
                ? t(
                    "agents.handoffDirectHint",
                    "PromptHub can start {{agent}} with this reviewed context in the selected project.",
                    { agent: targetName },
                  )
                : preview.transport === "launch"
                  ? t(
                      "agents.handoffLaunchHint",
                      "PromptHub will copy the handoff context and open {{agent}}. Paste it to continue in the selected project.",
                      { agent: targetName },
                    )
                  : t(
                      "agents.handoffCopyOnlyHint",
                      "PromptHub cannot open {{agent}} automatically, but you can copy this context and paste it into the Agent manually.",
                      { agent: targetName },
                    )}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("common.close", "Close")}
            onClick={onCancel}
            className="ml-auto rounded-md p-2 text-muted-foreground hover:bg-accent"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-background/70 p-5 font-mono text-xs leading-5 text-foreground">
          {preview.payload}
        </pre>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-border px-4 text-xs font-semibold text-foreground"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={isWorking}
            onClick={onCopy}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-4 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            <CopyIcon className="h-4 w-4" />
            {preview.transport === "direct"
              ? t("agents.copyCliCommand", "Copy CLI command")
              : t("agents.copyHandoffContext", "Copy handoff context")}
          </button>
          {preview.transport !== "unavailable" ? (
            <button
              type="button"
              disabled={isWorking}
              onClick={onConfirm}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              <SquareTerminalIcon className="h-4 w-4" />
              {preview.transport === "direct"
                ? t("agents.continueInAgent", "Continue in {{agent}}", {
                    agent: targetName,
                  })
                : t(
                    "agents.copyAndOpenAgent",
                    "Copy context and open {{agent}}",
                    { agent: targetName },
                  )}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

function ConversationEditDialog({
  agentId,
  metadata,
  projects,
  session,
  onCancel,
  onSaved,
  onError,
}: {
  agentId: string;
  metadata: AgentConversationMetadata | null;
  projects: SkillProject[];
  session: AgentSessionMetadata;
  onCancel(): void;
  onSaved(value: AgentConversationMetadata): void;
  onError(message: string): void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(metadata?.title || session.title);
  const [projectId, setProjectId] = useState(metadata?.projectId || "");
  const [tags, setTags] = useState(metadata?.tags.join(", ") || "");
  const [note, setNote] = useState(metadata?.note || "");
  const [favorite, setFavorite] = useState(metadata?.favorite || false);
  const [archived, setArchived] = useState(Boolean(metadata?.archivedAt));
  const project = projects.find((candidate) => candidate.id === projectId);

  const save = async () => {
    try {
      onSaved(
        await window.api.agent.updateConversationMetadata({
          agentId,
          sessionId: session.id,
          title,
          projectId: project?.id || null,
          projectPath: project?.rootPath || session.projectPath,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          note,
          favorite,
          archived,
        }),
      );
    } catch {
      onError(
        t(
          "agents.conversationSaveFailed",
          "Could not save conversation details.",
        ),
      );
    }
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={t("agents.editConversation", "Edit conversation")}
      size="md"
    >
      <div className="space-y-5">
        <div className="space-y-4">
          <Field label={t("agents.conversationTitle", "Title")}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none transition-all duration-base placeholder:text-muted-foreground focus:bg-background focus:ring-2 focus:ring-primary/30"
            />
          </Field>
          <Field label={t("agents.conversationProject", "Project")}>
            <Select
              ariaLabel={t("agents.conversationProject", "Project")}
              value={projectId}
              onChange={setProjectId}
              options={[
                {
                  value: "",
                  label: t("agents.unassignedProject", "Unassigned"),
                  labelText: t("agents.unassignedProject", "Unassigned"),
                },
                ...projects.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                  labelText: candidate.name,
                })),
              ]}
              triggerClassName="flex h-10 w-full items-center justify-between gap-2 rounded-xl border-0 bg-muted/50 px-4 text-left text-sm text-foreground outline-none transition-all duration-base hover:bg-muted/70 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </Field>
          <Field label={t("agents.conversationTags", "Tags (comma separated)")}>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none transition-all duration-base placeholder:text-muted-foreground focus:bg-background focus:ring-2 focus:ring-primary/30"
            />
          </Field>
          <Field label={t("agents.conversationNote", "Note")}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="min-h-[120px] w-full resize-none rounded-xl border-0 bg-muted/50 px-4 py-3 text-sm text-foreground outline-none transition-all duration-base placeholder:text-muted-foreground focus:bg-background focus:ring-2 focus:ring-primary/30"
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Checkbox
              checked={favorite}
              onChange={setFavorite}
              label={t("agents.favoriteConversation", "Favorite")}
            />
            <Checkbox
              checked={archived}
              onChange={setArchived}
              label={t("agents.archiveConversation", "Archive in PromptHub")}
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {t(
              "agents.archiveConversationHint",
              "Archiving hides this conversation from Active. The native transcript stays untouched and can be found in Archived.",
            )}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OptionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
