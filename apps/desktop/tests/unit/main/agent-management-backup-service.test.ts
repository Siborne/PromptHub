/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AgentProviderProfileDB,
  AgentSessionIndexDB,
  closeDatabase,
} from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";
import { createAgentManagementBackupService } from "../../../src/main/services/agent-management-backup-service";

describe("Agent management portable backup service", () => {
  let tempDir: string;
  let sourceDatabase: Database.Database;
  let targetDatabase: Database.Database;
  let sourceProfiles: AgentProviderProfileDB;
  let sourceSessions: AgentSessionIndexDB;
  let targetProfiles: AgentProviderProfileDB;
  let targetSessions: AgentSessionIndexDB;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-management-backup-"),
    );
    sourceDatabase = new Database(path.join(tempDir, "source.db"));
    targetDatabase = new Database(path.join(tempDir, "target.db"));
    for (const database of [sourceDatabase, targetDatabase]) {
      database.pragma("foreign_keys = ON");
      database.exec(SCHEMA);
    }
    sourceProfiles = new AgentProviderProfileDB(sourceDatabase);
    sourceSessions = new AgentSessionIndexDB(sourceDatabase);
    targetProfiles = new AgentProviderProfileDB(targetDatabase);
    targetSessions = new AgentSessionIndexDB(targetDatabase);
  });

  afterEach(() => {
    sourceDatabase.close();
    targetDatabase.close();
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("exports profiles, mappings, and redacted snapshot metadata without device-local refs", async () => {
    const created = sourceProfiles.createProfileWithMappings(
      {
        platformId: "claude",
        name: "Work",
        providerKind: "anthropic-compatible",
        protocol: "messages",
        endpoint: "https://api.example.com/v1",
        config: { region: "global" },
        secretRef: "agent-provider:source-secret",
        source: "manual",
      },
      [
        {
          routeKey: "primary",
          modelId: "claude-sonnet-4",
          parameters: {},
        },
        {
          routeKey: "fast",
          modelId: "claude-haiku",
          parameters: {},
        },
      ],
    );
    const archived = sourceProfiles.createProfile({
      platformId: "claude",
      name: "Archived",
      providerKind: "anthropic-compatible",
      protocol: "messages",
      config: {},
      source: "manual",
    });
    sourceProfiles.archiveProfile(archived.id, archived.updatedAt);
    sourceProfiles.createSnapshot({
      platformId: "claude",
      providerProfileId: created.id,
      nativeDigest: "sha256:verified",
      redactedSnapshot: { model: "claude-sonnet-4" },
      backupRef: "/device/local/config.enc",
      operation: "activate",
      result: "verified",
    });

    const service = createAgentManagementBackupService({
      profiles: sourceProfiles,
      secrets: {
        hasMany: async () => new Set(["agent-provider:source-secret"]),
      },
      sessions: sourceSessions,
      resolveSessionSource: () => null,
      transaction: <T>(operation: () => T) =>
        sourceDatabase.transaction(operation)(),
    });
    const backup = await service.exportBackup();

    expect(backup.version).toBe(1);
    expect(backup.providerProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          requiresSecret: true,
          profile: expect.objectContaining({
            platformId: "claude",
            name: "Work",
          }),
          modelMappings: expect.arrayContaining([
            expect.objectContaining({ routeKey: "primary" }),
            expect.objectContaining({ routeKey: "fast" }),
          ]),
        }),
        expect.objectContaining({
          id: archived.id,
          requiresSecret: false,
          archived: true,
        }),
      ]),
    );
    expect(backup.snapshots).toEqual([
      expect.objectContaining({
        platformId: "claude",
        providerProfileId: created.id,
        nativeDigest: "sha256:verified",
      }),
    ]);
    expect(JSON.stringify(backup)).not.toMatch(
      /source-secret|device\/local|backupRef|secretRef/,
    );
  });

  it("atomically replaces portable rows and reports same-device or missing secret readiness", async () => {
    const old = targetProfiles.createProfile({
      platformId: "codex",
      name: "Old",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });
    const availableRef = "agent-provider:profile-available";
    const service = createAgentManagementBackupService({
      profiles: targetProfiles,
      secrets: {
        hasMany: async (refs) =>
          new Set(refs.filter((ref) => ref === availableRef)),
      },
      sessions: targetSessions,
      resolveSessionSource: () => null,
      transaction: <T>(operation: () => T) =>
        targetDatabase.transaction(operation)(),
    });

    const result = await service.restoreBackup({
      version: 1,
      providerProfiles: [
        {
          id: "profile-available",
          profile: {
            platformId: "claude",
            name: "Available",
            providerKind: "anthropic-compatible",
            protocol: "messages",
            endpoint: null,
            config: {},
            source: "manual",
          },
          modelMappings: [],
          requiresSecret: true,
          archived: false,
          createdAt: 10,
          updatedAt: 11,
        },
        {
          id: "profile-missing",
          profile: {
            platformId: "codex",
            name: "Missing",
            providerKind: "custom",
            protocol: "responses",
            endpoint: "https://api.example.com/v1",
            config: {},
            source: "import",
          },
          modelMappings: [],
          requiresSecret: true,
          archived: true,
          createdAt: 20,
          updatedAt: 21,
        },
      ],
      snapshots: [
        {
          id: "snapshot-restored",
          platformId: "claude",
          providerProfileId: "profile-available",
          nativeDigest: "sha256:restored",
          redactedSnapshot: { model: "claude-sonnet-4" },
          operation: "restore",
          result: "verified",
          createdAt: 30,
        },
      ],
    });

    expect(targetProfiles.getProfileById(old.id)).toBeNull();
    expect(targetProfiles.getProfileById("profile-available")).toMatchObject({
      secretRef: availableRef,
      archived: false,
    });
    expect(targetProfiles.getProfileById("profile-missing")).toMatchObject({
      secretRef: "agent-provider:profile-missing",
      archived: true,
    });
    expect(targetProfiles.listSnapshotsForBackup()).toEqual([
      expect.objectContaining({
        id: "snapshot-restored",
        backupRef: null,
      }),
    ]);
    expect(result).toEqual({
      profileCount: 2,
      snapshotCount: 1,
      availableSecretProfileIds: ["profile-available"],
      missingSecretProfileIds: ["profile-missing"],
      restoredSessionPreferenceCount: 0,
      unresolvedSessionPreferenceKeys: [],
    });
  });

  it("rejects malformed portable data before replacing existing profiles", async () => {
    const existing = targetProfiles.createProfile({
      platformId: "codex",
      name: "Keep",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });
    const service = createAgentManagementBackupService({
      profiles: targetProfiles,
      secrets: { hasMany: async () => new Set() },
      sessions: targetSessions,
      resolveSessionSource: () => null,
      transaction: <T>(operation: () => T) =>
        targetDatabase.transaction(operation)(),
    });

    await expect(
      service.restoreBackup({
        version: 1,
        providerProfiles: [
          {
            id: "profile-invalid",
            profile: {
              platformId: "codex",
              name: "Invalid",
              providerKind: "custom",
              protocol: "responses",
              endpoint: null,
              config: { apiKey: "must-not-enter-backup" },
              source: "manual",
            },
            modelMappings: [],
            requiresSecret: false,
            archived: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        snapshots: [],
      }),
    ).rejects.toThrow("AGENT_MANAGEMENT_BACKUP_INVALID");

    expect(targetProfiles.getProfileById(existing.id)).toEqual(existing);
  });

  it("rolls the complete replacement back when SQLite aborts after cleanup", () => {
    const existing = targetProfiles.createProfile({
      platformId: "codex",
      name: "Keep After Failure",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });
    targetDatabase.exec(`
      CREATE TRIGGER abort_second_restored_profile
      BEFORE INSERT ON agent_provider_profiles
      WHEN NEW.id = 'profile-second'
      BEGIN
        SELECT RAISE(ABORT, 'injected restore failure');
      END;
    `);

    expect(() =>
      targetProfiles.replacePortableBackup({
        version: 1,
        providerProfiles: [
          {
            id: "profile-first",
            profile: {
              platformId: "claude",
              name: "First",
              providerKind: "anthropic-compatible",
              protocol: "messages",
              endpoint: null,
              config: {},
              source: "manual",
            },
            modelMappings: [],
            requiresSecret: false,
            archived: false,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "profile-second",
            profile: {
              platformId: "codex",
              name: "Second",
              providerKind: "custom",
              protocol: "responses",
              endpoint: null,
              config: {},
              source: "manual",
            },
            modelMappings: [],
            requiresSecret: false,
            archived: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        snapshots: [],
      }),
    ).toThrow("injected restore failure");

    expect(targetProfiles.getProfileById(existing.id)).toEqual(existing);
    expect(targetProfiles.getProfileById("profile-first")).toBeNull();
  });

  it("bounds snapshot export queries", () => {
    expect(() => targetProfiles.listSnapshotsForBackup(0)).toThrow(
      "between 1 and 5000",
    );
    expect(() => targetProfiles.listSnapshotsForBackup(5_001)).toThrow(
      "between 1 and 5000",
    );
    expect(() => targetProfiles.listSnapshotsForBackup(1.5)).toThrow(
      "between 1 and 5000",
    );
  });

  it("exports only bounded enabled preferences for currently resolvable session sources", async () => {
    const source = sourceSessions.registerSource({
      platformId: "claude",
      rootPath: "/Users/source/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: true,
    });
    sourceSessions.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scannedAt: 10,
      status: "ok",
      scanCursor: '{"private":"cursor"}',
      records: [
        {
          externalId: "private-session",
          title: "Private session",
          sourcePath: "/Users/source/.claude/projects/private.jsonl",
          redactedPreview: "private preview",
          sourceStatus: "present",
        },
      ],
    });
    sourceSessions.registerSource({
      platformId: "future-agent",
      rootPath: "/Users/source/.future/sessions",
      adapterId: "future-v1",
      adapterVersion: "1",
      enabled: true,
    });
    sourceSessions.registerSource({
      platformId: "claude",
      rootPath: "/Users/legacy/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: false,
    });
    sourceSessions.registerSource({
      platformId: "claude",
      rootPath: "/Users/source/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: true,
    });

    const service = createAgentManagementBackupService({
      profiles: sourceProfiles,
      secrets: { hasMany: async () => new Set() },
      sessions: sourceSessions,
      resolveSessionSource: (platformId: string) =>
        platformId === "claude"
          ? {
              platformId,
              rootPath: "/Users/source/.claude/projects",
              adapterId: "claude-jsonl-v1",
              adapterVersion: "1",
            }
          : null,
      transaction: <T>(operation: () => T) =>
        sourceDatabase.transaction(operation)(),
    });

    const backup = await service.exportBackup();

    expect(backup.sessionSourcePreferences).toEqual([
      {
        platformId: "claude",
        adapterId: "claude-jsonl-v1",
        enabled: true,
      },
    ]);
    expect(JSON.stringify(backup)).not.toMatch(
      /Users\/source|private-session|private preview|private.*cursor/,
    );
  });

  it("rebinds a portable session preference to the current device descriptor", async () => {
    const current = targetSessions.registerSource({
      platformId: "claude",
      rootPath: "/Users/target/.claude/projects",
      adapterId: "claude-jsonl-v2",
      adapterVersion: "2",
      enabled: false,
    });
    const service = createAgentManagementBackupService({
      profiles: targetProfiles,
      secrets: { hasMany: async () => new Set() },
      sessions: targetSessions,
      resolveSessionSource: (platformId: string) =>
        platformId === "claude"
          ? {
              platformId,
              rootPath: "/Users/target/.claude/projects",
              adapterId: "claude-jsonl-v2",
              adapterVersion: "2",
            }
          : null,
      transaction: <T>(operation: () => T) =>
        targetDatabase.transaction(operation)(),
    });

    const result = await service.restoreBackup({
      version: 1,
      providerProfiles: [],
      snapshots: [],
      sessionSourcePreferences: [
        {
          platformId: "claude",
          adapterId: "claude-jsonl-v1",
          enabled: true,
        },
      ],
    });

    expect(targetSessions.getSource(current.id)).toMatchObject({
      rootPath: "/Users/target/.claude/projects",
      adapterId: "claude-jsonl-v2",
      adapterVersion: "2",
      enabled: true,
    });
    expect(result).toMatchObject({
      restoredSessionPreferenceCount: 1,
      unresolvedSessionPreferenceKeys: [],
    });
  });

  it("reports an unsupported session preference without inventing a source", async () => {
    const service = createAgentManagementBackupService({
      profiles: targetProfiles,
      secrets: { hasMany: async () => new Set() },
      sessions: targetSessions,
      resolveSessionSource: () => {
        throw new Error("unknown platform");
      },
      transaction: <T>(operation: () => T) =>
        targetDatabase.transaction(operation)(),
    });

    const result = await service.restoreBackup({
      version: 1,
      providerProfiles: [],
      snapshots: [],
      sessionSourcePreferences: [
        {
          platformId: "future-agent",
          adapterId: "future-v1",
          enabled: true,
        },
      ],
    });

    expect(targetSessions.listSources()).toEqual([]);
    expect(result).toMatchObject({
      restoredSessionPreferenceCount: 0,
      unresolvedSessionPreferenceKeys: ["future-agent:future-v1"],
    });
  });

  it("keeps existing session preferences when restoring a legacy Agent section", async () => {
    const current = targetSessions.registerSource({
      platformId: "claude",
      rootPath: "/Users/target/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: true,
    });
    const service = createAgentManagementBackupService({
      profiles: targetProfiles,
      secrets: { hasMany: async () => new Set() },
      sessions: targetSessions,
      resolveSessionSource: () => {
        throw new Error("resolver must not run for a legacy section");
      },
      transaction: <T>(operation: () => T) =>
        targetDatabase.transaction(operation)(),
    });

    await service.restoreBackup({
      version: 1,
      providerProfiles: [],
      snapshots: [],
    });

    expect(targetSessions.getSource(current.id)?.enabled).toBe(true);
  });

  it("rolls back Provider and session changes together when preference persistence fails", async () => {
    const existing = targetProfiles.createProfile({
      platformId: "codex",
      name: "Existing",
      providerKind: "custom",
      protocol: "responses",
      config: {},
      source: "manual",
    });
    const current = targetSessions.registerSource({
      platformId: "claude",
      rootPath: "/Users/target/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: false,
    });
    targetDatabase.exec(`
      CREATE TRIGGER abort_enabled_session_preference
      BEFORE UPDATE ON agent_session_sources
      WHEN NEW.enabled = 1
      BEGIN
        SELECT RAISE(ABORT, 'injected session preference failure');
      END;
    `);
    const service = createAgentManagementBackupService({
      profiles: targetProfiles,
      secrets: { hasMany: async () => new Set() },
      sessions: targetSessions,
      resolveSessionSource: (platformId: string) => ({
        platformId,
        rootPath: "/Users/target/.claude/projects",
        adapterId: "claude-jsonl-v1",
        adapterVersion: "1",
      }),
      transaction: <T>(operation: () => T) =>
        targetDatabase.transaction(operation)(),
    });

    await expect(
      service.restoreBackup({
        version: 1,
        providerProfiles: [
          {
            id: "replacement",
            profile: {
              platformId: "claude",
              name: "Replacement",
              providerKind: "anthropic-compatible",
              protocol: "messages",
              endpoint: null,
              config: {},
              source: "manual",
            },
            modelMappings: [],
            requiresSecret: false,
            archived: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        snapshots: [],
        sessionSourcePreferences: [
          {
            platformId: "claude",
            adapterId: "claude-jsonl-v1",
            enabled: true,
          },
        ],
      } as never),
    ).rejects.toThrow("injected session preference failure");

    expect(targetProfiles.getProfileById(existing.id)).toEqual(existing);
    expect(targetProfiles.getProfileById("replacement")).toBeNull();
    expect(targetSessions.getSource(current.id)?.enabled).toBe(false);
  });
});
