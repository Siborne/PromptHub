import type {
  AgentAssetFilesSnapshot,
  AgentAssetStoreSourcesSnapshot,
  CustomStoreSourceSnapshot,
  StoreSourceSnapshot,
} from "@prompthub/shared/types";
import { redactMcpLibraryForTransport } from "@prompthub/shared/utils/mcp-config";

import type { DatabaseBackup } from "./database-backup-format";

const STORE_SOURCE_TARGETS = {
  skills: { key: "skill-store", selectedKey: "selectedStoreSourceId" },
  mcp: { key: "mcp-store", selectedKey: "selectedMarketSourceId" },
  plugins: { key: "plugin-store", selectedKey: "selectedMarketSourceId" },
} as const;

function normalizeSource(value: unknown): StoreSourceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const type = source.type;
  if (
    typeof source.id !== "string" ||
    typeof source.name !== "string" ||
    typeof source.url !== "string" ||
    ![
      "official",
      "community",
      "marketplace-json",
      "git-repo",
      "local-dir",
    ].includes(String(type))
  ) {
    return null;
  }
  return {
    id: source.id,
    name: source.name,
    type: type as StoreSourceSnapshot["type"],
    url: source.url,
    branch: typeof source.branch === "string" ? source.branch : undefined,
    directory:
      typeof source.directory === "string" ? source.directory : undefined,
    enabled: typeof source.enabled === "boolean" ? source.enabled : undefined,
    order: typeof source.order === "number" ? source.order : undefined,
    createdAt:
      typeof source.createdAt === "number" ? source.createdAt : undefined,
  };
}

function persistedState(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const envelope = parsed as Record<string, unknown>;
    const state =
      envelope.state &&
      typeof envelope.state === "object" &&
      !Array.isArray(envelope.state)
        ? (envelope.state as Record<string, unknown>)
        : {};
    return { envelope, state };
  } catch (error) {
    console.warn(`Failed to read persisted store ${key}:`, error);
    return null;
  }
}

function rendererSourceSnapshot(
  key: string,
  selectedKey: string,
): CustomStoreSourceSnapshot | undefined {
  const persisted = persistedState(key);
  if (!persisted) return undefined;
  const customStoreSources = Array.isArray(persisted.state.customStoreSources)
    ? persisted.state.customStoreSources
        .map(normalizeSource)
        .filter((source): source is StoreSourceSnapshot => Boolean(source))
    : [];
  const selectedSourceId =
    typeof persisted.state[selectedKey] === "string"
      ? persisted.state[selectedKey]
      : undefined;
  return customStoreSources.length > 0 || selectedSourceId
    ? { customStoreSources, selectedSourceId }
    : undefined;
}

export async function collectStoreSourcesSnapshot(): Promise<
  AgentAssetStoreSourcesSnapshot | undefined
> {
  const snapshot: AgentAssetStoreSourcesSnapshot = {};
  const api = window.api?.settings?.rendererPersistence;
  const canonical = api ? await api.get() : null;
  for (const [key, config] of Object.entries(STORE_SOURCE_TARGETS)) {
    const renderer = rendererSourceSnapshot(config.key, config.selectedKey);
    const domain =
      key === "skills" ? "skill" : key === "plugins" ? "plugin" : "mcp";
    const sources = Array.isArray(canonical?.marketplaceSources?.[domain])
      ? canonical.marketplaceSources[domain]
          .map(normalizeSource)
          .filter((source): source is StoreSourceSnapshot => Boolean(source))
      : renderer?.customStoreSources;
    if ((sources?.length ?? 0) > 0 || renderer?.selectedSourceId) {
      snapshot[key as keyof AgentAssetStoreSourcesSnapshot] = {
        customStoreSources: sources ?? [],
        selectedSourceId: renderer?.selectedSourceId,
      };
    }
  }
  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}

export async function collectAgentAssetFilesSnapshot(options: {
  mcp: boolean;
  plugins: boolean;
}): Promise<AgentAssetFilesSnapshot | undefined> {
  const [mcpFiles, pluginFiles] = await Promise.all([
    options.mcp
      ? (window.api?.mcp?.exportDataFiles?.() ?? Promise.resolve([]))
      : Promise.resolve([]),
    options.plugins
      ? (window.api?.plugin?.exportDataFiles?.() ?? Promise.resolve([]))
      : Promise.resolve([]),
  ]);
  const snapshot: AgentAssetFilesSnapshot = {};
  if (mcpFiles.length > 0) snapshot.mcp = mcpFiles;
  if (pluginFiles.length > 0) snapshot.plugins = pluginFiles;
  return Object.keys(snapshot).length > 0 ? snapshot : undefined;
}

export async function collectAgentManagementBackup(): Promise<
  DatabaseBackup["agentManagement"]
> {
  const handler = window.api?.agent?.exportManagementBackup;
  if (!handler) throw new Error("Agent management backup API is unavailable");
  return handler();
}

function restoreRendererSource(
  key: string,
  selectedKey: string,
  snapshot: CustomStoreSourceSnapshot | undefined,
  includeSources: boolean,
): void {
  if (!snapshot) return;
  try {
    const persisted = persistedState(key);
    localStorage.setItem(
      key,
      JSON.stringify({
        ...(persisted?.envelope ?? {}),
        state: {
          ...(persisted?.state ?? {}),
          ...(includeSources
            ? { customStoreSources: snapshot.customStoreSources }
            : {}),
          ...(snapshot.selectedSourceId
            ? { [selectedKey]: snapshot.selectedSourceId }
            : {}),
        },
      }),
    );
  } catch (error) {
    console.warn(`Failed to restore persisted store ${key}:`, error);
  }
}

export async function restoreStoreSourcesSnapshot(
  snapshot: AgentAssetStoreSourcesSnapshot | undefined,
): Promise<void> {
  if (!snapshot) return;
  const api = window.api?.settings?.rendererPersistence;
  if (api) {
    type SourceInput = Parameters<typeof api.replaceSources>[1];
    await Promise.all([
      api.replaceSources(
        "skill",
        (snapshot.skills?.customStoreSources ?? []) as SourceInput,
      ),
      api.replaceSources(
        "mcp",
        (snapshot.mcp?.customStoreSources ?? []) as SourceInput,
      ),
      api.replaceSources(
        "plugin",
        (snapshot.plugins?.customStoreSources ?? []) as SourceInput,
      ),
    ]);
  }
  for (const [key, config] of Object.entries(STORE_SOURCE_TARGETS)) {
    restoreRendererSource(
      config.key,
      config.selectedKey,
      snapshot[key as keyof AgentAssetStoreSourcesSnapshot],
      !api,
    );
  }
}

export async function collectMcpLibrary(): Promise<
  DatabaseBackup["mcpLibrary"]
> {
  const library = await window.api?.mcp?.getLibrary?.();
  return library ? redactMcpLibraryForTransport(library) : undefined;
}

export async function collectPluginSnapshot(
  includePackages = true,
): Promise<Pick<DatabaseBackup, "pluginLibrary" | "pluginPackages">> {
  if (!includePackages) {
    const library = await window.api?.plugin?.getLibrary?.();
    return library ? { pluginLibrary: library } : {};
  }
  const snapshot = await window.api?.plugin?.exportLibrarySnapshot?.();
  if (!snapshot?.library) return {};
  return {
    pluginLibrary: snapshot.library,
    pluginPackages: snapshot.packages?.length ? snapshot.packages : undefined,
  };
}
