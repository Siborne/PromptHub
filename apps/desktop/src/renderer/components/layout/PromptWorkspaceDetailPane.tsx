import type { PromptWorkspaceDetailPaneProps } from "./prompt-workspace-detail-types";
import { PromptWorkspaceDetailProvider } from "./PromptWorkspaceDetailContext";
import { PromptWorkspaceDetailBody } from "./PromptWorkspaceDetailBody";

export type { PromptWorkspaceDetailPaneProps } from "./prompt-workspace-detail-types";

export function PromptWorkspaceDetailPane(
  props: PromptWorkspaceDetailPaneProps,
) {
  return (
    <PromptWorkspaceDetailProvider value={props}>
      <PromptWorkspaceDetailBody />
    </PromptWorkspaceDetailProvider>
  );
}
