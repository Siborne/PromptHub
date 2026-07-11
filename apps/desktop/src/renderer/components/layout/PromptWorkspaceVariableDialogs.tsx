import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "../../stores/prompt.store";
import { useSettingsStore } from "../../stores/settings.store";
import {
  copyTextToClipboard,
  resolvePromptContentByLanguage,
} from "../prompt/prompt-copy-utils";
import { useToast } from "../ui/Toast";
import type { PromptWorkspaceDialogsProps } from "./prompt-workspace-dialog-types";

const VariableInputModal = lazy(() =>
  import("../prompt/VariableInputModal").then((module) => ({
    default: module.VariableInputModal,
  })),
);

function useVariableDialogUtilities() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const incrementUsageCount = usePromptStore(
    (state) => state.incrementUsageCount,
  );
  const showCopyNotification = useSettingsStore(
    (state) => state.showCopyNotification,
  );
  return { incrementUsageCount, showCopyNotification, showToast, t };
}

function PromptSelectedCopyDialog({
  isVariableModalOpen,
  selectedPrompt,
  setIsVariableModalOpen,
  showEnglish,
  triggerCopied,
}: Pick<
  PromptWorkspaceDialogsProps,
  | "isVariableModalOpen"
  | "selectedPrompt"
  | "setIsVariableModalOpen"
  | "showEnglish"
  | "triggerCopied"
>) {
  const { incrementUsageCount, showCopyNotification, showToast, t } =
    useVariableDialogUtilities();
  if (!selectedPrompt) return null;
  return (
    <Suspense fallback={null}>
      <VariableInputModal
        isOpen={isVariableModalOpen}
        onClose={() => setIsVariableModalOpen(false)}
        promptId={selectedPrompt.id}
        systemPrompt={undefined}
        userPrompt={
          resolvePromptContentByLanguage(selectedPrompt, showEnglish).userPrompt
        }
        mode="copy"
        onCopy={(text) =>
          copySelectedPrompt(
            text,
            selectedPrompt.id,
            incrementUsageCount,
            triggerCopied,
            showToast,
            t,
            showCopyNotification,
            setIsVariableModalOpen,
          )
        }
      />
    </Suspense>
  );
}

async function copySelectedPrompt(
  text: string,
  promptId: string,
  incrementUsageCount: ReturnType<
    typeof usePromptStore.getState
  >["incrementUsageCount"],
  triggerCopied: () => void,
  showToast: ReturnType<typeof useToast>["showToast"],
  t: ReturnType<typeof useTranslation>["t"],
  showCopyNotification: boolean,
  setOpen: PromptWorkspaceDialogsProps["setIsVariableModalOpen"],
) {
  await copyTextToClipboard(text);
  await incrementUsageCount(promptId);
  triggerCopied();
  showToast(t("toast.copied"), "success", showCopyNotification);
  setOpen(false);
}

function PromptAiVariableDialog({
  isAiTestVariableModalOpen,
  isTestingAI,
  runAiTest,
  selectedPrompt,
  setIsAiTestVariableModalOpen,
  showEnglish,
}: Pick<
  PromptWorkspaceDialogsProps,
  | "isAiTestVariableModalOpen"
  | "isTestingAI"
  | "runAiTest"
  | "selectedPrompt"
  | "setIsAiTestVariableModalOpen"
  | "showEnglish"
>) {
  if (!selectedPrompt) return null;
  return (
    <Suspense fallback={null}>
      <VariableInputModal
        isOpen={isAiTestVariableModalOpen}
        onClose={() => setIsAiTestVariableModalOpen(false)}
        promptId={selectedPrompt.id}
        systemPrompt={getPromptContent(selectedPrompt, showEnglish, "system")}
        userPrompt={getPromptContent(selectedPrompt, showEnglish, "user")}
        mode="aiTest"
        onAiTest={(system, user, outputFormat, images) =>
          runAiTest(system, user, undefined, outputFormat, images)
        }
        isAiTesting={isTestingAI}
      />
    </Suspense>
  );
}

function getPromptContent(
  prompt: NonNullable<PromptWorkspaceDialogsProps["selectedPrompt"]>,
  showEnglish: boolean,
  field: "system" | "user",
) {
  if (field === "system") {
    return showEnglish
      ? prompt.systemPromptEn || prompt.systemPrompt
      : prompt.systemPrompt;
  }
  return showEnglish
    ? prompt.userPromptEn || prompt.userPrompt
    : prompt.userPrompt;
}

function PromptCompareVariableDialog({
  isComparingModels,
  isCompareVariableModalOpen,
  runModelCompare,
  selectedPrompt,
  setIsCompareVariableModalOpen,
  showEnglish,
}: Pick<
  PromptWorkspaceDialogsProps,
  | "isComparingModels"
  | "isCompareVariableModalOpen"
  | "runModelCompare"
  | "selectedPrompt"
  | "setIsCompareVariableModalOpen"
  | "showEnglish"
>) {
  if (!selectedPrompt) return null;
  return (
    <Suspense fallback={null}>
      <VariableInputModal
        isOpen={isCompareVariableModalOpen}
        onClose={() => setIsCompareVariableModalOpen(false)}
        promptId={selectedPrompt.id}
        systemPrompt={getPromptContent(selectedPrompt, showEnglish, "system")}
        userPrompt={getPromptContent(selectedPrompt, showEnglish, "user")}
        mode="aiTest"
        onAiTest={(system, user, _format, images) =>
          runModelCompare(system, user, images)
        }
        isAiTesting={isComparingModels}
      />
    </Suspense>
  );
}

type QueueCopyDialogProps = Pick<
  PromptWorkspaceDialogsProps,
  | "copyPrompt"
  | "copyPromptQueue"
  | "copyPromptQueueIndex"
  | "isCopyVariableModalOpen"
  | "setCopyPrompt"
  | "setCopyPromptQueue"
  | "setCopyPromptQueueIndex"
  | "setCopyPromptResults"
  | "setCopyPromptSourceId"
  | "setIsCopyVariableModalOpen"
  | "showEnglish"
  | "triggerCopied"
>;

function PromptQueueCopyDialog(props: QueueCopyDialogProps) {
  const utils = useVariableDialogUtilities();
  if (!props.copyPrompt) return null;
  return (
    <Suspense fallback={null}>
      <VariableInputModal
        isOpen={props.isCopyVariableModalOpen}
        onClose={() =>
          closeQueueCopy({
            setCopyPrompt: props.setCopyPrompt,
            setCopyPromptQueue: props.setCopyPromptQueue,
            setCopyPromptQueueIndex: props.setCopyPromptQueueIndex,
            setCopyPromptResults: props.setCopyPromptResults,
            setCopyPromptSourceId: props.setCopyPromptSourceId,
            setIsCopyVariableModalOpen: props.setIsCopyVariableModalOpen,
          })
        }
        promptId={props.copyPrompt.id}
        systemPrompt={undefined}
        userPrompt={
          resolvePromptContentByLanguage(props.copyPrompt, props.showEnglish)
            .userPrompt
        }
        mode="copy"
        onCopy={(text) =>
          handleQueueCopy(
            text,
            props.copyPrompt.id,
            props.copyPromptQueue,
            props.copyPromptQueueIndex,
            {
              setCopyPrompt: props.setCopyPrompt,
              setCopyPromptQueueIndex: props.setCopyPromptQueueIndex,
              setCopyPromptResults: props.setCopyPromptResults,
              setIsCopyVariableModalOpen: props.setIsCopyVariableModalOpen,
            },
            utils,
            props.triggerCopied,
          )
        }
      />
    </Suspense>
  );
}

function closeQueueCopy(
  setters: Pick<
    PromptWorkspaceDialogsProps,
    | "setCopyPrompt"
    | "setCopyPromptQueue"
    | "setCopyPromptQueueIndex"
    | "setCopyPromptResults"
    | "setCopyPromptSourceId"
    | "setIsCopyVariableModalOpen"
  >,
) {
  setters.setIsCopyVariableModalOpen(false);
  setters.setCopyPrompt(null);
  setters.setCopyPromptQueue([]);
  setters.setCopyPromptResults([]);
  setters.setCopyPromptQueueIndex(-1);
  setters.setCopyPromptSourceId(null);
}

async function handleQueueCopy(
  text: string,
  promptId: string,
  queue: PromptWorkspaceDialogsProps["copyPromptQueue"],
  queueIndex: number,
  setters: Pick<
    PromptWorkspaceDialogsProps,
    | "setCopyPrompt"
    | "setCopyPromptQueueIndex"
    | "setCopyPromptResults"
    | "setIsCopyVariableModalOpen"
  >,
  utils: ReturnType<typeof useVariableDialogUtilities>,
  triggerCopied: () => void,
) {
  if (queue.length > 0 && queueIndex >= 0) {
    setters.setCopyPromptResults((results) =>
      replaceQueueResult(results, queueIndex, text),
    );
    setters.setIsCopyVariableModalOpen(false);
    setters.setCopyPrompt(null);
    setters.setCopyPromptQueueIndex((index) => index + 1);
    return;
  }
  await copySelectedPrompt(
    text,
    promptId,
    utils.incrementUsageCount,
    triggerCopied,
    utils.showToast,
    utils.t,
    utils.showCopyNotification,
    setters.setIsCopyVariableModalOpen,
  );
  setters.setCopyPrompt(null);
}

function replaceQueueResult(results: string[], index: number, value: string) {
  const next = [...results];
  next[index] = value;
  return next;
}

export function PromptWorkspaceVariableDialogs(
  props: PromptWorkspaceDialogsProps,
) {
  return (
    <>
      <PromptSelectedCopyDialog {...props} />
      <PromptAiVariableDialog {...props} />
      <PromptCompareVariableDialog {...props} />
      <PromptQueueCopyDialog {...props} />
    </>
  );
}
