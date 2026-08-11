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
    expect(() =>
      parsePortableLogicalEnvelope(JSON.stringify(empty)),
    ).toThrow(/no selected scope/i);

    const malformed = JSON.parse(envelope({ agentManagement: {} })) as Record<
      string,
      any
    >;
    malformed.scope.agents = true;
    expect(() =>
      parsePortableLogicalEnvelope(JSON.stringify(malformed)),
    ).toThrow(/AGENT_MANAGEMENT_BACKUP_INVALID/);
  });
});
