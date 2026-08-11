/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AgentProviderProfileDB,
  closeDatabase,
  initDatabase,
  listDatabaseSafetyPoints,
} from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";

describe("AgentProviderProfileDB", () => {
  let tempDir: string;
  let database: Database.Database;
  let profiles: AgentProviderProfileDB;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-provider-db-"),
    );
    database = new Database(path.join(tempDir, "prompthub.db"));
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
    profiles = new AgentProviderProfileDB(database);
  });

  afterEach(() => {
    database.close();
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates fresh provider tables, constraints, and query indexes", () => {
    const objects = database
      .prepare(
        `SELECT type, name
         FROM sqlite_master
         WHERE name LIKE 'agent_provider_%'
            OR name LIKE 'idx_agent_provider_%'
         ORDER BY type, name`,
      )
      .all() as Array<{ type: string; name: string }>;

    expect(objects).toEqual(
      expect.arrayContaining([
        { type: "table", name: "agent_provider_profiles" },
        { type: "table", name: "agent_provider_model_mappings" },
        { type: "table", name: "agent_provider_snapshots" },
        { type: "index", name: "idx_agent_provider_profiles_platform" },
        { type: "index", name: "idx_agent_provider_profiles_active_name" },
        {
          type: "index",
          name: "idx_agent_provider_snapshots_platform_created",
        },
      ]),
    );

    expect(() =>
      database
        .prepare(
          `INSERT INTO agent_provider_profiles (
             id, platform_id, name, provider_kind, protocol, config_json,
             source, archived, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "invalid",
          "codex",
          "Invalid",
          "custom",
          "responses",
          "{}",
          "unknown-source",
          0,
          1,
          1,
        ),
    ).toThrow();
  });

  it("persists non-secret profile metadata and enforces active names per platform", () => {
    const profile = profiles.createProfile({
      platformId: "codex",
      name: "DeepSeek",
      providerKind: "custom",
      protocol: "responses",
      endpoint: "https://api.deepseek.com/v1",
      config: { defaultModel: "deepseek-chat", reasoning: true },
      secretRef: "agent-provider:codex:deepseek",
      source: "manual",
    });

    expect(profiles.getProfileById(profile.id)).toEqual(profile);
    expect(profiles.listProfiles({ platformId: "codex" })).toEqual([profile]);
    expect(
      database
        .prepare(
          "SELECT config_json, secret_ref FROM agent_provider_profiles WHERE id = ?",
        )
        .get(profile.id),
    ).toEqual({
      config_json: '{"defaultModel":"deepseek-chat","reasoning":true}',
      secret_ref: "agent-provider:codex:deepseek",
    });

    expect(() =>
      profiles.createProfile({
        platformId: "codex",
        name: "deepseek",
        providerKind: "custom",
        protocol: "responses",
        config: {},
        source: "manual",
      }),
    ).toThrow();

    const otherPlatform = profiles.createProfile({
      platformId: "claude",
      name: "DeepSeek",
      providerKind: "custom",
      protocol: "anthropic",
      config: {},
      source: "manual",
    });
    expect(otherPlatform.platformId).toBe("claude");

    const archived = profiles.archiveProfile(profile.id, profile.updatedAt);
    expect(archived.archived).toBe(true);
    expect(profiles.listProfiles({ platformId: "codex" })).toEqual([]);
    expect(
      profiles.listProfiles({
        platformId: "codex",
        includeArchived: true,
      }),
    ).toEqual([archived]);

    expect(() =>
      profiles.createProfile({
        platformId: "codex",
        name: "DeepSeek",
        providerKind: "custom",
        protocol: "responses",
        config: {},
        source: "native-import",
      }),
    ).not.toThrow();
  });

  it("uses optimistic timestamps to reject stale profile updates", () => {
    const profile = profiles.createProfile({
      platformId: "codex",
      name: "Gateway",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });

    const updated = profiles.updateProfile(
      profile.id,
      {
        name: "Gateway Updated",
        endpoint: "https://gateway.example/v1",
        config: { model: "gateway-chat" },
      },
      profile.updatedAt,
    );

    expect(updated).toMatchObject({
      name: "Gateway Updated",
      endpoint: "https://gateway.example/v1",
      config: { model: "gateway-chat" },
    });
    expect(updated.updatedAt).toBeGreaterThan(profile.updatedAt);
    expect(() =>
      profiles.updateProfile(
        profile.id,
        { name: "Stale Write" },
        profile.updatedAt,
      ),
    ).toThrow("Provider profile changed externally");
  });

  it("updates profile metadata and replaces mappings in one transaction", () => {
    const profile = profiles.createProfileWithMappings(
      {
        platformId: "codex",
        name: "Gateway",
        providerKind: "custom",
        protocol: "responses",
        config: {},
        source: "manual",
      },
      [
        {
          routeKey: "primary",
          modelId: "old-primary",
          parameters: {},
        },
        {
          routeKey: "secondary",
          modelId: "old-secondary",
          parameters: {},
        },
      ],
    );

    const updated = profiles.updateProfileWithMappings(
      profile.id,
      { name: "Gateway Updated" },
      profile.updatedAt,
      [
        {
          routeKey: "primary",
          modelId: "new-primary",
          parameters: { reasoning: "high" },
        },
      ],
    );

    expect(updated.name).toBe("Gateway Updated");
    expect(profiles.listModelMappings(profile.id)).toMatchObject([
      {
        routeKey: "primary",
        modelId: "new-primary",
        parameters: { reasoning: "high" },
      },
    ]);

    expect(() =>
      profiles.updateProfileWithMappings(
        profile.id,
        { name: "Broken" },
        updated.updatedAt,
        [
          {
            routeKey: "",
            modelId: "invalid",
            parameters: {},
          },
        ],
      ),
    ).toThrow();
    expect(profiles.getProfileById(profile.id)?.name).toBe("Gateway Updated");
    expect(profiles.listModelMappings(profile.id)[0]?.modelId).toBe(
      "new-primary",
    );
  });

  it("upserts route mappings and preserves snapshot history across profile deletion", () => {
    const profile = profiles.createProfile({
      platformId: "codex",
      name: "OpenRouter",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "import",
    });

    const originalMapping = profiles.upsertModelMapping({
      providerProfileId: profile.id,
      routeKey: "primary",
      modelId: "openai/gpt-5",
      parameters: { reasoningEffort: "medium" },
    });
    const updatedMapping = profiles.upsertModelMapping({
      providerProfileId: profile.id,
      routeKey: "primary",
      modelId: "openai/gpt-5.1",
      parameters: { reasoningEffort: "high" },
    });

    expect(updatedMapping.id).toBe(originalMapping.id);
    expect(profiles.listModelMappings(profile.id)).toEqual([updatedMapping]);

    const snapshot = profiles.createSnapshot({
      platformId: "codex",
      providerProfileId: profile.id,
      nativeDigest: "sha256:native",
      redactedSnapshot: {
        activeProvider: "openrouter",
        credentialStatus: "configured",
      },
      backupRef: "agent-config-backups/codex-1",
      operation: "activate",
      result: "verified",
    });
    profiles.createSnapshot({
      platformId: "codex",
      providerProfileId: profile.id,
      nativeDigest: "sha256:failed",
      redactedSnapshot: { activeProvider: "broken" },
      operation: "activate",
      result: "failed",
    });

    expect(
      profiles
        .listSnapshots({ platformId: "codex", limit: 10 })
        .map((entry) => entry.result),
    ).toEqual(expect.arrayContaining(["failed", "verified"]));
    expect(profiles.getLatestVerifiedSnapshot("codex")).toEqual(snapshot);
    expect(profiles.getLatestVerifiedSnapshot("claude")).toBeNull();
    expect(profiles.deleteProfile(profile.id)).toBe(true);
    expect(profiles.getProfileById(profile.id)).toBeNull();
    expect(profiles.listModelMappings(profile.id)).toEqual([]);
    expect(profiles.getLatestVerifiedSnapshot("codex")).toEqual({
      ...snapshot,
      providerProfileId: null,
    });
    expect(profiles.deleteProfile(profile.id)).toBe(false);
  });

  it("rolls back a profile and mapping batch when one mapping is invalid", () => {
    expect(() =>
      profiles.createProfileWithMappings(
        {
          platformId: "codex",
          name: "Atomic",
          providerKind: "custom",
          protocol: "responses",
          config: {},
          source: "manual",
        },
        [
          {
            routeKey: "primary",
            modelId: "model-a",
            parameters: {},
          },
          {
            routeKey: "",
            modelId: "model-b",
            parameters: {},
          },
        ],
      ),
    ).toThrow();

    expect(
      profiles.listProfiles({
        platformId: "codex",
        includeArchived: true,
      }),
    ).toEqual([]);
  });

  it("rejects malformed objects, missing records, and invalid snapshot bounds", () => {
    expect(() =>
      profiles.createProfile({
        platformId: "codex",
        name: "Invalid Config",
        providerKind: "custom",
        protocol: "responses",
        config: [] as unknown as Record<string, unknown>,
        source: "manual",
      }),
    ).toThrow("config must be a plain object");

    expect(() =>
      profiles.updateProfile("missing", { name: "Missing" }, 1),
    ).toThrow("Provider profile not found");
    expect(() => profiles.archiveProfile("missing", 1)).toThrow(
      "Provider profile not found",
    );
    expect(() =>
      profiles.upsertModelMapping({
        providerProfileId: "missing",
        routeKey: "primary",
        modelId: "model",
        parameters: {},
      }),
    ).toThrow();
    expect(() =>
      profiles.listSnapshots({ platformId: "codex", limit: 0 }),
    ).toThrow("Snapshot limit must be between 1 and 500");
    expect(() =>
      profiles.listSnapshots({ platformId: "codex", limit: 1.5 }),
    ).toThrow("Snapshot limit must be between 1 and 500");
    expect(() =>
      profiles.listSnapshots({ platformId: "codex", limit: 501 }),
    ).toThrow("Snapshot limit must be between 1 and 500");
  });

  it("rejects secret-bearing or non-JSON Provider Profile configuration", () => {
    const invalidConfigs: Record<string, unknown>[] = [
      { apiKey: "secret-token" },
      { nested: { Authorization: "Bearer secret-token" } },
      { refresh_token: "secret-token" },
      { password: "secret-token" },
      { value: undefined },
      { value: Number.POSITIVE_INFINITY },
    ];
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    invalidConfigs.push(cyclic);

    for (const config of invalidConfigs) {
      expect(() =>
        profiles.createProfile({
          platformId: "codex",
          name: `Invalid ${invalidConfigs.indexOf(config)}`,
          providerKind: "custom",
          protocol: "responses",
          config,
          source: "manual",
        }),
      ).toThrow("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
    }

    const valid = profiles.createProfile({
      platformId: "codex",
      name: "Redacted metadata",
      providerKind: "custom",
      protocol: "responses",
      config: {
        credentialStatus: "configured",
        secretRequired: true,
        endpointLabel: "Work gateway",
      },
      source: "manual",
    });
    expect(valid.config).toEqual({
      credentialStatus: "configured",
      secretRequired: true,
      endpointLabel: "Work gateway",
    });
    expect(() =>
      profiles.upsertModelMapping({
        providerProfileId: valid.id,
        routeKey: "primary",
        modelId: "gpt-5.4",
        parameters: { accessToken: "secret-token" },
      }),
    ).toThrow("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
  });

  it("rejects secret-bearing Provider audit snapshots before persistence and on legacy reads", () => {
    const secret = "snapshot-secret-token";
    const invalidSnapshots: Record<string, unknown>[] = [
      { apiKey: secret },
      { apiToken: secret },
      { nested: { Authorization: `Bearer ${secret}` } },
      { refresh_token: secret },
      { value: undefined },
    ];
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    invalidSnapshots.push(cyclic);

    for (const redactedSnapshot of invalidSnapshots) {
      expect(() =>
        profiles.createSnapshot({
          platformId: "codex",
          nativeDigest: "sha256:unsafe",
          redactedSnapshot,
          operation: "activate",
          result: "failed",
        }),
      ).toThrow("AGENT_PROVIDER_PUBLIC_CONFIG_INVALID");
    }
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM agent_provider_snapshots")
        .get(),
    ).toEqual({ count: 0 });

    database
      .prepare(
        `INSERT INTO agent_provider_snapshots (
           id, platform_id, provider_profile_id, native_digest,
           redacted_snapshot, backup_ref, operation, result, created_at
         ) VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, ?)`,
      )
      .run(
        "legacy-unsafe-snapshot",
        "codex",
        "sha256:legacy",
        JSON.stringify({ apiKey: secret }),
        "activate",
        "verified",
        1,
      );

    expect(() => profiles.getLatestVerifiedSnapshot("codex")).toThrow(
      "AGENT_PROVIDER_PUBLIC_CONFIG_INVALID",
    );
    expect(() => profiles.listSnapshots({ platformId: "codex" })).toThrow(
      "AGENT_PROVIDER_PUBLIC_CONFIG_INVALID",
    );
    try {
      profiles.getLatestVerifiedSnapshot("codex");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it("rejects credential-bearing endpoints before they reach SQLite", () => {
    expect(() =>
      profiles.createProfile({
        platformId: "codex",
        name: "Credential in URL",
        providerKind: "custom",
        protocol: "responses",
        endpoint: "https://user:secret-token@example.com/v1",
        config: {},
        source: "manual",
      }),
    ).toThrow("AGENT_PROVIDER_ENDPOINT_INVALID");

    const profile = profiles.createProfile({
      platformId: "codex",
      name: "Safe URL",
      providerKind: "custom",
      protocol: "responses",
      endpoint: "https://api.example.com/v1",
      config: {},
      source: "manual",
    });
    expect(() =>
      profiles.updateProfile(
        profile.id,
        { endpoint: "https://secret-token@example.com/v1" },
        profile.updatedAt,
      ),
    ).toThrow("AGENT_PROVIDER_ENDPOINT_INVALID");
    expect(profiles.getProfileById(profile.id)?.endpoint).toBe(
      "https://api.example.com/v1",
    );
    expect(
      (
        database
          .prepare("SELECT endpoint FROM agent_provider_profiles WHERE id = ?")
          .all(profile.id) as Array<{ endpoint: string | null }>
      )[0]?.endpoint,
    ).not.toContain("secret-token");

    database
      .prepare("UPDATE agent_provider_profiles SET endpoint = ? WHERE id = ?")
      .run("https://legacy:secret-token@example.com/v1", profile.id);
    expect(() => profiles.getProfileById(profile.id)).toThrow(
      "AGENT_PROVIDER_ENDPOINT_INVALID",
    );
    try {
      profiles.getProfileById(profile.id);
    } catch (error) {
      expect(String(error)).not.toContain("secret-token");
    }
  });

  it("fails closed when legacy profile or mapping JSON contains credentials", () => {
    const secret = "legacy-json-secret";
    const profile = profiles.createProfile({
      platformId: "codex",
      name: "Legacy JSON",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });
    const mapping = profiles.upsertModelMapping({
      providerProfileId: profile.id,
      routeKey: "primary",
      modelId: "gpt-5.4",
      parameters: {},
    });

    database
      .prepare(
        "UPDATE agent_provider_profiles SET config_json = ? WHERE id = ?",
      )
      .run(JSON.stringify({ nested: { apiKey: secret } }), profile.id);
    expect(() => profiles.getProfileById(profile.id)).toThrow(
      "AGENT_PROVIDER_PUBLIC_CONFIG_INVALID",
    );

    database
      .prepare(
        "UPDATE agent_provider_profiles SET config_json = ? WHERE id = ?",
      )
      .run("{}", profile.id);
    database
      .prepare(
        `UPDATE agent_provider_model_mappings
         SET parameters_json = ?
         WHERE id = ?`,
      )
      .run(JSON.stringify({ Authorization: `Bearer ${secret}` }), mapping.id);
    expect(() => profiles.listModelMappings(profile.id)).toThrow(
      "AGENT_PROVIDER_PUBLIC_CONFIG_INVALID",
    );
    try {
      profiles.listModelMappings(profile.id);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it("handles no-op and repeated archive updates and rejects corrupt stored JSON", () => {
    const profile = profiles.createProfile({
      platformId: "codex",
      name: "Boundary",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });

    expect(profiles.updateProfile(profile.id, {}, profile.updatedAt)).toEqual(
      profile,
    );
    const archived = profiles.archiveProfile(profile.id, profile.updatedAt);
    expect(profiles.archiveProfile(profile.id, archived.updatedAt)).toEqual(
      archived,
    );
    expect(profiles.listProfiles({ includeArchived: true })).toContainEqual(
      archived,
    );
    expect(() =>
      profiles.archiveProfile(profile.id, profile.updatedAt),
    ).not.toThrow();

    database
      .prepare(
        "UPDATE agent_provider_profiles SET config_json = ? WHERE id = ?",
      )
      .run("[]", profile.id);
    expect(() => profiles.getProfileById(profile.id)).toThrow(
      "Invalid provider config in database",
    );
  });
});

describe("Agent provider profile migration", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-provider-migration-"),
    );
    dbPath = path.join(tempDir, "prompthub.db");
  });

  afterEach(() => {
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("adds provider tables idempotently without changing existing data", () => {
    const legacy = new Database(dbPath);
    legacy.exec(
      "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
    legacy
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?)")
      .run("preserved", "yes");
    legacy.close();

    const migrated = initDatabase(dbPath);
    expect(
      migrated
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get("preserved"),
    ).toEqual({ value: "yes" });
    expect(
      migrated
        .prepare(
          "SELECT name FROM schema_migrations WHERE name = 'agent_provider_profiles_v1'",
        )
        .get(),
    ).toEqual({ name: "agent_provider_profiles_v1" });
    expect(
      migrated
        .prepare(
          `SELECT COUNT(*) AS count
           FROM sqlite_master
           WHERE type = 'table'
             AND name IN (
               'agent_provider_profiles',
               'agent_provider_model_mappings',
               'agent_provider_snapshots'
             )`,
        )
        .get(),
    ).toEqual({ count: 3 });

    closeDatabase();
    initDatabase(dbPath);
    closeDatabase();

    expect(listDatabaseSafetyPoints(dbPath)).toHaveLength(1);
    expect(
      fs
        .readdirSync(tempDir)
        .filter((entry) => entry.startsWith("prompthub.db.backup-")),
    ).toEqual([]);
  });
});
