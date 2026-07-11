import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settings.store";
import { useMcpStore } from "../../stores/mcp.store";
import { useToast } from "../ui/Toast";

/** Collects process-local state and store contracts consumed by the MCP page. */
export function useMcpManagerBindings() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const disabledPlatformIds = useSettingsStore(
    (state) => state.disabledPlatformIds,
  );
  const skillProjects = useSettingsStore((state) => state.skillProjects);
  const mcpStore = useMcpStore();
  return { t, showToast, disabledPlatformIds, skillProjects, mcpStore };
}

export type McpManagerBindings = ReturnType<typeof useMcpManagerBindings>;
