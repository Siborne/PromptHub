import { lazy, Suspense } from "react";
import type { PromptWorkspaceDialogsProps } from "./prompt-workspace-dialog-types";

const EditPromptModal = lazy(() =>
  import("../prompt/EditPromptModal").then((module) => ({
    default: module.EditPromptModal,
  })),
);
const PromptQuickRewriteDialog = lazy(() =>
  import("../prompt/PromptQuickRewriteDialog").then((module) => ({
    default: module.PromptQuickRewriteDialog,
  })),
);

function PromptEditorDialog({
  editingPrompt,
  setEditingPrompt,
}: Pick<PromptWorkspaceDialogsProps, "editingPrompt" | "setEditingPrompt">) {
  if (!editingPrompt) return null;
  return (
    <Suspense fallback={null}>
      <EditPromptModal
        isOpen
        onClose={() => setEditingPrompt(null)}
        prompt={editingPrompt}
      />
    </Suspense>
  );
}

function PromptQuickRewriteModal({
  quickRewritePrompt,
  setEditingPrompt,
  setQuickRewritePrompt,
}: Pick<
  PromptWorkspaceDialogsProps,
  "quickRewritePrompt" | "setEditingPrompt" | "setQuickRewritePrompt"
>) {
  if (!quickRewritePrompt) return null;
  return (
    <Suspense fallback={null}>
      <PromptQuickRewriteDialog
        isOpen
        onClose={() => setQuickRewritePrompt(null)}
        prompt={quickRewritePrompt}
        onContinueEditing={(prompt) => {
          setQuickRewritePrompt(null);
          setEditingPrompt(prompt);
        }}
      />
    </Suspense>
  );
}

export function PromptWorkspaceEditorDialogs(
  props: PromptWorkspaceDialogsProps,
) {
  return (
    <>
      <PromptEditorDialog {...props} />
      <PromptQuickRewriteModal {...props} />
    </>
  );
}
