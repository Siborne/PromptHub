import fs from "node:fs";
import path from "node:path";

import type {
  McpLibraryFile,
  McpServerConfig,
} from "@prompthub/shared/types/mcp";

import {
  publishCanonicalEntries,
  recoverCanonicalEntryPublication,
  type CanonicalEntryMutation,
} from "./canonical-entry-publication";
import {
  createMcpBindingConfigDocument,
  hydrateMcpServerResourceSecretsSync,
  hydrateMcpServerVersionSecretsSync,
  materializeMcpServerResourceBundle,
  parseMcpBindingConfigDocument,
  readMcpServerResourceBundle,
  type ExtractedMcpSecret,
  type McpServerResourceVersionInput,
  type ReadMcpServerResourceResult,
} from "./mcp-resource-schema";
import { getConfigDir, getDataDir, getUserDataPath } from "./runtime-paths";

const OPERATION_KEY = "mcp-library";
const BINDING_FILE_NAME = "mcp-bindings.json";
const MAX_RESOURCES = 10_000;

export interface CanonicalMcpSecretStore {
  filePath: string;
  read(ref: string): string | null;
  prepareUpdate(
    stagePath: string,
    input: {
      secrets: readonly ExtractedMcpSecret[];
      retainRefs: ReadonlySet<string>;
    },
  ): void;
}

export interface CanonicalMcpLibraryOptions {
  deviceId?: string;
  secretStore?: CanonicalMcpSecretStore;
  injectPublicationFailure?: (targetPath: string) => void;
}

interface LoadedServer {
  bundlePath: string;
  resource: ReadMcpServerResourceResult;
  hydrated: McpServerConfig;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function bindingPath(): string {
  return path.join(getConfigDir(), "devices", BINDING_FILE_NAME);
}

function mcpRoot(): string {
  return path.join(getDataDir(), "mcp");
}

function assertId(value: string, label: string): void {
  if (
    !value ||
    Buffer.byteLength(value, "utf8") > 256 ||
    /[\u0000-\u001f\u007f/\\]/u.test(value)
  ) {
    throw new Error(`Canonical MCP ${label} is invalid`);
  }
}

function readDeviceId(
  explicit: string | undefined,
  required: boolean,
): string | null {
  const filePath = path.join(getConfigDir(), "devices", "renderer.json");
  let persisted: string | null = null;
  try {
    const stats = fs.lstatSync(filePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size > 1024 * 1024) {
      throw new Error("Canonical MCP device configuration is unsafe");
    }
    const value: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      typeof (value as Record<string, unknown>).selfHostedDeviceId !== "string"
    ) {
      throw new Error("Canonical MCP device configuration is invalid");
    }
    persisted = (value as Record<string, string>).selfHostedDeviceId;
    assertId(persisted, "device id");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (explicit) {
    assertId(explicit, "device id");
    if (persisted && persisted !== explicit) {
      throw new Error("Canonical MCP device identity mismatch");
    }
    return explicit;
  }
  if (!persisted && required) {
    throw new Error("Canonical MCP device identity is unavailable");
  }
  return persisted;
}

function listBundlePaths(): string[] {
  const root = mcpRoot();
  if (!fs.existsSync(root)) return [];
  const rootStats = fs.lstatSync(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Canonical MCP library path is unsafe");
  }
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const bundlePaths = entries.flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    if (entry.name === "market-sources.json") {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error("Canonical MCP market source registry path is unsafe");
      }
      return [];
    }
    assertId(entry.name, "resource path");
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error("Canonical MCP resource path is unsafe");
    }
    return [path.join(root, entry.name)];
  });
  if (bundlePaths.length > MAX_RESOURCES) {
    throw new Error("Canonical MCP resource limit exceeded");
  }
  return bundlePaths;
}

function hasSecretReferences(resource: ReadMcpServerResourceResult): boolean {
  return resource.versions.some(
    (version) =>
      Object.keys(version.secretReferences.env).length > 0 ||
      Object.keys(version.secretReferences.headers).length > 0,
  );
}

function requireSecretReader(
  resource: ReadMcpServerResourceResult,
  options: CanonicalMcpLibraryOptions,
): (ref: string) => string | null {
  if (!hasSecretReferences(resource)) return () => null;
  if (!options.secretStore) {
    throw new Error(
      "Canonical MCP credentials require the device-bound secret store",
    );
  }
  return (ref) => options.secretStore!.read(ref);
}

function loadServers(options: CanonicalMcpLibraryOptions): LoadedServer[] {
  return listBundlePaths()
    .map((bundlePath): LoadedServer => {
      const resource = readMcpServerResourceBundle(bundlePath);
      if (path.basename(bundlePath) !== resource.server.id) {
        throw new Error(
          "Canonical MCP bundle path does not match its server id",
        );
      }
      const readSecret = requireSecretReader(resource, options);
      return {
        bundlePath,
        resource,
        hydrated: hydrateMcpServerResourceSecretsSync(resource, readSecret),
      };
    })
    .sort((left, right) => left.hydrated.id.localeCompare(right.hydrated.id));
}

function readBindings(
  knownServerIds: ReadonlySet<string>,
  options: CanonicalMcpLibraryOptions,
): McpLibraryFile["bindings"] {
  const filePath = bindingPath();
  if (!fs.existsSync(filePath)) return [];
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error("Canonical MCP binding path is unsafe");
  }
  const deviceId = readDeviceId(options.deviceId, true)!;
  return parseMcpBindingConfigDocument(fs.readFileSync(filePath, "utf8"), {
    expectedDeviceId: deviceId,
    knownServerIds,
  }).bindings;
}

export function readCanonicalMcpLibrary(
  options: CanonicalMcpLibraryOptions = {},
): McpLibraryFile {
  recoverCanonicalEntryPublication(getUserDataPath(), OPERATION_KEY);
  const loaded = loadServers(options);
  const ids = new Set(loaded.map((entry) => entry.hydrated.id));
  const bindings = readBindings(ids, options);
  return {
    kind: "prompthub-mcp-library",
    version: 1,
    updatedAt: new Date(
      Math.max(
        0,
        ...loaded.map((entry) => entry.hydrated.updatedAt),
        ...bindings.map((binding) => binding.updatedAt),
      ),
    ).toISOString(),
    servers: loaded.map((entry) => entry.hydrated),
    bindings,
  };
}

function hydrateVersions(
  loaded: LoadedServer,
  options: CanonicalMcpLibraryOptions,
): McpServerResourceVersionInput[] {
  const readSecret = requireSecretReader(loaded.resource, options);
  return loaded.resource.versions.map((version) => ({
    version: version.version,
    server: hydrateMcpServerVersionSecretsSync(version, readSecret),
    createdAt: version.createdAt,
    ...(version.note === undefined ? {} : { note: version.note }),
    ...(version.restoredFromVersion === undefined
      ? {}
      : { restoredFromVersion: version.restoredFromVersion }),
  }));
}

function collectRefs(resource: ReadMcpServerResourceResult): string[] {
  return resource.versions.flatMap((version) => [
    ...Object.values(version.secretReferences.env),
    ...Object.values(version.secretReferences.headers),
  ]);
}

function writeJsonStage(stagePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(stagePath), { recursive: true, mode: 0o700 });
  const descriptor = fs.openSync(stagePath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function writeCanonicalMcpLibrary(
  library: McpLibraryFile,
  options: CanonicalMcpLibraryOptions = {},
): void {
  recoverCanonicalEntryPublication(getUserDataPath(), OPERATION_KEY);
  const loaded = loadServers(options);
  const previous = new Map(loaded.map((entry) => [entry.hydrated.id, entry]));
  const next = new Map<string, McpServerConfig>();
  for (const server of library.servers) {
    assertId(server.id, "server id");
    if (next.has(server.id))
      throw new Error("Canonical MCP server id is duplicate");
    next.set(server.id, server);
  }
  const deviceId = readDeviceId(options.deviceId, true)!;
  const mutations: CanonicalEntryMutation[] = [];
  const extractedSecrets: ExtractedMcpSecret[] = [];
  const retainedRefs = new Set<string>();

  for (const [id, server] of next) {
    const current = previous.get(id);
    if (current && stableJson(current.hydrated) === stableJson(server)) {
      for (const ref of collectRefs(current.resource)) retainedRefs.add(ref);
      continue;
    }
    const currentVersion = (current?.resource.currentVersion ?? 0) + 1;
    const versions = [
      ...(current ? hydrateVersions(current, options) : []),
      {
        version: currentVersion,
        server,
        createdAt: new Date(server.updatedAt).toISOString(),
      },
    ];
    mutations.push({
      targetPath: path.join(mcpRoot(), id),
      prepare(stagePath) {
        const result = materializeMcpServerResourceBundle({
          bundlePath: stagePath,
          server,
          currentVersion,
          versions,
          writePolicy: {
            mode: "create",
            revision: (current?.resource.bundleManifest.revision ?? 0) + 1,
          },
        });
        extractedSecrets.push(...result.extractedSecrets);
        for (const secret of result.extractedSecrets)
          retainedRefs.add(secret.ref);
      },
    });
  }
  for (const [id, current] of previous) {
    if (!next.has(id)) {
      mutations.push({ targetPath: current.bundlePath, delete: true });
    }
  }
  const bindingDocument = createMcpBindingConfigDocument({
    deviceId,
    bindings: library.bindings,
    knownServerIds: new Set(next.keys()),
  });
  mutations.push({
    targetPath: bindingPath(),
    prepare: (stagePath) => writeJsonStage(stagePath, bindingDocument),
  });
  const requiresSecretStore =
    loaded.some(({ resource }) => hasSecretReferences(resource)) ||
    [...next.values()].some(
      (server) =>
        Object.keys(server.env ?? {}).length > 0 ||
        Object.keys(server.headers ?? {}).length > 0,
    );
  if (options.secretStore) {
    const secretStore = options.secretStore;
    mutations.push({
      targetPath: path.resolve(secretStore.filePath),
      prepare(stagePath) {
        secretStore.prepareUpdate(stagePath, {
          secrets: extractedSecrets,
          retainRefs: retainedRefs,
        });
      },
    });
  } else if (requiresSecretStore) {
    throw new Error(
      "Canonical MCP credentials require the device-bound secret store",
    );
  }
  publishCanonicalEntries({
    rootPath: getUserDataPath(),
    operationKey: OPERATION_KEY,
    entries: mutations,
    injectFailure: options.injectPublicationFailure,
    verify() {
      const restored = readCanonicalMcpLibrary(options);
      if (
        stableJson(restored.servers) !==
          stableJson(
            [...next.values()].sort((left, right) =>
              left.id.localeCompare(right.id),
            ),
          ) ||
        stableJson(restored.bindings) !== stableJson(bindingDocument.bindings)
      ) {
        throw new Error("Canonical MCP publication verification failed");
      }
    },
  });
}
