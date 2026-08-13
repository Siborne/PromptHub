import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRoundIcon, Loader2Icon, ShieldAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentModelCatalogEntry,
  AgentModelCatalogProvider,
  AgentModelConfiguration,
  AgentPiProviderApi,
  AgentPiThinkingLevel,
  AgentProviderModelTestResult,
  AgentProviderSourceCandidate,
  ImportAgentProviderSourceRequest,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { Button, ConfirmDialog, Input, Modal } from "../ui";
import { EditPiModelDialog, EditPiProviderDialog } from "./AgentPiEditDialogs";
import { AgentPiProviderDetail } from "./AgentPiProviderDetail";
import { AgentProviderSourceDialog } from "./AgentProviderSourceDialog";
import {
  AgentProviderContextMenu,
  AgentProviderToolbarActions,
  type AgentProviderContextMenuPosition,
} from "./AgentProviderWorkbenchActions";
import {
  AgentProviderWorkbenchLayout,
  providerWorkbenchListItemClass,
} from "./AgentProviderWorkbenchLayout";

const PI_APIS: AgentPiProviderApi[] = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
];

type DialogState =
  | { kind: "add-provider" }
  | { kind: "add-model"; providerId: string }
  | { kind: "edit-provider"; provider: AgentModelCatalogProvider }
  | {
      kind: "edit-model";
      providerId: string;
      model: AgentModelCatalogEntry;
    }
  | { kind: "set-credential"; providerId: string }
  | { kind: "remove-provider"; providerId: string }
  | { kind: "remove-model"; providerId: string; modelId: string }
  | { kind: "test-model"; providerId: string; modelId: string }
  | null;

function formatContextWindow(value?: number): string | null {
  if (!value) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function AgentPiModelCatalogPanel({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AgentModelConfiguration | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] =
    useState<AgentProviderContextMenuPosition | null>(null);
  const [sourceCandidates, setSourceCandidates] = useState<
    AgentProviderSourceCandidate[]
  >([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [modelTestResult, setModelTestResult] = useState<{
    modelId: string;
    result: AgentProviderModelTestResult;
  } | null>(null);
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setErrorCode(null);
    try {
      const next = await window.api.agent.getModelConfig("pi");
      if (loadGenerationRef.current === generation) {
        setConfig(next);
      }
    } catch {
      if (loadGenerationRef.current === generation) {
        setErrorCode("AGENT_PI_MODELS_LOAD_FAILED");
      }
    }
  }, []);

  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    setErrorCode(null);
    try {
      const candidates = await window.api.agent.listProviderSources("pi");
      setSourceCandidates(candidates);
      return candidates;
    } catch {
      setErrorCode("AGENT_PI_MODELS_OPERATION_FAILED");
      setSourceCandidates([]);
      return [];
    } finally {
      setSourceLoading(false);
    }
  }, []);

  const importSource = useCallback(
    async (request: ImportAgentProviderSourceRequest) => {
      setBusyAction("import-source");
      setErrorCode(null);
      try {
        const result = await window.api.agent.importPiProviderSource(request);
        await load();
        return result;
      } catch {
        setErrorCode("AGENT_PI_MODELS_OPERATION_FAILED");
        return null;
      } finally {
        setBusyAction(null);
      }
    },
    [load],
  );

  useEffect(() => {
    setConfig(null);
    setSelectedProviderId(null);
    void load();
  }, [agent.id, load]);

  const catalog = useMemo(() => config?.modelCatalog ?? [], [config]);
  const selectedProvider = useMemo(
    () =>
      catalog.find((provider) => provider.id === selectedProviderId) ?? null,
    [catalog, selectedProviderId],
  );
  useEffect(() => {
    if (selectedProvider || catalog.length === 0) return;
    const defaultProvider = catalog.find(
      (provider) => provider.id === config?.provider,
    );
    setSelectedProviderId(defaultProvider?.id ?? catalog[0].id);
  }, [catalog, config?.provider, selectedProvider]);

  async function runAction(
    action: string,
    operation: () => Promise<unknown>,
  ): Promise<boolean> {
    setBusyAction(action);
    setErrorCode(null);
    try {
      await operation();
      await load();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setErrorCode(
        /^AGENT_(PI|MODEL)_[A-Z0-9_]+$/.test(message)
          ? message
          : "AGENT_PI_MODELS_OPERATION_FAILED",
      );
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function setDefault(providerId: string, modelId: string) {
    await runAction("set-default", () =>
      window.api.agent.setModelConfig({
        agentId: "pi",
        model: `${providerId}/${modelId}`,
        thinkingLevel: config?.thinkingLevel ?? undefined,
      }),
    );
  }

  async function testModel(providerId: string, modelId: string) {
    setBusyAction(`test-model:${modelId}`);
    setErrorCode(null);
    try {
      const result = await window.api.agent.testPiModel({
        agentId: "pi",
        providerId,
        modelId,
      });
      setModelTestResult({ modelId, result });
      setDialog(null);
    } catch {
      setErrorCode("AGENT_PI_MODELS_OPERATION_FAILED");
    } finally {
      setBusyAction(null);
    }
  }

  async function setThinkingLevel(level: AgentPiThinkingLevel) {
    if (!config?.model) return;
    await runAction("set-thinking", () =>
      window.api.agent.setModelConfig({
        agentId: "pi",
        model: `${config.provider ?? ""}/${config.model}`,
        thinkingLevel: level,
      }),
    );
  }

  return (
    <>
      <AgentProviderWorkbenchLayout
        toolbar={
          <AgentProviderToolbarActions
            busy={busyAction !== null}
            onAdd={() => setDialog({ kind: "add-provider" })}
            onImport={() => setSourceDialogOpen(true)}
          />
        }
        sidebar={
          <nav
            aria-label={t("agents.piModels.listLabel")}
            className="h-full min-h-0 overflow-x-hidden overflow-y-auto p-1"
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenuPosition({
                x: event.clientX,
                y: event.clientY,
              });
            }}
          >
            {catalog.length === 0 ? (
              <p className="px-4 py-4 text-xs leading-5 text-muted-foreground">
                {t("agents.piModels.empty")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {catalog.map((provider) => {
                  const isDefault = provider.id === config?.provider;
                  const selected = provider.id === selectedProviderId;
                  return (
                    <li key={provider.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedProviderId(provider.id)}
                        aria-current={selected}
                        className={providerWorkbenchListItemClass(
                          selected,
                          "px-3 py-2.5",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {provider.id}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-[11px]">
                            {isDefault ? (
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {t("agents.piModels.currentDefault")}
                              </span>
                            ) : null}
                            {provider.source === "custom" ? (
                              <span className="text-muted-foreground">
                                {t("agents.piModels.customTag")}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {t("agents.piModels.modelsCount", {
                              count: provider.models.length,
                            })}
                          </span>
                          {provider.credentialReady ? (
                            <KeyRoundIcon
                              className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                              aria-label={t("agents.piModels.credentialReady")}
                            />
                          ) : (
                            <ShieldAlertIcon
                              className="h-3 w-3 text-amber-600 dark:text-amber-400"
                              aria-label={t(
                                "agents.piModels.credentialMissing",
                              )}
                            />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        }
      >
        {errorCode ? (
          <div
            role="alert"
            className="border-b border-destructive/30 bg-destructive/[0.06] px-5 py-2.5 text-xs text-destructive"
          >
            {t("agents.piModels.errors.operation")}
          </div>
        ) : null}
        {selectedProvider ? (
          <AgentPiProviderDetail
            provider={selectedProvider}
            currentModel={config?.model ?? null}
            thinkingLevel={config?.thinkingLevel ?? null}
            isDefaultProvider={selectedProvider.id === config?.provider}
            busyAction={busyAction}
            modelTestResult={modelTestResult}
            onSetThinking={setThinkingLevel}
            onSetDefault={setDefault}
            onAddModel={() =>
              setDialog({ kind: "add-model", providerId: selectedProvider.id })
            }
            onSetCredential={() =>
              setDialog({
                kind: "set-credential",
                providerId: selectedProvider.id,
              })
            }
            onEditProvider={() =>
              setDialog({ kind: "edit-provider", provider: selectedProvider })
            }
            onTestModel={(modelId) =>
              setDialog({
                kind: "test-model",
                providerId: selectedProvider.id,
                modelId,
              })
            }
            onEditModel={(model) =>
              setDialog({
                kind: "edit-model",
                providerId: selectedProvider.id,
                model,
              })
            }
            onRemoveProvider={() =>
              setDialog({
                kind: "remove-provider",
                providerId: selectedProvider.id,
              })
            }
            onRemoveModel={(modelId) =>
              setDialog({
                kind: "remove-model",
                providerId: selectedProvider.id,
                modelId,
              })
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-sm">
              <KeyRoundIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <h2 className="mt-3 text-sm font-semibold text-foreground">
                {t("agents.piModels.emptyTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("agents.piModels.emptyHint")}
              </p>
            </div>
          </div>
        )}
      </AgentProviderWorkbenchLayout>

      <AgentProviderContextMenu
        busy={busyAction !== null}
        position={contextMenuPosition}
        onAdd={() => setDialog({ kind: "add-provider" })}
        onImport={() => setSourceDialogOpen(true)}
        onClose={() => setContextMenuPosition(null)}
      />

      <AgentProviderSourceDialog
        isOpen={sourceDialogOpen}
        platformId="pi"
        candidates={sourceCandidates}
        loading={sourceLoading}
        importing={busyAction === "import-source"}
        onLoad={loadSources}
        onImport={importSource}
        onClose={() => setSourceDialogOpen(false)}
      />

      <AddProviderDialog
        open={dialog?.kind === "add-provider"}
        busy={busyAction === "add-provider"}
        onClose={() => setDialog(null)}
        onSubmit={async (input) => {
          const succeeded = await runAction("add-provider", async () => {
            const result = await window.api.agent.addPiProvider({
              agentId: "pi",
              ...input,
            });
            if (input.credential?.mode === "managed") {
              await window.api.agent.setPiCredential({
                agentId: "pi",
                providerId: input.providerId,
                secret: input.credential.secret,
              });
            }
            return result;
          });
          if (succeeded) setDialog(null);
        }}
      />
      {dialog?.kind === "add-model" ? (
        <AddModelDialog
          open
          providerId={dialog.providerId}
          busy={busyAction === "add-model"}
          onClose={() => setDialog(null)}
          onSubmit={async (model) => {
            const succeeded = await runAction("add-model", () =>
              window.api.agent.addPiModel({
                agentId: "pi",
                providerId: dialog.providerId,
                model,
              }),
            );
            if (succeeded) setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "edit-provider" ? (
        <EditPiProviderDialog
          provider={dialog.provider}
          busy={busyAction === "edit-provider"}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const succeeded = await runAction("edit-provider", () =>
              window.api.agent.updatePiProvider({ agentId: "pi", ...input }),
            );
            if (succeeded) setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "edit-model" ? (
        <EditPiModelDialog
          model={dialog.model}
          busy={busyAction === "edit-model"}
          onClose={() => setDialog(null)}
          onSubmit={async (model) => {
            const succeeded = await runAction("edit-model", () =>
              window.api.agent.updatePiModel({
                agentId: "pi",
                providerId: dialog.providerId,
                model: { originalId: dialog.model.id, ...model },
              }),
            );
            if (succeeded) setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "set-credential" ? (
        <SetCredentialDialog
          open
          busy={busyAction === "set-credential"}
          onClose={() => setDialog(null)}
          onSubmit={async (secret) => {
            const succeeded = await runAction("set-credential", () =>
              window.api.agent.setPiCredential({
                agentId: "pi",
                providerId: dialog.providerId,
                secret,
              }),
            );
            if (succeeded) setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === "test-model" ? (
        <ConfirmDialog
          isOpen
          onClose={() => setDialog(null)}
          onConfirm={() => {
            void testModel(dialog.providerId, dialog.modelId);
          }}
          title={t("agents.piModels.testModelConfirmTitle")}
          message={t("agents.piModels.testModelConfirmMessage", {
            model: dialog.modelId,
          })}
          confirmText={t("agents.piModels.testModel")}
          cancelText={t("common.cancel")}
          isLoading={busyAction === `test-model:${dialog.modelId}`}
        />
      ) : null}
      {dialog?.kind === "remove-provider" ? (
        <ConfirmDialog
          isOpen
          onClose={() => setDialog(null)}
          onConfirm={() => {
            void runAction("remove-provider", () =>
              window.api.agent.removePiProvider({
                agentId: "pi",
                providerId: dialog.providerId,
              }),
            ).then((succeeded) => {
              if (succeeded) {
                setDialog(null);
                setSelectedProviderId(null);
              }
            });
          }}
          title={t("agents.piModels.removeProviderTitle")}
          message={t("agents.piModels.removeProviderMessage", {
            provider: dialog.providerId,
          })}
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
          variant="destructive"
          isLoading={busyAction === "remove-provider"}
        />
      ) : null}
      {dialog?.kind === "remove-model" ? (
        <ConfirmDialog
          isOpen
          onClose={() => setDialog(null)}
          onConfirm={() => {
            void runAction("remove-model", () =>
              window.api.agent.removePiModel({
                agentId: "pi",
                providerId: dialog.providerId,
                modelId: dialog.modelId,
              }),
            ).then((succeeded) => {
              if (succeeded) setDialog(null);
            });
          }}
          title={t("agents.piModels.removeModelTitle")}
          message={t("agents.piModels.removeModelMessage", {
            model: dialog.modelId,
          })}
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
          variant="destructive"
          isLoading={busyAction === "remove-model"}
        />
      ) : null}
    </>
  );
}

function AddProviderDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: {
    providerId: string;
    baseUrl: string;
    api: AgentPiProviderApi;
    apiKeyRef?: string;
    models: { id: string }[];
    credential?:
      | { mode: "managed"; secret: string }
      | { mode: "env"; envKey: string };
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [providerId, setProviderId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [api, setApi] = useState<AgentPiProviderApi>("openai-completions");
  const [modelId, setModelId] = useState("");
  const [credentialMode, setCredentialMode] = useState<
    "managed" | "env" | "none"
  >("managed");
  const [secret, setSecret] = useState("");
  const [envKey, setEnvKey] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setProviderId("");
      setBaseUrl("");
      setApi("openai-completions");
      setModelId("");
      setCredentialMode("managed");
      setSecret("");
      setEnvKey("");
      setSubmitted(false);
    }
  }, [open]);

  const providerIdValid = /^[a-z0-9]([a-z0-9._-]{0,126}[a-z0-9])?$/.test(
    providerId.trim(),
  );
  const modelIdValid = modelId.trim().length > 0;
  const endpointValid = /^https?:\/\//.test(baseUrl.trim());
  const secretValid = credentialMode !== "managed" || secret.length > 0;
  const envKeyValid =
    credentialMode !== "env" || /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(envKey);
  const formValid =
    providerIdValid &&
    modelIdValid &&
    endpointValid &&
    secretValid &&
    envKeyValid;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t("agents.piModels.form.providerTitle")}
      size="lg"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("agents.piModels.form.providerId")}
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            disabled={busy}
            placeholder="ollama"
            error={
              submitted && !providerIdValid
                ? t("agents.piModels.form.providerIdInvalid")
                : undefined
            }
          />
          <Input
            label={t("agents.piModels.form.baseUrl")}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            disabled={busy}
            placeholder="http://localhost:11434/v1"
            error={
              submitted && !endpointValid
                ? t("agents.piModels.form.endpointInvalid")
                : undefined
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t("agents.piModels.form.api")}
            </span>
            <select
              value={api}
              onChange={(event) =>
                setApi(event.target.value as AgentPiProviderApi)
              }
              disabled={busy}
              className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              {PI_APIS.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {candidate}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={t("agents.piModels.form.firstModel")}
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={busy}
            placeholder="llama3.1:8b"
            error={
              submitted && !modelIdValid
                ? t("agents.piModels.form.required")
                : undefined
            }
          />
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <span className="block text-sm font-medium text-foreground">
            {t("agents.piModels.form.credentialMode")}
          </span>
          <div className="flex flex-wrap gap-2">
            {(["managed", "env", "none"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCredentialMode(mode)}
                disabled={busy}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  credentialMode === mode
                    ? "border-primary/60 bg-primary/[0.08] text-primary"
                    : "border-border text-muted-foreground hover:bg-accent/40"
                }`}
              >
                {t(`agents.piModels.form.credentialModes.${mode}`)}
              </button>
            ))}
          </div>
          {credentialMode === "managed" ? (
            <Input
              label={t("agents.piModels.form.apiKey")}
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              disabled={busy}
              error={
                submitted && !secretValid
                  ? t("agents.piModels.form.required")
                  : undefined
              }
            />
          ) : null}
          {credentialMode === "env" ? (
            <Input
              label={t("agents.piModels.form.envKey")}
              value={envKey}
              onChange={(event) => setEnvKey(event.target.value)}
              disabled={busy}
              placeholder="OLLAMA_API_KEY"
              error={
                submitted && !envKeyValid
                  ? t("agents.piModels.form.envKeyInvalid")
                  : undefined
              }
            />
          ) : null}
          {credentialMode === "managed" ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {t("agents.piModels.form.secretWriteOnly")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => {
            setSubmitted(true);
            if (!formValid) return;
            void onSubmit({
              providerId: providerId.trim(),
              baseUrl: baseUrl.trim(),
              api,
              ...(credentialMode === "env" && envKey
                ? { apiKeyRef: `$${envKey}` }
                : {}),
              models: [{ id: modelId.trim() }],
              ...(credentialMode === "managed" && secret
                ? { credential: { mode: "managed" as const, secret } }
                : {}),
            });
          }}
          disabled={busy}
        >
          {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
          {t("agents.piModels.form.create")}
        </Button>
      </div>
    </Modal>
  );
}

function AddModelDialog({
  open,
  providerId,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  providerId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (model: {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    reasoning?: boolean;
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [reasoning, setReasoning] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setId("");
      setName("");
      setContextWindow("");
      setMaxTokens("");
      setReasoning(false);
      setSubmitted(false);
    }
  }, [open]);

  const idValid = id.trim().length > 0;
  const contextValid =
    contextWindow.trim() === "" ||
    (Number.isSafeInteger(Number(contextWindow)) && Number(contextWindow) > 0);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t("agents.piModels.form.modelTitle")}
      size="md"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      <div className="space-y-4">
        <Input
          label={t("agents.piModels.form.modelId")}
          value={id}
          onChange={(event) => setId(event.target.value)}
          disabled={busy}
          placeholder="qwen2.5-coder:7b"
          error={
            submitted && !idValid
              ? t("agents.piModels.form.required")
              : undefined
          }
        />
        <Input
          label={t("agents.piModels.form.modelName")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
        />
        <Input
          label={t("agents.piModels.form.maxTokens")}
          type="number"
          min={1}
          value={maxTokens}
          onChange={(event) => setMaxTokens(event.target.value)}
          disabled={busy}
        />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={reasoning}
            onChange={(event) => setReasoning(event.target.checked)}
            disabled={busy}
          />
          {t("agents.piModels.form.reasoning")}
        </label>
        <Input
          label={t("agents.piModels.form.contextWindow")}
          type="number"
          min={1}
          value={contextWindow}
          onChange={(event) => setContextWindow(event.target.value)}
          disabled={busy}
          error={
            submitted && !contextValid
              ? t("agents.piModels.form.contextInvalid")
              : undefined
          }
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => {
            setSubmitted(true);
            if (!idValid || !contextValid) return;
            void onSubmit({
              id: id.trim(),
              ...(name.trim() ? { name: name.trim() } : {}),
              ...(contextWindow.trim()
                ? { contextWindow: Number(contextWindow) }
                : {}),
              ...(maxTokens.trim() ? { maxTokens: Number(maxTokens) } : {}),
              ...(reasoning ? { reasoning: true } : {}),
            });
          }}
          disabled={busy}
        >
          {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
          {t("agents.piModels.form.create")}
        </Button>
      </div>
    </Modal>
  );
}

function SetCredentialDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (secret: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [secret, setSecret] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setSecret("");
      setSubmitted(false);
    }
  }, [open]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t("agents.piModels.form.credentialTitle")}
      size="md"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      <Input
        label={t("agents.piModels.form.apiKey")}
        type="password"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        disabled={busy}
        error={
          submitted && !secret ? t("agents.piModels.form.required") : undefined
        }
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {t("agents.piModels.form.secretWriteOnly")}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => {
            setSubmitted(true);
            if (!secret) return;
            void onSubmit(secret);
          }}
          disabled={busy}
        >
          {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
          {t("agents.piModels.form.saveCredential")}
        </Button>
      </div>
    </Modal>
  );
}
