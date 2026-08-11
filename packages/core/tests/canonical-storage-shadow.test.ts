import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AgentProviderProfileDB,
  CanonicalResourceDB,
  DatabaseAdapter,
  CURRENT_DATABASE_SCHEMA_VERSION,
  CURRENT_LEGACY_SCHEMA_MIGRATION_NAMES,
  recordCurrentDatabaseMigration,
  recordCurrentLegacySchemaMigrations,
  RuleDB,
  SCHEMA_INDEXES,
  SCHEMA_TABLES,
  SkillDB,
} from "@prompthub/db";
import type { GenerationBatchManifest, Skill } from "@prompthub/shared/types";
import type { RuleFileContent } from "@prompthub/shared/types/rules";
import { afterEach, describe, expect, it } from "vitest";

import {
  materializeCanonicalStorageShadow,
  readCanonicalStorageShadow,
  stageCanonicalStorageDatabase,
} from "../src/canonical-storage-shadow";
import { materializeSkillResourceBundle } from "../src/skill-resource-schema";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-storage-shadow-"),
  );
  roots.push(value);
  return value;
}

function skill(): Skill {
  return {
    id: "skill-1",
    name: "writer",
    content: "# Writer\n",
    instructions: "# Writer\n",
    protocol_type: "skill",
    tags: [],
    is_favorite: false,
    currentVersion: 1,
    versionTrackingEnabled: true,
    created_at: Date.parse("2026-08-11T00:00:00.000Z"),
    updated_at: Date.parse("2026-08-11T01:00:00.000Z"),
  };
}

function rule(): RuleFileContent {
  return {
    id: "codex-global",
    platformId: "codex",
    platformName: "Codex",
    platformIcon: "terminal",
    platformDescription: "Codex rules",
    name: "AGENTS.md",
    description: "Global rules",
    path: "/Users/example/.codex/AGENTS.md",
    exists: true,
    group: "assistant",
    content: "# Rules\n",
    versions: [
      {
        id: "rule-version-1",
        savedAt: "2026-08-11T00:00:00.000Z",
        content: "# Rules\n",
        source: "create",
      },
    ],
  };
}

function generation(bytes: Buffer): GenerationBatchManifest {
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return {
    kind: "prompthub-generation-batch",
    version: 1,
    id: "batch-1",
    title: "Image",
    status: "succeeded",
    resolvedPrompt: "An image",
    model: { id: "model-1", provider: "openai", model: "gpt-image-2" },
    parameters: {},
    targetCount: 1,
    slots: [
      {
        index: 0,
        status: "succeeded",
        output: {
          id: "output-1",
          slotIndex: 0,
          fileName: "output.png",
          mimeType: "image/png",
          byteSize: bytes.length,
          sha256,
          favorite: false,
          createdAt: "2026-08-11T00:00:00.000Z",
        },
      },
    ],
    counts: {
      total: 1,
      pending: 0,
      running: 0,
      succeeded: 1,
      failed: 0,
      cancelled: 0,
      interrupted: 0,
    },
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:01:00.000Z",
    completedAt: "2026-08-11T00:01:00.000Z",
  };
}

afterEach(() => {
  for (const value of roots.splice(0))
    fs.rmSync(value, { recursive: true, force: true });
});

describe("complete canonical storage shadow", () => {
  it("publishes every local durable domain and rebuilds a verified SQLite catalog", () => {
    const base = root();
    const skillFile = path.join(base, "SKILL.md");
    const pluginFile = path.join(base, "plugin.json");
    const outputFile = path.join(base, "output.png");
    const outputBytes = Buffer.from("png-like-bytes");
    fs.writeFileSync(skillFile, "# Writer\n");
    fs.writeFileSync(pluginFile, "{}\n");
    fs.writeFileSync(outputFile, outputBytes);
    const targetPath = path.join(base, "data-shadow");

    const materialized = materializeCanonicalStorageShadow({
      targetPath,
      createdAt: "2026-08-11T02:00:00.000Z",
      prompts: {
        prompts: [],
        promptVersions: [],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
      skills: [
        {
          skill: skill(),
          versions: [
            {
              id: "skill-version-1",
              skillId: "skill-1",
              version: 1,
              content: "# Writer\n",
              createdAt: "2026-08-11T00:00:00.000Z",
            },
          ],
          packageFiles: [{ path: "SKILL.md", sourcePath: skillFile }],
        },
      ],
      rules: [rule()],
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-11T01:00:00.000Z",
        servers: [
          {
            id: "mcp-1",
            name: "local-mcp",
            displayName: "Local MCP",
            transport: "stdio",
            command: "npx",
            args: ["local-mcp"],
            env: { TOKEN: "secret-value" },
            enabled: true,
            source: { type: "manual" },
            createdAt: Date.parse("2026-08-11T00:00:00.000Z"),
            updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
          },
        ],
        bindings: [
          {
            id: "binding-1",
            serverIds: ["mcp-1"],
            target: "codex",
            scope: "global",
            path: "/Users/example/.codex/config.toml",
            enabled: true,
            createdAt: Date.parse("2026-08-11T00:00:00.000Z"),
            updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
          },
        ],
      },
      deviceId: "device-1",
      plugins: [
        {
          plugin: {
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
            source: { kind: "local" },
            installedAt: Date.parse("2026-08-11T00:00:00.000Z"),
            updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
          },
          versions: [],
          packageFiles: [{ path: "plugin.json", sourcePath: pluginFile }],
        },
      ],
      agentProviders: [
        {
          profile: {
            id: "profile-1",
            platformId: "codex",
            name: "OpenAI",
            providerKind: "openai",
            protocol: "openai-responses",
            endpoint: "https://api.openai.com/v1",
            config: {},
            secretRef: "agent-provider:profile-1",
            source: "manual",
            archived: false,
            createdAt: Date.parse("2026-08-11T00:00:00.000Z"),
            updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
          },
          modelMappings: [
            {
              id: "mapping-1",
              providerProfileId: "profile-1",
              routeKey: "primary",
              modelId: "gpt-5",
              parameters: {},
            },
          ],
        },
      ],
      generations: [
        {
          manifest: generation(outputBytes),
          outputSources: { "output.png": outputFile },
        },
      ],
    });

    expect(materialized.domainCounts).toEqual({
      skills: 1,
      rules: 1,
      "mcp-servers": 1,
      plugins: 1,
      "agent-providers": 1,
      generations: 1,
    });
    expect(materialized.extractedMcpSecrets).toHaveLength(1);
    expect(materialized.mcpBindingConfig?.bindings).toHaveLength(1);
    const restored = readCanonicalStorageShadow(targetPath);
    expect(restored.skills[0].skill.id).toBe("skill-1");
    expect(restored.rules[0].rule.id).toBe("codex-global");
    expect(restored.mcpServers[0].server.env).toBeUndefined();
    expect(restored.plugins[0].plugin.id).toBe("custom:plugin-1");
    expect(
      fs.existsSync(path.join(targetPath, "plugins", "custom%3Aplugin-1")),
    ).toBe(true);
    expect(restored.agentProviders[0].profile.id).toBe("profile-1");
    expect(restored.generations[0].manifest.id).toBe("batch-1");
    fs.writeFileSync(path.join(targetPath, "prompthub.db"), "catalog");
    fs.writeFileSync(path.join(targetPath, ".layout-state.json"), "{}\n");
    fs.writeFileSync(path.join(targetPath, ".authority-state.json"), "{}\n");
    fs.mkdirSync(path.join(targetPath, "operations", "migrations"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(targetPath, "operations", "migrations", "done.json"),
      "{}\n",
    );
    expect(readCanonicalStorageShadow(targetPath).domainCounts).toEqual(
      materialized.domainCounts,
    );
    const updatedSkill = {
      ...skill(),
      description: "Updated independently",
      updated_at: Date.parse("2026-08-11T03:00:00.000Z"),
    };
    materializeSkillResourceBundle({
      bundlePath: path.join(targetPath, "skills", "skill-1"),
      skill: updatedSkill,
      versions: [
        {
          id: "skill-version-1",
          skillId: "skill-1",
          version: 1,
          content: "# Writer\n",
          createdAt: "2026-08-11T00:00:00.000Z",
        },
      ],
      packageFiles: [{ path: "SKILL.md", sourcePath: skillFile }],
      writePolicy: { mode: "replace" },
    });
    expect(
      readCanonicalStorageShadow(targetPath).skills[0].skill.description,
    ).toBe("Updated independently");

    const operationalPath = path.join(base, "operational.db");
    const operational = new DatabaseAdapter(operationalPath);
    operational.exec(SCHEMA_TABLES);
    operational.exec(SCHEMA_INDEXES);
    recordCurrentLegacySchemaMigrations(operational, 1);
    recordCurrentDatabaseMigration(operational, 0);
    operational.run(
      "INSERT INTO settings (key, value) VALUES (?, ?)",
      "compatibility-key",
      "preserved",
    );
    operational.run(
      `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      "user-1",
      "owner",
      "hash",
      "admin",
      1,
      1,
    );
    operational.run(
      `INSERT INTO agent_session_sources (
         id, platform_id, root_path, adapter_id, adapter_version,
         enabled, last_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      "source-1",
      "codex",
      "/sessions",
      "jsonl",
      "1",
      1,
      "ok",
      1,
      1,
    );
    operational.close();

    const databasePath = path.join(base, "rebuilt.db");
    const publishedCanonicalRootPath = path.join(base, "published", "data");
    const rebuilt = stageCanonicalStorageDatabase(targetPath, databasePath, {
      operationalSourceDatabasePath: operationalPath,
      publishedCanonicalRootPath,
    });
    expect(rebuilt.resourceCount).toBe(6);
    expect(rebuilt.preservedDatabaseCounts).toMatchObject({
      settings: 1,
      users: 1,
      agent_session_sources: 1,
    });
    const database = new DatabaseAdapter(databasePath, { readOnly: true });
    try {
      expect(new SkillDB(database).getById("skill-1")).toMatchObject({
        name: "writer",
        local_repo_path: path.join(
          publishedCanonicalRootPath,
          "skills",
          "skill-1",
          "files",
        ),
      });
      expect(
        new AgentProviderProfileDB(database).getProfileById("profile-1")?.name,
      ).toBe("OpenAI");
      expect(new RuleDB(database).getById("codex-global")).toMatchObject({
        currentVersion: 1,
        managedPath: path.join(
          publishedCanonicalRootPath,
          "rules",
          "codex-global",
          "rule.md",
        ),
      });
      expect(
        database.get(
          "SELECT status FROM generation_batches WHERE id = ?",
          "batch-1",
        ),
      ).toEqual({ status: "succeeded" });
      expect(
        database.get(
          "SELECT sha256 FROM generation_outputs WHERE id = ?",
          "output-1",
        ),
      ).toEqual({
        sha256: crypto.createHash("sha256").update(outputBytes).digest("hex"),
      });
      expect(new CanonicalResourceDB(database).list()).toHaveLength(6);
      expect(
        database.get(
          "SELECT value FROM settings WHERE key = ?",
          "compatibility-key",
        ),
      ).toEqual({ value: "preserved" });
      expect(
        database.get("SELECT username FROM users WHERE id = ?", "user-1"),
      ).toEqual({ username: "owner" });
      expect(
        database.get(
          "SELECT adapter_id FROM agent_session_sources WHERE id = ?",
          "source-1",
        ),
      ).toEqual({ adapter_id: "jsonl" });
      expect(database.pragma("user_version")).toEqual([
        { user_version: CURRENT_DATABASE_SCHEMA_VERSION },
      ]);
      expect(
        Number(
          (
            database.get("SELECT COUNT(*) AS count FROM schema_migrations") as {
              count: number;
            }
          ).count,
        ),
      ).toBe(CURRENT_LEGACY_SCHEMA_MIGRATION_NAMES.length);
      expect(database.pragma("quick_check")).toEqual([{ quick_check: "ok" }]);
    } finally {
      database.close();
    }
  });

  it("removes a failed staged database when canonical ownership is invalid", () => {
    const base = root();
    const owned = skill();
    owned.ownerUserId = "server-user";
    const targetPath = path.join(base, "shadow");
    materializeCanonicalStorageShadow({
      targetPath,
      prompts: {
        prompts: [],
        promptVersions: [],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
      skills: [{ skill: owned, versions: [], packageFiles: [] }],
    });
    const databasePath = path.join(base, "failed.db");
    expect(() =>
      stageCanonicalStorageDatabase(targetPath, databasePath),
    ).toThrow(/server-owned Skill/u);
    expect(fs.existsSync(databasePath)).toBe(false);
  });
});
