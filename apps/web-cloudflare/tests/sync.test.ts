import { describe, expect, it } from "vitest";

import { emptySnapshot, normalizeSnapshot, snapshotCounts } from "../src/sync";

describe("sync snapshot helpers", () => {
  it("creates an empty snapshot with cloudflare backup version", () => {
    const snapshot = emptySnapshot();

    expect(snapshot.version).toBe("web-cloudflare-backup-v1");
    expect(snapshot.prompts).toEqual([]);
    expect(snapshot.promptVersions).toEqual([]);
    expect(snapshot.versions).toEqual([]);
    expect(snapshot.skills).toEqual([]);
  });

  it("normalizes versions and promptVersions symmetrically", () => {
    const version = {
      id: "v1",
      promptId: "p1",
      version: 1,
      systemPrompt: null,
      systemPromptEn: null,
      userPrompt: "hello",
      userPromptEn: null,
      variables: [],
      aiResponse: null,
      note: null,
      createdAt: "2026-05-29T00:00:00.000Z",
    };

    const normalized = normalizeSnapshot({
      exportedAt: "2026-05-29T00:00:00.000Z",
      prompts: [],
      versions: [version],
      folders: [],
      skills: [],
      skillVersions: [],
    });

    expect(normalized.versions).toEqual([version]);
    expect(normalized.promptVersions).toEqual([version]);
  });

  it("preserves current sync snapshot agent asset fields and counts them", () => {
    const normalized = normalizeSnapshot({
      exportedAt: "2026-06-28T00:00:00.000Z",
      prompts: [],
      promptVersions: [],
      folders: [],
      rules: [],
      skills: [],
      skillVersions: [],
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-06-28T00:00:00.000Z",
        bindings: [],
        servers: [
          {
            id: "mcp-1",
            name: "Docs MCP",
            transport: "stdio",
            command: "node",
            enabled: true,
            tags: [],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      pluginLibrary: {
        kind: "prompthub-plugin-library",
        version: 1,
        updatedAt: "2026-06-28T00:00:00.000Z",
        plugins: [
          {
            id: "plugin-1",
            name: "demo-plugin",
            displayName: "Demo Plugin",
            trustLevel: "custom",
            inventory: {
              skills: 0,
              mcpServers: 0,
              apps: 0,
              commands: 0,
              hooks: 0,
              agents: 0,
              assets: 0,
              docs: 0,
              lspServers: 0,
              scripts: 0,
            },
            classification: "bundle",
            source: { kind: "local" },
            installedAt: 1,
            updatedAt: 1,
          },
        ],
      },
      pluginPackages: [
        {
          pluginId: "plugin-1",
          files: [
            {
              relativePath: "plugin.json",
              contentBase64: "e30=",
              size: 2,
            },
          ],
        },
      ],
      storeSources: {
        plugins: {
          selectedSourceId: "custom-source",
          customStoreSources: [
            {
              id: "custom-source",
              name: "Custom",
              type: "marketplace-json",
              url: "https://example.com/plugins.json",
            },
          ],
        },
      },
      agentAssetFiles: {
        plugins: [
          {
            relativePath: "plugin-note.txt",
            contentBase64: "bm90ZQ==",
            size: 4,
          },
        ],
      },
    });

    expect(normalized.mcpLibrary?.servers).toHaveLength(1);
    expect(normalized.pluginLibrary?.plugins).toHaveLength(1);
    expect(normalized.pluginPackages?.[0]?.files[0]?.relativePath).toBe(
      "plugin.json",
    );
    expect(normalized.storeSources?.plugins?.selectedSourceId).toBe(
      "custom-source",
    );
    expect(normalized.agentAssetFiles?.plugins?.[0]?.relativePath).toBe(
      "plugin-note.txt",
    );
    expect(snapshotCounts(normalized)).toMatchObject({
      prompts: 0,
      folders: 0,
      rules: 0,
      skills: 0,
      mcpServers: 1,
      plugins: 1,
    });
  });
});
