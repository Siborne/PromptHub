import type { McpTargetPreset } from "@prompthub/core";
import type {
  McpEnvImportResult,
  McpHealthCheckResult,
  McpServerConfig,
  McpServerDraft,
  McpTargetStatusEntry,
  McpTargetSyncApplyResult,
  McpTargetSyncCheck,
} from "@prompthub/shared/types/mcp";
import { McpFullDetailPage } from "./McpFullDetailPage";
import { McpPlatformPanel } from "./McpPlatformPanel";
import { McpViewTransition } from "./mcp-manager-utils";

interface McpDetailWorkspaceProps {
  distributedTargetCount: number;
  healthCheck?: McpHealthCheckResult;
  server: McpServerConfig;
  targetPresets: McpTargetPreset[];
  targetStatus: McpTargetStatusEntry[];
  targetSyncChecks: McpTargetSyncCheck[];
  onApply: (presets: McpTargetPreset[]) => Promise<void>;
  onBack: () => void;
  onCheckServer: (serverId: string) => Promise<McpHealthCheckResult>;
  onCheckTargetSync: (serverId: string) => Promise<McpTargetSyncCheck[]>;
  onDelete: (serverId: string) => Promise<void>;
  onImportEnv: (
    serverId: string,
    envFilePath: string,
    selectedKeys?: string[],
  ) => Promise<McpEnvImportResult>;
  onRemove: (preset: McpTargetPreset) => Promise<void>;
  onSave: (serverId: string | null, draft: McpServerDraft) => Promise<void>;
  onSyncTargets: (serverId: string) => Promise<McpTargetSyncApplyResult>;
}

export function McpDetailWorkspace({
  distributedTargetCount,
  healthCheck,
  server,
  targetPresets,
  targetStatus,
  targetSyncChecks,
  onApply,
  onBack,
  onCheckServer,
  onCheckTargetSync,
  onDelete,
  onImportEnv,
  onRemove,
  onSave,
  onSyncTargets,
}: McpDetailWorkspaceProps) {
  return (
    <McpViewTransition viewKey={`detail-${server.id}`}>
      <McpFullDetailPage
        server={server}
        healthCheck={healthCheck}
        distributedTargetCount={distributedTargetCount}
        targetSyncChecks={targetSyncChecks}
        platformPanel={
          <McpPlatformPanel
            server={server}
            targetPresets={targetPresets}
            targetStatus={targetStatus}
            onApply={onApply}
            onRemove={onRemove}
          />
        }
        onBack={onBack}
        onSave={onSave}
        onCheckServer={onCheckServer}
        onCheckTargetSync={onCheckTargetSync}
        onSyncTargets={onSyncTargets}
        onImportEnv={onImportEnv}
        onDelete={onDelete}
      />
    </McpViewTransition>
  );
}
