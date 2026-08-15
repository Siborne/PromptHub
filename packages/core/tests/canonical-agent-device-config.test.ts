import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DatabaseAdapter, SCHEMA } from "@prompthub/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentSettingsRepository } from "../src/agent-management/agent-settings-repository";
import {
  publishCanonicalAgentDeviceConfig,
  readCanonicalAgentDeviceConfig,
} from "../src/canonical-agent-device-config";
import { writeCanonicalStorageAuthority } from "../src/canonical-storage-authority";
import {
  configureRuntimePaths,
  resetRuntimePaths,
  writeRuntimeLayoutState,
} from "../src/runtime-paths";

describe("canonical Agent device configuration", () => {
  let root: string;
  let database: DatabaseAdapter.Database;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-agent-device-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "b".repeat(64),
      operationId: "canonical-agent-device-test",
    });
    const rendererPath = path.join(root, "config", "devices", "renderer.json");
    fs.mkdirSync(path.dirname(rendererPath), { recursive: true });
    fs.writeFileSync(
      rendererPath,
      JSON.stringify({
        kind: "prompthub-renderer-devices",
        version: 1,
        updatedAt: "2026-08-12T00:00:00.000Z",
        selfHostedDeviceId: null,
      }),
    );
    database = new DatabaseAdapter(":memory:");
    database.exec(SCHEMA);
  });

  afterEach(() => {
    database.close();
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("routes CLI-style Agent settings mutations to the device document", () => {
    const repository = new AgentSettingsRepository(database);
    const builtinIds = new Set(["codex"]);
    repository.setBuiltinOverride(
      "codex",
      { rootPath: path.join(root, ".codex-alt") },
      builtinIds,
    );
    repository.addCustomAgent(
      {
        id: "local-agent",
        name: "Local Agent",
        rootPath: path.join(root, ".local-agent"),
        enabled: true,
      },
      builtinIds,
    );
    repository.setEnabled("local-agent", false, builtinIds);
    repository.setCodexIdentity({ name: "chatgpt", icon: "codex" });

    const stored = readCanonicalAgentDeviceConfig()!;
    expect(stored.deviceId).toMatch(/^device-[a-f0-9]{32}$/u);
    expect(stored.builtinAgentOverrides.codex.rootPath).toBe(
      path.join(root, ".codex-alt"),
    );
    expect(stored.customAgents[0]).toMatchObject({
      id: "local-agent",
      enabled: false,
    });
    expect(stored.disabledPlatformIds).toContain("local-agent");
    expect(stored.agentIdentityPreferences.codex).toEqual({
      name: "chatgpt",
      icon: "codex",
    });
    expect(
      database
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get("customAgents"),
    ).toBeTruthy();
  });

  it("rolls back the device file when its compatibility commit fails", () => {
    const initial = {
      builtinAgentOverrides: {},
      customAgents: [],
      disabledPlatformIds: [],
      agentIdentityPreferences: {},
    };
    publishCanonicalAgentDeviceConfig(initial);

    expect(() =>
      publishCanonicalAgentDeviceConfig(
        { ...initial, disabledPlatformIds: ["codex"] },
        () => {
          throw new Error("database write failed");
        },
      ),
    ).toThrow("database write failed");
    expect(readCanonicalAgentDeviceConfig()?.disabledPlatformIds).toEqual([]);
  });

  it("preserves legacy Agent settings while re-keying the local document", () => {
    const filePath = path.join(root, "config", "devices", "agents.json");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        kind: "prompthub-agent-device-config",
        version: 1,
        deviceId: "desktop-legacy-device",
        updatedAt: "2026-08-12T00:00:00.000Z",
        builtinAgentOverrides: { codex: { rootPath: "/legacy/codex" } },
        customAgents: [],
        disabledPlatformIds: ["claude"],
        agentIdentityPreferences: {
          codex: { name: "chatgpt", icon: "codex" },
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "config", "devices", "renderer.json"),
      JSON.stringify({
        kind: "prompthub-renderer-devices",
        version: 1,
        selfHostedDeviceId: null,
      }),
      "utf8",
    );

    const stored = readCanonicalAgentDeviceConfig()!;

    expect(stored.deviceId).toMatch(/^device-[a-f0-9]{32}$/u);
    expect(stored.deviceId).not.toBe("desktop-legacy-device");
    expect(stored.builtinAgentOverrides.codex.rootPath).toBe("/legacy/codex");
    expect(stored.disabledPlatformIds).toEqual(["claude"]);
    expect(stored.agentIdentityPreferences.codex).toEqual({
      name: "chatgpt",
      icon: "codex",
    });
    expect(JSON.parse(fs.readFileSync(filePath, "utf8")).deviceId).toBe(
      stored.deviceId,
    );
  });
});
