import { useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, FileTextIcon, SparklesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  getRuleAIModelChoices,
  isCompleteRuleAIModel,
  type RuleAIModelChoice,
} from "../../services/rule-ai-models";
import { useRulesStore } from "../../stores/rules.store";
import { useSettingsStore } from "../../stores/settings.store";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Select, type SelectOption } from "../ui/Select";
import { useToast } from "../ui/Toast";

interface RuleAiRewriteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function getRuleRewriteErrorMessage(
  error: unknown,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "RULE_AI_MODEL_UNAVAILABLE") {
    return t("rules.aiNoChatModel", "No chat model configured");
  }
  if (message === "RULE_AI_MODEL_INCOMPLETE") {
    return t(
      "rules.aiModelIncomplete",
      "The selected model configuration is incomplete.",
    );
  }
  return error instanceof Error
    ? error.message
    : t("rules.aiRewriteFailed", "AI rewrite failed");
}

export function getRuleProviderDefaultModelId(
  choices: RuleAIModelChoice[],
  providerId: string,
): string {
  const providerChoices = choices.filter(
    (choice) => choice.providerId === providerId,
  );
  return (
    providerChoices.find((choice) => choice.model.isDefault)?.model.id ??
    providerChoices[0]?.model.id ??
    ""
  );
}

export function RuleAiRewriteDialog({
  isOpen,
  onClose,
}: RuleAiRewriteDialogProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const currentFile = useRulesStore((state) => state.currentFile);
  const aiInstruction = useRulesStore((state) => state.aiInstruction);
  const isRewriting = useRulesStore((state) => state.isRewriting);
  const setAiInstruction = useRulesStore((state) => state.setAiInstruction);
  const rewriteCurrentRule = useRulesStore((state) => state.rewriteCurrentRule);
  const aiProvider = useSettingsStore((state) => state.aiProvider);
  const aiApiProtocol = useSettingsStore((state) => state.aiApiProtocol);
  const aiApiKey = useSettingsStore((state) => state.aiApiKey);
  const aiApiUrl = useSettingsStore((state) => state.aiApiUrl);
  const aiModel = useSettingsStore((state) => state.aiModel);
  const aiProviders = useSettingsStore((state) => state.aiProviders);
  const aiModels = useSettingsStore((state) => state.aiModels);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");

  const choices = useMemo(
    () =>
      getRuleAIModelChoices({
        aiProvider,
        aiApiProtocol,
        aiApiKey,
        aiApiUrl,
        aiModel,
        aiProviders,
        aiModels,
      }),
    [
      aiApiKey,
      aiApiProtocol,
      aiApiUrl,
      aiModel,
      aiModels,
      aiProvider,
      aiProviders,
    ],
  );
  const defaultChoice =
    choices.find((choice) => choice.model.isDefault) ?? choices[0] ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedProviderId(defaultChoice?.providerId ?? "");
    setSelectedModelId(defaultChoice?.model.id ?? "");
  }, [defaultChoice?.model.id, defaultChoice?.providerId, isOpen]);

  const providerOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, SelectOption>();
    for (const choice of choices) {
      options.set(choice.providerId, {
        value: choice.providerId,
        label: choice.providerLabel,
        labelText: choice.providerLabel,
      });
    }
    return [...options.values()];
  }, [choices]);

  const selectedProviderChoices = choices.filter(
    (choice) => choice.providerId === selectedProviderId,
  );
  const modelOptions = selectedProviderChoices.map<SelectOption>((choice) => ({
    value: choice.model.id,
    label: (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">
          {choice.model.name?.trim() || choice.model.model}
        </span>
        {choice.model.name?.trim() &&
        choice.model.name.trim() !== choice.model.model ? (
          <span className="truncate text-xs text-muted-foreground">
            {choice.model.model}
          </span>
        ) : null}
      </span>
    ),
    labelText: choice.model.name?.trim() || choice.model.model,
  }));
  const selectedChoice =
    choices.find((choice) => choice.model.id === selectedModelId) ?? null;
  const canRewrite = Boolean(
    currentFile &&
    aiInstruction.trim() &&
    selectedChoice &&
    isCompleteRuleAIModel(selectedChoice.model) &&
    !isRewriting,
  );

  const close = () => {
    if (!isRewriting) {
      onClose();
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedModelId(getRuleProviderDefaultModelId(choices, providerId));
  };

  const handleRewrite = async () => {
    try {
      await rewriteCurrentRule(selectedModelId);
      showToast(t("rules.aiRewriteDone", "AI draft ready"), "success");
      onClose();
    } catch (error) {
      showToast(getRuleRewriteErrorMessage(error, t), "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={t("rules.aiRewriteTitle", "Ask AI to improve")}
      subtitle={t(
        "rules.aiRewriteHint",
        "Describe your desired changes and AI will generate a new draft for the current rules file.",
      )}
      size="2xl"
      closeOnBackdrop={!isRewriting}
      closeOnEscape={!isRewriting}
    >
      <div className="space-y-5">
        {currentFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
            <FileTextIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-primary"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {currentFile.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {currentFile.platformName}
              </p>
            </div>
          </div>
        ) : null}

        {choices.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">
                {t("rules.aiProviderLabel", "Provider")}
              </span>
              <Select
                ariaLabel={t("rules.aiProviderLabel", "AI provider")}
                value={selectedProviderId}
                onChange={handleProviderChange}
                options={providerOptions}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-foreground">
                {t("rules.aiModelLabel", "Model")}
              </span>
              <Select
                ariaLabel={t("rules.aiModelLabel", "AI model")}
                value={selectedModelId}
                onChange={setSelectedModelId}
                options={modelOptions}
                disabled={modelOptions.length === 0}
              />
            </label>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircleIcon
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{t("rules.aiNoChatModel", "No chat model configured")}</span>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-foreground">
            {t("rules.aiInstructionLabel", "Requested changes")}
          </span>
          <textarea
            aria-label={t("rules.aiRewriteTitle", "Ask AI to improve")}
            value={aiInstruction}
            onChange={(event) => setAiInstruction(event.target.value)}
            className="h-56 w-full resize-y rounded-lg border border-border bg-background p-4 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            placeholder={t(
              "rules.aiRewritePlaceholder",
              "Example: add testing requirements, reorganize sections, or strengthen constraints while keeping the current markdown headings where possible.",
            )}
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isRewriting}
            onClick={close}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canRewrite}
            onClick={() => void handleRewrite()}
          >
            <SparklesIcon aria-hidden="true" className="h-4 w-4" />
            {isRewriting
              ? t("rules.aiRewriteWorking", "Generating draft...")
              : t("rules.aiRewriteAction", "Improve with AI")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
