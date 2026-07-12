import { describe, expect, it } from 'vitest';

import { buildSyncSummary, parseSyncSnapshot } from './sync-snapshot.js';

describe('sync-snapshot agent assets', () => {
  it('preserves prompt relations and output formats in the canonical snapshot', () => {
    const snapshot = parseSyncSnapshot({
      version: 'desktop-backup-v1',
      exportedAt: '2026-07-11T00:00:00.000Z',
      prompts: [],
      folders: [],
      skills: [],
      skillVersions: [],
      promptRelations: [
        {
          id: 'relation-1',
          sourcePromptId: 'prompt-1',
          targetPromptId: 'prompt-2',
          kind: 'next_step',
          note: 'Follow-up',
          createdAt: '2026-07-11T00:00:00.000Z',
          updatedAt: '2026-07-11T00:00:00.000Z',
        },
      ],
      outputFormatItems: [
        {
          id: 'output-1',
          sourcePromptId: 'prompt-1',
          targetPromptId: null,
          sortOrder: 0,
          createdAt: '2026-07-11T00:00:00.000Z',
          updatedAt: '2026-07-11T00:00:00.000Z',
        },
      ],
    });

    expect(snapshot.promptRelations).toHaveLength(1);
    expect(snapshot.outputFormatItems?.[0]?.id).toBe('output-1');
  });

  it('preserves portable Skill source metadata across desktop sync payloads', () => {
    const snapshot = parseSyncSnapshot({
      version: 'desktop-backup-v1',
      exportedAt: '2026-07-11T00:00:00.000Z',
      prompts: [],
      folders: [],
      skills: [
        {
          id: 'skill-remote',
          name: 'remote-review',
          protocol_type: 'skill',
          is_favorite: false,
          created_at: 1,
          updated_at: 2,
          source_id: 'registry:remote-review',
          source_label: 'Official Skills',
          source_url: 'https://example.com/skills/remote-review',
          source_branch: 'main',
          source_directory: 'skills/remote-review',
          canonical_skill_path: 'skills/remote-review/SKILL.md',
          directory_fingerprint: 'package-fingerprint',
          installed_directory_fingerprint: 'package-fingerprint',
          fingerprint_algorithm: 'skill-package-sha256-v1',
          source_binding_state: 'bound',
          content_url: 'https://example.com/skills/remote-review/SKILL.md',
          installed_content_hash: 'content-hash',
          installed_version: '1.2.3',
          installed_at: 1,
          updated_from_store_at: 2,
        },
      ],
      skillVersions: [],
    });

    expect(snapshot.skills[0]).toMatchObject({
      source_id: 'registry:remote-review',
      source_label: 'Official Skills',
      source_branch: 'main',
      source_directory: 'skills/remote-review',
      canonical_skill_path: 'skills/remote-review/SKILL.md',
      directory_fingerprint: 'package-fingerprint',
      installed_directory_fingerprint: 'package-fingerprint',
      fingerprint_algorithm: 'skill-package-sha256-v1',
      source_binding_state: 'bound',
    });
  });

  it('preserves current My MCP, My Plugins, plugin packages, and store sources', () => {
    const snapshot = parseSyncSnapshot({
      version: 'web-backup-v2',
      exportedAt: '2026-06-21T00:00:00.000Z',
      prompts: [],
      folders: [],
      skills: [],
      skillVersions: [],
      mcpLibrary: {
        kind: 'prompthub-mcp-library',
        version: 1,
        updatedAt: '2026-06-21T00:00:00.000Z',
        servers: [{ id: 'mcp-1', name: 'Local MCP' }],
        bindings: [],
      },
      pluginLibrary: {
        kind: 'prompthub-plugin-library',
        version: 1,
        updatedAt: '2026-06-21T00:00:00.000Z',
        plugins: [{ id: 'plugin-1', name: 'writer-kit' }],
      },
      pluginPackages: [
        {
          pluginId: 'plugin-1',
          files: [
            {
              relativePath: 'skill.json',
              contentBase64: 'e30=',
              size: 2,
            },
            {
              relativePath: 'versions/manifest.json',
              contentBase64: 'e30=',
              size: 2,
            },
          ],
        },
      ],
      agentAssetFiles: {
        mcp: [
          {
            relativePath: 'library.json',
            contentBase64: 'e30=',
            size: 2,
          },
        ],
        plugins: [
          {
            relativePath: 'writer-kit/package/skill.json',
            contentBase64: 'e30=',
            size: 2,
          },
        ],
      },
      storeSources: {
        skills: {
          customStoreSources: [
            {
              id: 'skill-source-1',
              name: 'Skill Store',
              type: 'git-repo',
              url: 'https://github.com/example/skills',
            },
          ],
          selectedSourceId: 'skill-source-1',
        },
        mcp: {
          customStoreSources: [
            {
              id: 'mcp-source-1',
              name: 'MCP Store',
              type: 'marketplace-json',
              url: 'https://example.com/mcp.json',
            },
          ],
          selectedSourceId: 'mcp-source-1',
        },
        plugins: {
          customStoreSources: [
            {
              id: 'plugin-source-1',
              name: 'Plugin Store',
              type: 'local-dir',
              url: '/Users/test/plugins',
            },
          ],
          selectedSourceId: 'plugin-source-1',
        },
      },
    });

    expect(snapshot.mcpLibrary?.servers).toHaveLength(1);
    expect(snapshot.pluginLibrary?.plugins).toHaveLength(1);
    expect(
      snapshot.pluginPackages?.[0]?.files.map((file) => file.relativePath),
    ).toEqual(['skill.json', 'versions/manifest.json']);
    expect(snapshot.agentAssetFiles?.plugins?.[0]?.relativePath).toBe(
      'writer-kit/package/skill.json',
    );
    expect(snapshot.storeSources?.plugins?.selectedSourceId).toBe(
      'plugin-source-1',
    );
    expect(buildSyncSummary(snapshot)).toMatchObject({
      mcpServers: 1,
      plugins: 1,
    });
  });

  it('still rejects reserved skill snapshot paths', () => {
    expect(() =>
      parseSyncSnapshot({
        version: 'web-backup-v2',
        exportedAt: '2026-06-21T00:00:00.000Z',
        prompts: [],
        folders: [],
        skills: [],
        skillVersions: [],
        skillFiles: {
          'skill-1': [
            {
              relativePath: 'skill.json',
              content: '{}',
            },
          ],
        },
      }),
    ).toThrow(/skillFiles\.skill-1\.0\.relativePath/);
  });
});
