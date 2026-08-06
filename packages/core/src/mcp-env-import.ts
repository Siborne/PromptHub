import type {
  McpEnvImportResult,
  McpServerConfig,
} from "@prompthub/shared/types/mcp";
import {
  inferMcpEnvRequirements,
  normalizeMcpServerDraft,
  parseMcpDotEnv,
} from "@prompthub/shared/utils/mcp-config";

export function buildMcpEnvImportResult(
  server: McpServerConfig,
  content: string,
  selectedKeys?: string[],
  updatedAt = Date.now(),
): McpEnvImportResult {
  const parsedEnv = parseMcpDotEnv(content);
  const requiredKeys = inferMcpEnvRequirements(server).map((item) => item.name);
  const allowedKeys = new Set(
    selectedKeys?.length ? selectedKeys : requiredKeys,
  );
  const importedEntries = Object.entries(parsedEnv).filter(([key]) =>
    allowedKeys.has(key),
  );
  const importedKeys = importedEntries.map(([key]) => key);
  const skippedKeys = Array.from(allowedKeys).filter(
    (key) => !Object.prototype.hasOwnProperty.call(parsedEnv, key),
  );
  const nextEnvRefs = { ...(server.envRefs ?? {}) };
  for (const key of importedKeys) {
    delete nextEnvRefs[key];
  }
  const nextServer = normalizeMcpServerDraft({
    ...server,
    env: {
      ...(server.env ?? {}),
      ...Object.fromEntries(importedEntries),
    },
    envRefs: Object.keys(nextEnvRefs).length > 0 ? nextEnvRefs : undefined,
    updatedAt,
  });
  const missingKeys = inferMcpEnvRequirements(nextServer)
    .filter((item) => {
      const value = nextServer.env?.[item.name];
      return item.required && (!value || /^<[^>]+>$/.test(value.trim()));
    })
    .map((item) => item.name);

  return {
    server: nextServer,
    importedKeys,
    skippedKeys,
    missingKeys,
  };
}
