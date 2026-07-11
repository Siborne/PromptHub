import { PromptWorkspaceContent } from "./PromptWorkspaceContent";
import { PromptWorkspaceProvider } from "./PromptWorkspaceContext";
import { usePromptWorkspaceController } from "./usePromptWorkspaceController";

export function PromptWorkspace() {
  const controller = usePromptWorkspaceController();
  return (
    <PromptWorkspaceProvider value={controller}>
      <PromptWorkspaceContent />
    </PromptWorkspaceProvider>
  );
}
