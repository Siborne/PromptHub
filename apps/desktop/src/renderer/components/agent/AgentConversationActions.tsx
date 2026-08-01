import { useEffect, useMemo, useState } from "react";
import {
  ExternalLinkIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  PencilIcon,
  RotateCcwIcon,
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
import { PlatformIcon } from "../ui/PlatformIcon";
import { Select } from "../ui/Select";

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
  const [notice, setNotice] = useState<string | null>(null);

  const targetOptions = useMemo(
    () =>
      targets.map((candidate) => {
        const transport =
          candidate.id === "claude" || candidate.id === "codex"
            ? t("agents.handoffCliTransport", "CLI handoff")
            : t("agents.handoffCopyTransport", "Open + copy");
        return {
          value: candidate.id,
          labelText: `${candidate.name}, ${transport}`,
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
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {transport}
              </span>
            </span>
          ),
        };
      }),
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
    setNotice(null);
    onError(null);
    try {
      await operation();
    } catch {
      onError(
        t("agents.conversationActionFailed", "Conversation action failed."),
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
          t(
            "agents.handoffCopiedLaunchFailed",
            "Context copied, but the target Agent could not be opened.",
          ),
        );
      } else if (result.status === "copied") {
        setNotice(
          t(
            "agents.handoffCopied",
            "Opened {{agent}} and copied the reviewed context.",
            {
              agent: target?.name || preview.targetAgentId,
            },
          ),
        );
      } else {
        setNotice(
          t(
            "agents.handoffStarted",
            "Started a new conversation in {{agent}}.",
            {
              agent: target?.name || preview.targetAgentId,
            },
          ),
        );
      }
      setPreview(null);
    });

  return (
    <>
      <section className="mt-4 rounded-xl border border-border/70 bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:bg-card">
        <div
          data-testid="conversation-continuation-toolbar"
          className="grid grid-cols-2 items-center gap-2 xl:grid-cols-[auto_15rem_14rem_auto]"
        >
          {session.resume ? (
            <button
              type="button"
              disabled={isWorking}
              onClick={() =>
                void run(async () => {
                  await window.api.agent.resumeConversation({
                    agentId: agent.id,
                    sessionId: session.id,
                  });
                  setNotice(
                    t(
                      "agents.resumeStarted",
                      "Opened the native resume flow in {{agent}}.",
                      { agent: agent.name },
                    ),
                  );
                })
              }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              {t("agents.resumeConversation", "Resume")}
            </button>
          ) : null}
          {targets.length > 0 ? (
            <>
              <Select
                ariaLabel={t("agents.continueWithAgent", "Continue with Agent")}
                value={targetAgentId}
                onChange={setTargetAgentId}
                options={targetOptions}
                className="min-w-0"
                triggerClassName="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-2.5 text-left text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <Select
                ariaLabel={t(
                  "agents.continuationProject",
                  "Project for continuation",
                )}
                value={projectId}
                onChange={setProjectId}
                options={projectOptions}
                className="min-w-0"
                triggerClassName="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-2.5 text-left text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <button
                type="button"
                disabled={isWorking || !targetAgentId || !projectPath}
                onClick={() => void requestPreview()}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/10 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
              >
                {t("agents.previewHandoff", "Preview handoff")}
              </button>
            </>
          ) : null}
        </div>

        {notice ? (
          <p
            role="status"
            className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            {notice}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-border/60 pt-2.5">
          <ActionButton
            label={t("agents.editConversation", "Edit details")}
            icon={<PencilIcon className="h-3.5 w-3.5" />}
            onClick={() => setIsEditing(true)}
          />
          <ActionButton
            label={t("agents.exportMarkdown", "Export Markdown")}
            icon={<FileTextIcon className="h-3.5 w-3.5" />}
            onClick={() =>
              void run(async () => {
                const result = await window.api.agent.exportConversation({
                  agentId: agent.id,
                  sessionId: session.id,
                  format: "markdown",
                });
                if (!result.canceled) {
                  setNotice(
                    t("agents.conversationExported", "Conversation exported."),
                  );
                }
              })
            }
          />
          <ActionButton
            label={t("agents.exportJson", "Export JSON")}
            icon={<FileJsonIcon className="h-3.5 w-3.5" />}
            onClick={() =>
              void run(async () => {
                const result = await window.api.agent.exportConversation({
                  agentId: agent.id,
                  sessionId: session.id,
                  format: "json",
                });
                if (!result.canceled) {
                  setNotice(
                    t("agents.conversationExported", "Conversation exported."),
                  );
                }
              })
            }
          />
          {metadata?.deletedAt ? (
            <ActionButton
              label={t("agents.restoreConversation", "Restore")}
              icon={<RotateCcwIcon className="h-3.5 w-3.5" />}
              onClick={() =>
                void run(async () => {
                  onMetadataChange(
                    await window.api.agent.restoreConversation({
                      agentId: agent.id,
                      sessionId: session.id,
                    }),
                  );
                })
              }
            />
          ) : (
            <ActionButton
              label={t("agents.deleteConversation", "Remove from history")}
              icon={<Trash2Icon className="h-3.5 w-3.5" />}
              destructive
              onClick={() =>
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
          )}
        </div>
      </section>

      {preview ? (
        <HandoffDialog
          preview={preview}
          targetName={target?.name || preview.targetAgentId}
          isWorking={isWorking}
          onCancel={() => setPreview(null)}
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

function ActionButton({
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
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium hover:bg-accent ${destructive ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function HandoffDialog({
  preview,
  targetName,
  isWorking,
  onCancel,
  onConfirm,
}: {
  preview: AgentConversationHandoffPreview;
  targetName: string;
  isWorking: boolean;
  onCancel(): void;
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
                    "A new target session will open with this portable context.",
                  )
                : t(
                    "agents.handoffCopyHint",
                    "Direct launch is unavailable. The context will be copied.",
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
            onClick={onConfirm}
            className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {t("agents.continueInAgent", "Continue in {{agent}}", {
              agent: targetName,
            })}
          </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold text-foreground">
          {t("agents.editConversation", "Edit conversation")}
        </h2>
        <div className="mt-4 space-y-3">
          <Field label={t("agents.conversationTitle", "Title")}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
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
              triggerClassName="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </Field>
          <Field label={t("agents.conversationTags", "Tags (comma separated)")}>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </Field>
          <Field label={t("agents.conversationNote", "Note")}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex gap-5 text-xs text-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(event) => setFavorite(event.target.checked)}
              />
              {t("agents.favoriteConversation", "Favorite")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={archived}
                onChange={(event) => setArchived(event.target.checked)}
              />
              {t("agents.archiveConversation", "Archived")}
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-border px-4 text-xs font-semibold"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="h-9 rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground"
          >
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
    </div>
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
