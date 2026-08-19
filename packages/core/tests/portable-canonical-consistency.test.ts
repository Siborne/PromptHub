import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  AgentProviderProfile,
  McpServerConfig,
  PluginLibraryEntry,
  RuleFileContent,
  Skill,
} from "@prompthub/shared";

import {
  assertPortableLogicalMatchesCanonicalStorage,
  materializeCanonicalStorageShadow,
} from "../src";

interface LogicalEnvelopeOverrides {
  skills?: unknown[];
  skillVersions?: unknown[];
  rules?: unknown[];
  mcpServers?: unknown[];
  plugins?: unknown[];
  providerProfiles?: unknown[];
}

function logicalEnvelope(overrides: LogicalEnvelopeOverrides = {}): string {
  return JSON.stringify({
    kind: "prompthub-export",
    exportedAt: "2026-08-11T00:00:00.000Z",
    scope: {
      prompts: true,
      folders: true,
      versions: true,
      images: true,
      videos: true,
      aiConfig: true,
      settings: true,
      rules: true,
      skills: true,
      mcp: true,
      plugins: true,
      agents: true,
    },
    payload: {
      version: 1,
      exportedAt: "2026-08-11T00:00:00.000Z",
      prompts: [],
      folders: [],
      versions: [],
      promptRelations: [],
      outputFormatItems: [],
      skills: overrides.skills ?? [],
      skillVersions: overrides.skillVersions ?? [],
      rules: overrides.rules ?? [],
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-11T00:00:00.000Z",
        servers: overrides.mcpServers ?? [],
        bindings: [],
      },
      pluginLibrary: {
        kind: "prompthub-plugin-library",
        version: 1,
        updatedAt: "2026-08-11T00:00:00.000Z",
        plugins: overrides.plugins ?? [],
      },
      agentManagement: {
        version: 1,
        providerProfiles: overrides.providerProfiles ?? [],
        snapshots: [],
      },
      aiConfig: {},
      settings: { state: {} },
    },
  });
}

describe("portable canonical consistency", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts matching complete empty durable inventories", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-match-"),
    );
    roots.push(root);
    const canonicalPath = path.join(root, "canonical");
    materializeCanonicalStorageShadow({
      targetPath: canonicalPath,
      prompts: {
        prompts: [],
        promptVersions: [],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-11T00:00:00.000Z",
        servers: [],
        bindings: [],
      },
    });

    expect(() =>
      assertPortableLogicalMatchesCanonicalStorage(
        logicalEnvelope(),
        canonicalPath,
      ),
    ).not.toThrow();
  });

  it("rejects a partial durable scope before reading canonical storage", () => {
    const value = JSON.parse(logicalEnvelope()) as Record<string, any>;
    value.scope.images = false;

    expect(() =>
      assertPortableLogicalMatchesCanonicalStorage(
        JSON.stringify(value),
        "/path/that-must-not-be-read",
      ),
    ).toThrow("requires a complete portable logical scope");
  });

  it("treats omitted optional empty collections as an empty durable inventory", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-optional-empty-"),
    );
    roots.push(root);
    const canonicalPath = path.join(root, "canonical");
    materializeCanonicalStorageShadow({
      targetPath: canonicalPath,
      prompts: {
        prompts: [],
        promptVersions: [],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-11T00:00:00.000Z",
        servers: [],
        bindings: [],
      },
    });
    const value = JSON.parse(logicalEnvelope()) as Record<string, any>;
    delete value.payload.promptRelations;
    delete value.payload.outputFormatItems;
    delete value.payload.skills;
    delete value.payload.skillVersions;
    delete value.payload.rules;
    delete value.payload.pluginLibrary.plugins;

    expect(() =>
      assertPortableLogicalMatchesCanonicalStorage(
        JSON.stringify(value),
        canonicalPath,
      ),
    ).not.toThrow();
  });

  it("rejects a renderer envelope captured from a different durable revision", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-stale-"),
    );
    roots.push(root);
    const canonicalPath = path.join(root, "canonical");
    materializeCanonicalStorageShadow({
      targetPath: canonicalPath,
      prompts: {
        prompts: [],
        promptVersions: [],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
    });

    expect(() =>
      assertPortableLogicalMatchesCanonicalStorage(
        logicalEnvelope({
          mcpServers: [
            {
              id: "server-1",
              name: "server-1",
              displayName: "Server",
              transport: "stdio",
              command: "server",
              enabled: true,
              source: { type: "manual" },
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        }),
        canonicalPath,
      ),
    ).toThrow("does not match canonical MCP servers");
  });

  it("matches normalized resource domains while excluding device-bound paths and secrets", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-resources-"),
    );
    roots.push(root);
    const canonicalPath = path.join(root, "canonical");
    const skill: Skill = {
      id: "skill-1",
      name: "writer",
      content: "# Writer\n",
      instructions: "# Writer\n",
      protocol_type: "skill",
      tags: [],
      is_favorite: false,
      currentVersion: 1,
      versionTrackingEnabled: true,
      local_repo_path: "/device-a/skills/writer",
      source_url: "https://example.com/writer.git",
      content_url: "not a URL",
      icon_url: "https://user:password@example.com/icon.png",
      created_at: 1,
      updated_at: 2,
    };
    const skillVersion = {
      id: "skill-version-1",
      skillId: "skill-1",
      version: 1,
      content: "# Writer\n",
      createdAt: "2026-08-11T00:00:00.000Z",
    };
    const rule: RuleFileContent = {
      id: "codex-global",
      platformId: "codex",
      platformName: "Codex",
      platformIcon: "terminal",
      platformDescription: "Codex rules",
      name: "AGENTS.md",
      description: "Global rules",
      path: "/device-a/.codex/AGENTS.md",
      exists: true,
      group: "assistant",
      content: "Current\n",
      versions: [
        {
          id: "rule-v1",
          savedAt: "2026-08-11T00:00:00.000Z",
          content: "Initial\n",
          source: "create",
        },
        {
          id: "rule-v2",
          savedAt: "2026-08-11T01:00:00.000Z",
          content: "Current\n",
          source: "manual-save",
        },
      ],
    };
    const projectRule: RuleFileContent = {
      id: "project:prompthub",
      platformId: "workspace",
      platformName: "Project",
      platformIcon: "folder",
      platformDescription: "Project rules",
      name: "AGENTS.md",
      description: "PromptHub project rules",
      path: "/projects/prompthub/AGENTS.md",
      projectRootPath: "/projects/prompthub",
      exists: true,
      group: "workspace",
      content: "Project rules\n",
      versions: [
        {
          id: "project-rule-v1",
          savedAt: "2026-08-11T00:00:00.000Z",
          content: "Project rules\n",
          source: "create",
        },
      ],
    };
    const mcpServer: McpServerConfig = {
      id: "mcp-1",
      name: "local-mcp",
      displayName: "Local MCP",
      transport: "stdio",
      command: "npx",
      args: ["local-mcp"],
      env: { TOKEN: "device-secret" },
      headers: { Authorization: "Bearer device-secret" },
      enabled: true,
      source: { type: "manual" },
      createdAt: 1,
      updatedAt: 2,
    };
    const plugin: PluginLibraryEntry = {
      id: "custom:plugin-1",
      name: "plugin",
      displayName: "Plugin",
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
      source: {
        kind: "local",
        localPackagePath: "/device-a/plugins/plugin",
        repository: "ftp://example.com/plugin.git",
        rawJsonUrl: "not a URL",
        url: "https://user:password@example.com/plugin",
      },
      localPackagePath: "/device-a/plugins/plugin",
      author: { name: "Maintainer", url: "ftp://example.com/author" },
      installedAt: 1,
      updatedAt: 2,
    };
    const profile: AgentProviderProfile = {
      id: "profile-1",
      platformId: "codex",
      name: "OpenAI",
      providerKind: "openai",
      protocol: "openai-responses",
      endpoint: null,
      config: { reasoning: "high" },
      secretRef: "agent-provider:profile-1",
      source: "manual",
      archived: false,
      createdAt: 1,
      updatedAt: 2,
    };
    materializeCanonicalStorageShadow({
      targetPath: canonicalPath,
      prompts: {
        prompts: [],
        promptVersions: [],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
      skills: [{ skill, versions: [skillVersion], packageFiles: [] }],
      rules: [rule, projectRule],
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-11T00:00:00.000Z",
        servers: [mcpServer],
        bindings: [],
      },
      deviceId: "device-a",
      plugins: [{ plugin, versions: [], packageFiles: [] }],
      agentProviders: [
        {
          profile,
          modelMappings: [
            {
              id: "mapping-2",
              providerProfileId: "profile-1",
              routeKey: "secondary",
              modelId: "gpt-4.1",
              parameters: { reasoning: "high" },
            },
            {
              id: "mapping-1",
              providerProfileId: "profile-1",
              routeKey: "primary",
              modelId: "gpt-5",
              parameters: { reasoning: "high" },
            },
          ],
        },
      ],
    });

    const matchingLogical = logicalEnvelope({
      skills: [{ ...skill, local_repo_path: "/device-b/skills/writer" }],
      skillVersions: [skillVersion],
      rules: [
        {
          ...rule,
          path: "/device-b/.codex/AGENTS.md",
          versions: [...rule.versions].reverse(),
        },
        projectRule,
      ],
      mcpServers: [
        {
          ...mcpServer,
          env: { TOKEN: "[REDACTED]" },
          headers: { Authorization: "[REDACTED]" },
        },
      ],
      plugins: [
        {
          ...plugin,
          localPackagePath: "/device-b/plugins/plugin",
          source: {
            ...plugin.source,
            localPackagePath: "/device-b/plugins/plugin",
          },
        },
      ],
      providerProfiles: [
        {
          id: "profile-1",
          profile: {
            platformId: "codex",
            name: "OpenAI",
            providerKind: "openai",
            protocol: "openai-responses",
            endpoint: null,
            config: { reasoning: "high" },
            source: "manual",
          },
          modelMappings: [
            {
              routeKey: "secondary",
              modelId: "gpt-4.1",
              parameters: { reasoning: "high" },
            },
            {
              routeKey: "primary",
              modelId: "gpt-5",
              parameters: { reasoning: "high" },
            },
          ],
          requiresSecret: true,
          archived: false,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    });

    expect(() =>
      assertPortableLogicalMatchesCanonicalStorage(
        matchingLogical,
        canonicalPath,
      ),
    ).not.toThrow();

    const mismatchedProjectPlacement = JSON.parse(matchingLogical) as Record<
      string,
      any
    >;
    mismatchedProjectPlacement.payload.rules[1].path =
      "/projects/other/AGENTS.md";
    expect(() =>
      assertPortableLogicalMatchesCanonicalStorage(
        JSON.stringify(mismatchedProjectPlacement),
        canonicalPath,
      ),
    ).toThrow("does not match canonical Rules");
  });
});
