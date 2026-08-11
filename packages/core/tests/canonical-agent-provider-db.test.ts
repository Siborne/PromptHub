import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DatabaseAdapter, SCHEMA } from "@prompthub/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CanonicalAgentProviderProfileDB } from "../src/canonical-agent-provider-db";
import { readAgentProviderResourceBundle } from "../src/agent-resource-schema";
import { writeCanonicalStorageAuthority } from "../src/canonical-storage-authority";
import {
  configureRuntimePaths,
  resetRuntimePaths,
  writeRuntimeLayoutState,
} from "../src/runtime-paths";

describe("canonical Agent provider database adapter", () => {
  let root: string;
  let database: DatabaseAdapter.Database;
  let profiles: CanonicalAgentProviderProfileDB;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-agent-canonical-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "a".repeat(64),
      operationId: "canonical-agent-provider-test",
    });
    database = new DatabaseAdapter(":memory:");
    database.exec(SCHEMA);
    profiles = new CanonicalAgentProviderProfileDB(database);
  });

  afterEach(() => {
    database.close();
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("publishes profile graphs with independent revisions and deletion", () => {
    const created = profiles.createProfileWithMappings(
      {
        platformId: "codex",
        name: "OpenAI",
        providerKind: "openai",
        protocol: "openai-responses",
        endpoint: "https://api.openai.com/v1",
        config: { reasoningEffort: "high" },
        secretRef: "agent-provider:temporary-ref",
        source: "manual",
      },
      [{ routeKey: "primary", modelId: "gpt-5", parameters: {} }],
    );
    const bundlePath = path.join(root, "data", "agents", created.id);
    const first = readAgentProviderResourceBundle(bundlePath);
    expect(first.bundleManifest.revision).toBe(1);
    expect(first.profile.secretRef).toBe(`agent-provider:${created.id}`);
    expect(
      fs.readFileSync(path.join(bundlePath, "agent.json"), "utf8"),
    ).not.toContain("temporary-ref");

    const updated = profiles.updateProfileWithMappings(
      created.id,
      { name: "OpenAI Primary" },
      created.updatedAt,
      [{ routeKey: "primary", modelId: "gpt-5.1", parameters: {} }],
    );
    const second = readAgentProviderResourceBundle(bundlePath);
    expect(second.bundleManifest.revision).toBe(2);
    expect(second.profile.name).toBe("OpenAI Primary");
    expect(second.modelMappings[0].modelId).toBe("gpt-5.1");

    profiles.archiveProfile(created.id, updated.updatedAt);
    expect(readAgentProviderResourceBundle(bundlePath).profile.archived).toBe(
      true,
    );
    expect(profiles.deleteProfile(created.id)).toBe(true);
    expect(fs.existsSync(bundlePath)).toBe(false);
  });

  it("rolls back SQLite when canonical publication cannot create its journal", () => {
    const created = profiles.createProfileWithMappings(
      {
        platformId: "codex",
        name: "Stable",
        providerKind: "openai",
        protocol: "openai-responses",
        config: {},
        source: "manual",
      },
      [],
    );
    const bundlePath = path.join(root, "data", "agents", created.id);
    const journalParent = path.join(root, "data", "operations", "journals");
    fs.mkdirSync(path.dirname(journalParent), { recursive: true });
    fs.rmSync(journalParent, { recursive: true, force: true });
    fs.writeFileSync(journalParent, "blocked");

    expect(() =>
      profiles.updateProfile(
        created.id,
        { name: "Must Roll Back" },
        created.updatedAt,
      ),
    ).toThrow();
    expect(profiles.getProfileById(created.id)?.name).toBe("Stable");
    expect(readAgentProviderResourceBundle(bundlePath).profile.name).toBe(
      "Stable",
    );
  });
});
