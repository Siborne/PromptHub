const MAX_DEPTH = 16;
const MAX_NODES = 10_000;
const MAX_KEY_LENGTH = 256;
const MAX_STRING_LENGTH = 100_000;
const MAX_ENDPOINT_LENGTH = 2_048;

export function isAgentProviderSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    normalized.endsWith("apikey") ||
    normalized.endsWith("apikeyref") ||
    normalized.endsWith("authheader") ||
    normalized.endsWith("authorization") ||
    normalized.endsWith("authorizationheader") ||
    normalized.endsWith("cookie") ||
    normalized.endsWith("credential") ||
    normalized.endsWith("credentialref") ||
    normalized.endsWith("credentials") ||
    normalized.endsWith("password") ||
    normalized.endsWith("privatekey") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("secretref") ||
    normalized.endsWith("token") ||
    normalized.endsWith("tokenref")
  );
}

function assertPublicValue(
  value: unknown,
  depth: number,
  state: { nodes: number; seen: WeakSet<object> },
): void {
  state.nodes += 1;
  if (depth > MAX_DEPTH || state.nodes > MAX_NODES) {
    throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
  }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
    }
    return;
  }
  if (typeof value !== "object") {
    throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
  }
  if (state.seen.has(value)) {
    throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
  }
  state.seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertPublicValue(item, depth + 1, state);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      !key ||
      key.length > MAX_KEY_LENGTH ||
      isAgentProviderSensitiveKey(key)
    ) {
      throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
    }
    assertPublicValue(child, depth + 1, state);
  }
}

export function assertAgentProviderPublicConfig(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
  }
  assertPublicValue(value, 0, { nodes: 0, seen: new WeakSet() });
}

export function normalizeAgentProviderEndpoint(
  value: string | null | undefined,
): string | null {
  const endpoint = value?.trim() ?? "";
  if (!endpoint) return null;
  if (
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(endpoint)
  ) {
    throw new Error("AGENT_PROVIDER_ENDPOINT_INVALID");
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("AGENT_PROVIDER_ENDPOINT_INVALID");
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("AGENT_PROVIDER_ENDPOINT_INVALID");
  }
  return endpoint;
}
