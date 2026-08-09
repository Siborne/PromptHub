import { useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  Loader2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderSourceCandidate,
  ImportAgentProviderSourceRequest,
} from "@prompthub/shared";
import { Button, Modal } from "../ui";

interface AgentProviderSourceDialogProps {
  isOpen: boolean;
  platformId: string;
  candidates: AgentProviderSourceCandidate[];
  loading: boolean;
  importing: boolean;
  onLoad: (platformId: string) => Promise<AgentProviderSourceCandidate[]>;
  onImport: (
    request: ImportAgentProviderSourceRequest,
  ) => Promise<unknown | null>;
  onClose: () => void;
}

function defaultSelection(candidates: AgentProviderSourceCandidate[]) {
  const provider = candidates.find((candidate) => candidate.compatible);
  const model =
    provider?.models.find((candidate) => candidate.isDefault) ??
    provider?.models[0];
  return { sourceId: provider?.sourceId ?? "", modelId: model?.id ?? "" };
}

export function AgentProviderSourceDialog({
  isOpen,
  platformId,
  candidates,
  loading,
  importing,
  onLoad,
  onImport,
  onClose,
}: AgentProviderSourceDialogProps) {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = useState("");
  const [modelId, setModelId] = useState("");

  useEffect(() => {
    if (isOpen) void onLoad(platformId);
  }, [isOpen, onLoad, platformId]);

  useEffect(() => {
    const selection = defaultSelection(candidates);
    setSourceId(selection.sourceId);
    setModelId(selection.modelId);
  }, [candidates]);

  const selected = useMemo(
    () => candidates.find((candidate) => candidate.sourceId === sourceId),
    [candidates, sourceId],
  );

  function select(candidate: AgentProviderSourceCandidate): void {
    if (!candidate.compatible) return;
    const model =
      candidate.models.find((item) => item.isDefault) ?? candidate.models[0];
    setSourceId(candidate.sourceId);
    setModelId(model?.id ?? "");
  }

  async function submit(): Promise<void> {
    if (!sourceId || !modelId) return;
    const result = await onImport({ platformId, sourceId, modelId });
    if (result) onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("agents.providerProfiles.sourceImport.title")}
      size="lg"
      closeOnBackdrop={!importing}
      closeOnEscape={!importing}
    >
      <p className="text-sm text-muted-foreground">
        {t("agents.providerProfiles.sourceImport.hint")}
      </p>
      <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            {t("agents.providerProfiles.sourceImport.loading")}
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("agents.providerProfiles.sourceImport.empty")}
          </p>
        ) : (
          candidates.map((candidate) => (
            <button
              key={candidate.sourceId}
              type="button"
              onClick={() => select(candidate)}
              disabled={!candidate.compatible || importing}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                candidate.sourceId === sourceId
                  ? "border-primary bg-primary/[0.06]"
                  : "border-border bg-card hover:bg-accent/50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {candidate.compatible ? (
                    <CheckCircle2Icon className="h-4 w-4" />
                  ) : (
                    <AlertCircleIcon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm text-foreground">
                      {candidate.name}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {candidate.providerKind}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {candidate.endpoint}
                  </span>
                  {!candidate.compatible && candidate.incompatibility ? (
                    <span className="mt-1 block text-xs font-medium text-amber-600 dark:text-amber-400">
                      {t(
                        `agents.providerProfiles.sourceImport.incompatibility.${candidate.incompatibility}`,
                      )}
                    </span>
                  ) : (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <KeyRoundIcon className="h-3 w-3" />
                      {t(
                        candidate.credentialReady
                          ? "agents.providerProfiles.sourceImport.credentialReady"
                          : "agents.providerProfiles.sourceImport.credentialMissing",
                      )}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      {selected ? (
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-medium text-foreground">
            {t("agents.providerProfiles.sourceImport.model")}
          </span>
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            disabled={importing}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            {selected.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.model})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={importing}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={!sourceId || !modelId || loading || importing}
        >
          {importing ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
          {t("agents.providerProfiles.sourceImport.confirm")}
        </Button>
      </div>
    </Modal>
  );
}
