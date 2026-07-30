import { getAgentPlatformCapabilityInventory } from "@prompthub/shared/constants/agent-platform-capabilities";
import { getPlatformById } from "@prompthub/shared/constants/platforms";
import type {
  AgentDeepLinkCommand,
  AgentDeepLinkErrorCode,
} from "@prompthub/shared/types/app-command";
import type {
  AgentProviderProfileExport,
  CreateAgentProviderModelMappingInput,
  CreateAgentProviderProfileInput,
} from "@prompthub/shared/types/agent";
import {
  assertAgentProviderPublicConfig,
  isAgentProviderSensitiveKey,
  normalizeAgentProviderEndpoint,
} from "@prompthub/shared/utils/agent-provider-config";

export const AGENT_DEEP_LINK_MAX_RAW_LENGTH = 16 * 1024;
export const AGENT_DEEP_LINK_MAX_DECODED_LENGTH = 12 * 1024;

const MAX_MODEL_MAPPINGS = 16;
const MAX_SCAN_DEPTH = 20;
const MAX_SCAN_NODES = 2_048;
const ALLOWED_PROTOCOLS = new Set([
  "anthropic-messages",
  "google-generative-ai",
  "openai-chat",
  "openai-responses",
  "platform-native",
]);
const PROFILE_SOURCES = new Set([
  "manual",
  "native-import",
  "universal",
  "import",
]);
const ENVELOPE_KEYS = new Set(["version", "objectType", "value"]);
const EXPORT_KEYS = new Set([
  "version",
  "profile",
  "modelMappings",
  "requiresSecret",
]);
const PROFILE_KEYS = new Set([
  "platformId",
  "name",
  "providerKind",
  "protocol",
  "endpoint",
  "config",
  "source",
]);
const MAPPING_KEYS = new Set(["routeKey", "modelId", "parameters"]);

interface DeepLinkEnvelope {
  version: 1;
  objectType: "provider-profile";
  value: AgentProviderProfileExport;
}

export type AgentDeepLinkParseResult =
  | {
      ok: true;
      command: Extract<AgentDeepLinkCommand, { type: "agent:import-provider" }>;
    }
  | { ok: false; errorCode: AgentDeepLinkErrorCode };

class DeepLinkError extends Error {
  readonly code: AgentDeepLinkErrorCode;

  constructor(code: AgentDeepLinkErrorCode) {
    super(code);
    this.code = code;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function invalid(): never {
  throw new DeepLinkError("AGENT_DEEP_LINK_INVALID");
}

function unsupported(): never {
  throw new DeepLinkError("AGENT_DEEP_LINK_UNSUPPORTED");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid();
  }
}

function assertRequiredKeys(
  value: Record<string, unknown>,
  required: readonly string[],
): void {
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) invalid();
  }
}

function assertBoundedString(
  value: unknown,
  options: { max: number; pattern?: RegExp; trim?: boolean },
): string {
  if (typeof value !== "string") invalid();
  const normalized = options.trim === false ? value : value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > options.max ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    (options.pattern && !options.pattern.test(normalized))
  ) {
    invalid();
  }
  return normalized;
}

function containsSensitiveKey(value: unknown): boolean {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > MAX_SCAN_NODES || current.depth > MAX_SCAN_DEPTH) invalid();
    if (current.value === null || typeof current.value !== "object") continue;

    if (Array.isArray(current.value)) {
      for (const child of current.value) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
      continue;
    }
    for (const [key, child] of Object.entries(current.value)) {
      if (key !== "requiresSecret" && isAgentProviderSensitiveKey(key)) {
        return true;
      }
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }
  return false;
}

function parseModelMappings(
  value: unknown,
): CreateAgentProviderModelMappingInput[] {
  if (!Array.isArray(value) || value.length > MAX_MODEL_MAPPINGS) invalid();
  const routeKeys = new Set<string>();
  return value.map((candidate) => {
    if (!isRecord(candidate)) invalid();
    assertExactKeys(candidate, MAPPING_KEYS);
    assertRequiredKeys(candidate, ["routeKey", "modelId", "parameters"]);
    const routeKey = assertBoundedString(candidate.routeKey, {
      max: 80,
      pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    });
    if (routeKeys.has(routeKey)) invalid();
    routeKeys.add(routeKey);
    const modelId = assertBoundedString(candidate.modelId, {
      max: 256,
      trim: false,
    });
    assertAgentProviderPublicConfig(candidate.parameters);
    return {
      routeKey,
      modelId,
      parameters: candidate.parameters,
    };
  });
}

function parseProfile(
  value: unknown,
): Omit<CreateAgentProviderProfileInput, "secretRef"> {
  if (!isRecord(value)) invalid();
  assertExactKeys(value, PROFILE_KEYS);
  assertRequiredKeys(value, [
    "platformId",
    "name",
    "providerKind",
    "protocol",
    "config",
    "source",
  ]);

  const platformId = assertBoundedString(value.platformId, {
    max: 80,
    pattern: /^[a-z0-9][a-z0-9-]*$/,
  });
  const platform = getPlatformById(platformId);
  if (
    !platform ||
    getAgentPlatformCapabilityInventory(platform).providerModel.status !==
      "supported"
  ) {
    unsupported();
  }

  const protocol = assertBoundedString(value.protocol, {
    max: 80,
    pattern: /^[a-z0-9][a-z0-9-]*$/,
  });
  if (!ALLOWED_PROTOCOLS.has(protocol)) unsupported();
  if (typeof value.source !== "string" || !PROFILE_SOURCES.has(value.source)) {
    invalid();
  }
  assertAgentProviderPublicConfig(value.config);
  const endpoint =
    value.endpoint === undefined || value.endpoint === null
      ? null
      : assertBoundedString(value.endpoint, {
          max: 2_048,
        });
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.username || parsed.password) {
        throw new DeepLinkError("AGENT_DEEP_LINK_SENSITIVE_VALUE_REJECTED");
      }
    } catch (error) {
      if (error instanceof DeepLinkError) throw error;
    }
  }

  return {
    platformId,
    name: assertBoundedString(value.name, { max: 120 }),
    providerKind: assertBoundedString(value.providerKind, {
      max: 80,
      pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    }),
    protocol,
    endpoint: normalizeAgentProviderEndpoint(endpoint),
    config: value.config,
    source: "import",
  };
}

function parseEnvelope(value: unknown): DeepLinkEnvelope {
  if (!isRecord(value)) invalid();
  if (containsSensitiveKey(value)) {
    throw new DeepLinkError("AGENT_DEEP_LINK_SENSITIVE_VALUE_REJECTED");
  }
  assertExactKeys(value, ENVELOPE_KEYS);
  assertRequiredKeys(value, ["version", "objectType", "value"]);
  if (value.version !== 1 || value.objectType !== "provider-profile") {
    unsupported();
  }
  if (!isRecord(value.value)) invalid();
  assertExactKeys(value.value, EXPORT_KEYS);
  assertRequiredKeys(value.value, [
    "version",
    "profile",
    "modelMappings",
    "requiresSecret",
  ]);
  if (value.value.version !== 1) unsupported();
  if (typeof value.value.requiresSecret !== "boolean") invalid();

  return {
    version: 1,
    objectType: "provider-profile",
    value: {
      version: 1,
      profile: parseProfile(value.value.profile),
      modelMappings: parseModelMappings(value.value.modelMappings),
      requiresSecret: value.value.requiresSecret,
    },
  };
}

export function parseAgentDeepLink(rawUrl: string): AgentDeepLinkParseResult {
  try {
    if (
      typeof rawUrl !== "string" ||
      byteLength(rawUrl) > AGENT_DEEP_LINK_MAX_RAW_LENGTH
    ) {
      throw new DeepLinkError("AGENT_DEEP_LINK_TOO_LARGE");
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      invalid();
    }
    const entries = [...parsedUrl.searchParams.entries()];
    if (
      parsedUrl.protocol !== "prompthub:" ||
      parsedUrl.hostname !== "import" ||
      parsedUrl.pathname !== "" ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.port ||
      parsedUrl.hash ||
      entries.length !== 1 ||
      entries[0][0] !== "payload"
    ) {
      invalid();
    }

    const payload = entries[0][1];
    if (
      payload.length === 0 ||
      byteLength(payload) > AGENT_DEEP_LINK_MAX_DECODED_LENGTH
    ) {
      throw new DeepLinkError(
        payload.length === 0
          ? "AGENT_DEEP_LINK_INVALID"
          : "AGENT_DEEP_LINK_TOO_LARGE",
      );
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(payload);
    } catch {
      invalid();
    }
    const envelope = parseEnvelope(decoded);
    return {
      ok: true,
      command: {
        type: "agent:import-provider",
        preview: envelope.value,
      },
    };
  } catch (error) {
    return {
      ok: false,
      errorCode:
        error instanceof DeepLinkError ? error.code : "AGENT_DEEP_LINK_INVALID",
    };
  }
}
