import fs from "node:fs/promises";
import path from "node:path";
import {
  applyEdits,
  modify,
  parse as parseJsonc,
  type ParseError,
} from "jsonc-parser";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

import type {
  AgentCredentialStatus,
  AgentModelConfiguration,
  UpdateAgentModelResult,
} from "@prompthub/shared/types";

interface AgentModelContext {
  agentId: string;
  rootPath: string;
}

interface UpdateAgentModelContext extends AgentModelContext {
  model: string;
  secondaryModel?: string | null;
}

interface UpdateOptions {
  backupRoot: string;
}

type JsonRecord = Record<string, unknown>;

const JSON_ADAPTER_PATHS: Record<string, string[]> = {
  claude: ["settings.json"],
  gemini: ["settings.json"],
  opencode: ["opencode.jsonc", "opencode.json"],
  openclaw: ["openclaw.json"],
};
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_MODEL_LENGTH = 512;

function emptyResult(
  agentId: string,
  status: AgentModelConfiguration["status"],
  overrides: Partial<AgentModelConfiguration> = {},
): AgentModelConfiguration {
  return {
    agentId,
    adapter: null,
    status,
    model: null,
    secondaryModel: null,
    fallbackModels: [],
    provider: null,
    endpoint: null,
    availableModels: [],
    credentialStatus: "unknown",
    sourceRelativePath: null,
    canSetModel: false,
    formattingMayChange: false,
    ...overrides,
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getRecord(value: unknown, key: string): JsonRecord | undefined {
  if (!isRecord(value)) return undefined;
  const child = value[key];
  return isRecord(child) ? child : undefined;
}

function getString(value: unknown, key: string): string | null {
  if (!isRecord(value) || typeof value[key] !== "string") return null;
  return (value[key] as string).trim() || null;
}

function getStringArray(value: unknown, key: string): string[] {
  if (!isRecord(value) || !Array.isArray(value[key])) return [];
  return Array.from(
    new Set(
      (value[key] as unknown[])
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function providerFromModel(model: string | null): string | null {
  if (!model?.includes("/")) return null;
  return model.split("/", 1)[0] || null;
}

function sanitizeEndpoint(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextConfig(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) {
    throw new Error("AGENT_MODEL_CONFIG_SIZE_INVALID");
  }
  return fs.readFile(filePath, "utf8");
}

function normalizeModel(value: string): string {
  const model = value.trim();
  if (
    !model ||
    model.length > MAX_MODEL_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(model)
  ) {
    throw new Error("AGENT_MODEL_CONFIG_MODEL_INVALID");
  }
  return model;
}

async function resolveJsonConfigPath(
  agentId: string,
  rootPath: string,
): Promise<{ absolutePath: string; relativePath: string } | null> {
  const candidates = JSON_ADAPTER_PATHS[agentId];
  if (!candidates) return null;
  for (const relativePath of candidates) {
    const absolutePath = path.join(rootPath, relativePath);
    if (await fileExists(absolutePath)) return { absolutePath, relativePath };
  }
  const relativePath = candidates[0];
  return { absolutePath: path.join(rootPath, relativePath), relativePath };
}

function parseJsonRecord(raw: string): JsonRecord {
  const errors: ParseError[] = [];
  const parsed = parseJsonc(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0 || !isRecord(parsed)) {
    throw new Error("AGENT_MODEL_CONFIG_INVALID");
  }
  return parsed;
}

function credentialStatusFromKeys(
  record: JsonRecord | undefined,
  keys: string[],
  fallback: AgentCredentialStatus,
): AgentCredentialStatus {
  if (
    record &&
    keys.some((key) => typeof record[key] === "string" && record[key] !== "")
  ) {
    return "configured";
  }
  return fallback;
}

function inspectClaude(
  data: JsonRecord,
  relativePath: string,
): AgentModelConfiguration {
  const model = getString(data, "model");
  const env = getRecord(data, "env");
  const endpoint = sanitizeEndpoint(getString(env, "ANTHROPIC_BASE_URL"));
  const provider = getString(env, "CLAUDE_CODE_USE_BEDROCK")
    ? "amazon-bedrock"
    : getString(env, "CLAUDE_CODE_USE_VERTEX")
      ? "google-vertex"
      : getString(env, "CLAUDE_CODE_USE_FOUNDRY")
        ? "microsoft-foundry"
        : endpoint
          ? "custom-gateway"
          : "anthropic";
  return emptyResult("claude", model ? "configured" : "not-configured", {
    adapter: "claude-settings-v1",
    model,
    provider,
    endpoint,
    availableModels: getStringArray(data, "availableModels"),
    credentialStatus: credentialStatusFromKeys(
      env,
      ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
      "platform-managed",
    ),
    sourceRelativePath: relativePath,
    canSetModel: true,
  });
}

function inspectGemini(
  data: JsonRecord,
  relativePath: string,
): AgentModelConfiguration {
  const model = getString(getRecord(data, "model"), "name");
  const auth = getRecord(getRecord(data, "security"), "auth");
  const selectedType = getString(auth, "selectedType");
  return emptyResult("gemini", model ? "configured" : "not-configured", {
    adapter: "gemini-settings-v1",
    model,
    provider: "google",
    credentialStatus: selectedType ? "platform-managed" : "unknown",
    sourceRelativePath: relativePath,
    canSetModel: true,
  });
}

function inspectOpenCode(
  data: JsonRecord,
  relativePath: string,
): AgentModelConfiguration {
  const model = getString(data, "model");
  const secondaryModel = getString(data, "small_model");
  const providers = getRecord(data, "provider");
  const provider = providerFromModel(model);
  const selectedProvider = provider
    ? getRecord(providers, provider)
    : undefined;
  const endpoint = getString(getRecord(selectedProvider, "options"), "baseURL");
  const configuredModels = selectedProvider
    ? Object.keys(getRecord(selectedProvider, "models") || {})
    : [];
  return emptyResult("opencode", model ? "configured" : "not-configured", {
    adapter: "opencode-config-v1",
    model,
    secondaryModel,
    provider,
    endpoint: sanitizeEndpoint(endpoint),
    availableModels: configuredModels.map((item) =>
      provider ? `${provider}/${item}` : item,
    ),
    credentialStatus: "platform-managed",
    sourceRelativePath: relativePath,
    canSetModel: true,
  });
}

function inspectOpenClaw(
  data: JsonRecord,
  relativePath: string,
): AgentModelConfiguration {
  const defaults = getRecord(getRecord(data, "agents"), "defaults");
  const modelConfig = getRecord(defaults, "model");
  const model = getString(modelConfig, "primary");
  return emptyResult("openclaw", model ? "configured" : "not-configured", {
    adapter: "openclaw-config-v1",
    model,
    fallbackModels: getStringArray(modelConfig, "fallbacks"),
    provider: providerFromModel(model),
    credentialStatus: "platform-managed",
    sourceRelativePath: relativePath,
    canSetModel: true,
  });
}

function inspectJsonAdapter(
  agentId: string,
  data: JsonRecord,
  relativePath: string,
): AgentModelConfiguration {
  if (agentId === "claude") return inspectClaude(data, relativePath);
  if (agentId === "gemini") return inspectGemini(data, relativePath);
  if (agentId === "opencode") return inspectOpenCode(data, relativePath);
  return inspectOpenClaw(data, relativePath);
}

function inspectCodex(data: JsonRecord): AgentModelConfiguration {
  const model = getString(data, "model");
  const provider = getString(data, "model_provider") || "openai";
  const providerConfig = getRecord(
    getRecord(data, "model_providers"),
    provider,
  );
  const profiles = getRecord(data, "profiles") || {};
  const availableModels = Array.from(
    new Set(
      [
        model,
        ...Object.values(profiles).map((profile) =>
          getString(profile, "model"),
        ),
      ].filter((item): item is string => Boolean(item)),
    ),
  );
  return emptyResult("codex", model ? "configured" : "not-configured", {
    adapter: "codex-toml-v1",
    model,
    provider,
    endpoint: sanitizeEndpoint(getString(providerConfig, "base_url")),
    availableModels,
    credentialStatus: "platform-managed",
    sourceRelativePath: "config.toml",
    canSetModel: true,
    formattingMayChange: true,
  });
}

export async function inspectAgentModelConfig(
  context: AgentModelContext,
): Promise<AgentModelConfiguration> {
  if (context.agentId === "codex") {
    const configPath = path.join(context.rootPath, "config.toml");
    if (!(await fileExists(configPath))) {
      return emptyResult("codex", "missing", {
        adapter: "codex-toml-v1",
        sourceRelativePath: "config.toml",
        canSetModel: true,
        formattingMayChange: true,
      });
    }
    try {
      return inspectCodex(
        parseToml(await readTextConfig(configPath)) as JsonRecord,
      );
    } catch {
      return emptyResult("codex", "invalid", {
        adapter: "codex-toml-v1",
        sourceRelativePath: "config.toml",
        canSetModel: false,
        formattingMayChange: true,
        errorCode: "AGENT_MODEL_CONFIG_INVALID",
      });
    }
  }

  const resolved = await resolveJsonConfigPath(
    context.agentId,
    context.rootPath,
  );
  if (!resolved) return emptyResult(context.agentId, "unsupported");
  if (!(await fileExists(resolved.absolutePath))) {
    return emptyResult(context.agentId, "missing", {
      adapter: `${context.agentId}-config-v1`,
      sourceRelativePath: resolved.relativePath,
      canSetModel: true,
    });
  }
  try {
    const data = parseJsonRecord(await readTextConfig(resolved.absolutePath));
    return inspectJsonAdapter(context.agentId, data, resolved.relativePath);
  } catch {
    return emptyResult(context.agentId, "invalid", {
      adapter: `${context.agentId}-config-v1`,
      sourceRelativePath: resolved.relativePath,
      canSetModel: false,
      errorCode: "AGENT_MODEL_CONFIG_INVALID",
    });
  }
}

async function createBackup(
  sourcePath: string,
  backupRoot: string,
  agentId: string,
): Promise<string | null> {
  if (!(await fileExists(sourcePath))) return null;
  const targetDir = path.join(backupRoot, agentId, String(Date.now()));
  await fs.mkdir(targetDir, { recursive: true, mode: 0o700 });
  const targetPath = path.join(targetDir, path.basename(sourcePath));
  await fs.copyFile(sourcePath, targetPath);
  await fs.chmod(targetPath, 0o600).catch(() => undefined);
  return targetPath;
}

async function atomicWrite(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporaryPath, targetPath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function assertConfigUnchanged(
  targetPath: string,
  original: string | null,
): Promise<void> {
  const exists = await fileExists(targetPath);
  if (exists !== (original !== null)) {
    throw new Error("AGENT_MODEL_CONFIG_CONCURRENT_CHANGE");
  }
  if (exists && (await readTextConfig(targetPath)) !== original) {
    throw new Error("AGENT_MODEL_CONFIG_CONCURRENT_CHANGE");
  }
}

async function restoreModelConfig(
  targetPath: string,
  original: string | null,
): Promise<void> {
  if (original === null) {
    await fs.rm(targetPath, { force: true });
    return;
  }
  await atomicWrite(targetPath, original);
}

async function verifyModelUpdate(
  context: AgentModelContext,
  expectedModel: string,
): Promise<AgentModelConfiguration> {
  const inspected = await inspectAgentModelConfig(context);
  if (inspected.status === "invalid" || inspected.model !== expectedModel) {
    throw new Error("AGENT_MODEL_CONFIG_VERIFICATION_FAILED");
  }
  return inspected;
}

function jsonModelEdits(
  agentId: string,
  raw: string,
  model: string,
  secondaryModel?: string | null,
): string {
  const formatting = { insertSpaces: true, tabSize: 2, eol: "\n" };
  const modelPath =
    agentId === "gemini"
      ? ["model", "name"]
      : agentId === "openclaw"
        ? ["agents", "defaults", "model", "primary"]
        : ["model"];
  let next = applyEdits(
    raw,
    modify(raw, modelPath, model, { formattingOptions: formatting }),
  );
  if (agentId === "opencode" && secondaryModel !== undefined) {
    next = applyEdits(
      next,
      modify(next, ["small_model"], secondaryModel || undefined, {
        formattingOptions: formatting,
      }),
    );
  }
  return next.endsWith("\n") ? next : `${next}\n`;
}

export async function updateAgentModelConfig(
  context: UpdateAgentModelContext,
  options: UpdateOptions,
): Promise<UpdateAgentModelResult> {
  const model = normalizeModel(context.model);
  const secondaryModel =
    context.secondaryModel === null || context.secondaryModel === undefined
      ? context.secondaryModel
      : normalizeModel(context.secondaryModel);

  if (context.agentId === "codex") {
    const targetPath = path.join(context.rootPath, "config.toml");
    let data: JsonRecord = {};
    let original: string | null = null;
    if (await fileExists(targetPath)) {
      original = await readTextConfig(targetPath);
      try {
        data = parseToml(original) as JsonRecord;
      } catch {
        throw new Error("AGENT_MODEL_CONFIG_INVALID");
      }
    }
    const backupPath = await createBackup(
      targetPath,
      options.backupRoot,
      context.agentId,
    );
    data.model = model;
    await assertConfigUnchanged(targetPath, original);
    try {
      await atomicWrite(targetPath, `${stringifyToml(data)}\n`);
      return {
        ...(await verifyModelUpdate(context, model)),
        backupPath,
      };
    } catch {
      await restoreModelConfig(targetPath, original).catch(() => undefined);
      throw new Error("AGENT_MODEL_CONFIG_UPDATE_FAILED");
    }
  }

  const resolved = await resolveJsonConfigPath(
    context.agentId,
    context.rootPath,
  );
  if (!resolved) throw new Error("AGENT_MODEL_CONFIG_UNSUPPORTED");
  let raw = "{}\n";
  let original: string | null = null;
  if (await fileExists(resolved.absolutePath)) {
    raw = await readTextConfig(resolved.absolutePath);
    original = raw;
    parseJsonRecord(raw);
  }
  const backupPath = await createBackup(
    resolved.absolutePath,
    options.backupRoot,
    context.agentId,
  );
  const next = jsonModelEdits(context.agentId, raw, model, secondaryModel);
  parseJsonRecord(next);
  await assertConfigUnchanged(resolved.absolutePath, original);
  try {
    await atomicWrite(resolved.absolutePath, next);
    return {
      ...(await verifyModelUpdate(context, model)),
      backupPath,
    };
  } catch {
    await restoreModelConfig(resolved.absolutePath, original).catch(
      () => undefined,
    );
    throw new Error("AGENT_MODEL_CONFIG_UPDATE_FAILED");
  }
}
