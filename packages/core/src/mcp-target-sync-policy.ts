import type {
  McpTargetBinding,
  McpTargetSyncCheck,
  McpTargetSyncOptions,
  McpTargetSyncStatus,
} from "@prompthub/shared/types/mcp";

const SYNC_REASONS: Record<McpTargetSyncStatus, string> = {
  synced: "target matches current PromptHub MCP projection",
  "needs-sync": "PromptHub MCP changed after the last target apply",
  "external-modified": "target MCP entry changed outside PromptHub",
  conflict: "PromptHub MCP and target MCP entry both changed",
  "missing-target": "target config file is missing",
  "missing-entry": "target config file no longer contains this MCP entry",
  "parse-error": "target config file cannot be parsed",
  "legacy-needs-review":
    "legacy binding has no baseline and target differs from PromptHub",
  "skipped-disabled-platform": "target platform is disabled in settings",
  "skipped-server-disabled": "MCP server is disabled in PromptHub",
};

export function getMcpTargetSyncReason(status: McpTargetSyncStatus): string {
  return SYNC_REASONS[status];
}

export function canRewriteTomlManagedSibling(
  check: McpTargetSyncCheck,
  options?: McpTargetSyncOptions,
): boolean {
  if (check.status === "synced" || check.status === "needs-sync") return true;
  if (
    (check.status === "missing-target" || check.status === "missing-entry") &&
    options?.recreateMissing
  ) {
    return true;
  }
  return Boolean(
    (check.status === "conflict" ||
      check.status === "external-modified" ||
      check.status === "legacy-needs-review" ||
      check.status === "parse-error") &&
    options?.forceConflicts,
  );
}

export function shouldSkipDisabledMcpPlatform(
  binding: McpTargetBinding,
  options?: McpTargetSyncOptions,
): boolean {
  if (options?.includeDisabled) return false;
  return new Set(options?.disabledPlatformIds ?? []).has(binding.target);
}
