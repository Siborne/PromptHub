import path from "node:path";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import type {
  AgentModelCatalogEntry,
  AgentModelCatalogProvider,
} from "@prompthub/shared/types";

import {
  fileExists,
  readTextConfig,
  sanitizeEndpoint,
} from "./agent-model-config-io";

/**
 * Pi model catalog reader.
 *
 * Pi (pi-coding-agent) keeps a three-file model surface under the agent root:
 * - `models-store.json`: built-in provider catalog cache (etag/checkedAt);
 *   read-only, cache metadata is stripped.
 * - `models.json`: user-authored custom providers/models (official override
 *   surface; see pi docs models.md).
 * - `auth.json`: per-provider credentials. Only key presence is inspected;
 *   values are never read into the returned catalog.
 *
 * All readers fail closed per-file so a malformed cache or user file never
 * breaks the settings-driven default-model surface.
 */

const PI_MODELS_STORE_PATH = "models-store.json";
const PI_MODELS_PATH = "models.json";
const PI_AUTH_PATH = "auth.json";

const MAX_PROVIDERS = 64;
const MAX_MODELS_PER_PROVIDER = 64;
const MAX_MODEL_ID_LENGTH = 512;
const MAX_PROVIDER_ID_LENGTH = 128;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const entry = value[key];
  return typeof entry === "string" && entry.trim() ? entry.trim() : null;
}

function parseJsonRecordSafe(raw: string): JsonRecord | null {
  const errors: ParseError[] = [];
  const parsed = parseJsonc(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0 || !isRecord(parsed)) return null;
  return parsed;
}

async function readJsonFileSafe(
  absolutePath: string,
): Promise<JsonRecord | null> {
  if (!(await fileExists(absolutePath))) return null;
  try {
    return parseJsonRecordSafe(await readTextConfig(absolutePath));
  } catch {
    // Missing, malformed, oversized, or symlinked catalog files degrade to
    // an empty catalog instead of breaking the settings surface.
    return null;
  }
}

function normalizeModelId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MODEL_ID_LENGTH) return null;

  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  return trimmed;
}

function toCatalogEntry(
  value: unknown,
  source: AgentModelCatalogEntry["source"],
): AgentModelCatalogEntry | null {
  if (!isRecord(value)) return null;
  const id = normalizeModelId(value.id);
  if (!id) return null;
  const entry: AgentModelCatalogEntry = { id, source };
  const name = getString(value, "name");
  if (name) entry.name = name;
  const api = getString(value, "api");
  if (api) entry.api = api;
  if (typeof value.reasoning === "boolean") entry.reasoning = value.reasoning;
  if (Array.isArray(value.input)) {
    const input = value.input.filter(
      (item): item is string => typeof item === "string",
    );
    if (input.length > 0) entry.input = input;
  }
  if (
    typeof value.contextWindow === "number" &&
    Number.isSafeInteger(value.contextWindow) &&
    value.contextWindow > 0
  ) {
    entry.contextWindow = value.contextWindow;
  }
  if (
    typeof value.maxTokens === "number" &&
    Number.isSafeInteger(value.maxTokens) &&
    value.maxTokens > 0
  ) {
    entry.maxTokens = value.maxTokens;
  }
  if (isRecord(value.thinkingLevelMap)) {
    const allowed = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
    const map = Object.fromEntries(
      allowed.flatMap((level) => {
        const mapped = value.thinkingLevelMap?.[level];
        return typeof mapped === "string" || mapped === null
          ? [[level, mapped]]
          : [];
      }),
    );
    if (Object.keys(map).length > 0) entry.thinkingLevelMap = map;
  }
  return entry;
}

function mergeModels(
  builtIn: AgentModelCatalogEntry[],
  custom: AgentModelCatalogEntry[],
): AgentModelCatalogEntry[] {
  const merged = new Map<string, AgentModelCatalogEntry>();
  for (const model of builtIn) merged.set(model.id, model);
  // Custom models override same-id built-ins (official override semantics).
  for (const model of custom) merged.set(model.id, model);
  return [...merged.values()];
}

export async function inspectPiModelCatalog(
  rootPath: string,
): Promise<AgentModelCatalogProvider[]> {
  const store = await readJsonFileSafe(
    path.join(rootPath, PI_MODELS_STORE_PATH),
  );
  const custom = await readJsonFileSafe(path.join(rootPath, PI_MODELS_PATH));
  const auth = await readJsonFileSafe(path.join(rootPath, PI_AUTH_PATH));

  const authProviders = new Set<string>();
  if (auth) {
    for (const [providerId, credential] of Object.entries(auth)) {
      if (
        isRecord(credential) &&
        (getString(credential, "key") ||
          getString(credential, "type") === "oauth")
      ) {
        authProviders.add(providerId);
      }
    }
  }

  const providers = new Map<string, AgentModelCatalogProvider>();

  if (store) {
    for (const [providerId, entry] of Object.entries(store)) {
      if (providers.size >= MAX_PROVIDERS) break;
      if (
        !isRecord(entry) ||
        !providerId.trim() ||
        providerId.length > MAX_PROVIDER_ID_LENGTH
      ) {
        continue;
      }
      const rawModels = Array.isArray(entry.models) ? entry.models : [];
      const models = rawModels
        .slice(0, MAX_MODELS_PER_PROVIDER)
        .map((model) => toCatalogEntry(model, "built-in"))
        .filter((model): model is AgentModelCatalogEntry => model !== null);
      const endpoint = sanitizeEndpoint(
        getString(
          Array.isArray(entry.models) ? entry.models[0] : undefined,
          "baseUrl",
        ) ?? getString(entry, "baseUrl"),
      );
      providers.set(providerId, {
        id: providerId,
        models,
        credentialReady: authProviders.has(providerId),
        credentialSource: authProviders.has(providerId) ? "auth" : "missing",
        source: "built-in",
        api: getString(entry, "api") as AgentModelCatalogProvider["api"],
        endpoint,
      });
    }
  }

  const customProviders = isRecord(custom?.providers)
    ? (custom.providers as JsonRecord)
    : {};
  for (const [providerId, entry] of Object.entries(customProviders)) {
    if (!isRecord(entry)) continue;
    if (!providerId.trim() || providerId.length > MAX_PROVIDER_ID_LENGTH) {
      continue;
    }
    const rawModels = Array.isArray(entry.models) ? entry.models : [];
    const models = rawModels
      .slice(0, MAX_MODELS_PER_PROVIDER)
      .map((model) => toCatalogEntry(model, "custom"))
      .filter((model): model is AgentModelCatalogEntry => model !== null);
    // apiKey presence (literal or $ENV reference) counts as configured auth;
    // the value itself never crosses the boundary.
    const configuredKey = getString(entry, "apiKey");
    const hasInlineKey = Boolean(configuredKey);
    const credentialSource = authProviders.has(providerId)
      ? "auth"
      : configuredKey?.startsWith("$")
        ? "environment"
        : hasInlineKey
          ? "provider-config"
          : "missing";
    const endpoint = sanitizeEndpoint(getString(entry, "baseUrl"));
    const existing = providers.get(providerId);
    if (existing) {
      existing.models = mergeModels(existing.models, models).slice(
        0,
        MAX_MODELS_PER_PROVIDER,
      );
      existing.credentialReady =
        existing.credentialReady ||
        authProviders.has(providerId) ||
        hasInlineKey;
      existing.credentialSource = credentialSource;
      existing.api = getString(
        entry,
        "api",
      ) as AgentModelCatalogProvider["api"];
      if (endpoint) existing.endpoint = endpoint;
      existing.source = "custom";
    } else {
      // The cap only blocks new providers; merges into existing providers
      // must still run for entries after a capped one.
      if (providers.size >= MAX_PROVIDERS) continue;
      providers.set(providerId, {
        id: providerId,
        models,
        credentialReady: authProviders.has(providerId) || hasInlineKey,
        credentialSource,
        source: "custom",
        api: getString(entry, "api") as AgentModelCatalogProvider["api"],
        endpoint,
      });
    }
  }

  return [...providers.values()];
}
