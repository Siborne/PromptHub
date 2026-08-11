import { describe, expect, it } from "vitest";

import { parsePortableLogicalEnvelope } from "../src/portable-logical-snapshot";

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: "prompthub-export",
    exportedAt: "2026-08-11T00:00:00.000Z",
    scope: {
      prompts: true,
      folders: true,
      versions: false,
      images: false,
      videos: false,
      aiConfig: false,
      settings: false,
      rules: false,
      skills: false,
      mcp: false,
      plugins: false,
      agents: false,
    },
    payload: {
      version: 1,
      exportedAt: "2026-08-11T00:00:00.000Z",
      prompts: [],
      folders: [],
      versions: [],
      ...overrides,
    },
  });
}

describe("portable logical snapshot", () => {
  it("parses the versioned scope and normalized logical payload", () => {
    const parsed = parsePortableLogicalEnvelope(envelope());
    expect(parsed.kind).toBe("prompthub-export");
    expect(parsed.scope.prompts).toBe(true);
    expect(parsed.payload).toMatchObject({
      version: 1,
      prompts: [],
      folders: [],
      versions: [],
    });
  });

  it("rejects missing scope flags and invalid settings state", () => {
    const missingFlag = JSON.parse(envelope()) as Record<string, any>;
    delete missingFlag.scope.agents;
    expect(() =>
      parsePortableLogicalEnvelope(JSON.stringify(missingFlag)),
    ).toThrow(/scope.*agents/i);
    expect(() =>
      parsePortableLogicalEnvelope(envelope({ settings: { state: [] } })),
    ).toThrow(/settings state/i);
  });

  it("rejects an empty selection and malformed Agent management data", () => {
    const empty = JSON.parse(envelope()) as Record<string, any>;
    for (const key of Object.keys(empty.scope)) empty.scope[key] = false;
    expect(() => parsePortableLogicalEnvelope(JSON.stringify(empty))).toThrow(
      /no selected scope/i,
    );

    const malformed = JSON.parse(envelope({ agentManagement: {} })) as Record<
      string,
      any
    >;
    malformed.scope.agents = true;
    expect(() =>
      parsePortableLogicalEnvelope(JSON.stringify(malformed)),
    ).toThrow(/AGENT_MANAGEMENT_BACKUP_INVALID/);
  });

  it("rejects invalid envelopes, scopes, arrays, and optional records", () => {
    expect(() => parsePortableLogicalEnvelope("null")).toThrow(
      /envelope is invalid/,
    );
    const invalidScope = JSON.parse(envelope()) as Record<string, any>;
    invalidScope.scope = [];
    expect(() =>
      parsePortableLogicalEnvelope(JSON.stringify(invalidScope)),
    ).toThrow(/scope is invalid/);

    expect(() =>
      parsePortableLogicalEnvelope(envelope({ prompts: {} })),
    ).toThrow(/invalid prompts/);
    expect(() =>
      parsePortableLogicalEnvelope(
        envelope({ prompts: new Array(100_001).fill(null) }),
      ),
    ).toThrow(/invalid prompts/);
    expect(() =>
      parsePortableLogicalEnvelope(envelope({ images: [] })),
    ).toThrow(/invalid images/);
  });

  it.each([
    ["agents", "agentManagement", /missing Agent data/],
    ["mcp", "mcpLibrary", /missing MCP data/],
    ["plugins", "pluginLibrary", /missing Plugin data/],
    ["settings", "settings", /missing settings data/],
    ["aiConfig", "aiConfig", /missing AI configuration data/],
  ])(
    "requires %s payload data when its scope is selected",
    (scopeKey, payloadKey, error) => {
      const value = JSON.parse(envelope()) as Record<string, any>;
      value.scope[scopeKey] = true;
      delete value.payload[payloadKey];

      expect(() => parsePortableLogicalEnvelope(JSON.stringify(value))).toThrow(
        error,
      );
    },
  );

  it("normalizes legacy version and timestamp fallbacks while retaining optional metadata", () => {
    const value = JSON.parse(envelope()) as Record<string, any>;
    value.payload.version = "legacy";
    delete value.payload.exportedAt;
    value.payload.settingsUpdatedAt = "2026-08-11T01:00:00.000Z";
    value.payload.settings = { state: { theme: "dark" } };
    value.payload.promptRelations = [];
    value.payload.images = {};

    expect(
      parsePortableLogicalEnvelope(JSON.stringify(value)).payload,
    ).toMatchObject({
      version: 1,
      exportedAt: "2026-08-11T00:00:00.000Z",
      settingsUpdatedAt: "2026-08-11T01:00:00.000Z",
      settings: { state: { theme: "dark" } },
      promptRelations: [],
      images: {},
    });
  });
});
