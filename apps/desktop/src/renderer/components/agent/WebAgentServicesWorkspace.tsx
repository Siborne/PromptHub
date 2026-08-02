import { useEffect, useState } from "react";
import { ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  AgentServiceDomain,
  AgentServiceManifestEntry,
  AgentServiceResult,
  ManagedAgentSummary,
} from "@prompthub/shared/types";

interface WebAgentServiceApi {
  getServiceManifest(agentId: string): Promise<AgentServiceManifestEntry[]>;
  getService(
    agentId: string,
    domain: AgentServiceDomain,
  ): Promise<AgentServiceResult>;
}

const DOMAIN_LABELS: Record<
  AgentServiceDomain,
  { key: string; fallback: string }
> = {
  skills: { key: "agents.skills", fallback: "Skills" },
  mcp: { key: "agents.mcp", fallback: "MCP" },
  plugins: { key: "agents.plugins", fallback: "Plugins" },
  rules: { key: "agents.rules", fallback: "Rules" },
  definitions: { key: "agents.definitions", fallback: "Definitions" },
  provider: { key: "agents.providerAndModel", fallback: "Provider" },
  appearance: { key: "agents.appearanceTab", fallback: "Appearance" },
  configFiles: { key: "agents.configFiles", fallback: "Config Files" },
  sessions: { key: "agents.sessions", fallback: "Sessions" },
  usage: { key: "agents.usage", fallback: "Usage" },
  maintenance: { key: "agents.maintenance", fallback: "Maintenance" },
};

const ACTION_LABELS: Record<string, string> = {
  activate: "Activate",
  apply: "Apply",
  browse: "Browse",
  distribute: "Distribute",
  edit: "Edit",
  export: "Export",
  inspect: "Inspect",
  install: "Install",
  launch: "Launch",
  manage: "Manage",
  resume: "Resume",
  update: "Update",
};

function getWebAgentServiceApi(): WebAgentServiceApi {
  const api = Reflect.get(window, "api") as unknown as {
    agent: WebAgentServiceApi;
  };
  return api.agent;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

function StatusLabel({
  status,
}: {
  status: "available" | "partial" | "unavailable";
}) {
  const { t } = useTranslation();
  const available = status === "available";
  const unavailable = status === "unavailable";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${available ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : unavailable ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
    >
      {available
        ? t("agents.webService.available", "Available")
        : unavailable
          ? t("agents.webService.unavailable", "Unavailable")
          : t("agents.webService.partial", "Partial")}
    </span>
  );
}

function RetryState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm">
      <p className="text-destructive">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2"
      >
        <RefreshCwIcon className="h-4 w-4" />
        {t("common.retry", "Retry")}
      </button>
    </div>
  );
}

function useServiceManifest(agentId: string, reloadKey: number) {
  const [value, setValue] = useState<AgentServiceManifestEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setValue(null);
    setError(null);
    void getWebAgentServiceApi()
      .getServiceManifest(agentId)
      .then((result) => active && setValue(result))
      .catch((reason) => active && setError(messageFromError(reason)));
    return () => {
      active = false;
    };
  }, [agentId, reloadKey]);
  return { error, value };
}

function ManifestCards({
  manifest,
  onSelect,
}: {
  manifest: AgentServiceManifestEntry[];
  onSelect: (domain: AgentServiceDomain) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {manifest.map((entry) => (
        <button
          key={entry.domain}
          type="button"
          onClick={() => onSelect(entry.domain)}
          className="flex min-h-24 flex-col items-start justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
        >
          <span className="font-medium">
            {t(
              DOMAIN_LABELS[entry.domain].key,
              DOMAIN_LABELS[entry.domain].fallback,
            )}
          </span>
          <StatusLabel status={entry.status} />
        </button>
      ))}
    </div>
  );
}

function ManifestView({
  agentId,
  onSelect,
}: {
  agentId: string;
  onSelect: (domain: AgentServiceDomain) => void;
}) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const { error, value: manifest } = useServiceManifest(agentId, reloadKey);

  if (error) {
    return (
      <RetryState
        message={error}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }
  if (!manifest) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-6">
      <h2 className="text-lg font-semibold">
        {t("agents.webService.title", "Agent services")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "agents.webService.description",
          "Services run on this self-hosted PromptHub server.",
        )}
      </p>
      <ManifestCards manifest={manifest} onSelect={onSelect} />
    </div>
  );
}

function ActionSummary({ result }: { result: AgentServiceResult }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2 border-b border-border px-6 py-3">
      {Object.entries(result.actions).map(([action, status]) => (
        <span
          key={action}
          className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground"
        >
          {t(
            `agents.webService.action.${action}`,
            ACTION_LABELS[action] ?? action,
          )}
          :{" "}
          {status === "available"
            ? t(
                "agents.webService.actionAvailable",
                "Available in self-hosted Web",
              )
            : t(
                "agents.webService.actionUnavailable",
                "Unavailable in browser",
              )}
        </span>
      ))}
    </div>
  );
}

function ServiceItems({ result }: { result: AgentServiceResult }) {
  const { t } = useTranslation();
  if (result.items.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("agents.webService.empty", "No items yet.")}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 overflow-y-auto p-6 sm:grid-cols-2 xl:grid-cols-3">
      {result.items.map((entry) => (
        <article
          key={entry.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="break-words text-sm font-medium">{entry.label}</h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t(`agents.webService.state.${entry.state}`, entry.state)}
            </span>
          </div>
          {entry.description ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {entry.description}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function useServiceResult(
  agentId: string,
  domain: AgentServiceDomain,
  reloadKey: number,
) {
  const [value, setValue] = useState<AgentServiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setValue(null);
    setError(null);
    void getWebAgentServiceApi()
      .getService(agentId, domain)
      .then((result) => active && setValue(result))
      .catch((reason) => active && setError(messageFromError(reason)));
    return () => {
      active = false;
    };
  }, [agentId, domain, reloadKey]);
  return { error, value };
}

function ServiceHeader({
  domain,
  result,
  onBack,
}: {
  domain: AgentServiceDomain;
  result: AgentServiceResult;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 border-b border-border px-6 py-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common.back", "Back")}
          className="rounded-md p-2 hover:bg-accent"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
      ) : null}
      <h2 className="font-semibold">
        {t(DOMAIN_LABELS[domain].key, DOMAIN_LABELS[domain].fallback)}
      </h2>
      <StatusLabel status={result.status} />
      <span className="ml-auto text-xs text-muted-foreground">
        {result.total}
      </span>
    </div>
  );
}

function ServiceReason({ reason }: { reason?: string }) {
  const { t } = useTranslation();
  if (!reason) return null;
  return (
    <p className="border-b border-border px-6 py-3 text-xs text-amber-700 dark:text-amber-300">
      {t(
        `agents.webService.reason.${reason}`,
        "This service is present, but its server adapter is still incomplete.",
      )}
    </p>
  );
}

function ServiceDetail({
  agentId,
  domain,
  onBack,
}: {
  agentId: string;
  domain: AgentServiceDomain;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [reloadKey, setReloadKey] = useState(0);
  const { error, value: result } = useServiceResult(agentId, domain, reloadKey);

  if (error) {
    return (
      <RetryState
        message={error}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }
  if (!result) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ServiceHeader domain={domain} result={result} onBack={onBack} />
      <ActionSummary result={result} />
      <ServiceReason reason={result.reason} />
      <ServiceItems result={result} />
    </div>
  );
}

export function WebAgentServicesWorkspace({
  agent,
  domain,
}: {
  agent: ManagedAgentSummary;
  domain?: AgentServiceDomain;
}) {
  const [selectedDomain, setSelectedDomain] =
    useState<AgentServiceDomain | null>(domain ?? null);

  useEffect(() => setSelectedDomain(domain ?? null), [agent.id, domain]);

  if (selectedDomain) {
    return (
      <ServiceDetail
        agentId={agent.id}
        domain={selectedDomain}
        onBack={domain ? undefined : () => setSelectedDomain(null)}
      />
    );
  }
  return <ManifestView agentId={agent.id} onSelect={setSelectedDomain} />;
}
