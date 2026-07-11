import { lazy, Suspense } from "react";
import { useUIStore } from "../../stores/ui.store";
import { Spinner } from "../ui/Spinner";
import { PromptWorkspace } from "./PromptWorkspace";

const RulesManager = lazy(() =>
  import("../rules/RulesManager").then((module) => ({
    default: module.RulesManager,
  })),
);
const McpManager = lazy(() =>
  import("../mcp/McpManager").then((module) => ({
    default: module.McpManager,
  })),
);
const PluginManager = lazy(() =>
  import("../plugin/PluginManager").then((module) => ({
    default: module.PluginManager,
  })),
);

const loadingFallback = (
  <div className="flex flex-1 items-center justify-center">
    <Spinner />
  </div>
);

export { PromptCard } from "./PromptVirtualizedList";

export function MainContent() {
  const appModule = useUIStore((state) => state.appModule);

  if (appModule === "rules") {
    return (
      <Suspense fallback={loadingFallback}>
        <RulesManager />
      </Suspense>
    );
  }

  if (appModule === "mcp") {
    return (
      <Suspense fallback={loadingFallback}>
        <McpManager />
      </Suspense>
    );
  }

  if (appModule === "plugin") {
    return (
      <Suspense fallback={loadingFallback}>
        <PluginManager />
      </Suspense>
    );
  }

  return <PromptWorkspace />;
}
