import { lazy, Suspense } from "react";
import { Spinner } from "../ui/Spinner";
import { SidebarMcpPanel } from "./SidebarMcpPanel";
import { SidebarPluginPanel } from "./SidebarPluginPanel";
import { SidebarPromptPanel } from "./SidebarPromptPanel";
import { SidebarSkillPanel } from "./SidebarSkillPanel";
import type { SidebarController } from "./sidebar-view-types";
import { AgentsSidebarPanel } from "../agent/AgentsSidebarPanel";

const RulesSidebarPanel = lazy(() =>
  import("./RulesSidebarPanel").then((module) => ({
    default: module.RulesSidebarPanel,
  })),
);

function SidebarRulesPanel({ controller }: { controller: SidebarController }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-3 py-4">
          <Spinner
            size="sm"
            tone="muted"
            label={controller.t(
              "rules.loadingSidebar",
              "Loading rules sidebar",
            )}
          />
        </div>
      }
    >
      <RulesSidebarPanel
        currentPage={controller.currentPage}
        onNavigate={controller.onNavigate}
      />
    </Suspense>
  );
}

export function SidebarPanel({
  controller,
}: {
  controller: SidebarController;
}) {
  if (!controller.hasVisibleModule) return null;
  const content =
    controller.activeModule === "prompt" ? (
      <SidebarPromptPanel controller={controller} />
    ) : controller.activeModule === "skill" ? (
      <SidebarSkillPanel controller={controller} />
    ) : controller.activeModule === "agents" ? (
      <AgentsSidebarPanel />
    ) : controller.activeModule === "mcp" ? (
      <SidebarMcpPanel controller={controller} />
    ) : controller.activeModule === "plugin" ? (
      <SidebarPluginPanel controller={controller} />
    ) : (
      <SidebarRulesPanel controller={controller} />
    );
  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-sidebar-background/85">
      {content}
    </div>
  );
}
