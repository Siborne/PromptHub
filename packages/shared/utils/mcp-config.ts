import type {
  McpEnvRequirement,
  McpMarketTemplate,
  McpPlaceholderRequirement,
  McpRuntimeDetails,
  McpServerConfig,
  McpServerDraft,
  McpTargetEntryDigest,
  McpTargetKind,
  McpTransport,
} from "../types/mcp";

export class McpConfigError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "McpConfigError";
    this.code = code;
  }
}

export const MCP_JSON_TARGETS: McpTargetKind[] = [
  "claude",
  "claude-desktop",
  "cursor",
  "cline",
  "gemini",
  "windsurf",
  "kiro",
  "kilo",
  "workbuddy",
  "codebuddy",
  "custom-json",
];

/**
 * Resolve the JSON root key holding server entries for a target.
 * 解析目标配置文件中存放 MCP 服务条目的根级 key。
 */
export function getMcpServersJsonKey(
  target: McpTargetKind,
): "mcpServers" | "servers" | "mcp" {
  if (target === "vscode") {
    return "servers";
  }
  if (target === "opencode" || target === "kilo") {
    return "mcp";
  }
  return "mcpServers";
}

const HTTP_TRANSPORTS: McpTransport[] = ["streamable-http", "sse"];

export const MCP_TARGET_ENTRY_DIGEST_ALGORITHM =
  "mcp-target-entry-sha256-v1" as const;

function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}

export function sanitizeMcpServerName(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "mcp-server";
}

export function parseMcpArgs(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (!value) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .flatMap((line) => line.split(/\s+/))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseMcpKeyValueLines(
  value: string | Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }
  if (
    typeof value !== "string" &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => [key.trim(), String(entryValue)] as const)
      .filter(([key]) => key.length > 0);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  const entries = String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return [line, ""] as const;
      }
      return [
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim(),
      ] as const;
    })
    .filter(([key]) => key.length > 0);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function parseMcpDotEnv(content: string): Record<string, string> {
  const entries: Array<[string, string]> = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    entries.push([key, parseDotEnvValue(normalized.slice(separatorIndex + 1))]);
  }

  return Object.fromEntries(entries);
}

function parseDotEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  const commentIndex = trimmed.search(/\s#/);
  return (
    commentIndex === -1 ? trimmed : trimmed.slice(0, commentIndex)
  ).trim();
}

export function inferMcpRuntimeDetails(
  server: Pick<McpServerConfig, "transport" | "command" | "args" | "url">,
): McpRuntimeDetails {
  if (server.transport !== "stdio") {
    return {
      runtime: server.transport.toUpperCase(),
      packageOrScript: server.url,
    };
  }

  return {
    runtime: getExecutableName(server.command),
    packageOrScript: inferPackageOrScript(server.args),
  };
}

function getExecutableName(command?: string): string | undefined {
  const name = command?.split(/[\\/]/).pop()?.trim();
  return name || undefined;
}

function inferPackageOrScript(args?: string[]): string | undefined {
  return (args ?? []).find((value) => {
    if (!value || value.startsWith("-") || isPlaceholder(value)) {
      return false;
    }
    return (
      value.startsWith("@") ||
      /\.(cjs|js|mjs|ts|py)$/i.test(value) ||
      /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9._-]+)?$/i.test(value)
    );
  });
}

export function inferMcpEnvRequirements(
  config: Pick<McpServerConfig, "env" | "args" | "url" | "headers">,
): McpEnvRequirement[] {
  const requirements = new Map<string, McpEnvRequirement>();

  for (const [name, value] of Object.entries(config.env ?? {})) {
    requirements.set(name, {
      name,
      required: value.trim() === "" || isPlaceholder(value),
      placeholder: isPlaceholder(value) ? value : undefined,
      source: "env",
    });
  }

  for (const value of config.args ?? []) {
    addVariableReferences(requirements, value, "args");
  }
  if (config.url) {
    addVariableReferences(requirements, config.url, "url");
  }
  for (const value of Object.values(config.headers ?? {})) {
    addVariableReferences(requirements, value, "headers");
  }

  return Array.from(requirements.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function inferMcpPlaceholderRequirements(
  config: Pick<McpServerConfig, "args" | "url" | "headers">,
): McpPlaceholderRequirement[] {
  const placeholders: McpPlaceholderRequirement[] = [];
  for (const value of config.args ?? []) {
    addPlaceholder(placeholders, value, "args");
  }
  if (config.url) {
    addPlaceholder(placeholders, config.url, "url");
  }
  for (const value of Object.values(config.headers ?? {})) {
    addPlaceholder(placeholders, value, "headers");
  }
  return placeholders;
}

function addVariableReferences(
  requirements: Map<string, McpEnvRequirement>,
  value: string,
  source: McpEnvRequirement["source"],
): void {
  const pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  let match = pattern.exec(value);
  while (match) {
    const name = match[1];
    if (!requirements.has(name)) {
      requirements.set(name, { name, required: true, source });
    }
    match = pattern.exec(value);
  }
}

function addPlaceholder(
  placeholders: McpPlaceholderRequirement[],
  value: string,
  source: McpPlaceholderRequirement["source"],
): void {
  if (isPlaceholder(value)) {
    placeholders.push({ value, source });
  }
}

function isPlaceholder(value: string): boolean {
  return /^<[^>]+>$/.test(value.trim());
}

export function normalizeMcpServerDraft(
  draft: McpServerDraft,
  now = Date.now(),
): McpServerConfig {
  const name = sanitizeMcpServerName(
    draft.name || draft.displayName || "mcp-server",
  );
  const transport = draft.transport || "stdio";
  const displayName = (draft.displayName || name).trim();
  const command = draft.command?.trim();
  const url = draft.url?.trim();
  const env = parseMcpKeyValueLines(draft.env);
  const headers = parseMcpKeyValueLines(draft.headers);
  const args = parseMcpArgs(draft.args);

  if (transport === "stdio" && !command) {
    throw new McpConfigError(
      "INVALID_SERVER",
      "stdio MCP 服务必须填写 command",
    );
  }
  if (HTTP_TRANSPORTS.includes(transport) && !url) {
    throw new McpConfigError("INVALID_SERVER", "远程 MCP 服务必须填写 url");
  }

  return {
    id: draft.id || createId("mcp"),
    name,
    displayName,
    description: draft.description?.trim() || undefined,
    notes: draft.notes?.trim() || undefined,
    transport,
    command,
    args: args.length > 0 ? args : undefined,
    cwd: draft.cwd?.trim() || undefined,
    env,
    url,
    headers,
    enabled: draft.enabled !== false,
    isFavorite: draft.isFavorite === true,
    tags: Array.from(
      new Set((draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
    ),
    source: draft.source ?? { type: "manual" },
    createdAt: draft.createdAt ?? now,
    updatedAt: draft.updatedAt ?? now,
  };
}

export function installMcpTemplate(
  template: McpMarketTemplate,
  now = Date.now(),
): McpServerConfig {
  return normalizeMcpServerDraft(
    {
      ...template,
      source: {
        type: "market",
        id: template.id,
        label: template.source?.label || template.displayName,
        url:
          template.documentationUrl ||
          template.homepage ||
          template.source?.url,
      },
      enabled: true,
    },
    now,
  );
}

export function toMcpServerEntry(
  server: McpServerConfig,
): Record<string, unknown> {
  if (server.transport === "stdio") {
    return stripUndefined({
      command: server.command,
      args: server.args,
      cwd: server.cwd,
      env: server.env,
    });
  }

  return stripUndefined({
    type: server.transport === "sse" ? "sse" : "http",
    url: server.url,
    headers: server.headers,
  });
}

/**
 * OpenCode and Kilo Code use an MCP entry shape where local stdio
 * servers store a combined command array and remote servers store url/headers.
 * OpenCode uses its own MCP entry shape:
 * local servers use `type: "local"` with a combined command array,
 * remote servers use `type: "remote"` with url/headers.
 * OpenCode 使用专有的 MCP 配置结构：本地服务为 type:"local" + 合并的
 * command 数组，远程服务为 type:"remote" + url/headers。
 */
export function toOpenCodeMcpEntry(
  server: McpServerConfig,
): Record<string, unknown> {
  if (server.transport === "stdio") {
    return stripUndefined({
      type: "local",
      command: [server.command ?? "", ...(server.args ?? [])].filter(Boolean),
      environment:
        server.env && Object.keys(server.env).length > 0
          ? server.env
          : undefined,
      enabled: true,
    });
  }

  return stripUndefined({
    type: "remote",
    url: server.url,
    headers:
      server.headers && Object.keys(server.headers).length > 0
        ? server.headers
        : undefined,
    enabled: true,
  });
}

function toCodexTomlMcpEntry(server: McpServerConfig): Record<string, unknown> {
  if (server.transport === "stdio") {
    return stripUndefined({
      command: server.command,
      args: server.args,
      cwd: server.cwd,
      env: server.env,
    });
  }

  return stripUndefined({
    url: server.url,
    http_headers:
      server.headers && Object.keys(server.headers).length > 0
        ? server.headers
        : undefined,
  });
}

export function getMcpTargetEntryObject(
  target: McpTargetKind,
  server: McpServerConfig,
): Record<string, unknown> {
  if (target === "opencode" || target === "kilo") {
    return toOpenCodeMcpEntry(server);
  }
  if (target === "codex" || target === "custom-toml") {
    return toCodexTomlMcpEntry(server);
  }
  return toMcpServerEntry(server);
}

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

function canonicalizeJsonValue(value: unknown): CanonicalJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      const canonical = canonicalizeJsonValue(item);
      return canonical === undefined ? null : canonical;
    });
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .flatMap(([key, entryValue]) => {
          const canonical = canonicalizeJsonValue(entryValue);
          return canonical === undefined ? [] : [[key, canonical]];
        }),
    );
  }
  return String(value);
}

export function canonicalizeMcpTargetEntry(entry: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(entry) ?? null);
}

export function computeMcpTargetEntryDigest(
  target: McpTargetKind,
  entry: Record<string, unknown>,
  recordedAt = Date.now(),
  serverName = "",
): McpTargetEntryDigest {
  void target;
  return {
    algorithm: MCP_TARGET_ENTRY_DIGEST_ALGORITHM,
    digest: sha256HexSync(canonicalizeMcpTargetEntry(entry)),
    serverName,
    recordedAt,
  };
}

export function parseMcpJsonConfigContent(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(stripJsoncSyntax(trimmed));
}

function stripJsoncSyntax(content: string): string {
  return stripTrailingJsonCommas(stripJsonComments(content));
}

function stripJsonComments(content: string): string {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < content.length && !/[\r\n]/.test(content[index])) {
        index += 1;
      }
      output += content[index] ?? "";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (
        index < content.length &&
        !(content[index] === "*" && content[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function stripTrailingJsonCommas(content: string): string {
  let output = "";
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(content[lookahead] ?? "")) {
        lookahead += 1;
      }
      if (content[lookahead] === "}" || content[lookahead] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

export function buildMcpServersJson(servers: McpServerConfig[]): {
  mcpServers: Record<string, Record<string, unknown>>;
} {
  return {
    mcpServers: Object.fromEntries(
      servers
        .filter((server) => server.enabled)
        .map((server) => [server.name, toMcpServerEntry(server)]),
    ),
  };
}

export function buildVsCodeMcpJson(servers: McpServerConfig[]): {
  servers: Record<string, Record<string, unknown>>;
} {
  return {
    servers: Object.fromEntries(
      servers
        .filter((server) => server.enabled)
        .map((server) => [server.name, toMcpServerEntry(server)]),
    ),
  };
}

export function buildMcpTargetJson(
  target: McpTargetKind,
  servers: McpServerConfig[],
): Record<string, unknown> {
  const key = getMcpServersJsonKey(target);
  return {
    [key]: Object.fromEntries(
      servers
        .filter((server) => server.enabled)
        .map((server) => [
          server.name,
          getMcpTargetEntryObject(target, server),
        ]),
    ),
  };
}

export function buildCodexMcpToml(servers: McpServerConfig[]): string {
  return servers
    .filter((server) => server.enabled)
    .map((server) => {
      const lines = [`[mcp_servers.${tomlBareKey(server.name)}]`];
      if (server.transport === "stdio") {
        lines.push(`command = ${tomlString(server.command || "")}`);
        if (server.args?.length) {
          lines.push(`args = [${server.args.map(tomlString).join(", ")}]`);
        }
        if (server.cwd) {
          lines.push(`cwd = ${tomlString(server.cwd)}`);
        }
        if (server.env && Object.keys(server.env).length > 0) {
          lines.push(`env = ${tomlInlineTable(server.env)}`);
        }
      } else if (server.url) {
        lines.push(`url = ${tomlString(server.url)}`);
        if (server.headers && Object.keys(server.headers).length > 0) {
          lines.push(`http_headers = ${tomlInlineTable(server.headers)}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildMcpConfigPreview(
  target: McpTargetKind,
  servers: McpServerConfig[],
): string {
  if (target === "codex" || target === "custom-toml") {
    return `${buildCodexMcpToml(servers)}\n`;
  }
  return `${JSON.stringify(buildMcpTargetJson(target, servers), null, 2)}\n`;
}

export function mergeMcpServersJson(
  existing: unknown,
  target: McpTargetKind,
  servers: McpServerConfig[],
): Record<string, unknown> {
  const root =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const key = getMcpServersJsonKey(target);
  const existingServers =
    root[key] && typeof root[key] === "object" && !Array.isArray(root[key])
      ? { ...(root[key] as Record<string, unknown>) }
      : {};

  for (const server of servers.filter((item) => item.enabled)) {
    existingServers[server.name] = getMcpTargetEntryObject(target, server);
  }

  root[key] = existingServers;
  return root;
}

/**
 * Remove named MCP server entries from a JSON target config while keeping
 * every unrelated key untouched.
 * 从 JSON 目标配置中删除指定名称的 MCP 服务条目，保持其他配置不变。
 */
export function removeMcpServersFromJson(
  existing: unknown,
  target: McpTargetKind,
  serverNames: string[],
): Record<string, unknown> {
  const root =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const key = getMcpServersJsonKey(target);
  if (!root[key] || typeof root[key] !== "object" || Array.isArray(root[key])) {
    return root;
  }
  const names = new Set(serverNames);
  root[key] = Object.fromEntries(
    Object.entries(root[key] as Record<string, unknown>).filter(
      ([name]) => !names.has(name),
    ),
  );
  return root;
}

/**
 * Remove `[mcp_servers.<name>]` sections from a Codex-style TOML config.
 * Sections end at the next top-level table header. Quoted section names are
 * supported. Unrelated content is preserved byte-for-byte.
 * 从 Codex 风格 TOML 配置中删除指定 server 的配置段，其余内容原样保留。
 */
export function removeCodexMcpTomlServers(
  existingContent: string,
  serverNames: string[],
): string {
  const names = new Set(serverNames);
  const lines = existingContent.split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const section = parseCodexMcpTomlSection(line);
    if (section) {
      skipping = names.has(section.serverName);
      if (skipping) {
        continue;
      }
    } else if (skipping && /^\s*\[/.test(line)) {
      // A new table header ends the skipped section.
      skipping = false;
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * List MCP server names present in a JSON target config.
 * 列出 JSON 目标配置中已存在的 MCP 服务名称。
 */
export function listMcpServerNamesInJson(
  existing: unknown,
  target: McpTargetKind,
): string[] {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
    return [];
  }
  const root = existing as Record<string, unknown>;
  const key = getMcpServersJsonKey(target);
  const entries = root[key];
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return [];
  }
  return Object.keys(entries as Record<string, unknown>);
}

/**
 * List MCP server names present in a Codex-style TOML config.
 * 列出 Codex 风格 TOML 配置中已存在的 MCP 服务名称。
 */
export function listMcpServerNamesInToml(content: string): string[] {
  const names: string[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const section = parseCodexMcpTomlSection(rawLine);
    if (section?.isServerRoot) {
      names.push(section.serverName);
    }
  }
  return names;
}

function parseCodexMcpTomlSection(
  line: string,
): { serverName: string; isServerRoot: boolean } | null {
  const trimmed = line.trim();
  const prefix = "[mcp_servers.";

  if (!trimmed.startsWith(prefix) || !trimmed.endsWith("]")) {
    return null;
  }

  const sectionPath = trimmed.slice(prefix.length, -1);
  const serverKey = parseTomlDottedKeySegment(sectionPath);
  if (!serverKey) {
    return null;
  }

  const remainingPath = sectionPath.slice(serverKey.endIndex);
  if (remainingPath.length > 0 && !remainingPath.startsWith(".")) {
    return null;
  }

  return {
    serverName: serverKey.value,
    isServerRoot: remainingPath.length === 0,
  };
}

function parseTomlDottedKeySegment(
  value: string,
): { value: string; endIndex: number } | null {
  if (value.startsWith('"')) {
    let escaped = false;
    for (let index = 1; index < value.length; index += 1) {
      const char = value[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char !== '"') {
        continue;
      }

      const rawSegment = value.slice(0, index + 1);
      try {
        const parsed = JSON.parse(rawSegment) as unknown;
        return typeof parsed === "string"
          ? { value: parsed, endIndex: index + 1 }
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  const bareMatch = value.match(/^[A-Za-z0-9_-]+/);
  return bareMatch
    ? { value: bareMatch[0], endIndex: bareMatch[0].length }
    : null;
}

const MANAGED_BLOCK_START = "# >>> PromptHub MCP managed block >>>";
const MANAGED_BLOCK_END = "# <<< PromptHub MCP managed block <<<";

export function mergeCodexMcpToml(
  existingContent: string,
  servers: McpServerConfig[],
): string {
  const withoutManaged = existingContent
    .replace(
      new RegExp(
        `\\n?${escapeRegExp(MANAGED_BLOCK_START)}[\\s\\S]*?${escapeRegExp(MANAGED_BLOCK_END)}\\n?`,
        "g",
      ),
      "\n",
    )
    .trimEnd();
  const block = [
    MANAGED_BLOCK_START,
    buildCodexMcpToml(servers).trim(),
    MANAGED_BLOCK_END,
  ]
    .filter(Boolean)
    .join("\n");
  return `${withoutManaged ? `${withoutManaged}\n\n` : ""}${block}\n`;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlBareKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : tomlString(value);
}

function tomlInlineTable(value: Record<string, string>): string {
  return `{ ${Object.entries(value)
    .map(
      ([key, entryValue]) => `${tomlBareKey(key)} = ${tomlString(entryValue)}`,
    )
    .join(", ")} }`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256HexSync(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 1 + 8) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  padded[paddedLength - 4] = (bitLength >>> 24) & 0xff;
  padded[paddedLength - 3] = (bitLength >>> 16) & 0xff;
  padded[paddedLength - 2] = (bitLength >>> 8) & 0xff;
  padded[paddedLength - 1] = bitLength & 0xff;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] =
        (padded[base] << 24) |
        (padded[base + 1] << 16) |
        (padded[base + 2] << 8) |
        padded[base + 3];
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[index] + words[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}
