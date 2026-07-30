import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock3Icon,
  CopyIcon,
  HistoryIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentSessionDetail,
  AgentSessionMetadata,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { useAgentSessionIndex } from "./use-agent-session-index";

const SESSION_PAGE_SIZE = 50;
const TRANSCRIPT_PAGE_SIZE = 80;

function formatTime(value: number | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export function AgentSessionsPanel({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  const sessionIndex = useAgentSessionIndex(agent.id);
  const [sessions, setSessions] = useState<AgentSessionMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentSessionDetail | null>(null);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [visibleEntryCount, setVisibleEntryCount] =
    useState(TRANSCRIPT_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const currentAgentId = useRef(agent.id);
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
    if (!sessionIndex.state.enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);
      listSessions(agent.id, SESSION_PAGE_SIZE, 0, query.trim() || undefined)
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
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [agent.id, query, sessionIndex.revision, sessionIndex.state.enabled, t]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setIsReading(true);
    setVisibleEntryCount(TRANSCRIPT_PAGE_SIZE);
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
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized || sessionIndex.state.enabled) return sessions;
    return sessions.filter((session) =>
      [session.title, session.projectLabel, session.projectPath, session.model]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalized)),
    );
  }, [query, sessionIndex.state.enabled, sessions]);
  const selected =
    sessions.find((session) => session.id === selectedId) || null;
  const visibleEntries = detail?.entries.slice(0, visibleEntryCount) || [];

  const loadMoreSessions = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await listSessions(
        agent.id,
        SESSION_PAGE_SIZE,
        nextOffset,
        sessionIndex.state.enabled ? query.trim() || undefined : undefined,
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
      <aside className="flex min-h-0 flex-col border-b border-border bg-muted/15 lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-border/70 p-4">
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
              aria-label={t("agents.searchSessions")}
              placeholder={t("agents.searchSessions")}
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
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
              onClick={() => setSelectedId(session.id)}
              style={{
                contentVisibility: "auto",
                containIntrinsicSize: "88px",
              }}
              className={`mb-1 w-full rounded-md border px-3 py-3 text-left transition-colors ${selectedId === session.id ? "border-primary/50 bg-primary/[0.08]" : "border-transparent hover:bg-accent"}`}
            >
              <span className="line-clamp-2 text-sm font-medium text-foreground">
                {session.title}
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3Icon className="h-3.5 w-3.5" />
                {formatTime(session.updatedAt) || t("agents.timeUnknown")}
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
              {!query && sessions.length === 0 ? (
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

      <section className="flex min-h-0 min-w-0 flex-col bg-background">
        {selected ? (
          <>
            <header className="shrink-0 border-b border-border/70 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {selected.title}
                  </h2>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {selected.projectPath ||
                      selected.projectLabel ||
                      selected.id}
                  </p>
                </div>
                {selected.resume ? (
                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        displayResumeCommand(selected),
                      )
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-accent"
                  >
                    <CopyIcon className="h-4 w-4" />
                    {t("agents.copyResumeCommand")}
                  </button>
                ) : null}
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {isReading ? (
                <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  {t("agents.loadingTranscript")}
                </div>
              ) : null}
              {!isReading && detail?.entries.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  {t("agents.noTranscriptEntries")}
                </p>
              ) : null}
              {!isReading
                ? visibleEntries.map((entry) => (
                    <article
                      key={entry.id}
                      style={{
                        contentVisibility: "auto",
                        containIntrinsicSize: "120px",
                      }}
                      className={`rounded-md border px-4 py-3 ${entry.role === "user" ? "border-border bg-muted/40" : "border-border bg-card"}`}
                    >
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        {t(`agents.sessionRole.${entry.role}`)}
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
                        {entry.text}
                      </pre>
                    </article>
                  ))
                : null}
              {!isReading &&
              detail &&
              visibleEntryCount < detail.entries.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleEntryCount((count) =>
                      Math.min(
                        count + TRANSCRIPT_PAGE_SIZE,
                        detail.entries.length,
                      ),
                    )
                  }
                  className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  {t("agents.showMoreMessages")}
                </button>
              ) : null}
              {detail?.truncated ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-muted-foreground">
                  {t("agents.transcriptTruncated")}
                </p>
              ) : null}
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
