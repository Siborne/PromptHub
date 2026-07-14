import crypto from "crypto";

import type {
  McpMarketTemplate,
  McpMarketUpdateCheck,
  McpMarketUpdateResult,
  McpServerConfig,
} from "@prompthub/shared/types/mcp";

export type McpMarketUpdatePreparation =
  | {
      errorCode: "MARKET_UPDATE_REVIEW_REQUIRED" | "SOURCE_MISMATCH";
      reason: string;
    }
  | { result: McpMarketUpdateResult; shouldPersist: boolean };

function sortedKeys(value?: Record<string, string>): string[] {
  return Object.keys(value ?? {}).sort();
}

function fingerprint(value: unknown): string {
  return `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex")}`;
}

function templateSignature(template: McpMarketTemplate) {
  return {
    templateId: template.id,
    version: template.version ?? "",
    displayName: template.displayName,
    description: template.description,
    transport: template.transport,
    command: template.command ?? "",
    args: template.args ?? [],
    url: template.url ?? "",
    envKeys: sortedKeys(template.env),
    headerKeys: sortedKeys(template.headers),
  };
}

function serverSignature(server: McpServerConfig) {
  return {
    templateId: server.source.id ?? "",
    version: server.source.installedTemplateVersion ?? "",
    displayName: server.displayName,
    description: server.description ?? "",
    transport: server.transport,
    command: server.command ?? "",
    args: server.args ?? [],
    url: server.url ?? "",
    envKeys: sortedKeys(server.env),
    headerKeys: sortedKeys(server.headers),
  };
}

export function computeMcpMarketTemplateFingerprint(
  template: McpMarketTemplate,
): string {
  return fingerprint(templateSignature(template));
}

export function computeInstalledMcpMarketFingerprint(
  server: McpServerConfig,
): string {
  return fingerprint(serverSignature(server));
}

export function reconcileMcpMarketTemplate(
  server: McpServerConfig,
  template: McpMarketTemplate,
  checkedAt = Date.now(),
): McpMarketUpdateCheck {
  const installedFingerprint = server.source.installedTemplateFingerprint;
  const localFingerprint = computeInstalledMcpMarketFingerprint(server);
  const remoteFingerprint = computeMcpMarketTemplateFingerprint(template);
  const base = {
    serverId: server.id,
    templateId: template.id,
    installedFingerprint,
    localFingerprint,
    remoteFingerprint,
    checkedAt,
  };

  if (server.source.type !== "market" || server.source.id !== template.id) {
    return {
      ...base,
      status: "source-mismatch",
      localModified: false,
      remoteChanged: false,
      reason: "The installed MCP does not belong to this market template.",
    };
  }
  if (localFingerprint === remoteFingerprint) {
    return {
      ...base,
      status: "up-to-date",
      localModified: false,
      remoteChanged: false,
      reason: "The installed MCP matches the current market template.",
    };
  }
  if (!installedFingerprint) {
    return {
      ...base,
      status: "legacy-review",
      localModified: true,
      remoteChanged: true,
      reason: "This legacy MCP has no installed market baseline.",
    };
  }

  const localModified = localFingerprint !== installedFingerprint;
  const remoteChanged = remoteFingerprint !== installedFingerprint;
  const status = localModified
    ? remoteChanged
      ? "conflict"
      : "local-modified"
    : "update-available";
  return {
    ...base,
    status,
    localModified,
    remoteChanged,
    reason:
      status === "update-available"
        ? "A newer market template is available."
        : status === "local-modified"
          ? "The installed MCP configuration was changed locally."
          : "Both the installed MCP and market template changed.",
  };
}

function mergeSecretValues(
  templateValues?: Record<string, string>,
  currentValues?: Record<string, string>,
): Record<string, string> | undefined {
  const merged = { ...(templateValues ?? {}), ...(currentValues ?? {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function applyMcpMarketTemplate(
  server: McpServerConfig,
  template: McpMarketTemplate,
  updatedAt = Date.now(),
): McpServerConfig {
  const installedTemplateFingerprint =
    computeMcpMarketTemplateFingerprint(template);
  return {
    ...server,
    displayName: template.displayName,
    description: template.description,
    transport: template.transport,
    command: template.command,
    args: template.args,
    url: template.url,
    env: mergeSecretValues(template.env, server.env),
    headers: mergeSecretValues(template.headers, server.headers),
    source: {
      ...server.source,
      type: "market",
      id: template.id,
      label: template.source?.label || template.displayName,
      url:
        template.documentationUrl || template.homepage || template.source?.url,
      marketSourceId: template.source?.id,
      marketSourceUrl: template.source?.url,
      installedTemplateVersion: template.version,
      installedTemplateFingerprint,
      marketLastCheckedAt: updatedAt,
      marketLastError: undefined,
    },
    updatedAt,
  };
}

export function prepareMcpMarketTemplateUpdate(
  server: McpServerConfig,
  template: McpMarketTemplate,
  force = false,
): McpMarketUpdatePreparation {
  const check = reconcileMcpMarketTemplate(server, template);
  if (check.status === "source-mismatch") {
    return { errorCode: "SOURCE_MISMATCH", reason: check.reason };
  }
  if (check.status === "up-to-date") {
    return {
      result: { status: "up-to-date", check, server },
      shouldPersist: false,
    };
  }
  if (check.status !== "update-available" && !force) {
    return {
      errorCode: "MARKET_UPDATE_REVIEW_REQUIRED",
      reason: check.reason,
    };
  }
  const updated = applyMcpMarketTemplate(server, template);
  return {
    result: {
      status: "updated",
      check: reconcileMcpMarketTemplate(updated, template),
      server: updated,
    },
    shouldPersist: true,
  };
}
