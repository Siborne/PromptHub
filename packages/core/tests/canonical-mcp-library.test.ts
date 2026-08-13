import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  McpLibraryFile,
  McpServerConfig,
} from "@prompthub/shared/types/mcp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readCanonicalMcpLibrary,
  type CanonicalMcpSecretStore,
  writeCanonicalMcpLibrary,
} from "../src/canonical-mcp-library";
import { CoreMcpLibraryService } from "../src/mcp-library";
import { readMcpServerResourceBundle } from "../src/mcp-resource-schema";
import { configureRuntimePaths, resetRuntimePaths } from "../src/runtime-paths";
import {
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "../src";

function server(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: "server-1",
    name: "github",
    displayName: "GitHub",
    transport: "streamable-http",
    url: "https://mcp.example.test/api",
    env: { TOKEN: "secret-value" },
    enabled: true,
    source: { type: "manual" },
    createdAt: Date.parse("2026-08-12T00:00:00.000Z"),
    updatedAt: Date.parse("2026-08-12T00:00:00.000Z"),
    ...overrides,
  };
}

function library(servers: McpServerConfig[]): McpLibraryFile {
  return {
    kind: "prompthub-mcp-library",
    version: 1,
    updatedAt: "2026-08-12T00:00:00.000Z",
    servers,
    bindings: [],
  };
}

describe("canonical MCP library", () => {
  let root: string;
  let secretStore: CanonicalMcpSecretStore;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-canonical-mcp-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "b".repeat(64),
      operationId: "canonical-mcp-test",
    });
    const rendererPath = path.join(root, "config", "devices", "renderer.json");
    fs.mkdirSync(path.dirname(rendererPath), { recursive: true });
    fs.writeFileSync(
      rendererPath,
      JSON.stringify({ selfHostedDeviceId: "device-1" }),
    );
    const filePath = path.join(root, "secrets", "mcp-resource-secrets.json");
    secretStore = {
      filePath,
      read(ref) {
        if (!fs.existsSync(filePath)) return null;
        return (
          (
            JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
              string,
              string
            >
          )[ref] ?? null
        );
      },
      prepareUpdate(stagePath, input) {
        const current = fs.existsSync(filePath)
          ? (JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
              string,
              string
            >)
          : {};
        const next = Object.fromEntries(
          Object.entries(current).filter(([ref]) => input.retainRefs.has(ref)),
        );
        for (const secret of input.secrets) next[secret.ref] = secret.value;
        fs.mkdirSync(path.dirname(stagePath), { recursive: true });
        fs.writeFileSync(stagePath, JSON.stringify(next));
      },
    };
  });

  afterEach(() => {
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("creates, versions, reloads, and deletes server bundles with secrets", () => {
    writeCanonicalMcpLibrary(library([server()]), { secretStore });

    expect(readCanonicalMcpLibrary({ secretStore }).servers).toEqual([
      server(),
    ]);
    const bundlePath = path.join(root, "data", "mcp", "server-1");
    expect(readMcpServerResourceBundle(bundlePath).currentVersion).toBe(1);
    expect(
      fs.readFileSync(path.join(bundlePath, "server.json"), "utf8"),
    ).not.toContain("secret-value");

    const updated = server({
      displayName: "GitHub Cloud",
      updatedAt: Date.parse("2026-08-12T01:00:00.000Z"),
    });
    writeCanonicalMcpLibrary(library([updated]), { secretStore });
    const versioned = readMcpServerResourceBundle(bundlePath);
    expect(versioned.currentVersion).toBe(2);
    expect(versioned.bundleManifest.revision).toBe(2);
    expect(versioned.versions).toHaveLength(2);
    expect(readCanonicalMcpLibrary({ secretStore }).servers).toEqual([updated]);

    writeCanonicalMcpLibrary(library([]), { secretStore });
    expect(readCanonicalMcpLibrary({ secretStore }).servers).toEqual([]);
    expect(fs.existsSync(bundlePath)).toBe(false);
    expect(JSON.parse(fs.readFileSync(secretStore.filePath, "utf8"))).toEqual(
      {},
    );
  });

  it("rolls back bundles, binding config, and secrets together", () => {
    writeCanonicalMcpLibrary(library([server()]), { secretStore });
    const beforeSecret = fs.readFileSync(secretStore.filePath, "utf8");
    const updated = server({
      env: { TOKEN: "new-secret" },
      updatedAt: Date.parse("2026-08-12T02:00:00.000Z"),
    });

    expect(() =>
      writeCanonicalMcpLibrary(library([updated]), {
        secretStore,
        injectPublicationFailure(targetPath) {
          if (targetPath === secretStore.filePath) throw new Error("disk full");
        },
      }),
    ).toThrow("disk full");

    expect(readCanonicalMcpLibrary({ secretStore }).servers).toEqual([
      server(),
    ]);
    expect(fs.readFileSync(secretStore.filePath, "utf8")).toBe(beforeSecret);
    expect(
      readMcpServerResourceBundle(path.join(root, "data", "mcp", "server-1"))
        .currentVersion,
    ).toBe(1);
  });

  it("fails closed when canonical credentials have no device secret adapter", () => {
    expect(() => writeCanonicalMcpLibrary(library([server()]))).toThrow(
      /device-bound secret store/u,
    );
    expect(fs.existsSync(path.join(root, "data", "mcp", "server-1"))).toBe(
      false,
    );
  });

  it("routes the production MCP service through canonical authority", () => {
    const service = new CoreMcpLibraryService({ secretStore });
    const created = service.createServer({
      name: "filesystem",
      displayName: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["server-filesystem"],
      enabled: true,
      source: { type: "manual" },
    });

    expect(service.read().servers[0]).toMatchObject({
      id: created.id,
      name: "filesystem",
    });
    expect(
      fs.existsSync(path.join(root, "data", "mcp", created.id, "server.json")),
    ).toBe(true);
    expect(fs.existsSync(path.join(root, "data", "mcp", "library.json"))).toBe(
      false,
    );
  });

  it("coexists with the independently managed MCP market source registry", () => {
    const registryPath = path.join(
      root,
      "data",
      "mcp",
      "market-sources.json",
    );
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(
      registryPath,
      `${JSON.stringify({ kind: "prompthub-mcp-market-sources", version: 1 })}\n`,
      "utf8",
    );

    expect(readCanonicalMcpLibrary({ secretStore }).servers).toEqual([]);

    fs.rmSync(registryPath);
    fs.mkdirSync(registryPath);
    expect(() => readCanonicalMcpLibrary({ secretStore })).toThrow(
      /Canonical MCP market source registry path is unsafe/u,
    );
  });
});
