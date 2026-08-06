import { describe, expect, it } from "vitest";

import { buildMcpEnvImportResult } from "../src/mcp-env-import";
import type { McpServerConfig } from "@prompthub/shared/types/mcp";

const server: McpServerConfig = {
  id: "mcp_review",
  name: "review",
  displayName: "Review",
  transport: "stdio",
  command: "npx",
  args: ["review", "<WORKSPACE>"],
  env: { API_KEY: "", OPTIONAL_MODE: "keep" },
  enabled: true,
  source: { type: "manual" },
  createdAt: 1,
  updatedAt: 1,
};

describe("MCP env import", () => {
  it("imports selected values, preserves existing values, and reports missing keys", () => {
    const result = buildMcpEnvImportResult(
      server,
      "API_KEY=secret\nUNRELATED=ignored\n",
      ["API_KEY", "MISSING"],
      2,
    );

    expect(result).toMatchObject({
      server: {
        env: { API_KEY: "secret", OPTIONAL_MODE: "keep" },
        updatedAt: 2,
      },
      importedKeys: ["API_KEY"],
      skippedKeys: ["MISSING"],
      missingKeys: [],
    });
  });

  it("uses inferred requirements when no explicit selection is provided", () => {
    const result = buildMcpEnvImportResult(
      server,
      "OPTIONAL_MODE=fast\n",
      undefined,
      3,
    );

    expect(result.importedKeys).toContain("OPTIONAL_MODE");
    expect(result.missingKeys).toContain("API_KEY");
  });

  it("handles absent env maps and placeholder requirements", () => {
    const absentEnv = buildMcpEnvImportResult(
      { ...server, args: [], env: undefined },
      "",
      ["MISSING"],
    );
    const placeholder = buildMcpEnvImportResult(
      { ...server, env: { API_KEY: "<API_KEY>" } },
      "",
      undefined,
      4,
    );

    expect(absentEnv.server.env).toBeUndefined();
    expect(absentEnv.skippedKeys).toEqual(["MISSING"]);
    expect(placeholder.missingKeys).toEqual(["API_KEY"]);
  });

  it("converts an imported value from a reference to a local literal", () => {
    const result = buildMcpEnvImportResult(
      {
        ...server,
        env: undefined,
        envRefs: { API_KEY: "${API_KEY}" },
      },
      "API_KEY=imported-secret\n",
      undefined,
      5,
    );

    expect(result.importedKeys).toEqual(["API_KEY"]);
    expect(result.server.env).toEqual({ API_KEY: "imported-secret" });
    expect(result.server.envRefs).toBeUndefined();
    expect(result.missingKeys).toEqual([]);
  });
});
