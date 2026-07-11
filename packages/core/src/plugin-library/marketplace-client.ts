import path from "path";

import type {
  PluginInventorySummary,
  PluginMarketEntry,
  PluginMarketPreview,
  PluginMarketSource,
} from "@prompthub/shared/types/plugin";

import {
  CorePluginError,
  type FetchLike,
  type GitHubRepositoryRef,
  type RawRecord,
  normalizeRelativePosixPath,
  parseJsonObject,
  safePluginBrandColor,
  safeString,
  safeStringArray,
} from "./shared";
import {
  applyPreviewCacheToEntry,
  buildGitHubTreeUrl,
  buildRawPluginFileUrl,
  extractGitHubTreePaths,
  extractPluginInventoryFromManifest,
  getMarketplaceDisplayName,
  isSkillFileUnderDirectory,
  looksLikeDirectoryManifestPath,
  manifestFieldStrings,
  normalizeMarketEntry,
  parseGitHubRepositoryRef,
  readLocalPromptHubMarketplace,
  resolveManifestAssetUrl,
} from "./marketplace";
import {
  classifyPluginInventory,
  getPluginSemanticUnsupportedReason,
  normalizeAuthor,
} from "./normalization";
import { PluginLibraryStorage } from "./storage";

interface PluginMarketplaceClientOptions {
  fetchFn?: FetchLike;
  marketSources: PluginMarketSource[];
  storage: PluginLibraryStorage;
}

function unavailableFetch(): Promise<never> {
  throw new CorePluginError("FETCH_UNAVAILABLE", "当前运行环境不支持 fetch");
}

function findMarketSource(
  entry: PluginMarketEntry,
  sources: PluginMarketSource[],
): PluginMarketSource {
  const source = sources.find((item) => item.id === entry.marketplaceId);
  if (!source) {
    throw new CorePluginError(
      "MISSING_SOURCE",
      `${entry.displayName} 的 marketplace source 不存在`,
    );
  }
  return source;
}

function getInterfaceRecord(manifest: RawRecord): RawRecord {
  return manifest.interface && typeof manifest.interface === "object"
    ? (manifest.interface as RawRecord)
    : {};
}

function enrichMarketEntry(
  entry: PluginMarketEntry,
  manifest: RawRecord,
  inventory: PluginInventorySummary,
  source: PluginMarketSource,
): PluginMarketEntry {
  const interfaceRecord = getInterfaceRecord(manifest);
  const name = safeString(manifest.name) ?? entry.name;
  const displayName =
    safeString(interfaceRecord.displayName) ||
    safeString(manifest.displayName) ||
    entry.displayName ||
    name;
  const description =
    safeString(interfaceRecord.shortDescription) ||
    safeString(manifest.description) ||
    entry.description ||
    safeString(interfaceRecord.longDescription);
  const logoUrl =
    resolveManifestAssetUrl(source, entry, interfaceRecord.logo) ??
    entry.logoUrl;
  const iconUrl =
    resolveManifestAssetUrl(source, entry, interfaceRecord.composerIcon) ||
    resolveManifestAssetUrl(source, entry, interfaceRecord.icon) ||
    entry.iconUrl ||
    logoUrl;
  return {
    ...entry,
    name,
    displayName,
    description,
    iconUrl,
    logoUrl,
    brandColor:
      safePluginBrandColor(interfaceRecord.brandColor) ?? entry.brandColor,
    version: safeString(manifest.version) ?? entry.version,
    author: normalizeAuthor(manifest.author) ?? entry.author,
    category: entry.category ?? safeString(interfaceRecord.category),
    inventory,
    classification: classifyPluginInventory(inventory),
  };
}

function createMarketPreview(
  entry: PluginMarketEntry,
  manifest: RawRecord,
  manifestUrl: string,
): PluginMarketPreview {
  const interfaceRecord = getInterfaceRecord(manifest);
  return {
    entry,
    displayName: entry.displayName,
    description: entry.description,
    longDescription: safeString(interfaceRecord.longDescription),
    iconUrl: entry.iconUrl,
    logoUrl: entry.logoUrl,
    brandColor: entry.brandColor,
    version: entry.version,
    author: entry.author,
    category: entry.category,
    inventory: entry.inventory ?? extractPluginInventoryFromManifest(manifest),
    classification:
      entry.classification ??
      classifyPluginInventory(extractPluginInventoryFromManifest(manifest)),
    tags: safeStringArray(manifest.keywords),
    homepage:
      safeString(manifest.homepage) || safeString(interfaceRecord.websiteURL),
    repository: safeString(manifest.repository) || entry.source.repository,
    codexDetailUrl: entry.codexDetailUrl,
    manifestUrl,
    canInstall: entry.classification === "bundle",
    unsupportedReason: getPluginSemanticUnsupportedReason(
      entry.classification ?? "invalid",
    ),
    warnings: [],
  };
}

export class PluginMarketplaceClient {
  private fetchFn: FetchLike;
  private githubTreePathCache = new Map<string, Promise<string[]>>();
  private marketSources: PluginMarketSource[];
  private storage: PluginLibraryStorage;

  constructor(options: PluginMarketplaceClientOptions) {
    this.fetchFn =
      options.fetchFn ??
      (globalThis.fetch as unknown as FetchLike | undefined) ??
      unavailableFetch;
    this.marketSources = options.marketSources;
    this.storage = options.storage;
  }

  getMarketSources(sources?: PluginMarketSource[]): PluginMarketSource[] {
    return [...(sources ?? this.marketSources)];
  }

  async getMarketEntries(
    sources = this.marketSources,
  ): Promise<PluginMarketEntry[]> {
    const entries: PluginMarketEntry[] = [];
    for (const source of sources) {
      try {
        entries.push(...(await this.readMarketplace(source)));
      } catch (error) {
        console.warn(
          `[plugin-library] Failed to read marketplace ${source.id}:`,
          error,
        );
      }
    }
    return entries;
  }

  async previewMarketPlugin(
    entryId: string,
    sources = this.marketSources,
  ): Promise<PluginMarketPreview> {
    const entries = await this.getMarketEntries(sources);
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) {
      throw new CorePluginError(
        "NOT_FOUND",
        `Plugin 商店条目不存在: ${entryId}`,
      );
    }
    const preview = await this.buildPreviewForEntry(entry, sources);
    this.storage.writeMarketPreviewCache(preview);
    return preview;
  }

  async buildPreviewForEntry(
    entry: PluginMarketEntry,
    sources = this.marketSources,
  ): Promise<PluginMarketPreview> {
    const manifestUrl = this.getManifestUrlForEntry(entry, sources);
    const manifest = await this.readManifest(manifestUrl, entry.displayName);
    const source = findMarketSource(entry, sources);
    const inventory = await this.resolveInventory(entry, manifest, source);
    const enriched = enrichMarketEntry(entry, manifest, inventory, source);
    return createMarketPreview(enriched, manifest, manifestUrl);
  }

  private async resolveInventory(
    entry: PluginMarketEntry,
    manifest: RawRecord,
    source: PluginMarketSource,
  ): Promise<PluginInventorySummary> {
    const inventory = extractPluginInventoryFromManifest(manifest);
    const expandedSkills = await this.resolveDirectorySkillCount(
      entry,
      manifest,
      source,
    );
    if (expandedSkills !== undefined) {
      inventory.skills = expandedSkills;
    }
    return inventory;
  }

  private async resolveDirectorySkillCount(
    entry: PluginMarketEntry,
    manifest: RawRecord,
    source: PluginMarketSource,
  ): Promise<number | undefined> {
    const skillPaths = manifestFieldStrings(manifest.skills);
    if (!skillPaths.some(looksLikeDirectoryManifestPath)) {
      return undefined;
    }
    let total = 0;
    let expanded = false;
    for (const skillPath of skillPaths) {
      if (!looksLikeDirectoryManifestPath(skillPath)) {
        total += 1;
        continue;
      }
      const count = await this.countRepositorySkillFiles(
        entry,
        source,
        skillPath,
      );
      if (count === undefined) {
        return undefined;
      }
      total += count;
      expanded = true;
    }
    return expanded && total > 0 ? total : undefined;
  }

  private async countRepositorySkillFiles(
    entry: PluginMarketEntry,
    source: PluginMarketSource,
    rawSkillPath: string,
  ): Promise<number | undefined> {
    if (!entry.source.packagePath) {
      return undefined;
    }
    const repositoryRef = parseGitHubRepositoryRef(
      source.repository,
      source.rawJsonUrl,
    );
    if (!repositoryRef) {
      return undefined;
    }
    try {
      const packagePath = normalizeRelativePosixPath(entry.source.packagePath);
      const skillPath = normalizeRelativePosixPath(rawSkillPath);
      const skillDirectory = normalizeRelativePosixPath(
        path.posix.join(packagePath, skillPath),
      );
      const treePaths = await this.getGitHubTreePaths(repositoryRef);
      return treePaths.filter((treePath) =>
        isSkillFileUnderDirectory(treePath, skillDirectory),
      ).length;
    } catch {
      return undefined;
    }
  }

  private async getGitHubTreePaths(
    repositoryRef: GitHubRepositoryRef,
  ): Promise<string[]> {
    const treeUrl = buildGitHubTreeUrl(repositoryRef);
    const cached = this.githubTreePathCache.get(treeUrl);
    if (cached) {
      return cached;
    }
    const pending = this.fetchText(treeUrl)
      .then((content) =>
        extractGitHubTreePaths(parseJsonObject(content, "GitHub tree")),
      )
      .catch((error) => {
        this.githubTreePathCache.delete(treeUrl);
        throw error;
      });
    this.githubTreePathCache.set(treeUrl, pending);
    return pending;
  }

  private async readMarketplace(
    source: PluginMarketSource,
  ): Promise<PluginMarketEntry[]> {
    const local = readLocalPromptHubMarketplace(source);
    const content = local ?? (await this.fetchText(source.rawJsonUrl));
    const marketplace = parseJsonObject(
      content,
      `${source.displayName} market`,
    );
    const displayName = getMarketplaceDisplayName(marketplace, source);
    const plugins = Array.isArray(marketplace.plugins)
      ? marketplace.plugins
      : [];
    const cache = this.storage.readMarketCache();
    return plugins
      .map((plugin) => normalizeMarketEntry(plugin, source, displayName))
      .filter((plugin): plugin is PluginMarketEntry => plugin !== null)
      .map((entry) => applyPreviewCacheToEntry(entry, cache.entries[entry.id]));
  }

  private getManifestUrlForEntry(
    entry: PluginMarketEntry,
    sources: PluginMarketSource[],
  ): string {
    if (!entry.source.manifestPath) {
      throw new CorePluginError(
        "MISSING_MANIFEST",
        `${entry.displayName} 没有可定位的 Plugin manifest`,
      );
    }
    const source = findMarketSource(entry, sources);
    return buildRawPluginFileUrl(source, entry.source.manifestPath);
  }

  private async readManifest(
    manifestUrl: string,
    displayName: string,
  ): Promise<RawRecord> {
    const content = await this.fetchText(manifestUrl);
    return parseJsonObject(content, `${displayName} manifest`);
  }

  private async fetchText(url: string): Promise<string> {
    const response = await this.fetchFn(url, {
      headers: { Accept: "application/json,text/plain,*/*" },
    });
    if (!response.ok) {
      throw new CorePluginError(
        "FETCH_FAILED",
        `读取 Plugin 资源失败 (${response.status} ${response.statusText}): ${url}`,
      );
    }
    return response.text();
  }
}
