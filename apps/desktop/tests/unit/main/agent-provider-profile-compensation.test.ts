/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentProviderProfileDB, closeDatabase } from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";
import {
  AgentProviderProfileService,
  type AgentProviderProfileServiceSecretStore,
} from "../../../src/main/services/agent-provider-profile-service";

describe("AgentProviderProfileService compensation integration", () => {
  let tempDir: string;
  let database: Database.Database;
  let profiles: AgentProviderProfileDB;
  let secrets: Map<string, string>;
  let failLegacyClear: boolean;
  let service: AgentProviderProfileService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-provider-compensation-"),
    );
    database = new Database(path.join(tempDir, "prompthub.db"));
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
    profiles = new AgentProviderProfileDB(database);
    secrets = new Map([["legacy-provider:profile", "old-secret"]]);
    failLegacyClear = true;
    const secretStore: AgentProviderProfileServiceSecretStore = {
      read: async (ref) => secrets.get(ref) ?? null,
      write: async (ref, value) => {
        secrets.set(ref, value);
      },
      clear: async (ref) => {
        if (ref === "legacy-provider:profile" && failLegacyClear) {
          failLegacyClear = false;
          throw new Error("legacy secret cleanup denied");
        }
        secrets.delete(ref);
      },
      hasMany: async (refs) => new Set(refs.filter((ref) => secrets.has(ref))),
    };
    service = new AgentProviderProfileService(profiles, secretStore);
  });

  afterEach(() => {
    database.close();
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("restores the exact durable profile, mappings, and secret after cleanup failure", async () => {
    const created = profiles.createProfileWithMappings(
      {
        platformId: "claude",
        name: "Work",
        providerKind: "anthropic-compatible",
        protocol: "messages",
        endpoint: "https://old.example.com",
        config: { timeoutMs: 10_000 },
        secretRef: "legacy-provider:profile",
        source: "native-import",
      },
      [
        {
          routeKey: "primary",
          modelId: "claude-old",
          parameters: { temperature: 0.2 },
        },
      ],
    );

    await expect(
      service.update({
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
        profile: {
          name: "Changed",
          endpoint: "https://new.example.com",
          config: { timeoutMs: 20_000 },
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "claude-new",
            parameters: { temperature: 0.8 },
          },
        ],
        secretAction: "replace",
        secret: "new-secret",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_UPDATE_FAILED");

    expect(profiles.getProfileById(created.id)).toMatchObject({
      name: "Work",
      endpoint: "https://old.example.com",
      config: { timeoutMs: 10_000 },
      secretRef: "legacy-provider:profile",
      source: "native-import",
    });
    expect(profiles.listModelMappings(created.id)).toEqual([
      expect.objectContaining({
        routeKey: "primary",
        modelId: "claude-old",
        parameters: { temperature: 0.2 },
      }),
    ]);
    expect(secrets).toEqual(
      new Map([["legacy-provider:profile", "old-secret"]]),
    );
  });
});
