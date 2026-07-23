export type AgentCodexProviderErrorCode =
  | "unsupported-agent"
  | "invalid-provider-id"
  | "reserved-provider-id"
  | "provider-id-conflict"
  | "invalid-name"
  | "invalid-base-url"
  | "invalid-wire-api"
  | "invalid-profile-model"
  | "conflicting-credentials"
  | "provider-not-found"
  | "active-provider"
  | "invalid-config"
  | "config-too-complex"
  | "concurrent-change"
  | "write-failed"
  | "verification-failed"
  | "secret-store-unavailable"
  | "secret-store-invalid";

/**
 * Classified error whose message is a stable, redacted code. The message never
 * contains key material, filesystem paths, or config content so it can cross
 * the IPC boundary for renderer display.
 */
export class AgentCodexProviderError extends Error {
  readonly code: AgentCodexProviderErrorCode;

  constructor(code: AgentCodexProviderErrorCode) {
    super(`agent-codex-provider:${code}`);
    this.name = "AgentCodexProviderError";
    this.code = code;
  }
}
