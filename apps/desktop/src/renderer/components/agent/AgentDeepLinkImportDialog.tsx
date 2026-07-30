import { useRef, useState } from "react";
import { AlertTriangle, Download, KeyRound, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPlatformById } from "@prompthub/shared/constants/platforms";
import type { AgentDeepLinkCommand } from "@prompthub/shared/types";

import { useAgentProviderStore } from "../../stores/agent-provider.store";
import { Modal } from "../ui/Modal";

interface AgentDeepLinkImportDialogProps {
  command: AgentDeepLinkCommand | null;
  onClose: () => void;
}

export function AgentDeepLinkImportDialog({
  command,
  onClose,
}: AgentDeepLinkImportDialogProps) {
  const { t } = useTranslation();
  const createProfile = useAgentProviderStore((state) => state.createProfile);
  const loadProfiles = useAgentProviderStore((state) => state.load);
  const selectProfile = useAgentProviderStore((state) => state.select);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const submittingRef = useRef(false);

  if (!command) return null;

  if (command.type === "agent:import-error") {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title={t("agents.providerProfiles.deepLink.errorTitle")}
        size="sm"
      >
        <div role="alert" className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-destructive"
            />
            <p className="text-sm leading-6 text-foreground">
              {t(
                `agents.providerProfiles.deepLink.errors.${command.errorCode}`,
              )}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const { preview } = command;
  const platform =
    getPlatformById(preview.profile.platformId)?.name ??
    preview.profile.platformId;

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorCode(null);

    if (
      useAgentProviderStore.getState().platformId !== preview.profile.platformId
    ) {
      await loadProfiles(preview.profile.platformId);
    }
    const created = await createProfile({
      profile: preview.profile,
      modelMappings: preview.modelMappings,
    });
    if (!created) {
      setErrorCode(
        useAgentProviderStore.getState().errorCode ??
          "AGENT_PROVIDER_OPERATION_FAILED",
      );
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    selectProfile(created.id);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("agents.providerProfiles.deepLink.title")}
      subtitle={preview.profile.name}
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
      showCloseButton={!isSubmitting}
      size="xl"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PreviewField
            label={t("agents.providerProfiles.deepLink.platform")}
            value={platform}
          />
          <PreviewField
            label={t("agents.providerProfiles.providerKind")}
            value={preview.profile.providerKind}
          />
          <PreviewField
            label={t("agents.providerProfiles.protocol")}
            value={preview.profile.protocol}
          />
          <PreviewField
            label={t("agents.providerProfiles.endpoint")}
            value={
              preview.profile.endpoint ??
              t("agents.providerProfiles.platformNative")
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PreviewJson
            title={t("agents.providerProfiles.deepLink.publicConfig")}
            value={preview.profile.config}
          />
          <PreviewJson
            title={t("agents.providerProfiles.modelMappings")}
            value={preview.modelMappings}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <KeyRound
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {preview.requiresSecret
                  ? t("agents.providerProfiles.deepLink.secretRequired")
                  : t("agents.providerProfiles.deepLink.noSecretRequired")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("agents.providerProfiles.deepLink.secretHint")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.deepLink.profileOnly")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("agents.providerProfiles.deepLink.profileOnlyHint")}
              </p>
            </div>
          </div>
        </div>

        {errorCode ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {t("agents.providerProfiles.deepLink.createFailed")}
          </p>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Download aria-hidden="true" className="size-4" />
            {isSubmitting
              ? t("agents.providerProfiles.deepLink.importing")
              : t("agents.providerProfiles.deepLink.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className="mt-1 truncate text-sm font-medium text-foreground"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function PreviewJson({ title, value }: { title: string; value: unknown }) {
  const serialized = JSON.stringify(value, null, 2);
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border">
      <h3 className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-semibold text-foreground">
        {title}
      </h3>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-5 text-muted-foreground">
        {serialized}
      </pre>
    </section>
  );
}
