import fs from "fs";
import path from "path";

import { BUILTIN_MCP_MARKET_SOURCES } from "@prompthub/shared/constants/mcp-market";
import type { McpMarketSource } from "@prompthub/shared/types/mcp";

import { getDataDir } from "./runtime-paths";

const MCP_MARKET_SOURCE_FILE_NAME = "market-sources.json";
const MAX_CUSTOM_MCP_MARKET_SOURCES = 64;

interface McpMarketSourceRegistryFile {
  kind: "prompthub-mcp-market-sources";
  version: 1;
  updatedAt: string;
  sources: McpMarketSource[];
}

export interface AuthorizedMcpMarketFetch {
  source: McpMarketSource;
  url: string;
  allowPrivateNetwork: boolean;
  allowInsecurePrivateNetworkHttp: boolean;
}

export function getMcpMarketSourceRegistryFilePath(): string {
  return path.join(getDataDir(), "mcp", MCP_MARKET_SOURCE_FILE_NAME);
}

export function sanitizeMcpMarketSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return "invalid MCP market source URL";
  }
}

function normalizeCustomSource(source: McpMarketSource): McpMarketSource {
  const id = source.id.trim().slice(0, 128);
  const label = source.label.trim().slice(0, 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(id) || !label) {
    throw new Error("Invalid MCP market source identity");
  }
  const url = new URL(source.url.trim());
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("MCP market sources require an HTTP(S) URL");
  }
  if (url.toString().length > 2048) {
    throw new Error("MCP market source URL is too long");
  }
  return {
    id,
    label,
    url: url.toString(),
    description: source.description?.trim().slice(0, 512) || undefined,
    trustLevel: "community",
  };
}

function readCustomSources(): McpMarketSource[] {
  const filePath = getMcpMarketSourceRegistryFilePath();
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as Partial<McpMarketSourceRegistryFile>;
  if (!Array.isArray(raw.sources)) return [];
  const builtinIds = new Set(BUILTIN_MCP_MARKET_SOURCES.map(({ id }) => id));
  return raw.sources
    .filter((source) => !builtinIds.has(source.id))
    .map(normalizeCustomSource)
    .slice(0, MAX_CUSTOM_MCP_MARKET_SOURCES);
}

export function readRegisteredMcpMarketSources(): McpMarketSource[] {
  return [...BUILTIN_MCP_MARKET_SOURCES, ...readCustomSources()];
}

export function replaceCustomMcpMarketSources(
  sources: McpMarketSource[],
): McpMarketSource[] {
  const builtinIds = new Set(BUILTIN_MCP_MARKET_SOURCES.map(({ id }) => id));
  const byId = new Map<string, McpMarketSource>();
  for (const source of sources) {
    if (builtinIds.has(source.id)) continue;
    const normalized = normalizeCustomSource(source);
    byId.set(normalized.id, normalized);
  }
  const customSources = Array.from(byId.values()).slice(
    0,
    MAX_CUSTOM_MCP_MARKET_SOURCES,
  );
  const filePath = getMcpMarketSourceRegistryFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(
    tempPath,
    `${JSON.stringify(
      {
        kind: "prompthub-mcp-market-sources",
        version: 1,
        updatedAt: new Date().toISOString(),
        sources: customSources,
      } satisfies McpMarketSourceRegistryFile,
      null,
      2,
    )}\n`,
    "utf8",
  );
  fs.renameSync(tempPath, filePath);
  return [...BUILTIN_MCP_MARKET_SOURCES, ...customSources];
}

function isAllowedSourcePath(source: URL, requested: URL): boolean {
  const sourcePath = source.pathname;
  if (sourcePath === "/") return true;
  if (sourcePath.endsWith("/"))
    return requested.pathname.startsWith(sourcePath);
  return requested.pathname === sourcePath;
}

export function authorizeMcpMarketFetch(
  sourceId: string,
  requestedUrl: string,
): AuthorizedMcpMarketFetch {
  const source = readRegisteredMcpMarketSources().find(
    (candidate) => candidate.id === sourceId,
  );
  if (!source) throw new Error("MCP market source is not registered");
  const sourceUrl = new URL(source.url);
  const requested = new URL(requestedUrl);
  if (!["http:", "https:"].includes(requested.protocol)) {
    throw new Error("MCP market fetch only allows HTTP(S) URLs");
  }
  if (sourceUrl.origin !== requested.origin) {
    throw new Error("MCP market fetch origin does not match registered source");
  }
  if (!isAllowedSourcePath(sourceUrl, requested)) {
    throw new Error("MCP market fetch path is outside the registered source");
  }
  const builtin = BUILTIN_MCP_MARKET_SOURCES.some(
    (candidate) => candidate.id === source.id,
  );
  return {
    source,
    url: requested.toString(),
    allowPrivateNetwork: !builtin,
    allowInsecurePrivateNetworkHttp: !builtin,
  };
}
