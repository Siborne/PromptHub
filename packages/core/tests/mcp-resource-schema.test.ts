import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  McpServerConfig,
  McpTargetBinding,
} from "@prompthub/shared/types/mcp";
import { afterEach, describe, expect, it } from "vitest";

import {
  createMcpBindingConfigDocument,
  hydrateMcpServerResourceSecrets,
  hydrateMcpServerResourceSecretsSync,
  materializeMcpServerResourceBundle,
  parseMcpBindingConfigDocument,
  readMcpServerResourceBundle,
} from "../src/mcp-resource-schema";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-mcp-bundle-"));
  roots.push(value);
  return value;
}

function server(): McpServerConfig {
  return {
    id: "mcp-server-1",
    name: "github",
    displayName: "GitHub",
    description: "GitHub MCP",
    transport: "streamable-http",
    url: "https://mcp.example.test/api",
    env: {
      GITHUB_TOKEN: "ghp_literal_secret",
      OPTIONAL: "plain-value",
    },
    envRefs: { HOME: "${HOME}" },
    headers: { Authorization: "Bearer secret-token" },
    headerRefs: { "X-Workspace": "${WORKSPACE_ID}" },
    enabled: true,
    isFavorite: true,
    tags: ["development"],
    source: { type: "manual" },
    createdAt: Date.parse("2026-08-11T00:00:00.000Z"),
    updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
  };
}

function binding(): McpTargetBinding {
  return {
    id: "binding-1",
    serverIds: ["mcp-server-1"],
    target: "codex",
    scope: "global",
    path: "/Users/example/.codex/config.toml",
    enabled: true,
    entryDigests: {
      "mcp-server-1": {
        algorithm: "mcp-target-entry-sha256-v1",
        digest: "a".repeat(64),
        serverName: "github",
        recordedAt: Date.parse("2026-08-11T01:00:00.000Z"),
      },
    },
    createdAt: Date.parse("2026-08-11T00:00:00.000Z"),
    updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
  };
}

afterEach(() => {
  for (const value of roots.splice(0))
    fs.rmSync(value, { recursive: true, force: true });
});

describe("MCP canonical resource schema", () => {
  it("replaces metadata edits without coupling revision to MCP history", () => {
    const base = root();
    const bundlePath = path.join(base, "server");
    materializeMcpServerResourceBundle({ bundlePath, server: server() });
    const updated = {
      ...server(),
      displayName: "GitHub Cloud",
      updatedAt: Date.parse("2026-08-11T02:00:00.000Z"),
    };

    const result = materializeMcpServerResourceBundle({
      bundlePath,
      server: updated,
      writePolicy: { mode: "replace" },
    });

    expect(result.manifest.revision).toBe(2);
    expect(readMcpServerResourceBundle(bundlePath).server.displayName).toBe(
      "GitHub Cloud",
    );
  });

  it("extracts literal credentials and round-trips a versioned server through references", async () => {
    const base = root();
    const bundlePath = path.join(base, "server");
    const result = materializeMcpServerResourceBundle({
      bundlePath,
      server: server(),
    });

    expect(result.extractedSecrets.map(({ value }) => value).sort()).toEqual([
      "Bearer secret-token",
      "ghp_literal_secret",
      "plain-value",
    ]);
    const storedText = fs.readFileSync(
      path.join(bundlePath, "server.json"),
      "utf8",
    );
    expect(storedText).not.toContain("ghp_literal_secret");
    expect(storedText).not.toContain("Bearer secret-token");
    expect(storedText).not.toContain("plain-value");

    const restored = readMcpServerResourceBundle(bundlePath);
    expect(restored.server).toMatchObject({
      id: "mcp-server-1",
      envRefs: { HOME: "${HOME}" },
      headerRefs: { "X-Workspace": "${WORKSPACE_ID}" },
    });
    expect(restored.server.env).toBeUndefined();
    expect(restored.server.headers).toBeUndefined();
    expect(restored.versions).toHaveLength(1);
    expect(restored.currentVersion).toBe(1);

    const values = new Map(
      result.extractedSecrets.map(({ ref, value }) => [ref, value]),
    );
    const hydrated = await hydrateMcpServerResourceSecrets(
      restored,
      async (ref) => values.get(ref) ?? null,
    );
    expect(hydrated.env).toEqual(server().env);
    expect(hydrated.headers).toEqual(server().headers);
    expect(
      hydrateMcpServerResourceSecretsSync(
        restored,
        (ref) => values.get(ref) ?? null,
      ),
    ).toMatchObject({ env: server().env, headers: server().headers });
  });

  it("keeps device target bindings outside server bundles", () => {
    const document = createMcpBindingConfigDocument({
      deviceId: "device-1",
      bindings: [binding()],
      knownServerIds: new Set(["mcp-server-1"]),
    });
    expect(
      parseMcpBindingConfigDocument(JSON.stringify(document), {
        expectedDeviceId: "device-1",
        knownServerIds: new Set(["mcp-server-1"]),
      }).bindings,
    ).toEqual([binding()]);

    expect(() =>
      createMcpBindingConfigDocument({
        deviceId: "device-1",
        bindings: [{ ...binding(), serverIds: ["missing-server"] }],
        knownServerIds: new Set(["mcp-server-1"]),
      }),
    ).toThrow(/unknown MCP server/u);
  });

  it("accepts persisted target binding ids that contain absolute paths", () => {
    const persisted = {
      ...binding(),
      id: "codex:global:/Users/example/.codex/config.toml",
    };
    const document = createMcpBindingConfigDocument({
      deviceId: "device-1",
      bindings: [persisted],
      knownServerIds: new Set(["mcp-server-1"]),
    });

    expect(
      parseMcpBindingConfigDocument(JSON.stringify(document), {
        expectedDeviceId: "device-1",
        knownServerIds: new Set(["mcp-server-1"]),
      }).bindings,
    ).toEqual([persisted]);
    expect(() =>
      createMcpBindingConfigDocument({
        deviceId: "device-1",
        bindings: [{ ...persisted, id: "codex:global:/tmp/config.toml\n" }],
        knownServerIds: new Set(["mcp-server-1"]),
      }),
    ).toThrow(/binding id/u);
  });

  it("fails closed on missing secrets, hostile paths, and tampered payloads", async () => {
    const base = root();
    const serverBundle = path.join(base, "server");
    materializeMcpServerResourceBundle({
      bundlePath: serverBundle,
      server: server(),
    });
    const restored = readMcpServerResourceBundle(serverBundle);
    await expect(
      hydrateMcpServerResourceSecrets(restored, async () => null),
    ).rejects.toThrow(/missing MCP secret/u);

    expect(() =>
      createMcpBindingConfigDocument({
        deviceId: "device-1",
        bindings: [{ ...binding(), path: "../escape" }],
        knownServerIds: new Set(["mcp-server-1"]),
      }),
    ).toThrow(/target path/u);

    fs.appendFileSync(path.join(serverBundle, "server.json"), " ");
    expect(() => readMcpServerResourceBundle(serverBundle)).toThrow(
      /size mismatch/u,
    );
  });
});
