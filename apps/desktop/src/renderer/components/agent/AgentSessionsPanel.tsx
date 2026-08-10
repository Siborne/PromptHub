import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveIcon,
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  Clock3Icon,
  CopyIcon,
  FolderIcon,
  HardDriveIcon,
  HistoryIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  TerminalSquareIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentConversationMetadata,
  AgentSessionDetail,
  AgentSessionEntry,
  AgentSessionMetadata,
  ManagedAgentSummary,
  SkillProject,
} from "@prompthub/shared/types";
import { AgentConversationMarkdown } from "./AgentConversationMarkdown";
import { AgentConversationActions } from "./AgentConversationActions";
import { useAgentSessionIndex } from "./use-agent-session-index";
import { Select } from "../ui/Select";
import {
  formatSessionSize,
  resolveSessionTitle,
  sortAgentSessions,
  type AgentSessionSort,
} from "./agent-session-display";

const SESSION_PAGE_SIZE = 50;
const TRANSCRIPT_FETCH_PAGE_SIZE = 80;
const TRANSCRIPT_VIEW_PAGE_SIZE = 20;
const MAX_TRANSCRIPT_CURSOR_HOPS = 8;

function formatTime(value: number | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizedProjectPath(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^(?:[A-Za-z]:)?[\\/]$/.test(trimmed)) return trimmed;
  return trimmed.replace(/[\\/]+$/, "");
}

function pathFilterValue(value: string): string {
  return `path:${value}`;
}

function displayResumeCommand(session: AgentSessionMetadata): string {
  if (!session.resume) return "";
  return [session.resume.executable, ...session.resume.args]
    .map((part) =>
      /^[A-Za-z0-9_./:-]+$/.test(part) ? part : JSON.stringify(part),
    )
    .join(" ");
}

function listSessions(
  agentId: string,
  limit: number,
  offset: number,
  search?: string,
) {
  return search
    ? window.api.agent.listSessions(agentId, limit, offset, search)
    : window.api.agent.listSessions(agentId, limit, offset);
}

interface AgentSessionsPanelProps {
  agent: ManagedAgentSummary;
  agents?: ManagedAgentSummary[];
  projects?: SkillProject[];
}

export function AgentSessionsPanel({
  agent,
  agents = [agent],
  projects = [],
}: AgentSessionsPanelProps) {
  const { t } = useTranslation();
  const sessionIndex = useAgentSessionIndex(agent.id);
  const [sessions, setSessions] = useState<AgentSessionMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentSessionDetail | null>(null);
  const [query, setQuery] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState({
    agentId: agent.id,
    query: "",
    revision: 0,
  });
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isLoadingMoreTranscript, setIsLoadingMoreTranscript] = useState(false);
  const [transcriptPage, setTranscriptPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metadataBySession, setMetadataBySession] = useState<
    Record<string, AgentConversationMetadata>
  >({});
  const [projectFilter, setProjectFilter] = useState("all");
  const [sessionSort, setSessionSort] = useState<AgentSessionSort>("newest");
  const [contextMenu, setContextMenu] = useState<{
    sessionId: string;
    x: number;
    y: number;
  } | null>(null);
  const currentAgentId = useRef(agent.id);
  const transcriptRef = useRef<HTMLDivElement>(null);
  currentAgentId.current = agent.id;

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setSessions([]);
    setTotal(0);
    setHasMore(false);
    setNextOffset(0);
    setSelectedId(null);
    setDetail(null);
    setQuery("");
    setSubmittedSearch({ agentId: agent.id, query: "", revision: 0 });
    setMetadataBySession({});
    setProjectFilter("all");
    setSessionSort("newest");
    setContextMenu(null);
    listSessions(agent.id, SESSION_PAGE_SIZE, 0)
      .then((result) => {
        if (!active) return;
        setSessions(result.sessions);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setNextOffset(SESSION_PAGE_SIZE);
        setSelectedId(result.sessions[0]?.id || null);
      })
      .catch(() => active && setError(t("agents.sessionsLoadFailed")))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [agent.id, t]);

  useEffect(() => {
    if (
      sessions.length === 0 ||
      typeof window.api.agent.listConversationMetadata !== "function"
    ) {
      return;
    }
    let active = true;
    window.api.agent
      .listConversationMetadata(
        agent.id,
        sessions.slice(0, 200).map((session) => session.id),
      )
      .then((records) => {
        if (!active) return;
        setMetadataBySession((current) => ({
          ...current,
          ...Object.fromEntries(
            records.map((record) => [record.sessionId, record]),
          ),
        }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [agent.id, sessions]);

  useEffect(() => {
    if (submittedSearch.agentId !== agent.id) return;
    if (!sessionIndex.state.enabled && submittedSearch.revision === 0) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    listSessions(
      agent.id,
      SESSION_PAGE_SIZE,
      0,
      submittedSearch.query || undefined,
    )
      .then((result) => {
        if (!active || currentAgentId.current !== agent.id) return;
        setSessions(result.sessions);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setNextOffset(SESSION_PAGE_SIZE);
        setSelectedId(result.sessions[0]?.id || null);
      })
      .catch(() => active && setError(t("agents.sessionsLoadFailed")))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [
    agent.id,
    sessionIndex.revision,
    sessionIndex.state.enabled,
    submittedSearch,
    t,
  ]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setIsReading(true);
    setIsLoadingMoreTranscript(false);
    setTranscriptPage(0);
    setDetail(null);
    setError(null);
    window.api.agent
      .readSession(agent.id, selectedId)
      .then((next) => active && setDetail(next))
      .catch(() => {
        if (!active) return;
        setDetail(null);
        setError(t("agents.sessionReadFailed"));
      })
      .finally(() => active && setIsReading(false));
    return () => {
      active = false;
    };
  }, [agent.id, selectedId, t]);

  const filtered = useMemo(() => {
    const normalized =
      submittedSearch.agentId === agent.id
        ? submittedSearch.query.toLocaleLowerCase()
        : "";
    const matching = sessions.filter((session) => {
      const metadata = metadataBySession[session.id];
      if (
        projectFilter !== "all" &&
        (projectFilter.startsWith("path:")
          ? pathFilterValue(
              normalizedProjectPath(
                metadata?.projectPath || session.projectPath,
              ) || "",
            ) !== projectFilter
          : `id:${metadata?.projectId || ""}` !== projectFilter)
      ) {
        return false;
      }
      if (!normalized) return true;
      return [
        metadata?.title,
        session.title,
        session.projectLabel,
        session.projectPath,
        metadata?.projectPath,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalized));
    });
    return sortAgentSessions(matching, sessionSort);
  }, [
    metadataBySession,
    projectFilter,
    sessions,
    sessionSort,
    submittedSearch,
    agent.id,
  ]);
  const selected =
    sessions.find((session) => session.id === selectedId) || null;
  const transcriptPageCount = Math.max(
    1,
    Math.ceil((detail?.entries.length || 0) / TRANSCRIPT_VIEW_PAGE_SIZE),
  );
  const safeTranscriptPage = Math.min(
    transcriptPage,
    Math.max(0, transcriptPageCount - 1),
  );
  const visibleEntries =
    detail?.entries.slice(
      safeTranscriptPage * TRANSCRIPT_VIEW_PAGE_SIZE,
      (safeTranscriptPage + 1) * TRANSCRIPT_VIEW_PAGE_SIZE,
    ) || [];

  useEffect(() => {
    const lastPage = Math.max(0, transcriptPageCount - 1);
    setTranscriptPage((current) => Math.min(current, lastPage));
  }, [transcriptPageCount]);

  const loadTranscriptPage = async (nextPage: number, seekLatest = false) => {
    if (!detail || !selectedId || isLoadingMoreTranscript) return;
    if (nextPage < 0) return;
    if (!seekLatest && nextPage < transcriptPageCount) {
      setTranscriptPage(nextPage);
      return;
    }
    if (!seekLatest && nextPage !== transcriptPageCount) return;
    if (!detail.nextCursor) {
      if (seekLatest) setTranscriptPage(transcriptPageCount - 1);
      return;
    }

    const sessionId = selectedId;
    setIsLoadingMoreTranscript(true);
    setError(null);
    try {
      let cursor: string | null = detail.nextCursor;
      let entries = detail.entries;
      let parseErrors = 0;
      let truncated = detail.truncated;
      let hops = 0;
      while (
        cursor &&
        (seekLatest ||
          entries.length <= nextPage * TRANSCRIPT_VIEW_PAGE_SIZE) &&
        hops < MAX_TRANSCRIPT_CURSOR_HOPS
      ) {
        const page = await window.api.agent.readSession(agent.id, sessionId, {
          cursor,
          limit: TRANSCRIPT_FETCH_PAGE_SIZE,
        });
        if (currentAgentId.current !== agent.id) return;
        const known = new Set(entries.map((entry) => entry.id));
        const appended = page.entries.filter((entry) => !known.has(entry.id));
        entries = [...entries, ...appended];
        parseErrors += page.parseErrors;
        truncated ||= page.truncated;
        const nextCursor = page.nextCursor ?? null;
        cursor = nextCursor === cursor ? null : nextCursor;
        hops += 1;
      }

      setDetail((current) => {
        if (!current || current.sessionId !== sessionId) return current;
        return {
          ...current,
          entries,
          parseErrors: current.parseErrors + parseErrors,
          truncated: current.truncated || truncated,
          nextCursor: cursor,
        };
      });
      const lastPage = Math.max(
        0,
        Math.ceil(entries.length / TRANSCRIPT_VIEW_PAGE_SIZE) - 1,
      );
      setTranscriptPage(seekLatest ? lastPage : Math.min(nextPage, lastPage));
    } catch {
      if (currentAgentId.current === agent.id) {
        setError(t("agents.sessionReadFailed"));
      }
    } finally {
      if (currentAgentId.current === agent.id) {
        setIsLoadingMoreTranscript(false);
      }
    }
  };

  useEffect(() => {
    transcriptRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
  }, [transcriptPage]);
  const projectFilterEntries = useMemo(() => {
    const entries = new Map<
      string,
      { value: string; label: string; path: string | null }
    >();
    for (const project of projects) {
      const projectPath = normalizedProjectPath(project.rootPath);
      const value = projectPath
        ? pathFilterValue(projectPath)
        : `id:${project.id}`;
      entries.set(value, { value, label: project.name, path: projectPath });
    }
    for (const session of sessions) {
      const metadata = metadataBySession[session.id];
      const projectPath = normalizedProjectPath(
        metadata?.projectPath || session.projectPath,
      );
      if (!projectPath) continue;
      const value = pathFilterValue(projectPath);
      if (entries.has(value)) continue;
      entries.set(value, {
        value,
        label: session.projectLabel || projectPath,
        path: projectPath,
      });
    }
    const values = [...entries.values()];
    const labelCounts = new Map<string, number>();
    for (const entry of values) {
      labelCounts.set(entry.label, (labelCounts.get(entry.label) || 0) + 1);
    }
    return values.map((entry) => ({
      ...entry,
      label:
        entry.path && (labelCounts.get(entry.label) || 0) > 1
          ? `${entry.label} · ${entry.path}`
          : entry.label,
    }));
  }, [metadataBySession, projects, sessions]);
  const projectFilterOptions = useMemo(
    () => [
      {
        value: "all",
        labelText: t("agents.allProjects", "All projects"),
        label: (
          <FilterLabel
            icon={<FolderIcon className="h-3.5 w-3.5" />}
            text={t("agents.allProjects", "All projects")}
          />
        ),
      },
      ...projectFilterEntries.map((project) => ({
        value: project.value,
        labelText: project.label,
        label: (
          <FilterLabel
            icon={<FolderIcon className="h-3.5 w-3.5" />}
            text={project.label}
          />
        ),
      })),
    ],
    [projectFilterEntries, t],
  );
  const sessionSortOptions = useMemo(
    () => [
      {
        value: "newest",
        labelText: t("agents.newestConversations", "Newest first"),
        label: (
          <FilterLabel
            icon={<Clock3Icon className="h-3.5 w-3.5" />}
            text={t("agents.newestConversations", "Newest first")}
          />
        ),
      },
      {
        value: "oldest",
        labelText: t("agents.oldestConversations", "Oldest first"),
        label: (
          <FilterLabel
            icon={<Clock3Icon className="h-3.5 w-3.5" />}
            text={t("agents.oldestConversations", "Oldest first")}
          />
        ),
      },
      {
        value: "largest",
        labelText: t("agents.largestConversations", "Largest first"),
        label: (
          <FilterLabel
            icon={<HardDriveIcon className="h-3.5 w-3.5" />}
            text={t("agents.largestConversations", "Largest first")}
          />
        ),
      },
      {
        value: "smallest",
        labelText: t("agents.smallestConversations", "Smallest first"),
        label: (
          <FilterLabel
            icon={<HardDriveIcon className="h-3.5 w-3.5" />}
            text={t("agents.smallestConversations", "Smallest first")}
          />
        ),
      },
    ],
    [t],
  );

  const loadMoreSessions = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await listSessions(
        agent.id,
        SESSION_PAGE_SIZE,
        nextOffset,
        submittedSearch.agentId === agent.id
          ? submittedSearch.query || undefined
          : undefined,
      );
      if (currentAgentId.current !== agent.id) return;
      setSessions((current) => {
        const known = new Set(current.map((session) => session.id));
        const additions = result.sessions.filter(
          (session) => !known.has(session.id),
        );
        return [...current, ...additions];
      });
      setTotal(result.total);
      setHasMore(result.hasMore);
      setNextOffset((offset) => offset + SESSION_PAGE_SIZE);
    } catch {
      setError(t("agents.sessionsLoadFailed"));
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-56 items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        {t("agents.loadingSessions")}
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border bg-white dark:bg-muted/10 lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-border/70 bg-white p-4 dark:bg-transparent">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("agents.sessionHistory")}
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {t("agents.sessionsLoadedCount", {
                loaded: sessions.length,
                total: Math.max(total, sessions.length),
              })}
            </span>
          </div>
          <label className="relative mt-3 block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) {
                  return;
                }
                event.preventDefault();
                const nextQuery = query.trim();
                setSubmittedSearch((current) => ({
                  agentId: agent.id,
                  query: nextQuery,
                  revision:
                    current.agentId === agent.id ? current.revision + 1 : 1,
                }));
              }}
              aria-label={t("agents.searchSessions")}
              placeholder={t("agents.searchSessions")}
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select
              ariaLabel={t(
                "agents.filterSessionsByProject",
                "Filter by project",
              )}
              value={projectFilter}
              onChange={setProjectFilter}
              options={projectFilterOptions}
              className="min-w-0"
              triggerClassName="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-2.5 text-left text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            <Select
              ariaLabel={t("agents.sortConversations", "Sort conversations")}
              value={sessionSort}
              onChange={(value) => setSessionSort(value as AgentSessionSort)}
              options={sessionSortOptions}
              className="min-w-0"
              triggerClassName="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border/80 bg-background px-2.5 text-left text-xs text-foreground shadow-sm outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          {sessionIndex.state.supported ? (
            <div className="mt-3 border-t border-border/70 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {t("agents.localSessionIndex")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-label={t("agents.enableLocalSessionIndex")}
                  aria-describedby="local-session-index-description"
                  aria-checked={sessionIndex.state.enabled}
                  disabled={sessionIndex.isChanging || sessionIndex.isIndexing}
                  onClick={() =>
                    void sessionIndex.setEnabled(!sessionIndex.state.enabled)
                  }
                  className={`relative ml-auto h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    sessionIndex.state.enabled
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      sessionIndex.state.enabled
                        ? "translate-x-4"
                        : "translate-x-0"
                    }`}
                  />
                </button>
                {sessionIndex.state.enabled && !sessionIndex.isIndexing ? (
                  <button
                    type="button"
                    aria-label={t("agents.refreshLocalSessionIndex")}
                    title={t("agents.refreshLocalSessionIndex")}
                    onClick={() => void sessionIndex.refresh()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p
                id="local-session-index-description"
                className="mt-1.5 pr-2 text-[11px] leading-4 text-muted-foreground"
              >
                {t("agents.localSessionIndexDescription")}
              </p>
              {sessionIndex.isIndexing && sessionIndex.progress ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {t("agents.indexingSessions", {
                          processed: sessionIndex.progress.processed,
                          total: sessionIndex.progress.total,
                        })}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{
                          width: `${
                            sessionIndex.progress.total > 0
                              ? Math.min(
                                  100,
                                  (sessionIndex.progress.processed /
                                    sessionIndex.progress.total) *
                                    100,
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t("agents.cancelSessionIndexing")}
                    title={t("agents.cancelSessionIndexing")}
                    onClick={() => void sessionIndex.cancel()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              {sessionIndex.error ? (
                <p className="mt-2 text-[11px] text-destructive">
                  {t("agents.sessionIndexFailed")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => {
                setContextMenu(null);
                setSelectedId(session.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setSelectedId(session.id);
                setContextMenu({
                  sessionId: session.id,
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              aria-current={selectedId === session.id ? "true" : undefined}
              style={{
                contentVisibility: "auto",
                containIntrinsicSize: "88px",
              }}
              className={`mb-1 w-full rounded-md border px-3 py-3 text-left text-foreground transition-colors ${selectedId === session.id ? "border-primary/40 bg-accent/70" : "border-transparent hover:bg-accent"}`}
            >
              <span className="flex items-start gap-2">
                <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-foreground">
                  {resolveSessionTitle(
                    session.title,
                    session.id,
                    metadataBySession[session.id]?.title,
                  )}
                </span>
                {metadataBySession[session.id]?.archivedAt ? (
                  <span
                    aria-label={t("agents.archivedConversations", "Archived")}
                    title={t("agents.archivedConversations", "Archived")}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  >
                    <ArchiveIcon className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3Icon className="h-3.5 w-3.5" />
                {formatTime(session.updatedAt) || t("agents.timeUnknown")}
                <span aria-hidden="true">·</span>
                <HardDriveIcon className="h-3.5 w-3.5" />
                {formatSessionSize(session.sizeBytes) ||
                  t("agents.sessionSizeUnknown", "Size unknown")}
              </span>
              {session.projectLabel ? (
                <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground/80">
                  {session.projectLabel}
                </span>
              ) : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              <p>{t("agents.noSessions")}</p>
              {!submittedSearch.query && sessions.length === 0 ? (
                <p className="mx-auto mt-2 max-w-64 leading-5">
                  {t("agents.noNativeSessionsHint", { agent: agent.name })}
                </p>
              ) : null}
            </div>
          ) : null}
          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadMoreSessions()}
              disabled={isLoadingMore}
              className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : null}
              {t(
                isLoadingMore
                  ? "agents.loadingMoreSessions"
                  : "agents.loadMoreSessions",
              )}
            </button>
          ) : null}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-slate-50/70 dark:bg-background">
        {selected ? (
          <>
            <header className="shrink-0 border-b border-border/70 bg-white px-5 py-2 dark:bg-background">
              {typeof window.api.agent.resumeConversation === "function" ? (
                <AgentConversationActions
                  agent={agent}
                  agents={agents}
                  projects={projects}
                  session={selected}
                  metadata={metadataBySession[selected.id] || null}
                  contextMenu={
                    contextMenu?.sessionId === selected.id
                      ? { x: contextMenu.x, y: contextMenu.y }
                      : null
                  }
                  onContextMenuClose={() => setContextMenu(null)}
                  onDeleted={(sessionId) => {
                    const remaining = sessions.filter(
                      (candidate) => candidate.id !== sessionId,
                    );
                    setSessions(remaining);
                    setTotal((current) => Math.max(0, current - 1));
                    setMetadataBySession((current) => {
                      const next = { ...current };
                      delete next[sessionId];
                      return next;
                    });
                    setSelectedId((current) =>
                      current === sessionId
                        ? remaining[0]?.id || null
                        : current,
                    );
                  }}
                  onError={setError}
                />
              ) : selected.resume ? (
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      displayResumeCommand(selected),
                    )
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  <CopyIcon className="h-4 w-4" />
                  {t("agents.copyResumeCommand")}
                </button>
              ) : null}
            </header>
            {!isReading &&
            detail &&
            (detail.entries.length > TRANSCRIPT_VIEW_PAGE_SIZE ||
              Boolean(detail.nextCursor)) ? (
              <TranscriptPagination
                currentPage={safeTranscriptPage}
                pageCount={transcriptPageCount}
                hasMore={Boolean(detail.nextCursor)}
                isLoading={isLoadingMoreTranscript}
                onPageChange={(page) => void loadTranscriptPage(page)}
                onLatest={() =>
                  void loadTranscriptPage(transcriptPageCount, true)
                }
              />
            ) : null}
            <div
              ref={transcriptRef}
              data-testid="conversation-transcript"
              className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4"
            >
              {isReading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  {t("agents.loadingTranscript")}
                </div>
              ) : null}
              {!isReading &&
              detail?.entries.length === 0 &&
              !detail.nextCursor ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  {t("agents.noTranscriptEntries")}
                </p>
              ) : null}
              {!isReading
                ? visibleEntries.map((entry) => (
                    <ConversationMessage
                      key={entry.id}
                      entry={entry}
                      roleLabel={t(`agents.sessionRole.${entry.role}`)}
                    />
                  ))
                : null}
            </div>
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
            {t("agents.selectSession")}
          </div>
        )}
        {error ? (
          <p className="border-t border-border px-5 py-3 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function transcriptPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 5)
    return Array.from({ length: pageCount }, (_, index) => index);
  const start = Math.min(Math.max(currentPage - 2, 0), pageCount - 5);
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function TranscriptPagination({
  currentPage,
  pageCount,
  hasMore,
  isLoading,
  onPageChange,
  onLatest,
}: {
  currentPage: number;
  pageCount: number;
  hasMore: boolean;
  isLoading: boolean;
  onPageChange(page: number): void;
  onLatest(): void;
}) {
  const { t } = useTranslation();
  return (
    <nav
      data-testid="conversation-transcript-pagination"
      aria-label={t("agents.transcriptPagination", "Message pages")}
      className="flex h-12 shrink-0 items-center justify-center gap-1 border-b border-border/70 bg-white px-4 dark:bg-background"
    >
      <button
        type="button"
        aria-label={t("agents.transcriptPreviousPage", "Previous message page")}
        disabled={currentPage === 0 || isLoading}
        onClick={() => onPageChange(currentPage - 1)}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1">
        {transcriptPageNumbers(currentPage, pageCount).map((page) => (
          <button
            key={page}
            type="button"
            aria-label={t(
              "agents.transcriptPageButton",
              "Message page {{page}}",
              {
                page: page + 1,
              },
            )}
            aria-current={page === currentPage ? "page" : undefined}
            onClick={() => onPageChange(page)}
            className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-semibold transition-colors ${
              page === currentPage
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {page + 1}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label={t("agents.transcriptNextPage", "Next message page")}
        disabled={(!hasMore && currentPage >= pageCount - 1) || isLoading}
        onClick={() => onPageChange(currentPage + 1)}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
      >
        {isLoading ? (
          <Loader2Icon className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        aria-label={t("agents.transcriptLatest", "Latest messages")}
        title={t("agents.transcriptLatest", "Latest messages")}
        disabled={(!hasMore && currentPage >= pageCount - 1) || isLoading}
        onClick={onLatest}
        className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
      >
        <ChevronsRightIcon className="h-4 w-4" />
      </button>
      <span className="ml-2 text-[11px] font-medium text-muted-foreground">
        {t("agents.transcriptPageStatus", "Page {{page}} of {{total}}", {
          page: currentPage + 1,
          total: `${pageCount}${hasMore ? "+" : ""}`,
        })}
      </span>
    </nav>
  );
}

function FilterLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="truncate">{text}</span>
    </span>
  );
}

function ConversationMessage({
  entry,
  roleLabel,
}: {
  entry: AgentSessionEntry;
  roleLabel: string;
}) {
  const baseClass =
    "max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ring-1 ring-black/[0.025]";
  const sharedProps = {
    "data-testid": `conversation-message-${entry.id}`,
    style: {
      contentVisibility: "auto",
      containIntrinsicSize: "120px",
    } as React.CSSProperties,
  };

  if (entry.role === "user") {
    return (
      <article
        {...sharedProps}
        className="flex w-full flex-row-reverse items-start gap-2.5"
      >
        <span
          role="img"
          aria-label={roleLabel}
          title={roleLabel}
          data-testid={`conversation-avatar-${entry.id}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-sm"
        >
          <UserIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div
          data-testid={`conversation-bubble-${entry.id}`}
          className="min-w-0 max-w-[82%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm shadow-primary/15 ring-1 ring-primary/10"
        >
          <AgentConversationMarkdown content={entry.text} />
        </div>
      </article>
    );
  }

  if (entry.role === "assistant") {
    return (
      <article {...sharedProps} className="flex w-full items-start gap-2.5">
        <span
          role="img"
          aria-label={roleLabel}
          title={roleLabel}
          data-testid={`conversation-avatar-${entry.id}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-white text-primary shadow-sm dark:bg-card"
        >
          <BotIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div
          data-testid={`conversation-bubble-${entry.id}`}
          className="min-w-0 max-w-[82%] rounded-2xl rounded-tl-md border border-border/70 bg-white px-3.5 py-2.5 text-foreground shadow-sm ring-1 ring-black/[0.025] dark:bg-card"
        >
          <AgentConversationMarkdown content={entry.text} />
        </div>
      </article>
    );
  }

  if (entry.role === "tool") {
    return (
      <article {...sharedProps} className="flex w-full items-start gap-2.5">
        <span
          role="img"
          aria-label={roleLabel}
          title={roleLabel}
          data-testid={`conversation-avatar-${entry.id}`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sky-200 bg-white text-sky-600 shadow-sm dark:border-sky-900/70 dark:bg-card"
        >
          <BotIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div
          data-testid={`conversation-bubble-${entry.id}`}
          className="min-w-0 max-w-[82%] rounded-2xl rounded-tl-md border border-sky-200 bg-white px-3.5 py-2.5 text-foreground shadow-sm ring-1 ring-black/[0.025] dark:border-sky-900/70 dark:bg-card"
        >
          <MessageRole
            icon={<TerminalSquareIcon className="h-3.5 w-3.5" />}
            label={roleLabel}
            className="text-sky-600"
          />
          <div className="mt-1">
            <AgentConversationMarkdown content={entry.text} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      {...sharedProps}
      className={`${baseClass} mx-auto border border-amber-200 bg-white dark:border-amber-900/70 dark:bg-card`}
    >
      <MessageRole
        icon={<InfoIcon className="h-3.5 w-3.5" />}
        label={roleLabel}
        className="text-amber-600"
      />
      <div className="mt-1 text-foreground">
        <AgentConversationMarkdown content={entry.text} />
      </div>
    </article>
  );
}

function MessageRole({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] font-semibold ${className}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
