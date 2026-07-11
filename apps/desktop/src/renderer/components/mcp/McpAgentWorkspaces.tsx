import type { TFunction } from "i18next";
import type { McpTargetPreset } from "@prompthub/core";
import type {
  McpServerConfig,
  McpTargetStatusEntry,
} from "@prompthub/shared/types/mcp";
import { McpAgentsView } from "./McpAgentsView";
import { McpViewTransition } from "./mcp-manager-utils";

interface McpAgentWorkspacesProps {
  mode: "agents" | "projects";
  projectTargetPresets: McpTargetPreset[];
  servers: McpServerConfig[];
  t: TFunction;
  targetPresets: McpTargetPreset[];
  targetStatus: McpTargetStatusEntry[];
  onAddMcp: (preset: McpTargetPreset) => void;
  onImportExternal: (
    preset: McpTargetPreset,
    serverName: string,
  ) => Promise<void>;
  onOpenAgentConfig: (preset: McpTargetPreset) => Promise<void>;
  onOpenManaged: (server: McpServerConfig) => void;
  onRefresh: () => Promise<void>;
  onRemoveAgentEntry: (
    preset: McpTargetPreset,
    serverName: string,
  ) => Promise<void>;
}

export function McpAgentWorkspaces({
  mode,
  projectTargetPresets,
  servers,
  t,
  targetPresets,
  targetStatus,
  onAddMcp,
  onImportExternal,
  onOpenAgentConfig,
  onOpenManaged,
  onRefresh,
  onRemoveAgentEntry,
}: McpAgentWorkspacesProps) {
  const isProjectMode = mode === "projects";

  return (
    <McpViewTransition viewKey={mode}>
      <McpAgentsView
        servers={servers}
        targetPresets={isProjectMode ? projectTargetPresets : targetPresets}
        targetStatus={targetStatus}
        title={isProjectMode ? t("mcp.projectMcp", "Project MCP") : undefined}
        sidebarHint={
          isProjectMode
            ? t(
                "mcp.projectMcpSidebarHint",
                "Manage project-level MCP configs for registered projects.",
              )
            : undefined
        }
        noTargetsLabel={
          isProjectMode
            ? t("mcp.noProjectTargets", "No project targets")
            : undefined
        }
        selectTargetLabel={
          isProjectMode
            ? t("mcp.selectProjectTarget", "Select a project target")
            : undefined
        }
        targetIconVariant={isProjectMode ? "project" : undefined}
        openConfigLabel={
          isProjectMode
            ? t("mcp.openProjectConfig", "Open project config")
            : undefined
        }
        removeEntryLabel={
          isProjectMode
            ? t("mcp.removeFromProject", "Remove from Project")
            : undefined
        }
        onAddMcp={onAddMcp}
        onImportExternal={onImportExternal}
        onOpenManaged={onOpenManaged}
        onOpenAgentConfig={onOpenAgentConfig}
        onRemoveAgentEntry={onRemoveAgentEntry}
        onRefresh={onRefresh}
      />
    </McpViewTransition>
  );
}
