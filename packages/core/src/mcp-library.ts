import fs from "fs";
import path from "path";

import {
  BUILTIN_MCP_MARKET_SOURCES,
  BUILTIN_MCP_MARKET_TEMPLATES,
} from "@prompthub/shared/constants/mcp-market";
import {
  isMcpTargetKind,
  type McpServerConfig,
} from "@prompthub/shared/types/mcp";
import { MCP_REDACTED_VALUE } from "@prompthub/shared/utils/mcp-config";
import {
  type McpEnvImportResult,
  type McpCreateFromSourceRequest,
  type McpCreateFromSourceResult,
  type McpHealthCheckResult,
  type McpHealthIssue,
  type McpHealthStatus,
  type McpApplyResult,
  type McpApplyTarget,
  type McpImportResult,
  type McpLibraryFile,
  type McpMarketTemplate,
  type McpMarketSource,
  type McpMarketUpdateCheck,
  type McpMarketUpdateResult,
  type McpRemoveResult,
  type McpRemoveTargetNames,
  type McpServerDraft,
  type McpTargetBinding,
  type McpTargetEntryDigest,
  type McpTargetKind,
  type McpTargetSyncApplyResult,
  type McpTargetSyncCheck,
  type McpTargetSyncOptions,
  type McpTargetSyncStatus,
  type McpTargetStatusEntry,
} from "@prompthub/shared/types/mcp";
import {
  buildMcpConfigPreview,
  computeMcpTargetEntryDigest,
  getMcpTargetEntryObject,
  getMcpJsonServerEntries,
  getMcpEnvReferences,
  inferMcpEnvRequirements,
  inferMcpPlaceholderRequirements,
  inferMcpRuntimeDetails,
  installMcpTemplate,
  listMcpServerNamesInJson,
  listMcpServerNamesInToml,
  mergeMcpToml,
  mergeMcpServersJson,
  normalizeMcpServerDraft,
  parseMcpJsonConfigContent,
  redactMcpConfigContent,
  redactMcpServerConfig,
  removeCodexMcpTomlServers,
  removeMcpServersFromJson,
  sanitizeMcpServerName,
} from "@prompthub/shared/utils/mcp-config";

import {
  getConfigDir,
  getDataDir,
  getRuntimeStorageContext,
  getUserDataPath,
} from "./runtime-paths";
import {
  readCanonicalMcpLibrary,
  writeCanonicalMcpLibrary,
  type CanonicalMcpLibraryOptions,
} from "./canonical-mcp-library";
import { assertStorageMaintenanceAvailable } from "./storage-maintenance-intent";
import { inferMcpSource } from "./mcp-source";
import { buildMcpEnvImportResult } from "./mcp-env-import";
import {
  applyMcpMarketTemplate,
  prepareMcpMarketTemplateUpdate,
  reconcileMcpMarketTemplate,
} from "./mcp-market-reconciliation";
import {
  getMcpTargetPresets,
  type McpTargetPreset,
} from "./mcp-target-presets";
import {
  canRewriteTomlManagedSibling,
  getMcpTargetSyncReason,
  shouldSkipDisabledMcpPlatform,
} from "./mcp-target-sync-policy";
import { commitMcpTargetProjection } from "./mcp-target-projection";

export { getMcpTargetPresets } from "./mcp-target-presets";
export type { McpTargetPreset } from "./mcp-target-presets";

const MCP_LIBRARY_DIR_NAME = "mcp";
const MCP_LIBRARY_FILE_NAME = "library.json";
const LEGACY_MCP_LIBRARY_FILE_NAME = "mcp-library.json";

export class CoreMcpError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CoreMcpError";
    this.code = code;
  }
}

export function getMcpLibraryFilePath(): string {
  return path.join(getDataDir(), MCP_LIBRARY_DIR_NAME, MCP_LIBRARY_FILE_NAME);
}

export function getLegacyMcpLibraryFilePath(): string {
  return path.join(getConfigDir(), LEGACY_MCP_LIBRARY_FILE_NAME);
}

function readMcpLibraryFile(filePath: string): McpLibraryFile {
  return normalizeLibrary(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function defaultLibrary(): McpLibraryFile {
  return {
    kind: "prompthub-mcp-library",
    version: 1,
    updatedAt: nowIso(),
    servers: [],
    bindings: [],
  };
}

function writeJsonFileAtomic(filePath: string, data: unknown): void {
  assertStorageMaintenanceAvailable(getUserDataPath());
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function normalizeLibrary(raw: Partial<McpLibraryFile>): McpLibraryFile {
  const now = nowMs();
  return {
    kind: "prompthub-mcp-library",
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
    servers: Array.isArray(raw.servers)
      ? raw.servers.map((server) =>
          normalizeMcpServerDraft(server as McpServerDraft, now),
        )
      : [],
    bindings: Array.isArray(raw.bindings)
      ? raw.bindings
          .filter((binding): binding is McpTargetBinding =>
            Boolean(
              binding &&
              typeof binding === "object" &&
              typeof binding.id === "string" &&
              isMcpTargetKind(binding.target) &&
              typeof binding.path === "string" &&
              Array.isArray(binding.serverIds),
            ),
          )
          .map((binding) => ({
            ...binding,
            enabled: binding.enabled !== false,
            entryDigests: normalizeEntryDigests(binding.entryDigests),
            createdAt: binding.createdAt || now,
            updatedAt: binding.updatedAt || now,
          }))
      : [],
  };
}

function normalizeEntryDigests(
  value: unknown,
): Record<string, McpTargetEntryDigest> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>).flatMap(
    ([serverId, rawDigest]) => {
      if (
        !rawDigest ||
        typeof rawDigest !== "object" ||
        Array.isArray(rawDigest)
      ) {
        return [];
      }
      const record = rawDigest as Record<string, unknown>;
      if (
        record.algorithm !== "mcp-target-entry-sha256-v1" ||
        typeof record.digest !== "string" ||
        typeof record.serverName !== "string"
      ) {
        return [];
      }
      return [
        [
          serverId,
          {
            algorithm: "mcp-target-entry-sha256-v1" as const,
            digest: record.digest,
            serverName: record.serverName,
            recordedAt:
              typeof record.recordedAt === "number"
                ? record.recordedAt
                : Date.now(),
          },
        ] as const,
      ];
    },
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function assertUniqueName(
  servers: McpServerConfig[],
  name: string,
  exceptId?: string,
): void {
  const duplicate = servers.find(
    (server) => server.name === name && server.id !== exceptId,
  );
  if (duplicate) {
    throw new CoreMcpError("DUPLICATE_NAME", `MCP 服务名已存在: ${name}`);
  }
}

function restoreRedactedDraftValues(
  local: Record<string, string> | undefined,
  incoming: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (incoming === undefined) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(incoming).map(([key, value]) => [
      key,
      value === MCP_REDACTED_VALUE ? (local?.[key] ?? "") : value,
    ]),
  );
}

function selectServers(
  library: McpLibraryFile,
  serverIds: string[],
): McpServerConfig[] {
  const ids = new Set(serverIds);
  const servers = library.servers.filter((server) => ids.has(server.id));
  if (servers.length !== ids.size) {
    throw new CoreMcpError("NOT_FOUND", "部分 MCP 服务不存在");
  }
  return servers;
}

function isTomlTarget(
  target: McpTargetKind,
): target is Extract<McpTargetKind, "codex" | "custom-toml" | "grok"> {
  return target === "codex" || target === "custom-toml" || target === "grok";
}

function createBindingId(target: McpApplyTarget): string {
  return `${target.target}:${target.scope}:${target.path}`;
}

function listExistingTargetServerNames(
  target: McpApplyTarget,
  existingContent: string,
): string[] {
  if (!existingContent.trim()) {
    return [];
  }
  return isTomlTarget(target.target)
    ? listMcpServerNamesInToml(existingContent)
    : listMcpServerNamesInJson(
        parseMcpJsonConfigContent(existingContent),
        target.target,
      );
}

function findExternalTargetConflicts(
  library: McpLibraryFile,
  target: McpApplyTarget,
  servers: McpServerConfig[],
  existingContent: string,
): string[] {
  const existingNames = new Set(
    listExistingTargetServerNames(target, existingContent),
  );
  if (existingNames.size === 0) {
    return [];
  }

  const existingBinding = library.bindings.find(
    (item) => item.id === createBindingId(target),
  );
  const managedIds = new Set(existingBinding?.serverIds ?? []);

  return servers
    .filter((server) => server.enabled)
    .filter((server) => existingNames.has(server.name))
    .filter((server) => !managedIds.has(server.id))
    .map((server) => server.name);
}

function findOverwrittenTargetNames(
  target: McpApplyTarget,
  servers: McpServerConfig[],
  existingContent: string,
): string[] {
  const existingNames = new Set(
    listExistingTargetServerNames(target, existingContent),
  );
  return servers
    .filter((server) => server.enabled && existingNames.has(server.name))
    .map((server) => server.name);
}

function verifyMcpTargetProjection(
  filePath: string,
  target: McpTargetKind,
  expectedContent: string,
  presentNames: string[],
  absentNames: string[],
): void {
  try {
    const writtenContent = fs.readFileSync(filePath, "utf8");
    if (writtenContent !== expectedContent) {
      throw new Error("written bytes do not match the projected content");
    }
    const names = new Set(
      listExistingTargetServerNames(
        {
          target,
          scope: "custom",
          path: filePath,
          serverIds: [],
        },
        writtenContent,
      ),
    );
    const missing = presentNames.filter((name) => !names.has(name));
    const retained = absentNames.filter((name) => names.has(name));
    if (missing.length > 0 || retained.length > 0) {
      throw new Error(
        `entry verification failed (missing: ${missing.join(", ") || "none"}; retained: ${retained.join(", ") || "none"})`,
      );
    }
  } catch (error) {
    throw new CoreMcpError(
      "TARGET_VERIFY_FAILED",
      `MCP 目标配置写入校验失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildEntryDigest(
  target: McpTargetKind,
  server: McpServerConfig,
  recordedAt = nowMs(),
): McpTargetEntryDigest {
  return computeMcpTargetEntryDigest(
    target,
    getMcpTargetEntryObject(target, server),
    recordedAt,
    server.name,
  );
}

function readTargetEntryDigest(
  filePath: string,
  target: McpTargetKind,
  serverName: string,
): string | undefined {
  const entry = readTargetEntryObject(filePath, target, serverName);
  return entry
    ? computeMcpTargetEntryDigest(target, entry, nowMs(), serverName).digest
    : undefined;
}

function readTargetEntryObject(
  filePath: string,
  target: McpTargetKind,
  serverName: string,
): Record<string, unknown> | null {
  const content = fs.readFileSync(filePath, "utf8");
  if (isTomlTarget(target)) {
    return readCodexTomlEntryObject(content, serverName);
  }
  const raw = parseMcpJsonConfigContent(content);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const targetEntries = getMcpJsonServerEntries(raw, target);
  if (!targetEntries) {
    return null;
  }
  const entry = targetEntries[serverName];
  return entry && typeof entry === "object" && !Array.isArray(entry)
    ? (entry as Record<string, unknown>)
    : null;
}

function readCodexTomlEntryObject(
  content: string,
  serverName: string,
): Record<string, unknown> | null {
  const entry: Record<string, unknown> = {};
  let found = false;
  let inServerRoot = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const section = parseCodexMcpSectionHeader(line);
    if (section) {
      if (section.serverName === serverName && section.isRoot) {
        found = true;
        inServerRoot = true;
        continue;
      }
      if (section.serverName === serverName) {
        found = true;
        inServerRoot = false;
        entry.__tomlChildSections = true;
        continue;
      }
      inServerRoot = false;
      continue;
    }
    if (!inServerRoot || !line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    entry[line.slice(0, separatorIndex).trim()] = parseTomlDigestValue(
      line.slice(separatorIndex + 1).trim(),
    );
  }

  return found ? entry : null;
}

function parseCodexMcpSectionHeader(
  line: string,
): { serverName: string; isRoot: boolean } | null {
  const match = line.match(
    /^\[mcp_servers\.("?)([^"\]]+)\1(?<child>\.[^\]]+)?\]$/,
  );
  if (!match) {
    return null;
  }
  return {
    serverName: match[2],
    isRoot: !match.groups?.child,
  };
}

function parseTomlDigestValue(value: string): unknown {
  if (value.startsWith("[")) {
    return parseTomlStringArray(value) ?? value;
  }
  if (value.startsWith("{")) {
    return parseTomlInlineTable(value) ?? value;
  }
  const stringValue = parseTomlString(value);
  if (stringValue !== undefined) {
    return stringValue;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : value;
}

function buildEntryDigests(
  target: McpTargetKind,
  servers: McpServerConfig[],
  recordedAt = nowMs(),
): Record<string, McpTargetEntryDigest> {
  return Object.fromEntries(
    servers
      .filter((server) => server.enabled)
      .map((server) => [
        server.id,
        buildEntryDigest(target, server, recordedAt),
      ]),
  );
}

function resolveServer(
  library: McpLibraryFile,
  identifier: string,
): McpServerConfig {
  const server = library.servers.find(
    (item) => item.id === identifier || item.name === identifier,
  );
  if (!server) {
    throw new CoreMcpError("NOT_FOUND", `MCP 服务不存在: ${identifier}`);
  }
  return server;
}

function commandExists(
  command: string,
  envPath = process.env.PATH ?? "",
): boolean {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return fs.existsSync(command);
  }
  const extensions =
    process.platform === "win32" ? ["", ".exe", ".cmd", ".bat", ".ps1"] : [""];
  return envPath
    .split(path.delimiter)
    .some((dir) =>
      extensions.some((extension) =>
        fs.existsSync(path.join(dir, command + extension)),
      ),
    );
}

function getHealthStatus(issues: McpHealthIssue[]): McpHealthStatus {
  if (issues.some((issue) => issue.severity === "error")) {
    return "error";
  }
  if (issues.length > 0) {
    return "warning";
  }
  return "ok";
}

function validateKnownEnvValue(name: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const validators: Record<string, { pattern: RegExp; example: string }> = {
    AMAP_MAPS_API_KEY: {
      pattern: /^[A-Za-z0-9]{16,64}$/,
      example: "a 16-64 character AMap key",
    },
    BRAVE_API_KEY: {
      pattern: /^BSA[0-9A-Za-z_-]{20,}$/,
      example: "a Brave key starting with BSA",
    },
    FIRECRAWL_API_KEY: {
      pattern: /^fc-[0-9A-Za-z_-]{20,}$/,
      example: "a Firecrawl key starting with fc-",
    },
    GITHUB_PERSONAL_ACCESS_TOKEN: {
      pattern: /^(ghp|github_pat|gho|ghu|ghs|ghr)_[0-9A-Za-z_]{20,}$/,
      example: "a GitHub token such as ghp_... or github_pat_...",
    },
    GOOGLE_MAPS_API_KEY: {
      pattern: /^AIza[0-9A-Za-z_-]{20,}$/,
      example: "a Google Maps key starting with AIza",
    },
    SLACK_BOT_TOKEN: {
      pattern: /^xoxb-[0-9A-Za-z-]{20,}$/,
      example: "a Slack bot token starting with xoxb-",
    },
    SLACK_TEAM_ID: {
      pattern: /^T[A-Z0-9]{8,}$/,
      example: "a Slack workspace/team id such as T01234567",
    },
  };
  const validator = validators[name];
  if (!validator || validator.pattern.test(trimmed)) {
    return null;
  }
  return `${name} 格式看起来不正确，应填写 ${validator.example}`;
}

function createHealthResult(server: McpServerConfig): McpHealthCheckResult {
  const issues: McpHealthIssue[] = [];
  if (server.transport === "stdio") {
    if (!server.command) {
      issues.push({
        code: "MISSING_COMMAND",
        severity: "error",
        field: "command",
        message: "stdio MCP 服务缺少 command",
      });
    } else if (!commandExists(server.command)) {
      issues.push({
        code: "COMMAND_NOT_FOUND",
        severity: "error",
        field: "command",
        message: `找不到命令: ${server.command}`,
      });
    }
    if (server.cwd && !fs.existsSync(server.cwd)) {
      issues.push({
        code: "MISSING_CWD",
        severity: "warning",
        field: "cwd",
        message: `工作目录不存在: ${server.cwd}`,
      });
    }
  } else {
    try {
      if (!server.url) {
        throw new Error("missing url");
      }
      new URL(server.url);
    } catch {
      issues.push({
        code: "INVALID_URL",
        severity: "error",
        field: "url",
        message: "远程 MCP 服务 URL 无效",
      });
    }
  }

  const referenceDetails = new Map<string, { hasDefault: boolean }>();
  const referenceValues = [
    ...Object.values(server.env ?? {}),
    ...Object.values(server.envRefs ?? {}),
    ...(server.args ?? []),
    ...(server.url ? [server.url] : []),
    ...Object.values(server.headers ?? {}),
    ...Object.values(server.headerRefs ?? {}),
  ];
  for (const value of referenceValues) {
    for (const reference of getMcpEnvReferences(value)) {
      const current = referenceDetails.get(reference.name);
      referenceDetails.set(reference.name, {
        hasDefault: (current?.hasDefault ?? false) || reference.hasDefault,
      });
    }
  }

  for (const requirement of inferMcpEnvRequirements(server)) {
    const reference = referenceDetails.get(requirement.name);
    const directValue = server.env?.[requirement.name];
    const hasMissingDirectValue =
      Object.prototype.hasOwnProperty.call(
        server.env ?? {},
        requirement.name,
      ) &&
      (!directValue || /^<[^>]+>$/.test(directValue.trim()));
    if (reference) {
      if (hasMissingDirectValue) {
        issues.push({
          code: "MISSING_ENV",
          severity: "error",
          field: requirement.name,
          message: `缺少环境变量: ${requirement.name}`,
        });
        continue;
      }
      const resolvedInCurrentProcess = Boolean(
        process.env[requirement.name]?.trim(),
      );
      if (!reference.hasDefault && !resolvedInCurrentProcess) {
        issues.push({
          code: "UNRESOLVED_ENV_REFERENCE",
          severity: "warning",
          field: requirement.name,
          message: `当前进程未设置环境变量引用: ${requirement.name}`,
        });
      }
      continue;
    }
    const value = directValue;
    if (requirement.required && (!value || /^<[^>]+>$/.test(value.trim()))) {
      issues.push({
        code: "MISSING_ENV",
        severity: "error",
        field: requirement.name,
        message: `缺少环境变量: ${requirement.name}`,
      });
      continue;
    }
    if (value) {
      if (/\$\{[A-Za-z_][A-Za-z0-9_]*\}/.test(value.trim())) {
        issues.push({
          code: "UNRESOLVED_ENV_REFERENCE",
          severity: "warning",
          field: requirement.name,
          message: `Environment references may not expand in all MCP targets: ${requirement.name}`,
        });
        continue;
      }
      const invalidMessage = validateKnownEnvValue(requirement.name, value);
      if (invalidMessage) {
        issues.push({
          code: "INVALID_ENV_VALUE",
          severity: "warning",
          field: requirement.name,
          message: invalidMessage,
        });
      }
    }
  }

  for (const placeholder of inferMcpPlaceholderRequirements(server)) {
    issues.push({
      code: "PLACEHOLDER_VALUE",
      severity: "error",
      field: placeholder.source,
      message: `仍有占位值需要替换: ${placeholder.value}`,
    });
  }

  return {
    serverId: server.id,
    serverName: server.name,
    status: getHealthStatus(issues),
    checkedAt: nowIso(),
    runtime: inferMcpRuntimeDetails(server),
    issues,
  };
}

function toSyncCheck(
  binding: McpTargetBinding,
  server: McpServerConfig,
  status: McpTargetSyncStatus,
  values: Partial<McpTargetSyncCheck> = {},
): McpTargetSyncCheck {
  return {
    bindingId: binding.id,
    target: binding.target,
    scope: binding.scope,
    path: binding.path,
    serverId: server.id,
    serverName: server.name,
    status,
    safeToReapply: status === "needs-sync",
    reason: getMcpTargetSyncReason(status),
    ...values,
  };
}

function classifySyncStatus(
  baselineDigest: string | undefined,
  currentDigest: string,
  targetDigest: string | undefined,
): McpTargetSyncStatus {
  if (!targetDigest) {
    return "missing-entry";
  }
  if (!baselineDigest) {
    return currentDigest === targetDigest ? "synced" : "legacy-needs-review";
  }
  if (baselineDigest === currentDigest && baselineDigest === targetDigest) {
    return "synced";
  }
  if (baselineDigest === targetDigest && currentDigest !== baselineDigest) {
    return "needs-sync";
  }
  if (baselineDigest === currentDigest && targetDigest !== baselineDigest) {
    return "external-modified";
  }
  if (currentDigest === targetDigest) {
    return "synced";
  }
  return "conflict";
}

function importServerEntry(
  name: string,
  entry: unknown,
  now: number,
  target?: McpTargetKind,
): McpServerConfig | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const commandParts = Array.isArray(record.command)
    ? record.command.filter((item): item is string => typeof item === "string")
    : [];
  const command =
    typeof record.command === "string" ? record.command : commandParts[0];
  const url =
    target === "antigravity" && typeof record.serverUrl === "string"
      ? record.serverUrl
      : typeof record.url === "string"
        ? record.url
        : undefined;
  if (!command && !url) {
    return null;
  }
  const args =
    commandParts.length > 0
      ? commandParts.slice(1)
      : Array.isArray(record.args)
        ? record.args.filter((item): item is string => typeof item === "string")
        : undefined;
  const envRecord = record.env ?? record.environment;
  const headersRecord = record.headers ?? record.http_headers;

  return normalizeMcpServerDraft(
    {
      name: sanitizeMcpServerName(name),
      displayName: name,
      description:
        typeof record.description === "string" ? record.description : undefined,
      transport: command
        ? "stdio"
        : target === "openclaw"
          ? record.transport === "streamable-http"
            ? "streamable-http"
            : "sse"
          : record.type === "sse"
            ? "sse"
            : "streamable-http",
      command,
      args,
      cwd: typeof record.cwd === "string" ? record.cwd : undefined,
      env:
        envRecord && typeof envRecord === "object" && !Array.isArray(envRecord)
          ? (envRecord as Record<string, string>)
          : undefined,
      url,
      headers:
        headersRecord &&
        typeof headersRecord === "object" &&
        !Array.isArray(headersRecord)
          ? (headersRecord as Record<string, string>)
          : undefined,
      enabled:
        record.enable !== false &&
        record.enabled !== false &&
        record.disabled !== true,
      source: { type: "import" },
    },
    now,
  );
}

function parseTomlString(value: string): string | undefined {
  try {
    const parsed = JSON.parse(value.trim()) as unknown;
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseTomlStringArray(value: string): string[] | undefined {
  try {
    const parsed = JSON.parse(value.trim()) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : undefined;
  } catch {
    return undefined;
  }
}

function parseTomlInlineTable(
  value: string,
): Record<string, string> | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return undefined;
  }
  const entries = trimmed
    .slice(1, -1)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }
      const key = entry.slice(0, separatorIndex).trim().replace(/^"|"$/g, "");
      const parsedValue = parseTomlString(entry.slice(separatorIndex + 1));
      return key && parsedValue !== undefined ? [key, parsedValue] : null;
    })
    .filter((entry): entry is [string, string] => Boolean(entry));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseCodexTomlServers(
  content: string,
  now: number,
): McpServerConfig[] {
  const servers: McpServerConfig[] = [];
  let currentName: string | null = null;
  let current: Record<string, unknown> = {};

  const flush = () => {
    if (!currentName) {
      return;
    }
    const server = importServerEntry(currentName, current, now);
    if (server) {
      servers.push(server);
    }
    currentName = null;
    current = {};
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const sectionMatch = line.match(/^\[mcp_servers\.("?)([^"\]]+)\1\]$/);
    if (sectionMatch) {
      flush();
      currentName = sectionMatch[2];
      continue;
    }
    if (!currentName) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key === "args") {
      current.args = parseTomlStringArray(value);
    } else if (key === "env" || key === "http_headers" || key === "headers") {
      current[key === "env" ? "env" : "headers"] = parseTomlInlineTable(value);
    } else if (key === "command" || key === "cwd" || key === "url") {
      current[key] = parseTomlString(value);
    }
  }
  flush();
  return servers;
}

function parseJsonImportServers(
  content: string,
  now: number,
): McpServerConfig[] {
  const raw = parseMcpJsonConfigContent(content) as Record<string, unknown>;
  const asObjectRecord = (
    value: unknown,
  ): Record<string, unknown> | undefined =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const mcp = asObjectRecord(raw.mcp);
  const source =
    asObjectRecord(raw.mcpServers) ??
    asObjectRecord(raw.servers) ??
    asObjectRecord(mcp?.servers) ??
    mcp ??
    {};
  return Object.entries(source)
    .map(([name, entry]) => importServerEntry(name, entry, now))
    .filter((server): server is McpServerConfig => Boolean(server));
}

function readImportServersFromContent(
  content: string,
  now: number,
  format?: "json" | "toml",
): McpServerConfig[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }
  if (format === "toml") {
    return parseCodexTomlServers(trimmed, now);
  }
  if (format === "json") {
    return parseJsonImportServers(trimmed, now);
  }
  try {
    return parseJsonImportServers(trimmed, now);
  } catch {
    const servers = parseCodexTomlServers(trimmed, now);
    if (servers.length > 0) {
      return servers;
    }
    throw new Error("Invalid MCP config content");
  }
}

function readImportServers(filePath: string, now: number): McpServerConfig[] {
  const content = fs.readFileSync(filePath, "utf8");
  const format =
    path.extname(filePath).toLowerCase() === ".toml" ? "toml" : "json";
  return readImportServersFromContent(content, now, format);
}

function mergeImportedServers(
  library: McpLibraryFile,
  sourceServers: McpServerConfig[],
): McpImportResult & { library: McpLibraryFile } {
  const imported: McpServerConfig[] = [];
  const skipped: string[] = [];
  const existingNames = new Set(library.servers.map((server) => server.name));

  for (const server of sourceServers) {
    if (existingNames.has(server.name)) {
      skipped.push(server.name);
      continue;
    }
    imported.push(server);
    existingNames.add(server.name);
  }

  return {
    imported,
    skipped,
    library:
      imported.length > 0
        ? { ...library, servers: [...imported, ...library.servers] }
        : library,
  };
}

function readTargetServers(
  filePath: string,
  target: McpTargetKind,
  now: number,
): McpServerConfig[] {
  const content = fs.readFileSync(filePath, "utf8");
  if (isTomlTarget(target)) {
    return parseCodexTomlServers(content, now);
  }
  const raw = parseMcpJsonConfigContent(content);
  const source = getMcpJsonServerEntries(raw, target);
  if (!source) {
    return [];
  }
  return Object.entries(source)
    .map(([name, entry]) => importServerEntry(name, entry, now, target))
    .filter((server): server is McpServerConfig => Boolean(server))
    .map((server) => ({
      ...server,
      source: { type: "import", id: target, label: filePath },
    }));
}

export class CoreMcpLibraryService {
  constructor(
    private readonly canonicalOptions: CanonicalMcpLibraryOptions = {},
  ) {}

  read(): McpLibraryFile {
    if (getRuntimeStorageContext().localAuthority === "canonical-files") {
      try {
        return normalizeLibrary(readCanonicalMcpLibrary(this.canonicalOptions));
      } catch (error) {
        throw new CoreMcpError(
          "INVALID_LIBRARY",
          error instanceof Error ? error.message : "MCP 配置库无法解析",
        );
      }
    }
    const primaryPath = getMcpLibraryFilePath();
    try {
      if (fs.existsSync(primaryPath)) {
        return readMcpLibraryFile(primaryPath);
      }

      const legacyPath = getLegacyMcpLibraryFilePath();
      if (!fs.existsSync(legacyPath)) {
        return defaultLibrary();
      }

      const migrated = readMcpLibraryFile(legacyPath);
      writeJsonFileAtomic(primaryPath, migrated);
      return migrated;
    } catch (error) {
      throw new CoreMcpError(
        "INVALID_LIBRARY",
        error instanceof Error ? error.message : "MCP 配置库无法解析",
      );
    }
  }

  write(library: McpLibraryFile): McpLibraryFile {
    const next = normalizeLibrary({
      ...library,
      updatedAt: nowIso(),
    });
    if (getRuntimeStorageContext().localAuthority === "canonical-files") {
      writeCanonicalMcpLibrary(next, this.canonicalOptions);
    } else {
      writeJsonFileAtomic(getMcpLibraryFilePath(), next);
    }
    return next;
  }

  getMarketTemplates(): McpMarketTemplate[] {
    return BUILTIN_MCP_MARKET_TEMPLATES;
  }

  getMarketSources(): McpMarketSource[] {
    return BUILTIN_MCP_MARKET_SOURCES;
  }

  checkServer(identifier: string): McpHealthCheckResult {
    return createHealthResult(resolveServer(this.read(), identifier));
  }

  checkAllServers(): McpHealthCheckResult[] {
    return this.read().servers.map((server) => createHealthResult(server));
  }

  createServer(draft: McpServerDraft): McpServerConfig {
    const library = this.read();
    const server = normalizeMcpServerDraft(draft);
    assertUniqueName(library.servers, server.name);
    this.write({
      ...library,
      servers: [server, ...library.servers],
    });
    return server;
  }

  updateServer(id: string, draft: McpServerDraft): McpServerConfig {
    const library = this.read();
    const current = library.servers.find((server) => server.id === id);
    if (!current) {
      throw new CoreMcpError("NOT_FOUND", `MCP 服务不存在: ${id}`);
    }
    const nextServer = normalizeMcpServerDraft({
      ...current,
      ...draft,
      ...(draft.env !== undefined && {
        env: restoreRedactedDraftValues(current.env, draft.env),
      }),
      ...(draft.headers !== undefined && {
        headers: restoreRedactedDraftValues(current.headers, draft.headers),
      }),
      id,
      createdAt: current.createdAt,
      updatedAt: nowMs(),
    });
    assertUniqueName(library.servers, nextServer.name, id);
    this.write({
      ...library,
      servers: library.servers.map((server) =>
        server.id === id ? nextServer : server,
      ),
    });
    return nextServer;
  }

  setServerEnabled(identifier: string, enabled: boolean): McpServerConfig {
    const library = this.read();
    const current = resolveServer(library, identifier);
    const nextServer = normalizeMcpServerDraft({
      ...current,
      enabled,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowMs(),
    });
    this.write({
      ...library,
      servers: library.servers.map((server) =>
        server.id === current.id ? nextServer : server,
      ),
    });
    return nextServer;
  }

  deleteServer(id: string): McpLibraryFile {
    const library = this.read();
    const servers = library.servers.filter((server) => server.id !== id);
    if (servers.length === library.servers.length) {
      throw new CoreMcpError("NOT_FOUND", `MCP 服务不存在: ${id}`);
    }
    return this.write({
      ...library,
      servers,
      bindings: library.bindings
        .map((binding) => ({
          ...binding,
          serverIds: binding.serverIds.filter((serverId) => serverId !== id),
          entryDigests: binding.entryDigests
            ? Object.fromEntries(
                Object.entries(binding.entryDigests).filter(
                  ([serverId]) => serverId !== id,
                ),
              )
            : undefined,
        }))
        .filter((binding) => binding.serverIds.length > 0),
    });
  }

  installTemplate(templateId: string): McpServerConfig {
    const template = BUILTIN_MCP_MARKET_TEMPLATES.find(
      (item) => item.id === templateId,
    );
    if (!template) {
      throw new CoreMcpError("NOT_FOUND", `MCP 模板不存在: ${templateId}`);
    }
    const library = this.read();
    const installed = installMcpTemplate(template);
    const server = applyMcpMarketTemplate(
      installed,
      template,
      installed.updatedAt,
    );
    assertUniqueName(library.servers, server.name);
    this.write({
      ...library,
      servers: [server, ...library.servers],
    });
    return server;
  }

  installMarketTemplate(template: McpMarketTemplate): McpServerConfig {
    const library = this.read();
    const installed = installMcpTemplate(template);
    const server = applyMcpMarketTemplate(
      installed,
      template,
      installed.updatedAt,
    );
    assertUniqueName(library.servers, server.name);
    this.write({
      ...library,
      servers: [server, ...library.servers],
    });
    return server;
  }

  checkMarketTemplateUpdate(
    identifier: string,
    template: McpMarketTemplate,
  ): McpMarketUpdateCheck {
    return reconcileMcpMarketTemplate(
      resolveServer(this.read(), identifier),
      template,
    );
  }

  updateFromMarketTemplate(
    identifier: string,
    template: McpMarketTemplate,
    force = false,
  ): McpMarketUpdateResult {
    const library = this.read();
    const current = resolveServer(library, identifier);
    const prepared = prepareMcpMarketTemplateUpdate(current, template, force);
    if ("errorCode" in prepared) {
      throw new CoreMcpError(prepared.errorCode, prepared.reason);
    }
    if (prepared.shouldPersist) {
      this.write({
        ...library,
        servers: library.servers.map((item) =>
          item.id === current.id ? prepared.result.server : item,
        ),
      });
    }
    return prepared.result;
  }

  preview(target: McpTargetKind, serverIds: string[]): string {
    const library = this.read();
    return buildMcpConfigPreview(target, selectServers(library, serverIds));
  }

  apply(target: McpApplyTarget): McpApplyResult {
    const library = this.read();
    const servers = selectServers(library, target.serverIds).filter(
      (server) => server.enabled,
    );
    if (servers.length === 0) {
      throw new CoreMcpError(
        "NO_ENABLED_SERVERS",
        "没有已启用的 MCP 服务可分发",
      );
    }
    const targetExisted = fs.existsSync(target.path);
    const existingContent = targetExisted
      ? fs.readFileSync(target.path, "utf8")
      : "";
    const externalConflicts = findExternalTargetConflicts(
      library,
      target,
      servers,
      existingContent,
    );
    if (externalConflicts.length > 0 && !target.force) {
      throw new CoreMcpError(
        "TARGET_CONFLICT",
        `目标配置已存在同名 MCP 服务: ${externalConflicts.join(
          ", ",
        )}。确认覆盖后请使用 force。`,
      );
    }
    const overwrittenServerNames = findOverwrittenTargetNames(
      target,
      servers,
      existingContent,
    );
    const tomlBaseContent =
      isTomlTarget(target.target) && target.force
        ? removeCodexMcpTomlServers(existingContent, externalConflicts)
        : existingContent;
    const content = isTomlTarget(target.target)
      ? mergeMcpToml(tomlBaseContent, target.target, servers)
      : `${JSON.stringify(
          mergeMcpServersJson(
            parseMcpJsonConfigContent(existingContent),
            target.target,
            servers,
          ),
          null,
          2,
        )}\n`;

    const now = nowMs();
    const bindingId = createBindingId(target);
    const existingBinding = library.bindings.find(
      (item) => item.id === bindingId,
    );
    const nextEntryDigests = {
      ...(existingBinding?.entryDigests ?? {}),
      ...buildEntryDigests(target.target, servers, now),
    };
    const binding: McpTargetBinding = {
      id: bindingId,
      target: target.target,
      scope: target.scope,
      path: target.path,
      // Merge with previously applied servers so re-applying one server does
      // not erase the distributed status of others on the same target.
      // 与之前已应用的 server 合并，避免重复应用单个 server 时
      // 丢失同一目标上其他 server 的分发状态。
      serverIds: Array.from(
        new Set([
          ...(existingBinding?.serverIds ?? []),
          ...servers.map((server) => server.id),
        ]),
      ),
      enabled: true,
      entryDigests: nextEntryDigests,
      lastAppliedAt: now,
      createdAt: existingBinding?.createdAt ?? now,
      updatedAt: now,
    };
    const nextLibrary = {
      ...library,
      bindings: [
        binding,
        ...library.bindings.filter((item) => item.id !== binding.id),
      ],
    };
    commitMcpTargetProjection({
      filePath: target.path,
      previousContent: targetExisted ? existingContent : undefined,
      nextContent: content,
      verify: () =>
        verifyMcpTargetProjection(
          target.path,
          target.target,
          content,
          servers.map((server) => server.name),
          [],
        ),
      persist: () => {
        this.write(nextLibrary);
      },
    });

    return {
      path: target.path,
      backupPath: undefined,
      target: target.target,
      appliedServerNames: servers.map((server) => server.name),
      overwrittenServerNames,
      // The file on disk contains the explicitly selected literal values;
      // callers only receive a redacted view.
      content: redactMcpConfigContent(target.target, content),
    };
  }

  /**
   * Remove selected servers from an agent target config file. Unrelated
   * config content is preserved. The matching binding is updated and dropped
   * when it becomes empty.
   */
  removeFromTarget(target: McpApplyTarget): McpRemoveResult {
    const library = this.read();
    const servers = selectServers(library, target.serverIds);
    if (!fs.existsSync(target.path)) {
      throw new CoreMcpError(
        "TARGET_NOT_FOUND",
        `目标配置文件不存在: ${target.path}`,
      );
    }
    const existingContent = fs.readFileSync(target.path, "utf8");
    const serverNames = servers.map((server) => server.name);
    const content = isTomlTarget(target.target)
      ? removeCodexMcpTomlServers(existingContent, serverNames)
      : `${JSON.stringify(
          removeMcpServersFromJson(
            parseMcpJsonConfigContent(existingContent),
            target.target,
            serverNames,
          ),
          null,
          2,
        )}\n`;

    const now = nowMs();
    const bindingId = createBindingId(target);
    const removedIds = new Set(target.serverIds);
    const nextLibrary = {
      ...library,
      bindings: library.bindings
        .map((binding) =>
          binding.id === bindingId
            ? {
                ...binding,
                serverIds: binding.serverIds.filter(
                  (serverId) => !removedIds.has(serverId),
                ),
                entryDigests: binding.entryDigests
                  ? Object.fromEntries(
                      Object.entries(binding.entryDigests).filter(
                        ([serverId]) => !removedIds.has(serverId),
                      ),
                    )
                  : undefined,
                updatedAt: now,
              }
            : binding,
        )
        .filter((binding) => binding.serverIds.length > 0),
    };
    commitMcpTargetProjection({
      filePath: target.path,
      previousContent: existingContent,
      nextContent: content,
      verify: () =>
        verifyMcpTargetProjection(
          target.path,
          target.target,
          content,
          [],
          serverNames,
        ),
      persist: () => {
        this.write(nextLibrary);
      },
    });

    return {
      path: target.path,
      backupPath: undefined,
      target: target.target,
      removedServerNames: serverNames,
      content: redactMcpConfigContent(target.target, content),
    };
  }

  /**
   * Remove named MCP server entries from an agent target config file. This is
   * used for external Agent MCP entries that do not exist in PromptHub's local
   * library and therefore cannot be addressed by server id.
   */
  removeNamesFromTarget(target: McpRemoveTargetNames): McpRemoveResult {
    if (target.serverNames.length === 0) {
      throw new CoreMcpError("NO_SERVER_NAMES", "没有可移除的 MCP 服务名称");
    }
    if (!fs.existsSync(target.path)) {
      throw new CoreMcpError(
        "TARGET_NOT_FOUND",
        `目标配置文件不存在: ${target.path}`,
      );
    }

    const library = this.read();
    const existingContent = fs.readFileSync(target.path, "utf8");
    const content = isTomlTarget(target.target)
      ? removeCodexMcpTomlServers(existingContent, target.serverNames)
      : `${JSON.stringify(
          removeMcpServersFromJson(
            parseMcpJsonConfigContent(existingContent),
            target.target,
            target.serverNames,
          ),
          null,
          2,
        )}\n`;

    const removedNames = new Set(target.serverNames);
    const removedLibraryIds = new Set(
      library.servers
        .filter((server) => removedNames.has(server.name))
        .map((server) => server.id),
    );
    const now = nowMs();
    const bindingId = createBindingId({ ...target, serverIds: [] });
    const nextLibrary = {
      ...library,
      bindings: library.bindings
        .map((binding) =>
          binding.id === bindingId
            ? {
                ...binding,
                serverIds: binding.serverIds.filter(
                  (serverId) => !removedLibraryIds.has(serverId),
                ),
                entryDigests: binding.entryDigests
                  ? Object.fromEntries(
                      Object.entries(binding.entryDigests).filter(
                        ([serverId]) => !removedLibraryIds.has(serverId),
                      ),
                    )
                  : undefined,
                updatedAt: now,
              }
            : binding,
        )
        .filter((binding) => binding.serverIds.length > 0),
    };
    commitMcpTargetProjection({
      filePath: target.path,
      previousContent: existingContent,
      nextContent: content,
      verify: () =>
        verifyMcpTargetProjection(
          target.path,
          target.target,
          content,
          [],
          target.serverNames,
        ),
      persist: () => {
        this.write(nextLibrary);
      },
    });

    return {
      path: target.path,
      backupPath: undefined,
      target: target.target,
      removedServerNames: target.serverNames,
      content: redactMcpConfigContent(target.target, content),
    };
  }

  checkServerTargetSync(
    identifier: string,
    options?: McpTargetSyncOptions,
  ): McpTargetSyncCheck[] {
    const library = this.read();
    const server = resolveServer(library, identifier);
    const bindings = library.bindings.filter((binding) =>
      binding.serverIds.includes(server.id),
    );
    const checks: McpTargetSyncCheck[] = [];
    let nextBindings = library.bindings;
    let shouldWrite = false;

    for (const binding of bindings) {
      if (shouldSkipDisabledMcpPlatform(binding, options)) {
        checks.push(toSyncCheck(binding, server, "skipped-disabled-platform"));
        continue;
      }
      if (!server.enabled) {
        checks.push(toSyncCheck(binding, server, "skipped-server-disabled"));
        continue;
      }
      const current = buildEntryDigest(binding.target, server);
      const baseline = binding.entryDigests?.[server.id];
      if (!fs.existsSync(binding.path)) {
        checks.push(
          toSyncCheck(binding, server, "missing-target", {
            baselineDigest: baseline?.digest,
            currentDigest: current.digest,
          }),
        );
        continue;
      }

      let targetDigest: string | undefined;
      try {
        targetDigest = readTargetEntryDigest(
          binding.path,
          binding.target,
          server.name,
        );
      } catch {
        checks.push(
          toSyncCheck(binding, server, "parse-error", {
            baselineDigest: baseline?.digest,
            currentDigest: current.digest,
          }),
        );
        continue;
      }

      const status = classifySyncStatus(
        baseline?.digest,
        current.digest,
        targetDigest,
      );
      const check = toSyncCheck(binding, server, status, {
        baselineDigest: baseline?.digest,
        currentDigest: current.digest,
        targetDigest,
        safeToReapply: status === "needs-sync",
      });
      checks.push(check);

      if (status === "synced" && baseline?.digest !== current.digest) {
        nextBindings = nextBindings.map((item) =>
          item.id === binding.id
            ? {
                ...item,
                entryDigests: {
                  ...(item.entryDigests ?? {}),
                  [server.id]: current,
                },
                updatedAt: nowMs(),
              }
            : item,
        );
        shouldWrite = true;
      }
    }

    if (shouldWrite) {
      this.write({ ...library, bindings: nextBindings });
    }
    return checks;
  }

  syncServerToBoundTargets(
    identifier: string,
    options?: McpTargetSyncOptions,
  ): McpTargetSyncApplyResult {
    const library = this.read();
    const server = resolveServer(library, identifier);
    const checks = this.checkServerTargetSync(identifier, options).filter(
      (check) =>
        !options?.targetBindingIds?.length ||
        options.targetBindingIds.includes(check.bindingId),
    );
    const result: McpTargetSyncApplyResult = {
      updated: [],
      skipped: [],
      blocked: [],
      failed: [],
    };

    for (const check of checks) {
      if (check.status === "synced") {
        result.skipped.push(check);
        continue;
      }
      if (check.status === "skipped-disabled-platform") {
        result.skipped.push(check);
        continue;
      }
      if (check.status === "skipped-server-disabled") {
        result.skipped.push(check);
        continue;
      }
      if (
        (check.status === "missing-target" ||
          check.status === "missing-entry") &&
        !options?.recreateMissing
      ) {
        result.blocked.push(check);
        continue;
      }
      if (
        (check.status === "conflict" ||
          check.status === "external-modified" ||
          check.status === "legacy-needs-review" ||
          check.status === "parse-error") &&
        !options?.forceConflicts
      ) {
        result.blocked.push(check);
        continue;
      }

      const binding = library.bindings.find(
        (item) => item.id === check.bindingId,
      );
      if (!binding) {
        result.failed.push({ ...check, error: "Binding not found" });
        continue;
      }

      const applyServerIds = isTomlTarget(binding.target)
        ? binding.serverIds
            .map((serverId) =>
              library.servers.find((item) => item.id === serverId),
            )
            .filter((item): item is McpServerConfig => Boolean(item?.enabled))
            .map((item) => item.id)
        : [server.id];
      const blockingSibling = isTomlTarget(binding.target)
        ? applyServerIds
            .filter((serverId) => serverId !== server.id)
            .flatMap((serverId) =>
              this.checkServerTargetSync(serverId, options).filter(
                (item) => item.bindingId === check.bindingId,
              ),
            )
            .find((item) => !canRewriteTomlManagedSibling(item, options))
        : undefined;

      if (blockingSibling) {
        result.blocked.push({
          ...blockingSibling,
          reason: `TOML target also contains unsafe managed sibling "${blockingSibling.serverName}": ${blockingSibling.reason}`,
        });
        continue;
      }

      try {
        const applyResult = this.apply({
          target: binding.target,
          scope: binding.scope,
          path: binding.path,
          serverIds: applyServerIds,
          force: options?.forceConflicts,
        });
        result.updated.push({
          backupPath: applyResult.backupPath,
          bindingId: check.bindingId,
          path: check.path,
          scope: check.scope,
          serverName: check.serverName,
          status: check.status,
          target: check.target,
        });
      } catch (error) {
        result.failed.push({
          ...check,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Inspect every target preset config file and report which MCP server
   * names are currently present. The actual files are the source of truth
   * for distribution status, not the recorded bindings.
   * 扫描所有目标平台配置文件，报告其中实际存在的 MCP 服务名。
   * 分发状态以真实文件为准，而非记录的 binding。
   */
  getTargetStatus(
    presets: McpTargetPreset[] = getMcpTargetPresets(),
  ): McpTargetStatusEntry[] {
    return presets.map((preset) => {
      if (!fs.existsSync(preset.path)) {
        return {
          presetId: preset.id,
          path: preset.path,
          exists: false,
          serverNames: [],
        };
      }
      try {
        const servers = readTargetServers(preset.path, preset.target, nowMs());
        const serverNames = servers.map((server) => server.name);
        return {
          presetId: preset.id,
          path: preset.path,
          exists: true,
          serverNames,
          servers: servers.map((server) => ({
            ...redactMcpServerConfig(server),
            source: { type: "import", id: preset.id, label: preset.label },
          })),
        };
      } catch {
        // Unparseable target config is reported as present but unknown so
        // the UI never claims a server is distributed based on bad data.
        // 配置无法解析时报告为存在但内容未知，避免 UI 基于坏数据误报。
        return {
          presetId: preset.id,
          path: preset.path,
          exists: true,
          serverNames: [],
        };
      }
    });
  }

  importFromFile(filePath: string): McpImportResult {
    const library = this.read();
    const now = nowMs();
    const sourceServers = readImportServers(filePath, now);
    const result = mergeImportedServers(library, sourceServers);
    if (result.imported.length > 0) {
      this.write(result.library);
    }

    return { imported: result.imported, skipped: result.skipped };
  }

  createFromSource(
    request: McpCreateFromSourceRequest,
  ): McpCreateFromSourceResult {
    if (request.kind === "config") {
      const library = this.read();
      const now = nowMs();
      const sourceServers = readImportServersFromContent(request.input, now);
      const result = mergeImportedServers(library, sourceServers);
      if (result.imported.length > 0) {
        this.write(result.library);
      }

      return {
        imported: result.imported,
        skipped: result.skipped,
        detectedKind: "config-content",
        warnings: [],
      };
    }

    const inference = inferMcpSource(request.input, request.kind);
    if (inference.detectedKind === "config-file") {
      const result = this.importFromFile(path.resolve(request.input));
      return {
        ...result,
        detectedKind: inference.detectedKind,
        warnings: inference.warnings,
      };
    }

    const library = this.read();
    const now = nowMs();
    const existingNames = new Set(library.servers.map((server) => server.name));
    const imported: McpServerConfig[] = [];
    const skipped: string[] = [];

    for (const draft of inference.drafts) {
      const server = normalizeMcpServerDraft(draft, now);
      if (existingNames.has(server.name)) {
        skipped.push(server.name);
        continue;
      }
      imported.push(server);
      existingNames.add(server.name);
    }

    if (imported.length > 0) {
      this.write({
        ...library,
        servers: [...imported, ...library.servers],
      });
    }

    return {
      imported,
      skipped,
      detectedKind: inference.detectedKind,
      warnings: inference.warnings,
    };
  }

  importEnvForServer(
    identifier: string,
    envFilePath: string,
    selectedKeys?: string[],
  ): McpEnvImportResult {
    const library = this.read();
    const server = resolveServer(library, identifier);
    const result = buildMcpEnvImportResult(
      server,
      fs.readFileSync(envFilePath, "utf8"),
      selectedKeys,
      nowMs(),
    );

    this.write({
      ...library,
      servers: library.servers.map((item) =>
        item.id === server.id ? result.server : item,
      ),
    });
    return result;
  }
}
