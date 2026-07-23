import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentCodexProvider,
  AgentCodexProviderList,
  UpsertAgentCodexProviderInput,
} from "@prompthub/shared/types";
import { Button, Input, Modal } from "../ui";

const PROVIDER_ID_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

type AuthMode = "managed" | "env";
type WireApi = "chat" | "responses";

interface FormErrors {
  providerId?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  envKey?: string;
}

interface AgentCodexProviderFormDialogProps {
  isOpen: boolean;
  agentId: string;
  /** null opens the dialog in add mode; a provider opens it in edit mode. */
  provider: AgentCodexProvider | null;
  onClose: () => void;
  onSaved: (next: AgentCodexProviderList) => void;
}

export function AgentCodexProviderFormDialog({
  isOpen,
  agentId,
  provider,
  onClose,
  onSaved,
}: AgentCodexProviderFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = provider !== null;

  const [providerId, setProviderId] = useState(provider?.id ?? "");
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [wireApi, setWireApi] = useState<WireApi>(provider?.wireApi ?? "chat");
  const [authMode, setAuthMode] = useState<AuthMode>(
    provider?.keySource === "env" ? "env" : "managed",
  );
  const [apiKey, setApiKey] = useState("");
  const [envKey, setEnvKey] = useState(provider?.envKey ?? "");
  const [profileModel, setProfileModel] = useState(
    provider?.profileModel ?? "",
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveId = isEdit ? provider.id : providerId.trim();

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!isEdit) {
      if (!providerId.trim()) {
        next.providerId = t("agents.providers.form.fieldRequired", {
          field: t("agents.providers.form.providerId"),
        });
      } else if (!PROVIDER_ID_PATTERN.test(providerId.trim())) {
        next.providerId = t("agents.providers.form.providerIdInvalid");
      }
    }
    if (!name.trim()) {
      next.name = t("agents.providers.form.fieldRequired", {
        field: t("agents.providers.form.name"),
      });
    }
    if (!baseUrl.trim()) {
      next.baseUrl = t("agents.providers.form.fieldRequired", {
        field: t("agents.providers.form.baseUrl"),
      });
    }
    if (authMode === "env") {
      if (!envKey.trim()) {
        next.envKey = t("agents.providers.form.envKeyRequired");
      }
    } else if (!isEdit && !apiKey.trim()) {
      next.apiKey = t("agents.providers.form.apiKeyRequired");
    }
    return next;
  }

  async function handleSubmit(): Promise<void> {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const input: UpsertAgentCodexProviderInput = {
      agentId,
      providerId: effectiveId,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      wireApi,
      ...(authMode === "env"
        ? { envKey: envKey.trim() }
        : {
            envKey: null,
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          }),
      profileModel: profileModel.trim() || null,
    };

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const next = await window.api.agent.upsertProvider(input);
      onSaved(next);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : t("agents.providers.form.saveFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? t("agents.providers.form.editTitle")
          : t("agents.providers.form.addTitle")
      }
      size="lg"
    >
      <div className="space-y-4">
        <Input
          label={t("agents.providers.form.providerId")}
          value={providerId}
          onChange={(event) => setProviderId(event.target.value)}
          placeholder="deepseek"
          disabled={isEdit || isSubmitting}
          error={errors.providerId}
        />
        <Input
          label={t("agents.providers.form.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="DeepSeek"
          disabled={isSubmitting}
          error={errors.name}
        />
        <Input
          label={t("agents.providers.form.baseUrl")}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://api.example.com/v1"
          disabled={isSubmitting}
          error={errors.baseUrl}
        />

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {t("agents.providers.form.wireApiLabel")}
          </legend>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="codex-provider-wire-api"
                checked={wireApi === "chat"}
                onChange={() => setWireApi("chat")}
                disabled={isSubmitting}
              />
              {t("agents.providers.form.wireApiChat")}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="codex-provider-wire-api"
                checked={wireApi === "responses"}
                onChange={() => setWireApi("responses")}
                disabled={isSubmitting}
              />
              {t("agents.providers.form.wireApiResponses")}
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            {t("agents.providers.form.authLabel")}
          </legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="codex-provider-auth"
                checked={authMode === "managed"}
                onChange={() => setAuthMode("managed")}
                disabled={isSubmitting}
              />
              {t("agents.providers.form.authManaged")}
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="radio"
                name="codex-provider-auth"
                checked={authMode === "env"}
                onChange={() => setAuthMode("env")}
                disabled={isSubmitting}
              />
              {t("agents.providers.form.authEnv")}
            </label>
          </div>
        </fieldset>

        {authMode === "managed" ? (
          <Input
            label={t("agents.providers.form.apiKey")}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              isEdit ? t("agents.providers.form.apiKeyKeep") : "sk-..."
            }
            disabled={isSubmitting}
            error={errors.apiKey}
            autoComplete="off"
          />
        ) : (
          <Input
            label={t("agents.providers.form.envKey")}
            value={envKey}
            onChange={(event) => setEnvKey(event.target.value)}
            placeholder="DEEPSEEK_API_KEY"
            disabled={isSubmitting}
            error={errors.envKey}
          />
        )}

        <div>
          <Input
            label={t("agents.providers.form.profileModel")}
            value={profileModel}
            onChange={(event) => setProfileModel(event.target.value)}
            placeholder="deepseek-chat"
            disabled={isSubmitting}
          />
          {profileModel.trim() && effectiveId ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("agents.providers.form.profileHelp", { id: effectiveId })}
            </p>
          ) : null}
        </div>

        {submitError ? (
          <p className="text-xs text-destructive">{submitError}</p>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : null}
            {t("agents.providers.form.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
