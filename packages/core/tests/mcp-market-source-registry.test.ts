/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  authorizeMcpMarketFetch,
  getMcpMarketSourceRegistryFilePath,
  readRegisteredMcpMarketSources,
  replaceCustomMcpMarketSources,
  sanitizeMcpMarketSourceUrl,
} from "@prompthub/core/mcp-market-source-registry";
import { configureRuntimePaths, resetRuntimePaths } from "@prompthub/core";

describe("MCP market source registry", () => {
  let userDataPath: string;

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "mcp-market-source-registry-"),
    );
    configureRuntimePaths({ userDataPath });
  });

  afterEach(() => {
    resetRuntimePaths();
    fs.rmSync(userDataPath, { recursive: true, force: true });
  });

  it("persists custom sources without allowing them to replace built-in identities", () => {
    expect(readRegisteredMcpMarketSources()).toHaveLength(2);
    const sources = replaceCustomMcpMarketSources([
      {
        id: "lan-catalog",
        label: "LAN Catalog",
        url: "http://192.168.1.20/mcp/catalog.json",
        description: "Team MCP services",
        trustLevel: "community",
      },
      {
        id: "prompthub-official",
        label: "Forged Official",
        url: "http://127.0.0.1/forged.json",
        trustLevel: "community",
      },
    ]);

    expect(sources.map((source) => source.id)).toEqual([
      "prompthub-official",
      "modelcontextprotocol",
      "lan-catalog",
    ]);
    expect(
      sources.find((source) => source.id === "prompthub-official"),
    ).toMatchObject({ url: "https://github.com/legeling/PromptHub" });
    expect(fs.existsSync(getMcpMarketSourceRegistryFilePath())).toBe(true);
    expect(readRegisteredMcpMarketSources()).toEqual(sources);
  });

  it("authorizes only registered source origin and path boundaries", () => {
    replaceCustomMcpMarketSources([
      {
        id: "lan-catalog",
        label: "LAN Catalog",
        url: "http://192.168.1.20/mcp/catalog.json?token=secret",
        trustLevel: "community",
      },
    ]);

    expect(
      authorizeMcpMarketFetch(
        "lan-catalog",
        "http://192.168.1.20/mcp/catalog.json?q=github",
      ),
    ).toEqual(
      expect.objectContaining({
        allowPrivateNetwork: true,
        allowInsecurePrivateNetworkHttp: true,
      }),
    );
    expect(() =>
      authorizeMcpMarketFetch(
        "lan-catalog",
        "http://192.168.1.20/admin/config",
      ),
    ).toThrow(/path/i);
    expect(() =>
      authorizeMcpMarketFetch(
        "lan-catalog",
        "http://192.168.1.21/mcp/catalog.json",
      ),
    ).toThrow(/origin/i);
    expect(() =>
      authorizeMcpMarketFetch(
        "missing-source",
        "http://192.168.1.20/mcp/catalog.json",
      ),
    ).toThrow(/registered/i);
  });

  it("sanitizes credentials, query values, and fragments from source display", () => {
    expect(
      sanitizeMcpMarketSourceUrl(
        "https://alice:secret@gitea.internal/mcp/catalog.json?token=hidden#main",
      ),
    ).toBe("https://gitea.internal/mcp/catalog.json");
    expect(sanitizeMcpMarketSourceUrl("not a url")).toBe(
      "invalid MCP market source URL",
    );
  });

  it("allows registered directory paths but keeps built-in network policy strict", () => {
    replaceCustomMcpMarketSources([
      {
        id: "team-directory",
        label: "Team Directory",
        url: "http://mcp.internal/catalog/",
        trustLevel: "community",
      },
    ]);

    expect(
      authorizeMcpMarketFetch(
        "team-directory",
        "http://mcp.internal/catalog/page-2.json",
      ),
    ).toMatchObject({ allowPrivateNetwork: true });
    expect(() =>
      authorizeMcpMarketFetch(
        "team-directory",
        "http://mcp.internal/catalog-admin/secrets.json",
      ),
    ).toThrow(/path/i);
    expect(
      authorizeMcpMarketFetch(
        "modelcontextprotocol",
        "https://registry.modelcontextprotocol.io/v0/servers",
      ),
    ).toMatchObject({
      allowPrivateNetwork: false,
      allowInsecurePrivateNetworkHttp: false,
    });
    expect(() =>
      authorizeMcpMarketFetch(
        "team-directory",
        "ftp://mcp.internal/catalog/page-2.json",
      ),
    ).toThrow(/HTTP\(S\)/i);
  });

  it("rejects invalid source identities, protocols, and oversized URLs", () => {
    expect(() =>
      replaceCustomMcpMarketSources([
        {
          id: "invalid id",
          label: "Invalid",
          url: "https://example.com/catalog.json",
          trustLevel: "community",
        },
      ]),
    ).toThrow(/identity/i);
    expect(() =>
      replaceCustomMcpMarketSources([
        {
          id: "invalid-protocol",
          label: "Invalid",
          url: "file:///tmp/catalog.json",
          trustLevel: "community",
        },
      ]),
    ).toThrow(/HTTP\(S\)/i);
    expect(() =>
      replaceCustomMcpMarketSources([
        {
          id: "too-long",
          label: "Too long",
          url: `https://example.com/${"a".repeat(2050)}`,
          trustLevel: "community",
        },
      ]),
    ).toThrow(/too long/i);
  });

  it("ignores registry files without a source array", () => {
    const filePath = getMcpMarketSourceRegistryFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, sources: {} }));

    expect(readRegisteredMcpMarketSources()).toHaveLength(2);
  });
});
