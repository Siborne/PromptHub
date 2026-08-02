import { useEffect, useState } from "react";
import {
  CableIcon,
  KeyRoundIcon,
  Loader2Icon,
  NetworkIcon,
  SaveIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderProfilePublic,
  CreateAgentProviderProfileRequest,
  UpdateAgentProviderProfileRequest,
} from "@prompthub/shared/types";
import { normalizeAgentProviderEndpoint } from "@prompthub/shared/utils/agent-provider-config";
import { Button, Input } from "../ui";
import {
  AgentProviderCredentialField,
  type AgentProviderCredentialAction,
} from "./AgentProviderCredentialField";

interface AgentProviderProfileFormDialogProps {
  isOpen: boolean;
  platformId: string;
  profile: AgentProviderProfilePublic | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (
    request: CreateAgentProviderProfileRequest,
  ) => Promise<AgentProviderProfilePublic | null>;
  onUpdate: (
    request: UpdateAgentProviderProfileRequest,
  ) => Promise<AgentProviderProfilePublic | null>;
}

interface FormState {
  name: string;
  providerKind: string;
  providerId: string;
  credentialEnvKey: string;
  protocol: string;
  endpoint: string;
  primaryModel: string;
  upstreamModel: string;
  maxContextSize: string;
  secondaryModel: string;
  secret: string;
  credentialAction: AgentProviderCredentialAction;
  credentialSource: "managed" | "environment";
}

const CODEX_PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{0,63}$/;
const KIMI_PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const KIMI_PROVIDER_PROTOCOLS: Record<string, string> = {
  kimi: "openai-chat",
  openai: "openai-chat",
  openai_responses: "openai-responses",
  anthropic: "anthropic-messages",
  "google-genai": "google-generative-ai",
  vertexai: "platform-native",
};
const GROK_PROVIDER_PROTOCOLS: Record<string, string> = {
  "openai-compatible": "openai-chat",
  "openai-responses": "openai-responses",
  anthropic: "anthropic-messages",
  grok: "platform-native",
};
const QWEN_PROVIDER_PROTOCOLS: Record<string, string> = {
  openai: "openai-chat",
  anthropic: "anthropic-messages",
  gemini: "google-generative-ai",
  "vertex-ai": "platform-native",
  "qwen-oauth": "platform-native",
};
const QWEN_DEFAULT_ENV_KEYS: Record<string, string> = {
  openai: "DASHSCOPE_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};
const OPENCODE_PROVIDER_PROTOCOLS: Record<string, string> = {
  "openai-compatible": "openai-chat",
  openai: "openai-responses",
  "platform-native": "platform-native",
};
const OPENCODE_PROVIDER_PACKAGES: Record<string, string> = {
  "openai-compatible": "@ai-sdk/openai-compatible",
  openai: "@ai-sdk/openai",
};
const OPENCODE_PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function hasInvalidEndpoint(value: string): boolean {
  if (!value.trim()) return false;
  try {
    normalizeAgentProviderEndpoint(value);
    return false;
  } catch {
    return true;
  }
}

function initialForm(
  platformId: string,
  profile: AgentProviderProfilePublic | null,
): FormState {
  const model = (routeKey: string) =>
    profile?.modelMappings.find((item) => item.routeKey === routeKey)
      ?.modelId ?? "";
  const primary = profile?.modelMappings.find(
    (item) => item.routeKey === "primary",
  );
  return {
    name: profile?.name ?? "",
    providerKind:
      profile?.providerKind ??
      (platformId === "gemini"
        ? "google-gemini"
        : platformId === "grok"
          ? "openai-compatible"
          : platformId === "qwen"
            ? "openai"
            : platformId === "opencode"
              ? "openai-compatible"
              : platformId),
    providerId:
      typeof profile?.config.providerId === "string"
        ? profile.config.providerId
        : typeof profile?.config.legacyProviderId === "string"
          ? profile.config.legacyProviderId
          : "",
    credentialEnvKey:
      typeof profile?.config.envKey === "string"
        ? profile.config.envKey
        : platformId === "gemini"
          ? "GEMINI_API_KEY"
          : platformId === "codex"
            ? "OPENAI_API_KEY"
            : profile?.config.credentialEnvKey === "ANTHROPIC_AUTH_TOKEN"
              ? "ANTHROPIC_AUTH_TOKEN"
              : platformId === "grok"
                ? "XAI_API_KEY"
                : platformId === "qwen"
                  ? "DASHSCOPE_API_KEY"
                  : "ANTHROPIC_API_KEY",
    protocol:
      profile?.protocol ??
      (platformId === "codex"
        ? "openai-responses"
        : platformId === "claude"
          ? "anthropic-messages"
          : platformId === "gemini"
            ? "google-generative-ai"
            : platformId === "grok"
              ? "openai-chat"
              : platformId === "kimi"
                ? "openai-chat"
                : platformId === "qwen"
                  ? "openai-chat"
                  : platformId === "opencode"
                    ? "openai-chat"
                    : "platform-native"),
    endpoint: profile?.endpoint ?? "",
    primaryModel: model("primary"),
    upstreamModel:
      typeof primary?.parameters.upstreamModelId === "string"
        ? primary.parameters.upstreamModelId
        : "",
    maxContextSize:
      typeof primary?.parameters[
        platformId === "grok" ? "contextWindow" : "maxContextSize"
      ] === "number"
        ? String(
            primary.parameters[
              platformId === "grok" ? "contextWindow" : "maxContextSize"
            ],
          )
        : "",
    secondaryModel: model("secondary"),
    secret: "",
    credentialAction: "preserve",
    credentialSource:
      platformId === "codex" && typeof profile?.config.envKey === "string"
        ? "environment"
        : "managed",
  };
}

function modelMappings(form: FormState, platformId: string) {
  return [
    {
      routeKey: "primary",
      modelId: form.primaryModel.trim(),
      parameters:
        platformId === "kimi" || platformId === "grok"
          ? {
              upstreamModelId: form.upstreamModel.trim(),
              [platformId === "grok" ? "contextWindow" : "maxContextSize"]:
                Number(form.maxContextSize),
            }
          : {},
    },
    ...(platformId === "opencode" && form.secondaryModel.trim()
      ? [
          {
            routeKey: "secondary",
            modelId: form.secondaryModel.trim(),
            parameters: {},
          },
        ]
      : []),
  ];
}

export function AgentProviderProfileFormDialog({
  isOpen,
  platformId,
  profile,
  busy,
  onClose,
  onCreate,
  onUpdate,
}: AgentProviderProfileFormDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => initialForm(platformId, profile));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setForm(initialForm(platformId, profile));
    setSubmitted(false);
  }, [isOpen, platformId, profile]);

  const nameMissing = submitted && !form.name.trim();
  const providerMissing = submitted && !form.providerKind.trim();
  const requiresProviderId =
    platformId === "codex" ||
    platformId === "kimi" ||
    platformId === "grok" ||
    platformId === "opencode" ||
    platformId === "qwen";
  const providerIdValueMissing = requiresProviderId && !form.providerId.trim();
  const providerIdMissing = submitted && providerIdValueMissing;
  const providerIdValueInvalid =
    requiresProviderId &&
    Boolean(form.providerId.trim()) &&
    !(
      platformId === "codex"
        ? CODEX_PROVIDER_ID_PATTERN
        : platformId === "opencode"
          ? OPENCODE_PROVIDER_ID_PATTERN
          : KIMI_PROVIDER_ID_PATTERN
    ).test(form.providerId.trim());
  const providerIdInvalid = submitted && providerIdValueInvalid;
  const qwenManaged =
    platformId === "qwen" && form.protocol !== "platform-native";
  const grokManaged =
    platformId === "grok" && form.protocol !== "platform-native";
  const codexManaged =
    platformId === "codex" && form.protocol !== "platform-native";
  const codexEnvironment =
    codexManaged && form.credentialSource === "environment";
  const envKeyValueInvalid =
    (qwenManaged || grokManaged || codexEnvironment) &&
    !ENV_KEY_PATTERN.test(form.credentialEnvKey.trim());
  const envKeyInvalid = submitted && envKeyValueInvalid;
  const openCodeDirect =
    platformId === "opencode" && form.protocol !== "platform-native";
  const codexCustom =
    platformId === "codex" &&
    form.protocol !== "platform-native" &&
    form.providerId.trim() !== "openai";
  const openCodeNativeReadOnly =
    platformId === "opencode" &&
    profile?.source === "native-import" &&
    form.protocol === "platform-native";
  const grokNativeReadOnly =
    platformId === "grok" &&
    profile?.source === "native-import" &&
    form.protocol === "platform-native";
  const endpointValueMissing =
    (qwenManaged || grokManaged || openCodeDirect || codexCustom) &&
    !form.endpoint.trim();
  const endpointMissing = submitted && endpointValueMissing;
  const endpointValueInvalid =
    !endpointValueMissing && hasInvalidEndpoint(form.endpoint);
  const endpointInvalid = submitted && endpointValueInvalid;
  const modelMissing = submitted && !form.primaryModel.trim();
  const upstreamModelValueMissing =
    (platformId === "kimi" || platformId === "grok") &&
    !form.upstreamModel.trim();
  const upstreamModelMissing = submitted && upstreamModelValueMissing;
  const maxContextSizeValueInvalid =
    (platformId === "kimi" || platformId === "grok") &&
    (!form.maxContextSize.trim() ||
      !Number.isSafeInteger(Number(form.maxContextSize)) ||
      Number(form.maxContextSize) < 1 ||
      Number(form.maxContextSize) > 10_000_000);
  const maxContextSizeInvalid = submitted && maxContextSizeValueInvalid;
  const acceptsManagedCredential =
    platformId === "codex"
      ? codexManaged && !codexEnvironment
      : platformId === "claude"
        ? form.protocol === "anthropic-messages"
        : platformId === "gemini"
          ? form.protocol === "google-generative-ai"
          : platformId === "kimi"
            ? form.protocol !== "platform-native"
            : platformId === "grok"
              ? false
              : platformId === "qwen"
                ? form.protocol !== "platform-native"
                : platformId === "opencode"
                  ? form.protocol !== "platform-native"
                  : true;
  const credentialReplacementValueMissing =
    Boolean(profile) &&
    acceptsManagedCredential &&
    form.credentialAction === "replace" &&
    !form.secret;
  const credentialReplacementMissing =
    submitted && credentialReplacementValueMissing;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(): Promise<void> {
    setSubmitted(true);
    if (
      !form.name.trim() ||
      !form.providerKind.trim() ||
      providerIdValueMissing ||
      providerIdValueInvalid ||
      envKeyValueInvalid ||
      endpointValueMissing ||
      endpointValueInvalid ||
      !form.primaryModel.trim() ||
      upstreamModelValueMissing ||
      maxContextSizeValueInvalid ||
      credentialReplacementValueMissing
    ) {
      return;
    }
    const mappings = modelMappings(form, platformId);
    const existingConfig = { ...(profile?.config ?? {}) };
    delete existingConfig.credentialEnvKey;
    delete existingConfig.nativeAuthType;
    delete existingConfig.envKey;
    if (
      (platformId === "kimi" ||
        platformId === "grok" ||
        platformId === "qwen" ||
        platformId === "opencode") &&
      form.protocol !== "platform-native"
    ) {
      delete existingConfig.nativeAuthOwnership;
    }
    const common = {
      name: form.name.trim(),
      providerKind: form.providerKind.trim(),
      protocol: form.protocol,
      endpoint: form.endpoint.trim() || null,
      config: {
        ...existingConfig,
        ...(platformId === "codex" ||
        platformId === "kimi" ||
        platformId === "grok" ||
        platformId === "opencode" ||
        platformId === "qwen"
          ? { providerId: form.providerId.trim() }
          : {}),
        ...(platformId === "opencode" && openCodeDirect
          ? { package: OPENCODE_PROVIDER_PACKAGES[form.providerKind] }
          : {}),
        ...(qwenManaged || grokManaged
          ? { envKey: form.credentialEnvKey.trim() }
          : {}),
        ...(codexEnvironment ? { envKey: form.credentialEnvKey.trim() } : {}),
        ...(platformId === "qwen" && form.protocol === "platform-native"
          ? {
              nativeAuthOwnership:
                typeof profile?.config.nativeAuthOwnership === "string"
                  ? profile.config.nativeAuthOwnership
                  : form.providerKind === "vertex-ai"
                    ? "vertex-adc"
                    : "oauth",
            }
          : {}),
        ...(platformId === "claude" && form.protocol === "anthropic-messages"
          ? { credentialEnvKey: form.credentialEnvKey }
          : {}),
        ...(platformId === "gemini" && form.protocol === "google-generative-ai"
          ? { credentialEnvKey: "GEMINI_API_KEY" }
          : {}),
        ...(platformId === "gemini" && form.protocol === "platform-native"
          ? { nativeAuthType: form.providerKind.trim() }
          : {}),
      },
    };
    const secret = acceptsManagedCredential ? form.secret : "";
    const saved = profile
      ? await onUpdate({
          id: profile.id,
          expectedUpdatedAt: profile.updatedAt,
          profile: common,
          modelMappings: mappings,
          secretAction: !acceptsManagedCredential
            ? profile.secretState === "none"
              ? "preserve"
              : "clear"
            : form.credentialAction,
          ...(form.credentialAction === "replace" && secret ? { secret } : {}),
        })
      : await onCreate({
          profile: {
            platformId,
            ...common,
            source: "manual",
          },
          modelMappings: mappings,
          ...(secret ? { secret } : {}),
        });
    if (saved) onClose();
  }

  if (!isOpen) return null;

  const title = profile
    ? t("agents.providerProfiles.form.editTitle")
    : t("agents.providerProfiles.form.addTitle");

  return (
    <div
      role="region"
      aria-label={title}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("agents.providerProfiles.form.inlineHint")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy || openCodeNativeReadOnly || grokNativeReadOnly}
          >
            {busy ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon className="h-4 w-4" />
            )}
            {t("agents.providerProfiles.form.save")}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-5 p-5">
          <section className="border-b border-border pb-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRoundIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.form.sections.identity")}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("agents.providerProfiles.form.name")}
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                disabled={busy}
                error={
                  nameMissing
                    ? t("agents.providerProfiles.form.required")
                    : undefined
                }
              />
              {platformId === "kimi" ||
              platformId === "grok" ||
              platformId === "qwen" ||
              platformId === "opencode" ? (
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-foreground">
                    {t("agents.providerProfiles.form.providerKind")}
                  </span>
                  <select
                    value={form.providerKind}
                    onChange={(event) => {
                      const providerKind = event.target.value;
                      setForm((current) => ({
                        ...current,
                        providerKind,
                        protocol:
                          (platformId === "kimi"
                            ? KIMI_PROVIDER_PROTOCOLS
                            : platformId === "grok"
                              ? GROK_PROVIDER_PROTOCOLS
                              : platformId === "qwen"
                                ? QWEN_PROVIDER_PROTOCOLS
                                : OPENCODE_PROVIDER_PROTOCOLS)[providerKind] ??
                          current.protocol,
                        credentialEnvKey:
                          platformId === "qwen" &&
                          QWEN_DEFAULT_ENV_KEYS[providerKind]
                            ? QWEN_DEFAULT_ENV_KEYS[providerKind]
                            : current.credentialEnvKey,
                      }));
                    }}
                    disabled={
                      busy || openCodeNativeReadOnly || grokNativeReadOnly
                    }
                    className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.keys(
                      platformId === "kimi"
                        ? KIMI_PROVIDER_PROTOCOLS
                        : platformId === "grok"
                          ? GROK_PROVIDER_PROTOCOLS
                          : platformId === "qwen"
                            ? QWEN_PROVIDER_PROTOCOLS
                            : OPENCODE_PROVIDER_PROTOCOLS,
                    ).map((providerKind) => (
                      <option key={providerKind} value={providerKind}>
                        {providerKind}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <Input
                  label={t("agents.providerProfiles.form.providerKind")}
                  value={form.providerKind}
                  onChange={(event) =>
                    update("providerKind", event.target.value)
                  }
                  disabled={busy}
                  error={
                    providerMissing
                      ? t("agents.providerProfiles.form.required")
                      : undefined
                  }
                />
              )}
              {platformId === "codex" ||
              platformId === "kimi" ||
              platformId === "grok" ||
              platformId === "opencode" ||
              platformId === "qwen" ? (
                <Input
                  label={t("agents.providerProfiles.form.providerId")}
                  value={form.providerId}
                  onChange={(event) => update("providerId", event.target.value)}
                  disabled={
                    busy || openCodeNativeReadOnly || grokNativeReadOnly
                  }
                  placeholder="work-gateway"
                  error={
                    providerIdMissing
                      ? t("agents.providerProfiles.form.required")
                      : providerIdInvalid
                        ? t(
                            platformId === "kimi" ||
                              platformId === "grok" ||
                              platformId === "qwen" ||
                              platformId === "opencode"
                              ? "agents.providerProfiles.form.kimiProviderIdInvalid"
                              : "agents.providerProfiles.form.providerIdInvalid",
                          )
                        : undefined
                  }
                />
              ) : null}
            </div>
          </section>

          <section className="border-b border-border pb-5">
            <div className="mb-4 flex items-center gap-2">
              <NetworkIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.form.sections.connection")}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-foreground">
                  {t("agents.providerProfiles.form.protocol")}
                </span>
                <select
                  value={form.protocol}
                  onChange={(event) => update("protocol", event.target.value)}
                  disabled={
                    busy ||
                    platformId === "grok" ||
                    platformId === "qwen" ||
                    platformId === "opencode"
                  }
                  className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="platform-native">
                    {t("agents.providerProfiles.form.platformNative")}
                  </option>
                  {platformId === "claude" ? (
                    <option value="anthropic-messages">
                      {t("agents.providerProfiles.form.anthropicMessages")}
                    </option>
                  ) : platformId === "gemini" ? (
                    <option value="google-generative-ai">
                      {t("agents.providerProfiles.form.googleGenerativeAi")}
                    </option>
                  ) : platformId === "kimi" ||
                    platformId === "grok" ||
                    platformId === "qwen" ? (
                    <>
                      <option value="openai-chat">
                        OpenAI Chat Completions
                      </option>
                      {platformId === "kimi" || platformId === "grok" ? (
                        <option value="openai-responses">
                          OpenAI Responses
                        </option>
                      ) : null}
                      <option value="anthropic-messages">
                        {t("agents.providerProfiles.form.anthropicMessages")}
                      </option>
                      {platformId === "qwen" ? (
                        <option value="google-generative-ai">
                          {t("agents.providerProfiles.form.googleGenerativeAi")}
                        </option>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <option value="openai-chat">
                        OpenAI Chat Completions
                      </option>
                      <option value="openai-responses">OpenAI Responses</option>
                    </>
                  )}
                </select>
              </label>
              {platformId !== "qwen" || qwenManaged ? (
                <Input
                  label={t(
                    platformId === "qwen" || openCodeDirect || codexCustom
                      ? "agents.providerProfiles.form.endpointRequired"
                      : platformId === "grok"
                        ? "agents.providerProfiles.form.endpointRequired"
                        : "agents.providerProfiles.form.endpoint",
                  )}
                  value={form.endpoint}
                  onChange={(event) => update("endpoint", event.target.value)}
                  disabled={
                    busy || openCodeNativeReadOnly || grokNativeReadOnly
                  }
                  placeholder="https://api.example.com/v1"
                  error={
                    endpointMissing
                      ? t("agents.providerProfiles.form.required")
                      : endpointInvalid
                        ? t("agents.providerProfiles.form.endpointInvalid")
                        : undefined
                  }
                />
              ) : null}
            </div>
          </section>

          <section className="border-b border-border pb-5">
            <div className="mb-4 flex items-center gap-2">
              <CableIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.form.sections.models")}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t("agents.providerProfiles.form.primaryModel")}
                value={form.primaryModel}
                onChange={(event) => update("primaryModel", event.target.value)}
                disabled={busy || openCodeNativeReadOnly || grokNativeReadOnly}
                error={
                  modelMissing
                    ? t("agents.providerProfiles.form.required")
                    : undefined
                }
              />
              {platformId === "kimi" || platformId === "grok" ? (
                <>
                  <Input
                    label={t("agents.providerProfiles.form.upstreamModel")}
                    value={form.upstreamModel}
                    onChange={(event) =>
                      update("upstreamModel", event.target.value)
                    }
                    disabled={busy || grokNativeReadOnly}
                    error={
                      upstreamModelMissing
                        ? t("agents.providerProfiles.form.required")
                        : undefined
                    }
                  />
                  <Input
                    type="number"
                    min={1}
                    max={10_000_000}
                    step={1}
                    label={t("agents.providerProfiles.form.maxContextSize")}
                    value={form.maxContextSize}
                    onChange={(event) =>
                      update("maxContextSize", event.target.value)
                    }
                    disabled={busy || grokNativeReadOnly}
                    error={
                      maxContextSizeInvalid
                        ? t("agents.providerProfiles.form.positiveInteger")
                        : undefined
                    }
                  />
                </>
              ) : platformId === "opencode" ? (
                <Input
                  label={t("agents.providerProfiles.form.secondaryModel")}
                  value={form.secondaryModel}
                  onChange={(event) =>
                    update("secondaryModel", event.target.value)
                  }
                  disabled={busy || openCodeNativeReadOnly}
                />
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <KeyRoundIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.form.sections.authentication")}
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {platformId === "claude" &&
              form.protocol === "anthropic-messages" ? (
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-foreground">
                    {t("agents.providerProfiles.form.credentialKind")}
                  </span>
                  <select
                    value={form.credentialEnvKey}
                    onChange={(event) =>
                      update("credentialEnvKey", event.target.value)
                    }
                    disabled={busy}
                    className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="ANTHROPIC_API_KEY">
                      {t("agents.providerProfiles.form.anthropicApiKey")}
                    </option>
                    <option value="ANTHROPIC_AUTH_TOKEN">
                      {t("agents.providerProfiles.form.anthropicAuthToken")}
                    </option>
                  </select>
                </label>
              ) : null}
              {platformId === "codex" && form.protocol !== "platform-native" ? (
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-foreground">
                    {t("agents.providerProfiles.form.authenticationSource")}
                  </span>
                  <select
                    value={form.credentialSource}
                    onChange={(event) => {
                      const credentialSource = event.target.value as
                        | "managed"
                        | "environment";
                      setForm((current) => ({
                        ...current,
                        credentialSource,
                        credentialAction:
                          credentialSource === "managed" &&
                          profile?.secretState !== "available"
                            ? "replace"
                            : current.credentialAction,
                        secret:
                          credentialSource === "environment"
                            ? ""
                            : current.secret,
                      }));
                    }}
                    disabled={busy}
                    className="h-10 w-full rounded-xl border-0 bg-muted/50 px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="managed">
                      {t(
                        "agents.providerProfiles.form.authenticationSources.managed",
                      )}
                    </option>
                    <option value="environment">
                      {t(
                        "agents.providerProfiles.form.authenticationSources.environment",
                      )}
                    </option>
                  </select>
                </label>
              ) : null}
              {qwenManaged || grokManaged || codexEnvironment ? (
                <Input
                  label={t("agents.providerProfiles.form.environmentVariable")}
                  value={form.credentialEnvKey}
                  onChange={(event) =>
                    update("credentialEnvKey", event.target.value)
                  }
                  disabled={busy}
                  placeholder={
                    platformId === "grok"
                      ? "XAI_API_KEY"
                      : platformId === "qwen"
                        ? "DASHSCOPE_API_KEY"
                        : "OPENAI_API_KEY"
                  }
                  error={
                    envKeyInvalid
                      ? t(
                          "agents.providerProfiles.form.environmentVariableInvalid",
                        )
                      : undefined
                  }
                />
              ) : null}
            </div>

            {acceptsManagedCredential ? (
              <AgentProviderCredentialField
                profileSecretState={profile?.secretState ?? null}
                action={form.credentialAction}
                value={form.secret}
                disabled={busy}
                error={
                  credentialReplacementMissing
                    ? t(
                        "agents.providerProfiles.form.credentialReplacementRequired",
                      )
                    : undefined
                }
                onActionChange={(credentialAction) => {
                  update("credentialAction", credentialAction);
                }}
                onValueChange={(secret) => update("secret", secret)}
              />
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {t("agents.providerProfiles.form.platformCredentialHint")}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
