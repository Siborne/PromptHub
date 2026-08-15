import { lazy, Suspense } from "react";
import { Spinner } from "../ui/Spinner";
import { PromptWorkspaceCardRoute } from "./PromptWorkspaceCardRoute";
import { PromptWorkspaceDialogLayer } from "./PromptWorkspaceDialogLayer";
import { usePromptWorkspaceContext } from "./PromptWorkspaceContext";
import { PromptWorkspaceViewRoutes } from "./PromptWorkspaceViewRoutes";

const SkillManager = lazy(() =>
  import("../skill/SkillManager").then((module) => ({
    default: module.SkillManager,
  })),
);

function PromptWorkspaceLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner />
    </div>
  );
}

function PromptWorkspaceRoutes() {
  const { stores } = usePromptWorkspaceContext();
  return (
    <>
      {stores.promptData.viewMode === "card" ? (
        <PromptWorkspaceCardRoute />
      ) : (
        <PromptWorkspaceViewRoutes />
      )}
      <PromptWorkspaceDialogLayer />
    </>
  );
}

export function PromptWorkspaceContent() {
  const { stores } = usePromptWorkspaceContext();
  return (
    <main className="flex-1 relative overflow-hidden app-wallpaper-section">
      {stores.preferences.uiViewMode === "skill" ? (
        <Suspense fallback={<PromptWorkspaceLoading />}>
          <SkillManager />
        </Suspense>
      ) : (
        <PromptWorkspaceRoutes />
      )}
    </main>
  );
}
