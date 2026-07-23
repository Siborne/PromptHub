import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CpuIcon,
  KeyRoundIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  ServerIcon,
  ShieldCheckIcon,
  StarIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentCodexProvider,
  AgentCodexProviderList,
  AgentCodexProviderTestResult,
  AgentCredentialStatus,
  AgentModelConfiguration,
  ManagedAgentSummary,
} from "@prompthub/shared/types";

import { ConfirmDialog } from "../ui";
import { AgentCodexProviderFormDialog } from "./AgentCodexProviderFormDialog";

const BUILT_IN_SELECTION = "builtin";

type DialogState =
  | { mode: "add" }
  | { mode: "edit"; provider: AgentCodexProvider };

interface ProviderTestState {
  loading: boolean;
  result: AgentCodexProviderTestResult | null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isActiveProviderError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("active-provider");
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-foreground">{value}</dd>
    </div>
  );
}

function credentialStatusClass(status: AgentCredentialStatus): string {
  if (status === "configured" || status === "platform-managed") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (status === "missing") {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

export function AgentProviderModelPanel({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const isCodex = agent.id === "codex";

  const [config, setConfig] = useState<AgentModelConfiguration | null>(null);
  const [model, setModel] = useState("");
  const [secondaryModel, setSecondaryModel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [list, setList] = useState<AgentCodexProviderList | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(isCodex);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentCodexProvider | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDefaultId, setPendingDefaultId] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<
    Record<string, ProviderTestState>
  >({});

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setSaved(false);
    window.api.agent
      .getModelConfig(agent.id)
      .then((next) => {
        if (!active) return;
        setConfig(next);
        setModel(next.model || "");
        setSecondaryModel(next.secondaryModel || "");
      })
      .catch(() => active && setError(t("agents.modelLoadFailed")))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [agent.id, t]);

  const loadProviders = useCallback(async () => {
    if (!isCodex) return;
    setIsLoadingProviders(true);
    setLoadError(null);
    try {
      const next = await window.api.agent.listProviders(agent.id);
      setList(next);
    } catch (loadFailure) {
      setLoadError(
        errorMessage(loadFailure, t("agents.providers.loadFailed")),
      );
    } finally {
      setIsLoadingProviders(false);
    }
  }, [agent.id, isCodex, t]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  async function saveModel() {
    if (!model.trim() || !config?.canSetModel) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const next = await window.api.agent.setModelConfig({
        agentId: agent.id,
        model: model.trim(),
        ...(agent.id === "opencode"
          ? { secondaryModel: secondaryModel.trim() || null }
          : {}),
      });
      setConfig(next);
      setModel(next.model || "");
      setSecondaryModel(next.secondaryModel || "");
      setSaved(true);
    } catch {
      setError(t("agents.modelSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetDefault(providerId: string): Promise<void> {
    setPendingDefaultId(providerId);
    setActionError(null);
    try {
      const next = await window.api.agent.setDefaultProvider(
        agent.id,
        providerId,
      );
      setList(next);
    } catch (setDefaultFailure) {
      setActionError(
        errorMessage(setDefaultFailure, t("agents.providers.setDefaultFailed")),
      );
    } finally {
      setPendingDefaultId(null);
    }
  }

  async function handleTest(providerId: string): Promise<void> {
    setTestStates((prev) => ({
      ...prev,
      [providerId]: { loading: true, result: null },
    }));
    setActionError(null);
    try {
      const result = await window.api.agent.testProvider(agent.id, providerId);
      setTestStates((prev) => ({
        ...prev,
        [providerId]: { loading: false, result },
      }));
    } catch (testFailure) {
      setTestStates((prev) => ({
        ...prev,
        [providerId]: { loading: false, result: null },
      }));
      setActionError(errorMessage(testFailure, t("agents.providers.testFailed")));
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      const next = await window.api.agent.removeProvider(
        agent.id,
        deleteTarget.id,
      );
      setList(next);
      setDeleteTarget(null);
    } catch (deleteFailure) {
      setDeleteTarget(null);
      setActionError(
        isActiveProviderError(deleteFailure)
          ? t("agents.providers.deleteActiveHint")
          : errorMessage(deleteFailure, t("agents.providers.deleteFailed")),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function renderKeyReadiness(provider: AgentCodexProvider): ReactNode {
    if (provider.keySource === "managed") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          {t("agents.providers.keyManaged")}
        </span>
      );
    }
    if (provider.keySource === "env") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <KeyRoundIcon className="h-3.5 w-3.5" />
          {t("agents.providers.keyEnv", { envKey: provider.envKey ?? "" })}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangleIcon className="h-3.5 w-3.5" />
        {t("agents.providers.keyNone")}
      </span>
    );
  }

  function renderActiveBadge(): ReactNode {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <StarIcon className="h-3 w-3" />
        {t("agents.providers.activeBadge")}
      </span>
    );
  }

  function renderTestState(providerId: string): ReactNode {
    const state = testStates[providerId];
    if (!state) return null;
    if (state.loading) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          {t("agents.providers.testing")}
        </span>
      );
    }
    if (!state.result) return null;
    if (state.result.status === "ok") {
      return (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {t("agents.providers.testOk", {
            count: state.result.modelCount ?? 0,
            latency: state.result.latencyMs ?? 0,
          })}
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-destructive">
        {t(`agents.providers.testStatus.${state.result.status}`)}
      </span>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-56 items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        {t("agents.loadingModelConfig")}
      </div>
    );
  }

  const providers = list?.providers ?? [];
  const activeThirdPartyId =
    providers.find((provider) => provider.isActive)?.id ?? null;
  const selectionIsValid =
    selection === BUILT_IN_SELECTION ||
    (selection !== null &&
      providers.some((provider) => provider.id === selection));
  const selectedId =
    selection !== null && selectionIsValid
      ? selection
      : (activeThirdPartyId ?? BUILT_IN_SELECTION);
  const selectedProvider =
    selectedId === BUILT_IN_SELECTION
      ? null
      : (providers.find((provider) => provider.id === selectedId) ?? null);
  const isBuiltInActive = list === null || list.activeProvider === "openai";
  const credentialStatus = config?.credentialStatus ?? "unknown";

  function renderBuiltInItem(): ReactNode {
    return (
      <li>
        <button
          type="button"
          onClick={() => setSelection(BUILT_IN_SELECTION)}
          aria-current={selectedId === BUILT_IN_SELECTION}
          className={`block w-full border-l-2 px-4 py-3 text-left ${
            selectedId === BUILT_IN_SELECTION
              ? "border-primary bg-accent"
              : "border-transparent hover:bg-accent/60"
          }`}
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {isCodex
                ? t("agents.providerDetail.openaiSubscription")
                : t("agents.platformDefault")}
            </span>
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("agents.providerDetail.builtInBadge")}
            </span>
            {isBuiltInActive ? renderActiveBadge() : null}
          </span>
          <span
            className={`mt-1 block text-xs ${credentialStatusClass(credentialStatus)}`}
          >
            {t(`agents.credentialStatus.${credentialStatus}`)}
          </span>
        </button>
      </li>
    );
  }

  function renderProviderItem(provider: AgentCodexProvider): ReactNode {
    const isSelected = selectedId === provider.id;
    return (
      <li key={provider.id}>
        <button
          type="button"
          onClick={() => setSelection(provider.id)}
          aria-current={isSelected}
          className={`block w-full border-l-2 px-4 py-3 text-left ${
            isSelected
              ? "border-primary bg-accent"
              : "border-transparent hover:bg-accent/60"
          }`}
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {provider.name}
            </span>
            {provider.isActive ? renderActiveBadge() : null}
          </span>
          <span className="mt-1 block">{renderKeyReadiness(provider)}</span>
        </button>
      </li>
    );
  }

  function renderBuiltInDetail(): ReactNode {
    return (
      <>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <CpuIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <h2 className="text-sm font-semibold text-foreground">
            {isCodex
              ? t("agents.providerDetail.openaiSubscription")
              : t("agents.platformDefault")}
          </h2>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {t("agents.providerDetail.builtInBadge")}
          </span>
          {isBuiltInActive ? renderActiveBadge() : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-sm font-semibold text-foreground">
              {t("agents.nativeModelConfig")}
            </h3>
            <dl className="mt-2">
              <DetailRow
                label={t("agents.provider")}
                value={config?.provider || t("agents.platformDefault")}
              />
              <DetailRow
                label={t("agents.endpoint")}
                value={config?.endpoint || t("agents.platformDefault")}
              />
              <DetailRow
                label={t("agents.credentials")}
                value={t(`agents.credentialStatus.${credentialStatus}`)}
              />
              <DetailRow
                label={t("agents.configSource")}
                value={config?.sourceRelativePath || t("agents.notAvailable")}
              />
            </dl>
          </section>

          <section className="mt-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("agents.modelSelection")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("agents.modelSelectionDesc")}
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-foreground">
                  {t("agents.defaultModel")}
                </span>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  list={`agent-models-${agent.id}`}
                  disabled={!config?.canSetModel || isSaving}
                  className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  placeholder={t("agents.modelPlaceholder")}
                />
                <datalist id={`agent-models-${agent.id}`}>
                  {config?.availableModels.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              {agent.id === "opencode" ? (
                <label className="block">
                  <span className="text-xs font-semibold text-foreground">
                    {t("agents.secondaryModel")}
                  </span>
                  <input
                    value={secondaryModel}
                    onChange={(event) => setSecondaryModel(event.target.value)}
                    disabled={!config?.canSetModel || isSaving}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                    placeholder={t("agents.optionalModelPlaceholder")}
                  />
                </label>
              ) : null}
            </div>

            {config?.formattingMayChange ? (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                {t("agents.tomlFormattingWarning")}
              </div>
            ) : null}
            {config?.status === "invalid" ? (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-xs text-destructive">
                <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                {t("agents.invalidModelConfig")}
              </div>
            ) : null}
            {error ? (
              <p className="mt-4 text-xs text-destructive">{error}</p>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border/60 pt-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
                {t("agents.secretsStayPrivate")}
              </span>
              <div className="flex items-center gap-3">
                {saved ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2Icon className="h-4 w-4" />
                    {t("agents.modelSaved")}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void saveModel()}
                  disabled={!config?.canSetModel || !model.trim() || isSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <SaveIcon className="h-4 w-4" />
                  )}
                  {t("agents.saveModel")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  function renderProviderDetail(provider: AgentCodexProvider): ReactNode {
    const isPendingDefault = pendingDefaultId === provider.id;
    return (
      <>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <ServerIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <h2 className="text-sm font-semibold text-foreground">
            {provider.name}
          </h2>
          <span className="text-xs text-muted-foreground">{provider.id}</span>
          {provider.isActive ? renderActiveBadge() : null}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {provider.isActive ? (
              <button
                type="button"
                onClick={() => void handleSetDefault("openai")}
                disabled={pendingDefaultId !== null}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                {isPendingDefault ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("agents.providers.restoreOpenai")}
              </button>
            ) : (
              <button
                type="button"
                aria-label={t("agents.providers.setDefaultNamed", {
                  name: provider.name,
                })}
                onClick={() => void handleSetDefault(provider.id)}
                disabled={pendingDefaultId !== null}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                {isPendingDefault ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <StarIcon className="h-3.5 w-3.5" />
                )}
                {t("agents.providers.setDefault")}
              </button>
            )}
            <button
              type="button"
              aria-label={t("agents.providers.testNamed", {
                name: provider.name,
              })}
              onClick={() => void handleTest(provider.id)}
              disabled={testStates[provider.id]?.loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <ZapIcon className="h-3.5 w-3.5" />
              {t("agents.providers.test")}
            </button>
            <button
              type="button"
              aria-label={t("agents.providers.editNamed", {
                name: provider.name,
              })}
              onClick={() => setDialogState({ mode: "edit", provider })}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {t("common.edit")}
            </button>
            <button
              type="button"
              aria-label={t("agents.providers.deleteNamed", {
                name: provider.name,
              })}
              onClick={() => setDeleteTarget(provider)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2Icon className="h-3.5 w-3.5" />
              {t("common.delete")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {actionError ? (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-xs text-destructive">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          ) : null}

          <dl>
            <DetailRow
              label={t("agents.providers.form.baseUrl")}
              value={provider.baseUrl}
            />
            <DetailRow
              label={t("agents.providers.form.wireApiLabel")}
              value={t(`agents.providers.wireApiBadge.${provider.wireApi}`)}
            />
            <DetailRow
              label={t("agents.providerDetail.keyLabel")}
              value={renderKeyReadiness(provider)}
            />
            {provider.profileModel ? (
              <DetailRow
                label={t("agents.providerDetail.profileModelLabel")}
                value={provider.profileModel}
              />
            ) : null}
          </dl>

          {provider.profileModel ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t("agents.providerDetail.profileUsage", { id: provider.id })}
            </p>
          ) : null}

          <div className="mt-3">{renderTestState(provider.id)}</div>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-64 shrink-0 flex-col border-r border-border">
        <nav
          aria-label={t("agents.providerDetail.listLabel")}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <ul>
            {renderBuiltInItem()}
            {providers.map(renderProviderItem)}
          </ul>
          {isCodex && isLoadingProviders ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              {t("agents.providers.loading")}
            </div>
          ) : null}
          {loadError ? (
            <div className="flex flex-col items-start gap-2 px-4 py-3">
              <span className="text-xs text-destructive">{loadError}</span>
              <button
                type="button"
                onClick={() => void loadProviders()}
                className="inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}
        </nav>
        {isCodex ? (
          <div className="shrink-0 border-t border-border p-3">
            <button
              type="button"
              onClick={() => setDialogState({ mode: "add" })}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent"
            >
              <PlusIcon className="h-4 w-4" />
              {t("agents.providers.add")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedProvider
          ? renderProviderDetail(selectedProvider)
          : renderBuiltInDetail()}
      </div>

      {dialogState ? (
        <AgentCodexProviderFormDialog
          key={dialogState.mode === "edit" ? dialogState.provider.id : "add"}
          isOpen
          agentId={agent.id}
          provider={dialogState.mode === "edit" ? dialogState.provider : null}
          onClose={() => setDialogState(null)}
          onSaved={(next) => {
            setList(next);
            setDialogState(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title={t("agents.providers.deleteConfirmTitle")}
        message={t("agents.providers.deleteConfirmMessage", {
          name: deleteTarget?.name ?? "",
        })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
