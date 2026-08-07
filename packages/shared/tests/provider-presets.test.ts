import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AGENT_PROVIDER_PRESETS,
  getAgentProviderPresets,
} from "@prompthub/shared/constants/provider-presets";
import { assertAgentProviderPreset } from "@prompthub/shared/utils/provider-preset";
import type { AgentProviderPreset } from "@prompthub/shared/types/provider-preset";

function validPreset(
  overrides: Partial<AgentProviderPreset> = {},
): AgentProviderPreset {
  return {
    platformId: "codex",
    name: "Test Provider",
    websiteUrl: "https://example.com",
    providerKind: "openai-compatible",
    protocol: "openai-chat",
    endpoint: "https://api.example.com/v1",
    config: { providerId: "test" },
    modelMappings: [{ routeKey: "primary", modelId: "test-model" }],
    credential: { source: "managed" },
    category: "third-party",
    ...overrides,
  };
}

describe("AgentProviderPreset catalog", () => {
  it("exposes the versioned static catalog with Codex official + additive presets", () => {
    const codex = getAgentProviderPresets("codex");
    assert.ok(codex.length >= 3, "expected at least three Codex presets");
    assert.ok(
      codex.some((preset) => preset.name === "OpenAI Official"),
      "expected the OpenAI Official baseline preset",
    );
    assert.ok(
      codex.some((preset) => preset.protocol === "openai-responses"),
      "expected a native-Responses additive preset",
    );
    assert.deepEqual(getAgentProviderPresets("claude"), []);
  });

  it("validates every shipped preset at module load", () => {
    assert.ok(AGENT_PROVIDER_PRESETS.length > 0);
    for (const preset of AGENT_PROVIDER_PRESETS) {
      assert.doesNotThrow(() => assertAgentProviderPreset(preset));
    }
  });

  it("rejects presets carrying sensitive keys in config or parameters", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ config: { providerId: "x", apiToken: "secret" } }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({
            modelMappings: [
              {
                routeKey: "primary",
                modelId: "m",
                parameters: { authHeader: "Bearer x" },
              },
            ],
          }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects unknown protocols and non-http(s) endpoints", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ protocol: "unknown" as never }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(validPreset({ endpoint: "file:///tmp/key" })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ endpoint: "https://user:pass@example.com/v1" }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects missing or invalid environment credential references", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ credential: { source: "environment" } }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({
            credential: { source: "environment", envKey: "1BAD KEY" },
          }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects unbounded model mappings and unknown route keys", () => {
    const mappings = Array.from({ length: 17 }, (_, index) => ({
      routeKey: "primary" as const,
      modelId: `m${index}`,
    }));
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ modelMappings: mappings })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({
            modelMappings: [{ routeKey: "tertiary", modelId: "m" }],
          }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects missing model mappings and empty names", () => {
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ modelMappings: [] })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ name: "  " })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects bad website/apiKey URLs and unknown apiKeyField values", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ websiteUrl: "ftp://example.com" }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({
            credential: { source: "managed", apiKeyField: "MY_KEY" as never },
          }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("accepts platform-native official presets without endpoints or keys", () => {
    assert.doesNotThrow(() =>
      assertAgentProviderPreset(
        validPreset({
          protocol: "platform-native",
          endpoint: null,
          config: { providerId: "openai" },
          credential: { source: "managed" },
          requiresOAuth: true,
        }),
      ),
    );
  });

  it("rejects malformed website and apiKey URLs", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ websiteUrl: "https://?x=1" }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(validPreset({ apiKeyUrl: 123 as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(validPreset({ apiKeyUrl: "javascript:alert(1)" })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects non-object mappings and invalid mapping parameters", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ modelMappings: ["primary" as never] }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.doesNotThrow(() =>
      assertAgentProviderPreset(
        validPreset({
          modelMappings: [
            { routeKey: "primary", modelId: "m", parameters: { topP: 0.8 } },
          ],
        }),
      ),
    );
  });

  it("rejects wrong-typed platformId, nameKey, providerKind, protocol", () => {
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ platformId: "" })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ nameKey: 7 as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(validPreset({ providerKind: "   " })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ protocol: 3 as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });

  it("rejects malformed credential shapes and category/icon/theme values", () => {
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ credential: "key" as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ credential: { source: "file" as never } }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ credential: { source: "managed", envKey: 7 as never } }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ credential: { source: "managed", apiKeyField: 7 as never } }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ category: "evil" as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ icon: "" })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () => assertAgentProviderPreset(validPreset({ iconColor: 7 as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ theme: { backgroundColor: "#fff" } as never }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.doesNotThrow(() =>
      assertAgentProviderPreset(
        validPreset({
          theme: { backgroundColor: "#0F172A", textColor: "#FFFFFF" },
        }),
      ),
    );
  });

  it("rejects unbounded or malformed endpoint candidates and requiresOAuth", () => {
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({
            endpointCandidates: Array.from(
              { length: 9 },
              (_, index) => `https://api${index}.example.com`,
            ),
          }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ endpointCandidates: [7 as never] }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(
          validPreset({ endpointCandidates: ["https://ok.example.com", "file:///x"] }),
        ),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
    assert.throws(
      () =>
        assertAgentProviderPreset(validPreset({ requiresOAuth: "yes" as never })),
      /AGENT_PROVIDER_PRESET_INVALID/,
    );
  });
});
