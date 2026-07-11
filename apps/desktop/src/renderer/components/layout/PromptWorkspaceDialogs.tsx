import { PromptWorkspaceEditorDialogs } from "./PromptWorkspaceEditorDialogs";
import { PromptWorkspaceModalDialogs } from "./PromptWorkspaceModalDialogs";
import { PromptWorkspaceSupplementDialogs } from "./PromptWorkspaceSupplementDialogs";
import { PromptWorkspaceVariableDialogs } from "./PromptWorkspaceVariableDialogs";
import type { PromptWorkspaceDialogsProps } from "./prompt-workspace-dialog-types";

export type { PromptWorkspaceDialogsProps } from "./prompt-workspace-dialog-types";

export function PromptWorkspaceDialogs(props: PromptWorkspaceDialogsProps) {
  return (
    <>
      <PromptWorkspaceEditorDialogs {...props} />
      <PromptWorkspaceModalDialogs {...props} />
      <PromptWorkspaceVariableDialogs {...props} />
      <PromptWorkspaceSupplementDialogs {...props} />
    </>
  );
}
