import {
  CheckIcon,
  CopyIcon,
  HistoryIcon,
  LoaderIcon,
  PlayIcon,
  SaveIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "../../stores/prompt.store";
import { useSettingsStore } from "../../stores/settings.store";
import {
  copyTextToClipboard,
  hasUserDefinedPromptVariables,
} from "../prompt/prompt-copy-utils";
import { useToast } from "../ui/Toast";
import { usePromptWorkspaceDetailContext } from "./PromptWorkspaceDetailContext";

function useCopyPromptAction() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const incrementUsageCount = usePromptStore(
    (state) => state.incrementUsageCount,
  );
  const showCopyNotification = useSettingsStore(
    (state) => state.showCopyNotification,
  );
  const detail = usePromptWorkspaceDetailContext();
  return async () => {
    const prompt = detail.selectedPrompt!;
    const content = detail.showEnglish
      ? prompt.userPromptEn || prompt.userPrompt
      : prompt.userPrompt;
    if (hasUserDefinedPromptVariables(undefined, content))
      return detail.setIsVariableModalOpen(true);
    await copyTextToClipboard(content);
    await incrementUsageCount(prompt.id);
    detail.triggerCopied();
    showToast(t("toast.copied"), "success", showCopyNotification);
  };
}

function PromptDetailEditActions() {
  const { t } = useTranslation();
  const detail = usePromptWorkspaceDetailContext();
  return (
    <>
      <button
        type="button"
        onClick={detail.cancelDetailInlineEdit}
        aria-label={t("common.cancel")}
        title={t("common.cancel")}
        disabled={detail.isDetailInlineSaving}
        className="flex items-center gap-2 h-9 px-4 rounded-lg app-wallpaper-surface-strong border border-border text-sm font-medium hover:bg-accent/60 disabled:opacity-50 transition-colors"
      >
        <XIcon aria-hidden="true" className="w-4 h-4" />
        <span>{t("common.cancel")}</span>
      </button>
      <button
        type="button"
        onClick={() => void detail.saveDetailInlineEdit()}
        aria-label={t("common.save")}
        title={t("common.save")}
        disabled={!detail.canSaveDetailInlineEdit}
        className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {detail.isDetailInlineSaving ? (
          <LoaderIcon aria-hidden="true" className="w-4 h-4 animate-spin" />
        ) : (
          <SaveIcon aria-hidden="true" className="w-4 h-4" />
        )}
        <span>{t("common.save")}</span>
      </button>
    </>
  );
}

function PromptDetailDefaultActions() {
  const { t } = useTranslation();
  const detail = usePromptWorkspaceDetailContext();
  const copy = useCopyPromptAction();
  const prompt = detail.selectedPrompt!;
  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {detail.copied ? (
          <CheckIcon aria-hidden="true" className="w-4 h-4" />
        ) : (
          <CopyIcon aria-hidden="true" className="w-4 h-4" />
        )}
        <span>{detail.copied ? t("prompt.copied") : t("prompt.copy")}</span>
      </button>
      <button
        type="button"
        onClick={() => detail.handleAiTest(prompt, "single")}
        className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary/90 text-white text-sm font-medium hover:bg-primary disabled:opacity-50 transition-colors"
      >
        <PlayIcon aria-hidden="true" className="w-4 h-4" />
        <span>{t("prompt.aiTest")}</span>
      </button>
      <button
        type="button"
        onClick={() => detail.handleVersionHistory(prompt)}
        className="flex items-center gap-2 h-9 px-4 rounded-lg app-wallpaper-surface-strong border border-border text-sm font-medium hover:bg-accent/60 disabled:opacity-50 transition-colors"
      >
        <HistoryIcon aria-hidden="true" className="w-4 h-4" />
        <span>{t("prompt.history")}</span>
      </button>
      <button
        type="button"
        onClick={() => detail.handleDeletePrompt(prompt)}
        className="flex items-center gap-2 h-9 px-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/20 disabled:opacity-50 transition-colors"
      >
        <TrashIcon aria-hidden="true" className="w-4 h-4" />
        <span>{t("prompt.delete")}</span>
      </button>
    </>
  );
}

export function PromptDetailActionBar() {
  const detail = usePromptWorkspaceDetailContext();
  return (
    <div className="flex-shrink-0 border-t border-border app-wallpaper-panel-strong px-6 py-3">
      <div className="w-full flex items-center gap-3 flex-wrap">
        {detail.isDetailInlineEditing ? (
          <PromptDetailEditActions />
        ) : (
          <PromptDetailDefaultActions />
        )}
      </div>
    </div>
  );
}
