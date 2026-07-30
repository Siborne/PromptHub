/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase } from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";
import { createAgentProviderRuntime } from "../../../src/main/services/agent-provider-runtime";

describe("agent provider runtime", () => {
  let database: Database.Database;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-provider-runtime-"),
    );
    database = new Database(path.join(tempDir, "prompthub.db"));
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
  });

  afterEach(() => {
    database.close();
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("shares one profile and activation runtime with the tray projection", async () => {
    const runtime = createAgentProviderRuntime({
      database,
      encryption: {
        isEncryptionAvailable: () => true,
        encryptString: (value) => Buffer.from(value, "utf8"),
        decryptString: (value) => value.toString("utf8"),
      },
      userDataPath: tempDir,
    });

    await runtime.profileService.create({
      profile: {
        platformId: "qwen",
        name: "Qwen Primary",
        providerKind: "openai-compatible",
        protocol: "openai-chat",
        endpoint: "https://example.com",
        config: {},
        source: "manual",
      },
      modelMappings: [
        {
          routeKey: "primary",
          modelId: "qwen3-coder",
          parameters: {},
        },
      ],
    });

    await expect(runtime.trayService.listGroups()).resolves.toEqual([
      expect.objectContaining({
        agentId: "qwen",
        currentProfileId: null,
        name: "Qwen Code",
        profiles: [
          expect.objectContaining({
            model: "qwen3-coder",
            name: "Qwen Primary",
          }),
        ],
      }),
    ]);
    expect(runtime.activationService).toBeDefined();
    expect(runtime.legacyProviderService).toBeDefined();
    expect(runtime.sessionIndexDb).toBeDefined();
    expect(runtime.secretStore).toBeDefined();

    runtime.sessionIndexDb.registerSource({
      platformId: "claude",
      rootPath: path.join(tempDir, "source-device", "projects"),
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: true,
    });
    await expect(runtime.backupService.exportBackup()).resolves.toMatchObject({
      sessionSourcePreferences: [
        {
          platformId: "claude",
          adapterId: "claude-jsonl-v1",
          enabled: true,
        },
      ],
    });
  });
});
