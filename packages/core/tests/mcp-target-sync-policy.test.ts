import { describe, expect, it } from "vitest";

import {
  canRewriteTomlManagedSibling,
  getMcpTargetSyncReason,
  shouldSkipDisabledMcpPlatform,
} from "../src/mcp-target-sync-policy";
import type {
  McpTargetBinding,
  McpTargetSyncCheck,
  McpTargetSyncStatus,
} from "@prompthub/shared/types/mcp";

const binding: McpTargetBinding = {
  id: "codex:global:/tmp/config.toml",
  serverIds: ["mcp_review"],
  target: "codex",
  scope: "global",
  path: "/tmp/config.toml",
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

function check(status: McpTargetSyncStatus): McpTargetSyncCheck {
  return {
    bindingId: binding.id,
    target: binding.target,
    scope: binding.scope,
    path: binding.path,
    serverId: "mcp_review",
    serverName: "review",
    status,
    safeToReapply: false,
    reason: status,
  };
}

describe("MCP target sync policy", () => {
  it("returns a reason for every target sync status", () => {
    const statuses: McpTargetSyncStatus[] = [
      "synced",
      "needs-sync",
      "external-modified",
      "conflict",
      "missing-target",
      "missing-entry",
      "parse-error",
      "legacy-needs-review",
      "skipped-disabled-platform",
      "skipped-server-disabled",
    ];
    statuses.forEach((status) =>
      expect(getMcpTargetSyncReason(status)).toBeTruthy(),
    );
  });

  it("only rewrites safe or explicitly forced TOML siblings", () => {
    expect(canRewriteTomlManagedSibling(check("synced"))).toBe(true);
    expect(canRewriteTomlManagedSibling(check("needs-sync"))).toBe(true);
    expect(
      canRewriteTomlManagedSibling(check("missing-entry"), {
        recreateMissing: true,
      }),
    ).toBe(true);
    expect(canRewriteTomlManagedSibling(check("missing-entry"))).toBe(false);
    expect(
      canRewriteTomlManagedSibling(check("conflict"), { forceConflicts: true }),
    ).toBe(true);
    expect(canRewriteTomlManagedSibling(check("external-modified"))).toBe(
      false,
    );
  });

  it("respects the disabled-platform filter and include override", () => {
    expect(
      shouldSkipDisabledMcpPlatform(binding, {
        disabledPlatformIds: ["codex"],
      }),
    ).toBe(true);
    expect(
      shouldSkipDisabledMcpPlatform(binding, {
        disabledPlatformIds: ["codex"],
        includeDisabled: true,
      }),
    ).toBe(false);
    expect(shouldSkipDisabledMcpPlatform(binding)).toBe(false);
  });
});
