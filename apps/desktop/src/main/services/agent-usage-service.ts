import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse as parseToml } from "smol-toml";

import type {
  AgentUsageMetric,
  AgentUsageQuota,
} from "@prompthub/shared/types";
import {
  createAntigravityLocalUsageClient,
  type AntigravityLocalUsageClient,
} from "./agent-usage-antigravity-local";
import { SkillInstaller } from "./skill-installer";
import { getPlatformRootDir } from "./skill-installer-utils";
import {
  createNativeCommandRunner,
  type NativeCommandRunner,
} from "./native-command";

export interface AgentUsageServiceOptions {
  resolveConfigRoot?: (agentId: string) => string;
  commandRunner?: NativeCommandRunner;
  fetchImpl?: typeof fetch;
  readFile?: (filePath: string) => Promise<string>;
  readDir?: (dirPath: string) => Promise<string[]>;
  now?: () => number;
  homeDir?: string;
  platform?: NodeJS.Platform;
  antigravityLocalClient?: AntigravityLocalUsageClient;
}

export interface AgentUsageService {
  getUsage(
    agentId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<AgentUsageQuota>;
}

interface ClaudeCredentials {
  accessToken: string;
  expiresAt: number | null;
  subscriptionType: string | null;
}

interface CodexCredentials {
  accessToken: string;
  accountId: string | null;
}

interface UsageWindow {
  utilization: number;
  resetsAt: number | null;
}

interface CodexUsageWindow extends UsageWindow {
  windowSeconds: number;
}

interface TokenCredentials {
  accessToken: string;
  expiresAt: number | null;
  renewable?: boolean;
}

type FetchJsonResult =
  | { kind: "ok"; body: unknown }
  | { kind: "expired" }
  | { kind: "unavailable"; errorCode: string };

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const USAGE_ADAPTER = "claude-oauth-v1";
const CODEX_USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_USAGE_ADAPTER = "codex-oauth-v1";
const CODEX_OFFICIAL_PROVIDER = "openai";
const KIMI_USAGE_ENDPOINT = "https://api.kimi.com/coding/v1/usages";
const KIMI_USAGE_ADAPTER = "kimi-oauth-v1";
const ANTIGRAVITY_USAGE_ADAPTER = "antigravity-oauth-v1";
const ANTIGRAVITY_KEYCHAIN_SERVICE = "gemini";
const ANTIGRAVITY_KEYCHAIN_ACCOUNT = "antigravity";
const GEMINI_USAGE_ADAPTER = "gemini-oauth-v1";
const COPILOT_USAGE_ENDPOINT = "https://api.github.com/copilot_internal/user";
const COPILOT_USAGE_ADAPTER = "copilot-oauth-v1";
const CLOUDCODE_BASE_URL = "https://cloudcode-pa.googleapis.com/v1internal";
const ANTIGRAVITY_TOKEN_RELATIVE_PATH = path.join(
  ".gemini",
  "antigravity-cli",
  "antigravity-oauth-token",
);
const GEMINI_CREDENTIALS_RELATIVE_PATH = path.join(
  ".gemini",
  "oauth_creds.json",
);
const GH_HOSTS_RELATIVE_PATH = path.join(".config", "gh", "hosts.yml");
const COPILOT_HOSTS_RELATIVE_PATH = path.join(
  ".config",
  "github-copilot",
  "hosts.json",
);
const SEVEN_DAY_WINDOW_SECONDS = 86_400;
const LEGACY_KEYCHAIN_SERVICE = "Claude Code-credentials";
const KEYCHAIN_TIMEOUT_MS = 10_000;
const KEYCHAIN_MAX_BUFFER = 64 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60_000;

const WINDOW_METRIC_META = {
  fiveHour: { id: "fiveHour", label: "5-hour window" },
  sevenDay: { id: "sevenDay", label: "7-day window" },
  sevenDayOpus: { id: "sevenDayOpus", label: "7-day Opus window" },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Accepts ISO strings or epoch numbers; values below 1e12 are treated as
// epoch seconds, anything larger as epoch milliseconds.
function parseResetTime(value: unknown): number | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
    return parseResetTime(Number(value));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  return null;
}

function toWindowMetric(
  key: keyof typeof WINDOW_METRIC_META,
  window: UsageWindow | null,
): AgentUsageMetric | null {
  if (!window) return null;
  const meta = WINDOW_METRIC_META[key];
  return {
    id: meta.id,
    label: meta.label,
    kind: "window",
    utilization: window.utilization,
    resetsAt: window.resetsAt,
  };
}

function defaultResolveConfigRoot(agentId: string): string {
  const platform = SkillInstaller.getSupportedPlatforms().find(
    (candidate) => candidate.id === agentId,
  );
  if (!platform) {
    throw new Error(`Unknown Agent platform: ${agentId}`);
  }
  return getPlatformRootDir(platform);
}

function hashedKeychainService(configRoot: string): string {
  const digest = createHash("sha256").update(configRoot).digest("hex");
  return `${LEGACY_KEYCHAIN_SERVICE}-${digest.slice(0, 8)}`;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRecord(value) ? value : null;
}

function parseCredentials(raw: string): ClaudeCredentials | null {
  const value = parseJsonObject(raw);
  if (!value) return null;

  const oauth = isRecord(value.claudeAiOauth) ? value.claudeAiOauth : null;
  const tokenCandidate = oauth?.accessToken ?? value.accessToken;
  if (typeof tokenCandidate !== "string" || !tokenCandidate.trim()) {
    return null;
  }

  const expiresAt =
    typeof oauth?.expiresAt === "number" && Number.isFinite(oauth.expiresAt)
      ? oauth.expiresAt
      : null;
  const subscriptionType =
    typeof oauth?.subscriptionType === "string" && oauth.subscriptionType.trim()
      ? oauth.subscriptionType.trim()
      : null;

  return {
    accessToken: tokenCandidate,
    expiresAt,
    subscriptionType,
  };
}

function parseUsageWindow(value: unknown): UsageWindow | null {
  if (!isRecord(value)) return null;
  const utilization = value.utilization;
  if (typeof utilization !== "number" || !Number.isFinite(utilization)) {
    return null;
  }
  const resetsAt =
    typeof value.resets_at === "string" && value.resets_at
      ? Date.parse(value.resets_at)
      : Number.NaN;
  return {
    utilization,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
  };
}

function parseCodexAuth(raw: string): CodexCredentials | null {
  const value = parseJsonObject(raw);
  if (!value) return null;
  const tokens = isRecord(value.tokens) ? value.tokens : null;
  const accessToken = tokens?.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    return null;
  }
  const accountId = tokens?.account_id;
  return {
    accessToken,
    accountId:
      typeof accountId === "string" && accountId.trim()
        ? accountId.trim()
        : null,
  };
}

// The official Codex backend does not guarantee primary/secondary slot
// semantics, so windows are classified by their length instead of their slot.
function parseCodexWindow(value: unknown): CodexUsageWindow | null {
  if (!isRecord(value)) return null;
  const usedPercent = value.used_percent;
  const windowSeconds = value.limit_window_seconds;
  if (
    typeof usedPercent !== "number" ||
    !Number.isFinite(usedPercent) ||
    typeof windowSeconds !== "number" ||
    !Number.isFinite(windowSeconds)
  ) {
    return null;
  }
  const resetAt = value.reset_at;
  return {
    utilization: usedPercent,
    resetsAt:
      typeof resetAt === "number" && Number.isFinite(resetAt)
        ? resetAt * 1000
        : null,
    windowSeconds,
  };
}

function pickLargerWindow(
  current: CodexUsageWindow | null,
  candidate: CodexUsageWindow,
): CodexUsageWindow {
  if (!current || candidate.utilization >= current.utilization) {
    return candidate;
  }
  return current;
}

function parseKimiCredentials(raw: string): TokenCredentials | null {
  const value = parseJsonObject(raw);
  if (!value) return null;
  const accessToken = value.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  return {
    accessToken,
    expiresAt: parseResetTime(value.expires_at),
  };
}

function parseKimiRollingLimit(entry: unknown): AgentUsageMetric | null {
  if (!isRecord(entry)) return null;
  const detail = isRecord(entry.detail) ? entry.detail : entry;
  const used = toFiniteNumber(detail.used);
  const limit = toFiniteNumber(detail.limit);
  if (used === null || limit === null) return null;
  return {
    id: "rolling",
    label: "Rolling window",
    kind: "window",
    utilization: limit > 0 ? (used / limit) * 100 : 0,
    resetsAt: parseResetTime(
      entry.resetTime ?? detail.resetTime ?? entry.reset_time,
    ),
  };
}

function mapKimiMetrics(body: unknown): AgentUsageMetric[] {
  if (!isRecord(body)) return [];
  const metrics: AgentUsageMetric[] = [];
  const usage = isRecord(body.usage) ? body.usage : null;
  if (usage) {
    const limit = toFiniteNumber(usage.limit);
    const used = toFiniteNumber(usage.used);
    const resetsAt = parseResetTime(usage.resetTime);
    if (limit !== null && limit > 0 && used !== null) {
      metrics.push({
        id: "weekly",
        label: "Weekly quota",
        kind: "quota",
        utilization: (used / limit) * 100,
        resetsAt,
        usedAmount: used,
        totalAmount: limit,
        unit: "%",
      });
    } else {
      // A zero/absent limit means the provider did not report amounts; keep
      // the metric but omit the amounts instead of dividing by zero.
      metrics.push({
        id: "weekly",
        label: "Weekly quota",
        kind: "quota",
        utilization: 0,
        resetsAt,
        unit: "%",
      });
    }
  }
  if (Array.isArray(body.limits)) {
    for (const entry of body.limits) {
      const metric = parseKimiRollingLimit(entry);
      if (metric) metrics.push(metric);
    }
  }
  return metrics;
}

function parseKimiPlan(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.user)) return null;
  const membership = isRecord(body.user.membership)
    ? body.user.membership
    : null;
  return toNonEmptyString(membership?.level);
}

function parseAntigravityCredentials(raw: string): TokenCredentials | null {
  const value = parseJsonObject(raw);
  if (!value || !isRecord(value.token)) return null;
  const accessToken = value.token.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  return {
    accessToken,
    expiresAt: parseResetTime(value.token.expiry),
    renewable:
      typeof value.token.refresh_token === "string" &&
      Boolean(value.token.refresh_token.trim()),
  };
}

function parseAntigravityKeychainCredentials(
  raw: string,
): TokenCredentials | null {
  const direct = parseAntigravityCredentials(raw);
  if (direct) return direct;

  // Antigravity 2.x stores `<account-ref>:<base64url-json>` in the macOS
  // Keychain. Decode candidates defensively so a future prefix change does
  // not expose or invalidate the credential payload.
  for (const candidate of raw.split(":").reverse()) {
    if (!candidate.trim()) continue;
    try {
      const decoded = Buffer.from(candidate.trim(), "base64url").toString(
        "utf8",
      );
      const parsed = parseAntigravityCredentials(decoded);
      if (parsed) return parsed;
    } catch {
      // Continue to the next candidate or the file-based fallbacks.
    }
  }
  return null;
}

function parseGeminiCredentials(raw: string): TokenCredentials | null {
  const value = parseJsonObject(raw);
  if (!value) return null;
  const accessToken = value.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  return {
    accessToken,
    expiresAt: parseResetTime(value.expiry_date),
  };
}

function extractCloudCodeProject(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const project = body.cloudaicompanionProject;
  if (typeof project === "string" && project.trim()) return project.trim();
  if (isRecord(project)) return toNonEmptyString(project.id);
  return null;
}

function extractCloudCodeTier(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.currentTier)) return null;
  const tier = body.currentTier;
  return toNonEmptyString(tier.name) ?? toNonEmptyString(tier.id);
}

// The models payload is a dict keyed by model name in current responses,
// but a list shape is accepted defensively.
function mapAntigravityModelMetrics(body: unknown): AgentUsageMetric[] {
  if (!isRecord(body)) return [];
  const models = body.models;
  const entries: Array<[string, unknown]> = [];
  if (isRecord(models)) {
    entries.push(...Object.entries(models));
  } else if (Array.isArray(models)) {
    for (const item of models) {
      if (!isRecord(item)) continue;
      const name =
        toNonEmptyString(item.name) ??
        toNonEmptyString(item.model) ??
        toNonEmptyString(item.id);
      if (name) entries.push([name, item]);
    }
  }
  const metrics: AgentUsageMetric[] = [];
  for (const [name, value] of entries) {
    if (!isRecord(value) || !isRecord(value.quotaInfo)) continue;
    const quotaInfo = value.quotaInfo;
    const remainingFraction = toFiniteNumber(quotaInfo.remainingFraction);
    if (remainingFraction === null) continue;
    metrics.push({
      id: `model:${name}`,
      label: name,
      kind: "quota",
      utilization: (1 - remainingFraction) * 100,
      resetsAt: parseResetTime(quotaInfo.resetTime),
    });
  }
  return metrics;
}

function mapGeminiBucketMetrics(body: unknown): AgentUsageMetric[] {
  if (!isRecord(body) || !Array.isArray(body.buckets)) return [];
  const metrics: AgentUsageMetric[] = [];
  for (const bucket of body.buckets) {
    if (!isRecord(bucket)) continue;
    const modelId = toNonEmptyString(bucket.modelId);
    const remainingFraction = toFiniteNumber(bucket.remainingFraction);
    if (!modelId || remainingFraction === null) continue;
    metrics.push({
      id: `model:${modelId}`,
      label: modelId,
      kind: "quota",
      utilization: (1 - remainingFraction) * 100,
      resetsAt: parseResetTime(bucket.resetTime),
    });
  }
  return metrics;
}

function parseCopilotSnapshot(
  id: string,
  label: string,
  value: unknown,
  resetsAt: number | null,
): AgentUsageMetric | null {
  if (!isRecord(value) || value.unlimited === true) return null;
  const entitlement = toFiniteNumber(value.entitlement);
  const remaining = toFiniteNumber(value.remaining);
  const percentUsed = toFiniteNumber(value.percent_used);
  let utilization = percentUsed;
  if (
    utilization === null &&
    entitlement !== null &&
    entitlement > 0 &&
    remaining !== null
  ) {
    utilization = (1 - remaining / entitlement) * 100;
  }
  if (utilization === null) return null;
  const metric: AgentUsageMetric = {
    id,
    label,
    kind: "quota",
    utilization,
    resetsAt,
    unit: "requests",
  };
  if (entitlement !== null && remaining !== null) {
    metric.usedAmount = entitlement - remaining;
  }
  if (entitlement !== null) {
    metric.totalAmount = entitlement;
  }
  return metric;
}

function mapCopilotMetrics(body: unknown): AgentUsageMetric[] {
  if (!isRecord(body)) return [];
  const resetsAt = parseResetTime(body.quota_reset_date);
  const snapshots = isRecord(body.quota_snapshots) ? body.quota_snapshots : {};
  return [
    parseCopilotSnapshot(
      "premium",
      "Premium requests",
      snapshots.premium_interactions,
      resetsAt,
    ),
    parseCopilotSnapshot("chat", "Chat requests", snapshots.chat, resetsAt),
  ].filter((metric): metric is AgentUsageMetric => metric !== null);
}

function buildQuota(
  agentId: string,
  status: AgentUsageQuota["status"],
  fetchedAt: number,
  overrides: Partial<AgentUsageQuota> = {},
): AgentUsageQuota {
  return {
    agentId,
    adapter: USAGE_ADAPTER,
    status,
    source: "provider",
    plan: null,
    metrics: [],
    fetchedAt,
    ...overrides,
  };
}

export function createAgentUsageService(
  options: AgentUsageServiceOptions = {},
): AgentUsageService {
  const resolveConfigRoot =
    options.resolveConfigRoot ?? defaultResolveConfigRoot;
  const commandRunner = options.commandRunner ?? createNativeCommandRunner();
  const fetchImpl = options.fetchImpl ?? fetch;
  const readFile =
    options.readFile ?? ((filePath: string) => fs.readFile(filePath, "utf8"));
  const readDir = options.readDir ?? ((dirPath: string) => fs.readdir(dirPath));
  const now = options.now ?? Date.now;
  const homeDir = options.homeDir ?? os.homedir();
  const platform = options.platform ?? process.platform;
  const antigravityLocalClient =
    options.antigravityLocalClient ??
    createAntigravityLocalUsageClient({ commandRunner, platform });

  const cache = new Map<string, { quota: AgentUsageQuota; storedAt: number }>();

  async function readKeychainCredentials(
    serviceName: string,
  ): Promise<ClaudeCredentials | null> {
    const security = await commandRunner.resolve("security");
    if (!security) return null;
    try {
      const result = await commandRunner.run(
        security,
        ["find-generic-password", "-s", serviceName, "-w"],
        { timeout: KEYCHAIN_TIMEOUT_MS, maxBuffer: KEYCHAIN_MAX_BUFFER },
      );
      return parseCredentials(result.stdout);
    } catch {
      return null;
    }
  }

  async function readFileCredentials(
    configRoot: string,
  ): Promise<ClaudeCredentials | null> {
    const credentialsPath = path.join(configRoot, ".credentials.json");
    try {
      const raw = await readFile(credentialsPath);
      return parseCredentials(raw);
    } catch {
      return null;
    }
  }

  async function resolveCredentials(
    configRoot: string,
  ): Promise<ClaudeCredentials | null> {
    if (platform === "darwin") {
      const legacy = await readKeychainCredentials(LEGACY_KEYCHAIN_SERVICE);
      if (legacy) return legacy;
      const hashed = await readKeychainCredentials(
        hashedKeychainService(configRoot),
      );
      if (hashed) return hashed;
    }
    return readFileCredentials(configRoot);
  }

  async function fetchUsage(
    credentials: ClaudeCredentials,
  ): Promise<FetchJsonResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetchImpl(USAGE_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "anthropic-beta": "oauth-2025-04-20",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      if (response.status === 401) {
        return { kind: "expired" };
      }
      if (!response.ok) {
        return { kind: "unavailable", errorCode: "http-error" };
      }
      return { kind: "ok", body: (await response.json()) as unknown };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return {
        kind: "unavailable",
        errorCode: isTimeout ? "timeout" : "network-error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // Shared fetch wrapper for the adapters added after Claude/Codex; both
  // 401 and 403 mean the stored token is no longer accepted.
  async function fetchJson(
    url: string,
    init: RequestInit,
  ): Promise<FetchJsonResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        return { kind: "expired" };
      }
      if (!response.ok) {
        return { kind: "unavailable", errorCode: "http-error" };
      }
      return { kind: "ok", body: (await response.json()) as unknown };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return {
        kind: "unavailable",
        errorCode: isTimeout ? "timeout" : "network-error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // A third-party model_provider in config.toml means the user is not on the
  // official Codex backend, so the ChatGPT usage endpoint must not be called.
  async function readCodexModelProvider(
    configRoot: string,
  ): Promise<string | null> {
    try {
      const raw = await readFile(path.join(configRoot, "config.toml"));
      const parsed: unknown = parseToml(raw);
      if (!isRecord(parsed)) return null;
      const provider = parsed.model_provider;
      return typeof provider === "string" && provider.trim()
        ? provider.trim()
        : null;
    } catch {
      return null;
    }
  }

  async function readCodexCredentials(
    configRoot: string,
  ): Promise<CodexCredentials | null> {
    try {
      const raw = await readFile(path.join(configRoot, "auth.json"));
      return parseCodexAuth(raw);
    } catch {
      return null;
    }
  }

  // A custom gateway (ANTHROPIC_BASE_URL) or cloud provider flag in
  // settings.json means Claude Code traffic bypasses the official Anthropic
  // subscription, so the official usage endpoint must not be called.
  async function isClaudeCustomGateway(configRoot: string): Promise<boolean> {
    try {
      const raw = await readFile(path.join(configRoot, "settings.json"));
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || !isRecord(parsed.env)) return false;
      const env = parsed.env;
      return [
        "ANTHROPIC_BASE_URL",
        "CLAUDE_CODE_USE_BEDROCK",
        "CLAUDE_CODE_USE_VERTEX",
        "CLAUDE_CODE_USE_FOUNDRY",
      ].some((key) => {
        const value = env[key];
        return typeof value === "string" && value.trim().length > 0;
      });
    } catch {
      return false;
    }
  }

  async function fetchCodexUsage(
    credentials: CodexCredentials,
  ): Promise<FetchJsonResult> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
    };
    if (credentials.accountId) {
      headers["ChatGPT-Account-Id"] = credentials.accountId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetchImpl(CODEX_USAGE_ENDPOINT, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        return { kind: "expired" };
      }
      if (!response.ok) {
        return { kind: "unavailable", errorCode: "http-error" };
      }
      return { kind: "ok", body: (await response.json()) as unknown };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      return {
        kind: "unavailable",
        errorCode: isTimeout ? "timeout" : "network-error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function queryCodexUsage(agentId: string): Promise<AgentUsageQuota> {
    const configRoot = resolveConfigRoot(agentId);
    const buildCodexQuota = (
      status: AgentUsageQuota["status"],
      overrides: Partial<AgentUsageQuota> = {},
    ): AgentUsageQuota =>
      buildQuota(agentId, status, now(), {
        adapter: CODEX_USAGE_ADAPTER,
        ...overrides,
      });

    const modelProvider = await readCodexModelProvider(configRoot);
    if (modelProvider !== null && modelProvider !== CODEX_OFFICIAL_PROVIDER) {
      return buildCodexQuota("unavailable", {
        errorCode: "custom-provider-active",
      });
    }

    const credentials = await readCodexCredentials(configRoot);
    if (!credentials) {
      return buildCodexQuota("no-credentials");
    }

    const result = await fetchCodexUsage(credentials);
    if (result.kind === "expired") {
      return buildCodexQuota("expired");
    }
    if (result.kind === "unavailable") {
      return buildCodexQuota("unavailable", { errorCode: result.errorCode });
    }

    const body = isRecord(result.body) ? result.body : {};
    const rateLimit = isRecord(body.rate_limit) ? body.rate_limit : {};
    let fiveHour: CodexUsageWindow | null = null;
    let sevenDay: CodexUsageWindow | null = null;
    for (const slot of ["primary_window", "secondary_window"] as const) {
      const window = parseCodexWindow(rateLimit[slot]);
      if (!window) continue;
      if (window.windowSeconds <= SEVEN_DAY_WINDOW_SECONDS) {
        fiveHour = pickLargerWindow(fiveHour, window);
      } else {
        sevenDay = pickLargerWindow(sevenDay, window);
      }
    }
    return buildCodexQuota("ok", {
      metrics: [
        toWindowMetric("fiveHour", fiveHour),
        toWindowMetric("sevenDay", sevenDay),
      ].filter((metric): metric is AgentUsageMetric => metric !== null),
      plan:
        typeof body.plan_type === "string" && body.plan_type.trim()
          ? body.plan_type.trim()
          : null,
    });
  }

  async function readKimiCredentialsFile(
    filePath: string,
  ): Promise<TokenCredentials | null> {
    try {
      const raw = await readFile(filePath);
      return parseKimiCredentials(raw);
    } catch {
      return null;
    }
  }

  async function readKimiCredentials(
    configRoot: string,
  ): Promise<TokenCredentials | null> {
    const primary = await readKimiCredentialsFile(
      path.join(configRoot, "credentials", "kimi-code.json"),
    );
    if (primary) return primary;
    // Older builds dropped token json files directly under <root>/oauth/.
    let entries: string[];
    try {
      entries = await readDir(path.join(configRoot, "oauth"));
    } catch {
      return null;
    }
    for (const entry of [...entries].sort()) {
      if (!entry.endsWith(".json")) continue;
      const parsed = await readKimiCredentialsFile(
        path.join(configRoot, "oauth", entry),
      );
      if (parsed) return parsed;
    }
    return null;
  }

  async function queryKimiUsage(
    agentId: string,
    configRoot: string,
  ): Promise<AgentUsageQuota> {
    const buildKimiQuota = (
      status: AgentUsageQuota["status"],
      overrides: Partial<AgentUsageQuota> = {},
    ): AgentUsageQuota =>
      buildQuota(agentId, status, now(), {
        adapter: KIMI_USAGE_ADAPTER,
        ...overrides,
      });

    const credentials = await readKimiCredentials(configRoot);
    if (!credentials) {
      return buildKimiQuota("no-credentials");
    }
    if (credentials.expiresAt !== null && credentials.expiresAt <= now()) {
      return buildKimiQuota("expired");
    }

    const result = await fetchJson(KIMI_USAGE_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (result.kind === "expired") {
      return buildKimiQuota("expired");
    }
    if (result.kind === "unavailable") {
      return buildKimiQuota("unavailable", { errorCode: result.errorCode });
    }
    return buildKimiQuota("ok", {
      metrics: mapKimiMetrics(result.body),
      plan: parseKimiPlan(result.body),
    });
  }

  async function readHomeCredentials(
    relativePath: string,
    parse: (raw: string) => TokenCredentials | null,
  ): Promise<TokenCredentials | null> {
    try {
      const raw = await readFile(path.join(homeDir, relativePath));
      return parse(raw);
    } catch {
      return null;
    }
  }

  async function readAntigravityKeychainCredentials(): Promise<TokenCredentials | null> {
    if (platform !== "darwin") return null;
    const security = await commandRunner.resolve("security");
    if (!security) return null;
    try {
      const result = await commandRunner.run(
        security,
        [
          "find-generic-password",
          "-s",
          ANTIGRAVITY_KEYCHAIN_SERVICE,
          "-a",
          ANTIGRAVITY_KEYCHAIN_ACCOUNT,
          "-w",
        ],
        { timeout: KEYCHAIN_TIMEOUT_MS, maxBuffer: KEYCHAIN_MAX_BUFFER },
      );
      return parseAntigravityKeychainCredentials(result.stdout.trim());
    } catch {
      return null;
    }
  }

  async function resolveAntigravityCredentialCandidates(): Promise<
    TokenCredentials[]
  > {
    const candidates = await Promise.all([
      readAntigravityKeychainCredentials(),
      readHomeCredentials(
        ANTIGRAVITY_TOKEN_RELATIVE_PATH,
        parseAntigravityCredentials,
      ),
      readHomeCredentials(
        GEMINI_CREDENTIALS_RELATIVE_PATH,
        parseGeminiCredentials,
      ),
    ]);
    const seen = new Set<string>();
    return candidates.filter((candidate): candidate is TokenCredentials => {
      if (!candidate || seen.has(candidate.accessToken)) return false;
      seen.add(candidate.accessToken);
      return true;
    });
  }

  // Shared Cloud Code Assist preamble for the Google-backed adapters:
  // resolves the managed project id and the subscription tier label.
  async function loadCodeAssist(
    accessToken: string,
    body: string,
  ): Promise<
    | { kind: "ok"; projectId: string | null; plan: string | null }
    | { kind: "expired" }
    | { kind: "unavailable"; errorCode: string }
  > {
    const result = await fetchJson(`${CLOUDCODE_BASE_URL}:loadCodeAssist`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (result.kind !== "ok") return result;
    return {
      kind: "ok",
      projectId: extractCloudCodeProject(result.body),
      plan: extractCloudCodeTier(result.body),
    };
  }

  async function queryAntigravityUsage(
    agentId: string,
  ): Promise<AgentUsageQuota> {
    const buildAntigravityQuota = (
      status: AgentUsageQuota["status"],
      overrides: Partial<AgentUsageQuota> = {},
    ): AgentUsageQuota =>
      buildQuota(agentId, status, now(), {
        adapter: ANTIGRAVITY_USAGE_ADAPTER,
        ...overrides,
      });

    const localUsage = await antigravityLocalClient.getUsage();
    if (localUsage.kind === "ok") {
      return buildAntigravityQuota("ok", {
        adapter: "antigravity-local-v1",
        metrics: localUsage.metrics,
        plan: localUsage.plan,
      });
    }

    // Prefer the current Antigravity desktop session, then retain the 1.x CLI
    // and shared Gemini files as compatibility sources. A stale source must
    // never hide a later valid one.
    const candidates = await resolveAntigravityCredentialCandidates();
    if (candidates.length === 0) {
      return buildAntigravityQuota("no-credentials");
    }
    let sawExpiredCredential = false;
    let sawRenewableCredential = false;
    for (const credentials of candidates) {
      if (credentials.expiresAt !== null && credentials.expiresAt <= now()) {
        sawExpiredCredential = true;
        sawRenewableCredential ||= credentials.renewable === true;
        continue;
      }

      const assist = await loadCodeAssist(
        credentials.accessToken,
        JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
      );
      if (assist.kind === "expired") {
        sawExpiredCredential = true;
        sawRenewableCredential ||= credentials.renewable === true;
        continue;
      }
      if (assist.kind === "unavailable") {
        return buildAntigravityQuota("unavailable", {
          errorCode: assist.errorCode,
        });
      }

      const modelsResult = await fetchJson(
        `${CLOUDCODE_BASE_URL}:fetchAvailableModels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ project: assist.projectId }),
        },
      );
      if (modelsResult.kind === "expired") {
        sawExpiredCredential = true;
        sawRenewableCredential ||= credentials.renewable === true;
        continue;
      }
      if (modelsResult.kind === "unavailable") {
        return buildAntigravityQuota("unavailable", {
          errorCode: modelsResult.errorCode,
        });
      }
      return buildAntigravityQuota("ok", {
        metrics: mapAntigravityModelMetrics(modelsResult.body),
        plan: assist.plan,
      });
    }
    if (sawRenewableCredential) {
      return buildAntigravityQuota("unavailable", {
        errorCode:
          localUsage.kind === "not-running"
            ? "antigravity-not-running"
            : "antigravity-session-unavailable",
      });
    }
    return buildAntigravityQuota(
      sawExpiredCredential ? "expired" : "no-credentials",
    );
  }

  async function queryGeminiUsage(agentId: string): Promise<AgentUsageQuota> {
    const buildGeminiQuota = (
      status: AgentUsageQuota["status"],
      overrides: Partial<AgentUsageQuota> = {},
    ): AgentUsageQuota =>
      buildQuota(agentId, status, now(), {
        adapter: GEMINI_USAGE_ADAPTER,
        ...overrides,
      });

    const credentials = await readHomeCredentials(
      GEMINI_CREDENTIALS_RELATIVE_PATH,
      parseGeminiCredentials,
    );
    if (!credentials) {
      return buildGeminiQuota("no-credentials");
    }
    if (credentials.expiresAt !== null && credentials.expiresAt <= now()) {
      return buildGeminiQuota("expired");
    }

    const assist = await loadCodeAssist(credentials.accessToken, "{}");
    if (assist.kind === "expired") {
      return buildGeminiQuota("expired");
    }
    if (assist.kind === "unavailable") {
      return buildGeminiQuota("unavailable", { errorCode: assist.errorCode });
    }

    const quotaResult = await fetchJson(
      `${CLOUDCODE_BASE_URL}:retrieveUserQuota`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: assist.projectId }),
      },
    );
    if (quotaResult.kind === "expired") {
      return buildGeminiQuota("expired");
    }
    if (quotaResult.kind === "unavailable") {
      return buildGeminiQuota("unavailable", {
        errorCode: quotaResult.errorCode,
      });
    }
    return buildGeminiQuota("ok", {
      metrics: mapGeminiBucketMetrics(quotaResult.body),
      plan: assist.plan,
    });
  }

  // GitHub OAuth tokens are reused from the gh CLI or the Copilot CLI
  // credential stores; PromptHub never runs its own OAuth flow here.
  async function readCopilotToken(): Promise<string | null> {
    try {
      const raw = await readFile(path.join(homeDir, GH_HOSTS_RELATIVE_PATH));
      // hosts.yml is flat enough that a line parse avoids a YAML dependency.
      const match = raw.match(/^\s*oauth_token:\s*(\S+)\s*$/m);
      if (match?.[1]) return match[1];
    } catch {
      // Fall through to the Copilot hosts.json store.
    }
    try {
      const raw = await readFile(
        path.join(homeDir, COPILOT_HOSTS_RELATIVE_PATH),
      );
      const value = parseJsonObject(raw);
      if (!value) return null;
      for (const host of Object.values(value)) {
        const token = isRecord(host)
          ? toNonEmptyString(host.oauth_token)
          : null;
        if (token) return token;
      }
    } catch {
      return null;
    }
    return null;
  }

  async function queryCopilotUsage(agentId: string): Promise<AgentUsageQuota> {
    const buildCopilotQuota = (
      status: AgentUsageQuota["status"],
      overrides: Partial<AgentUsageQuota> = {},
    ): AgentUsageQuota =>
      buildQuota(agentId, status, now(), {
        adapter: COPILOT_USAGE_ADAPTER,
        ...overrides,
      });

    const token = await readCopilotToken();
    if (!token) {
      return buildCopilotQuota("no-credentials");
    }

    const result = await fetchJson(COPILOT_USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "prompthub-desktop",
      },
    });
    if (result.kind === "expired") {
      return buildCopilotQuota("expired");
    }
    if (result.kind === "unavailable") {
      return buildCopilotQuota("unavailable", { errorCode: result.errorCode });
    }
    const body = isRecord(result.body) ? result.body : {};
    return buildCopilotQuota("ok", {
      metrics: mapCopilotMetrics(result.body),
      plan: toNonEmptyString(body.copilot_plan),
    });
  }

  async function queryUsage(agentId: string): Promise<AgentUsageQuota> {
    // Resolving the config root through the platform registry doubles as the
    // agentId allowlist check; unknown ids throw before any lookup happens.
    const configRoot = resolveConfigRoot(agentId);
    if (agentId === "codex") {
      return queryCodexUsage(agentId);
    }
    if (agentId === "kimi") {
      return queryKimiUsage(agentId, configRoot);
    }
    if (agentId === "antigravity") {
      return queryAntigravityUsage(agentId);
    }
    if (agentId === "gemini") {
      return queryGeminiUsage(agentId);
    }
    if (agentId === "copilot") {
      return queryCopilotUsage(agentId);
    }
    if (agentId !== "claude") {
      return buildQuota(agentId, "unavailable", now(), {
        adapter: "unsupported",
        errorCode: "unsupported-agent",
      });
    }

    // A custom gateway or cloud provider in settings.json means traffic no
    // longer goes to the official Anthropic subscription, so the official
    // quota endpoint must not be queried (mirrors the Codex short-circuit).
    if (await isClaudeCustomGateway(configRoot)) {
      return buildQuota(agentId, "unavailable", now(), {
        errorCode: "custom-provider-active",
      });
    }

    const credentials = await resolveCredentials(configRoot);
    if (!credentials) {
      return buildQuota(agentId, "no-credentials", now());
    }
    if (credentials.expiresAt !== null && credentials.expiresAt <= now()) {
      return buildQuota(agentId, "expired", now(), {
        plan: credentials.subscriptionType,
      });
    }

    const result = await fetchUsage(credentials);
    if (result.kind === "expired") {
      return buildQuota(agentId, "expired", now(), {
        plan: credentials.subscriptionType,
      });
    }
    if (result.kind === "unavailable") {
      return buildQuota(agentId, "unavailable", now(), {
        plan: credentials.subscriptionType,
        errorCode: result.errorCode,
      });
    }

    const body = isRecord(result.body) ? result.body : {};
    return buildQuota(agentId, "ok", now(), {
      metrics: [
        toWindowMetric("fiveHour", parseUsageWindow(body.five_hour)),
        toWindowMetric("sevenDay", parseUsageWindow(body.seven_day)),
        toWindowMetric("sevenDayOpus", parseUsageWindow(body.seven_day_opus)),
      ].filter((metric): metric is AgentUsageMetric => metric !== null),
      plan: credentials.subscriptionType,
    });
  }

  return {
    async getUsage(agentId, getOptions = {}) {
      if (typeof agentId !== "string" || agentId.trim().length === 0) {
        throw new Error("Agent usage query requires a non-empty agentId");
      }

      const cached = cache.get(agentId);
      if (
        !getOptions.forceRefresh &&
        cached &&
        now() - cached.storedAt < CACHE_TTL_MS
      ) {
        return cached.quota;
      }

      const quota = await queryUsage(agentId);
      cache.set(agentId, { quota, storedAt: now() });
      return quota;
    },
  };
}
