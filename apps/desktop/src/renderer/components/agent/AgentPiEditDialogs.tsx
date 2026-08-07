import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AgentModelCatalogEntry,
  AgentModelCatalogProvider,
  AgentPiCustomModelInput,
  AgentPiCustomProviderUpdateInput,
  AgentPiProviderApi,
} from "@prompthub/shared/types";
import { Button, Input, Modal } from "../ui";

const PI_APIS: AgentPiProviderApi[] = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
];

export function EditPiProviderDialog({
  provider,
  busy,
  onClose,
  onSubmit,
}: {
  provider: AgentModelCatalogProvider;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: AgentPiCustomProviderUpdateInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState(provider.endpoint ?? "");
  const [api, setApi] = useState<AgentPiProviderApi>(
    provider.api ?? "openai-completions",
  );
  const endpointValid = /^https?:\/\//.test(baseUrl.trim());

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("agents.piModels.form.editProviderTitle")}
      size="md"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      <div className="space-y-4">
        <Input
          label={t("agents.piModels.form.providerId")}
          value={provider.id}
          disabled
        />
        <Input
          label={t("agents.piModels.form.baseUrl")}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          disabled={busy}
          error={
            baseUrl.length > 0 && !endpointValid
              ? t("agents.piModels.form.endpointInvalid")
              : undefined
          }
        />
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-foreground">
            {t("agents.piModels.form.api")}
          </span>
          <select
            aria-label={t("agents.piModels.form.api")}
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
      </div>
      <DialogActions
        busy={busy}
        disabled={!endpointValid}
        onClose={onClose}
        onSave={() =>
          onSubmit({
            providerId: provider.id,
            baseUrl: baseUrl.trim(),
            api,
          })
        }
      />
    </Modal>
  );
}

export function EditPiModelDialog({
  model,
  busy,
  onClose,
  onSubmit,
}: {
  model: AgentModelCatalogEntry;
  busy: boolean;
  onClose: () => void;
  onSubmit: (model: AgentPiCustomModelInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [id, setId] = useState(model.id);
  const [name, setName] = useState(model.name ?? "");
  const [contextWindow, setContextWindow] = useState(
    model.contextWindow ? String(model.contextWindow) : "",
  );
  const [maxTokens, setMaxTokens] = useState(
    model.maxTokens ? String(model.maxTokens) : "",
  );
  const [reasoning, setReasoning] = useState(model.reasoning ?? false);
  const positiveInteger = (value: string) =>
    value === "" || (Number.isSafeInteger(Number(value)) && Number(value) > 0);
  const valid =
    id.trim().length > 0 &&
    positiveInteger(contextWindow) &&
    positiveInteger(maxTokens);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("agents.piModels.form.editModelTitle")}
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
        />
        <Input
          label={t("agents.piModels.form.modelName")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("agents.piModels.form.contextWindow")}
            type="number"
            min={1}
            value={contextWindow}
            onChange={(event) => setContextWindow(event.target.value)}
            disabled={busy}
            error={
              !positiveInteger(contextWindow)
                ? t("agents.piModels.form.contextInvalid")
                : undefined
            }
          />
          <Input
            label={t("agents.piModels.form.maxTokens")}
            type="number"
            min={1}
            value={maxTokens}
            onChange={(event) => setMaxTokens(event.target.value)}
            disabled={busy}
            error={
              !positiveInteger(maxTokens)
                ? t("agents.piModels.form.contextInvalid")
                : undefined
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={reasoning}
            onChange={(event) => setReasoning(event.target.checked)}
            disabled={busy}
          />
          {t("agents.piModels.form.reasoning")}
        </label>
      </div>
      <DialogActions
        busy={busy}
        disabled={!valid}
        onClose={onClose}
        onSave={() =>
          onSubmit({
            id: id.trim(),
            ...(name.trim() ? { name: name.trim() } : {}),
            ...(contextWindow ? { contextWindow: Number(contextWindow) } : {}),
            ...(maxTokens ? { maxTokens: Number(maxTokens) } : {}),
            reasoning,
          })
        }
      />
    </Modal>
  );
}

function DialogActions({
  busy,
  disabled,
  onClose,
  onSave,
}: {
  busy: boolean;
  disabled: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {t("common.cancel")}
      </Button>
      <Button onClick={() => void onSave()} disabled={busy || disabled}>
        {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
        {t("common.save")}
      </Button>
    </div>
  );
}
