import { useEffect, useMemo, useState } from "react";
import {
  Clock3Icon,
  CopyIcon,
  HistoryIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentSessionDetail,
  AgentSessionMetadata,
  ManagedAgentSummary,
} from "@prompthub/shared/types";

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

export function AgentSessionsPanel({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<AgentSessionMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentSessionDetail | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setSessions([]);
    setSelectedId(null);
    setDetail(null);
    setQuery("");
    window.api.agent
      .listSessions(agent.id, 100)
      .then((result) => {
        if (!active) return;
        setSessions(result.sessions);
        setSelectedId(result.sessions[0]?.id || null);
      })
      .catch(() => active && setError(t("agents.sessionsLoadFailed")))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [agent.id, t]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setIsReading(true);
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
    if (!normalized) return sessions;
    return sessions.filter((session) =>
      [session.title, session.projectLabel, session.projectPath, session.model]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalized)),
    );
  }, [query, sessions]);
  const selected =
    sessions.find((session) => session.id === selectedId) || null;

  if (isLoading) {
    return (
      <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        {t("agents.loadingSessions")}
      </div>
    );
  }

  return (
    <div className="grid min-h-[32rem] overflow-hidden rounded-md border border-border/80 bg-card shadow-sm lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="min-h-0 border-b border-border bg-muted/15 lg:border-b-0 lg:border-r">
        <div className="border-b border-border/70 p-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("agents.sessionHistory")}
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {sessions.length}
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
        </div>
        <div className="max-h-[38rem] overflow-y-auto p-2">
          {filtered.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedId(session.id)}
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
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {t("agents.noSessions")}
            </p>
          ) : null}
        </div>
      </aside>

      <section className="min-w-0 bg-background">
        {selected ? (
          <>
            <header className="border-b border-border/70 px-5 py-4">
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
            <div className="max-h-[36rem] space-y-3 overflow-y-auto p-5">
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
                ? detail?.entries.map((entry) => (
                    <article
                      key={entry.id}
                      className={`rounded-md border px-4 py-3 ${entry.role === "user" ? "border-blue-500/25 bg-blue-500/[0.06]" : "border-border bg-card"}`}
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
