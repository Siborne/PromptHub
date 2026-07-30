import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAgentProviderPublicConfig,
  normalizeAgentProviderEndpoint,
} from "@prompthub/shared/utils/agent-provider-config";

describe("Agent Provider Profile public configuration", () => {
  it("accepts bounded JSON values and null-prototype records", () => {
    const nested = Object.assign(
      Object.create(null) as Record<string, unknown>,
      {
        enabled: true,
        retries: 3,
        endpointLabel: "Work",
        optional: null,
        routes: ["primary", { kind: "fast" }],
        credentialStatus: "configured",
        secretRequired: true,
      },
    );

    assert.doesNotThrow(() => assertAgentProviderPublicConfig(nested));
  });

  it("rejects invalid roots, prototypes, cycles, and non-JSON values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const value of [
      null,
      [],
      new Date(),
      { value: undefined },
      { value: () => undefined },
      { value: 1n },
      { value: Number.NaN },
      { value: Number.POSITIVE_INFINITY },
      cyclic,
    ]) {
      assert.throws(
        () => assertAgentProviderPublicConfig(value),
        /AGENT_PROVIDER_PUBLIC_CONFIG_INVALID/,
      );
    }
  });

  it("rejects oversized structures, strings, keys, and sensitive keys", () => {
    let deep: Record<string, unknown> = { value: true };
    for (let index = 0; index < 18; index += 1) deep = { nested: deep };
    const invalid = [
      { "": true },
      { ["x".repeat(257)]: true },
      { value: "x".repeat(100_001) },
      { values: Array.from({ length: 10_001 }, () => true) },
      deep,
      { Authorization: "Bearer value" },
      { Cookie: "value" },
      { "Set-Cookie": "value" },
      { Password: "value" },
      { credential: "value" },
      { credentials: "value" },
      { token: "value" },
      { customApiKey: "value" },
      { authToken: "value" },
      { apiToken: "value" },
      { access_token: "value" },
      { refreshToken: "value" },
      { sessionToken: "value" },
      { bearerToken: "value" },
      { clientSecret: "value" },
      { privateKey: "value" },
      { authorizationHeader: "Bearer value" },
      { secretRef: "provider:secret" },
    ];

    for (const value of invalid) {
      assert.throws(
        () => assertAgentProviderPublicConfig(value),
        /AGENT_PROVIDER_PUBLIC_CONFIG_INVALID/,
      );
    }
  });

  it("accepts public HTTP endpoints without persisting URL credentials", () => {
    assert.equal(
      normalizeAgentProviderEndpoint("  https://api.example.com/v1  "),
      "https://api.example.com/v1",
    );
    assert.equal(
      normalizeAgentProviderEndpoint("http://127.0.0.1:11434/v1"),
      "http://127.0.0.1:11434/v1",
    );
    assert.equal(normalizeAgentProviderEndpoint("   "), null);
    assert.equal(normalizeAgentProviderEndpoint(null), null);

    for (const endpoint of [
      "https://user:token@example.com/v1",
      "https://token@example.com/v1",
      "not a URL",
      "file:///tmp/provider.sock",
      "data:text/plain,secret",
      "https://api.example.com/v1#credential",
      `https://api.example.com/${"x".repeat(2049)}`,
      "\0https://api.example.com/v1",
    ]) {
      assert.throws(
        () => normalizeAgentProviderEndpoint(endpoint),
        /AGENT_PROVIDER_ENDPOINT_INVALID/,
      );
    }
  });
});
