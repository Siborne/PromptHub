import fs from "fs";
import path from "path";

import type {
  PluginDeleteOptions,
  PluginDistributeRequest,
  PluginDistributeResult,
  PluginImportLocalRequest,
  PluginImportSourceRequest,
  PluginInstallResult,
  PluginInventorySummary,
  PluginLibrarySnapshot,
  PluginLibraryEntry,
  PluginLibraryFile,
  PluginMarketEntry,
  PluginMarketPreview,
  PluginMarketSource,
  PluginMetadataUpdate,
  PluginPackageHealthCheck,
  PluginPackageSource,
  PluginSemanticClassification,
  PluginSourceUpdateCheck,
  PluginSourceUpdateResult,
  PluginTargetCompatibility,
  PluginUndistributeRequest,
  PluginUndistributeResult,
  PluginVersion,
  PluginVersionFile,
  PluginVersionRollbackResult,
} from "@prompthub/shared/types/plugin";

import {
  CorePluginError,
  type CorePluginLibraryServiceOptions,
  type FetchLike,
  type MaterializedPluginPackage,
  type MaterializedPluginSourcePackage,
  type NormalizedPluginSourceRequest,
  type PackageMaterializer,
  type PluginMarketCacheFile,
  type PluginTargetPathResolver,
  type RawRecord,
  type SourcePackageMaterializer,
  type GitHubRepositoryRef,
  createPluginId,
  getManagedPluginsDir,
  getPluginLibraryFilePath,
  getPluginLocalPackagePath,
  isGitTransportSourceKind,
  normalizeRelativePosixPath,
  nowIso,
  nowMs,
  parseJsonObject,
  safePluginBrandColor,
  safeString,
  safeStringArray,
  writeJsonFileAtomic,
} from "./shared";
import {
  BUILTIN_PLUGIN_MARKET_SOURCES,
  applyPreviewCacheToEntry,
  buildGitHubTreeUrl,
  buildRawPluginFileUrl,
  extractPluginInventoryFromManifest,
  extractGitHubTreePaths,
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
  assertBundlePlugin,
  classifyPluginInventory,
  getPluginSemanticUnsupportedReason,
  normalizeAuthor,
} from "./normalization";
import {
  checkInstalledPluginPackage,
  extractLocalPluginInventory,
  findLocalPluginMarker,
  readLocalPluginManifest,
  validateLocalPluginPackage,
} from "./package-validation";
import {
  buildUpdatedPluginFromPreview,
  computePluginEntryManifestFingerprint,
  computePluginPackageFingerprint,
  computePluginPreviewFingerprint,
  copyPluginPackageToManagedPath,
  getPluginUpdateStatus,
  materializeGitPackage,
  materializeGitSourcePackage,
  normalizePluginSourceImportRequest,
} from "./package-materialization";
import {
  assertReadableDirectory,
  deleteDistributedPluginTargets,
  distributePlugin,
  getPluginTargetMatrix,
  removePluginDistribution,
} from "./distribution";
import { PluginLibraryStorage } from "./storage";
import { PluginMarketplaceClient } from "./marketplace-client";
import {
  attachMarketSourcePackageHash,
  getPluginPackageUpdateSignals,
} from "./source-reconciliation";

interface InstalledPluginOptions {
  id: string;
  materialized?: MaterializedPluginPackage;
  preview: PluginMarketPreview;
  repository?: string;
  source: PluginPackageSource;
  trustLevel: PluginLibraryEntry["trustLevel"];
}

interface ScannedLocalPlugin {
  classification: PluginSemanticClassification;
  inventory: PluginInventorySummary;
  manifest: RawRecord;
  name: string;
  sourcePath: string;
}

function scanLocalPluginPackage(
  request: PluginImportLocalRequest,
): ScannedLocalPlugin {
  const sourcePath = path.resolve(request.sourcePath);
  assertReadableDirectory(sourcePath, "Agent Plugin package");
  const markerPath = findLocalPluginMarker(sourcePath);
  if (!markerPath) {
    throw new CorePluginError(
      "MISSING_MANIFEST",
      `没有找到可识别的 Plugin manifest: ${sourcePath}`,
    );
  }
  const { manifest } = readLocalPluginManifest(markerPath);
  validateLocalPluginPackage(sourcePath, manifest);
  const inventory = extractLocalPluginInventory(
    sourcePath,
    manifest,
    markerPath,
  );
  const classification = classifyPluginInventory(inventory);
  const name = safeString(manifest.name) ?? path.basename(sourcePath);
  assertBundlePlugin(classification, name);
  return { classification, inventory, manifest, name, sourcePath };
}

function buildInstalledPlugin(
  options: InstalledPluginOptions,
): PluginLibraryEntry {
  const { materialized, preview } = options;
  const timestamp = nowMs();
  return {
    id: options.id,
    name: preview.entry.name,
    displayName: preview.displayName,
    description: preview.description,
    longDescription: preview.longDescription,
    iconUrl: preview.iconUrl,
    logoUrl: preview.logoUrl,
    brandColor: preview.brandColor,
    version: preview.version,
    author: preview.author,
    category: preview.category,
    trustLevel: options.trustLevel,
    inventory: preview.inventory,
    classification: preview.classification,
    source: options.source,
    tags: preview.tags,
    homepage: preview.homepage,
    repository: options.repository ?? preview.repository,
    distributedTargetIds: [],
    managedPath: materialized?.managedPath,
    localRepositoryPath: materialized?.localRepositoryPath,
    localPackagePath: materialized?.localPackagePath,
    installedManifestHash: computePluginPreviewFingerprint(preview),
    installedPackageHash: computePluginPackageFingerprint(
      materialized?.localPackagePath,
    ),
    installedAt: timestamp,
    updatedAt: timestamp,
  };
}

function persistInstalledPlugin(
  library: PluginLibraryFile,
  plugin: PluginLibraryEntry,
  warnings: string[],
): PluginInstallResult {
  const nextLibrary: PluginLibraryFile = {
    ...library,
    updatedAt: nowIso(),
    plugins: [...library.plugins, plugin],
  };
  try {
    writeJsonFileAtomic(getPluginLibraryFilePath(), nextLibrary);
  } catch (error) {
    if (plugin.managedPath) {
      fs.rmSync(plugin.managedPath, { recursive: true, force: true });
    }
    throw error;
  }
  return { plugin, library: nextLibrary, warnings };
}

function assertPluginIsNew(
  library: PluginLibraryFile,
  displayName: string,
  matches: (plugin: PluginLibraryEntry) => boolean,
  action = "导入",
): void {
  if (library.plugins.some(matches)) {
    throw new CorePluginError(
      "DUPLICATE_PLUGIN",
      `Plugin 已${action}: ${displayName}`,
    );
  }
}

function getSkippedSourceUpdate(
  check: PluginSourceUpdateCheck,
  library: PluginLibraryFile,
  overwriteLocalChanges: boolean,
): PluginSourceUpdateResult | undefined {
  if (!check.plugin || !check.preview) {
    return { status: "not-installed", library, check };
  }
  if (check.status === "up-to-date") {
    return {
      status: "up-to-date",
      plugin: check.plugin,
      library,
      check,
    };
  }
  if (
    (check.status === "local-modified" || check.status === "conflict") &&
    !overwriteLocalChanges
  ) {
    return { status: check.status, library, check };
  }
  return undefined;
}

function persistSourceUpdate(
  library: PluginLibraryFile,
  previousPlugin: PluginLibraryEntry,
  plugin: PluginLibraryEntry,
  materialized: MaterializedPluginPackage | undefined,
  check: PluginSourceUpdateCheck,
): PluginSourceUpdateResult {
  const nextLibrary: PluginLibraryFile = {
    ...library,
    updatedAt: nowIso(),
    plugins: library.plugins.map((entry) =>
      entry.id === plugin.id ? plugin : entry,
    ),
  };
  try {
    writeJsonFileAtomic(getPluginLibraryFilePath(), nextLibrary);
  } catch (error) {
    if (
      materialized?.managedPath &&
      materialized.managedPath !== previousPlugin.managedPath
    ) {
      fs.rmSync(materialized.managedPath, { recursive: true, force: true });
    }
    throw error;
  }
  return {
    status: "updated",
    plugin,
    library: nextLibrary,
    check,
    warnings: check.preview?.warnings ?? [],
  };
}

function buildPackageSourceEntry(
  sourcePath: string,
  manifest: RawRecord,
  inventory: PluginInventorySummary,
  classification: PluginSemanticClassification,
  source: PluginPackageSource & { marketplaceId: string },
): PluginMarketEntry {
  const { marketplaceId, ...entrySource } = source;
  const interfaceRecord =
    manifest.interface && typeof manifest.interface === "object"
      ? (manifest.interface as RawRecord)
      : {};
  const name = safeString(manifest.name) ?? path.basename(sourcePath);
  const displayName =
    safeString(interfaceRecord.displayName) ||
    safeString(manifest.displayName) ||
    name;
  return {
    id: createPluginId(marketplaceId, name),
    marketplaceId,
    name,
    displayName,
    description:
      safeString(interfaceRecord.shortDescription) ||
      safeString(manifest.description) ||
      safeString(interfaceRecord.longDescription),
    iconUrl: safeString(interfaceRecord.composerIcon),
    logoUrl: safeString(interfaceRecord.logo),
    brandColor: safePluginBrandColor(interfaceRecord.brandColor),
    version: safeString(manifest.version),
    author: normalizeAuthor(manifest.author),
    category: safeString(interfaceRecord.category),
    trustLevel: "custom",
    source: entrySource,
    inventory,
    classification,
  };
}

function buildPackageSourcePreview(
  sourcePath: string,
  manifest: RawRecord,
  inventory: PluginInventorySummary,
  classification: PluginSemanticClassification,
  source: PluginPackageSource & { marketplaceId: string },
): PluginMarketPreview {
  const entry = buildPackageSourceEntry(
    sourcePath,
    manifest,
    inventory,
    classification,
    source,
  );
  const interfaceRecord =
    manifest.interface && typeof manifest.interface === "object"
      ? (manifest.interface as RawRecord)
      : {};
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
    inventory,
    classification,
    tags: safeStringArray(manifest.keywords),
    homepage:
      safeString(manifest.homepage) || safeString(interfaceRecord.websiteURL),
    repository: safeString(manifest.repository) || source.repository,
    sourcePackageHash: computePluginPackageFingerprint(sourcePath),
    canInstall: classification === "bundle",
    unsupportedReason: getPluginSemanticUnsupportedReason(classification),
    warnings: [],
  };
}

export class CorePluginLibraryService {
  private marketSources: PluginMarketSource[];
  private materializePackages: boolean;
  private materializePackageFn: PackageMaterializer;
  private materializeSourcePackageFn: SourcePackageMaterializer;
  private resolvePluginTargetPath?: PluginTargetPathResolver;
  private marketplace: PluginMarketplaceClient;
  private storage = new PluginLibraryStorage();

  constructor(options: CorePluginLibraryServiceOptions = {}) {
    this.marketSources = options.marketSources ?? BUILTIN_PLUGIN_MARKET_SOURCES;
    this.marketplace = new PluginMarketplaceClient({
      fetchFn: options.fetchFn,
      marketSources: this.marketSources,
      storage: this.storage,
    });
    this.materializePackages = options.materializePackages ?? false;
    this.materializePackageFn =
      options.materializePackageFn ?? materializeGitPackage;
    this.materializeSourcePackageFn =
      options.materializeSourcePackageFn ?? materializeGitSourcePackage;
    this.resolvePluginTargetPath = options.resolvePluginTargetPath;
  }

  read(): PluginLibraryFile {
    return this.storage.read();
  }

  write(library: PluginLibraryFile): PluginLibraryFile {
    return this.storage.write(library);
  }

  readVersions(): PluginVersionFile {
    return this.storage.readVersions();
  }

  writeVersions(versionsFile: PluginVersionFile): PluginVersionFile {
    return this.storage.writeVersions(versionsFile);
  }

  getPluginVersions(pluginId: string): PluginVersion[] {
    return this.storage.getPluginVersions(pluginId);
  }

  createPluginVersion(pluginId: string, note?: string): PluginVersion {
    return this.storage.createPluginVersion(pluginId, note);
  }

  rollbackPluginVersion(
    pluginId: string,
    version: number,
  ): PluginVersionRollbackResult | null {
    return this.storage.rollbackPluginVersion(pluginId, version);
  }

  deletePluginVersion(pluginId: string, versionId: string): boolean {
    return this.storage.deletePluginVersion(pluginId, versionId);
  }

  exportSnapshot(): PluginLibrarySnapshot {
    return this.storage.exportSnapshot();
  }

  restoreSnapshot(snapshot: PluginLibrarySnapshot): PluginLibraryFile {
    return this.storage.restoreSnapshot(snapshot);
  }

  readMarketCache(): PluginMarketCacheFile {
    return this.storage.readMarketCache();
  }

  getMarketSources(sources?: PluginMarketSource[]): PluginMarketSource[] {
    return this.marketplace.getMarketSources(sources);
  }

  getTargetMatrix(): PluginTargetCompatibility[] {
    return getPluginTargetMatrix();
  }

  getMarketEntries(sources = this.marketSources): Promise<PluginMarketEntry[]> {
    return this.marketplace.getMarketEntries(sources);
  }

  previewMarketPlugin(
    entryId: string,
    sources = this.marketSources,
  ): Promise<PluginMarketPreview> {
    return this.marketplace.previewMarketPlugin(entryId, sources);
  }

  async installMarketPlugin(
    entryId: string,
    sources = this.marketSources,
  ): Promise<PluginInstallResult> {
    const preview = await this.previewMarketPlugin(entryId, sources);
    assertBundlePlugin(preview.classification, preview.entry.displayName);
    const id = createPluginId(preview.entry.marketplaceId, preview.entry.name);
    const library = this.read();
    assertPluginIsNew(
      library,
      preview.entry.displayName,
      (plugin) => plugin.id === id,
      "安装",
    );
    const materialized = this.materializePackages
      ? await this.materializePackageFn(preview.entry, id)
      : undefined;
    const source: PluginPackageSource = {
      ...preview.entry.source,
      localRepositoryPath: materialized?.localRepositoryPath,
      localPackagePath: materialized?.localPackagePath,
    };
    const plugin = buildInstalledPlugin({
      id,
      materialized,
      preview,
      source,
      trustLevel: preview.entry.trustLevel,
    });
    return persistInstalledPlugin(library, plugin, preview.warnings);
  }

  async importSourcePlugin(
    request: PluginImportSourceRequest,
  ): Promise<PluginInstallResult> {
    const sourceRequest = normalizePluginSourceImportRequest(request);
    const sourcePackage = await this.materializeSourcePackageFn(sourceRequest);
    try {
      const preview = this.buildPreviewForMaterializedSourcePackage(
        sourceRequest,
        sourcePackage,
      );
      assertBundlePlugin(preview.classification, preview.entry.name);
      const id = createPluginId(sourceRequest.sourceId, preview.entry.name);
      const library = this.read();
      assertPluginIsNew(
        library,
        preview.entry.name,
        (plugin) =>
          plugin.id === id ||
          (plugin.source.url === sourceRequest.url &&
            plugin.source.packagePath === sourceRequest.packagePath &&
            plugin.source.branch === sourceRequest.branch),
      );
      const materialized = copyPluginPackageToManagedPath(
        sourcePackage.sourcePath,
        id,
      );
      const source: PluginPackageSource = {
        ...preview.entry.source,
        localPackagePath: materialized.localPackagePath,
        localRepositoryPath: materialized.localRepositoryPath,
      };
      const plugin = buildInstalledPlugin({
        id,
        materialized,
        preview,
        repository: preview.repository || sourceRequest.url,
        source,
        trustLevel: "custom",
      });
      return persistInstalledPlugin(library, plugin, preview.warnings);
    } finally {
      if (sourcePackage.cleanupPath) {
        fs.rmSync(sourcePackage.cleanupPath, { recursive: true, force: true });
      }
    }
  }

  async previewSourcePlugin(
    request: PluginImportSourceRequest,
  ): Promise<PluginMarketPreview> {
    const sourceRequest = normalizePluginSourceImportRequest(request);
    const sourcePackage = await this.materializeSourcePackageFn(sourceRequest);
    try {
      return this.buildPreviewForMaterializedSourcePackage(
        sourceRequest,
        sourcePackage,
      );
    } finally {
      if (sourcePackage.cleanupPath) {
        fs.rmSync(sourcePackage.cleanupPath, { recursive: true, force: true });
      }
    }
  }

  importLocalPluginPackage(
    request: PluginImportLocalRequest,
  ): PluginInstallResult {
    const scanned = scanLocalPluginPackage(request);
    const sourceTargetId = request.sourceTargetId?.trim() || "agent";
    const id = createPluginId(`agent-${sourceTargetId}`, scanned.name);
    const library = this.read();
    assertPluginIsNew(
      library,
      scanned.name,
      (plugin) => plugin.id === id || plugin.source.url === scanned.sourcePath,
    );
    const preview = this.buildPreviewForLocalPackage(
      scanned.sourcePath,
      scanned.manifest,
      scanned.inventory,
      scanned.classification,
      sourceTargetId,
      request.sourceTargetName,
    );
    const materialized = copyPluginPackageToManagedPath(scanned.sourcePath, id);
    const plugin = buildInstalledPlugin({
      id,
      materialized,
      preview,
      source: {
        kind: "local",
        sourceId: sourceTargetId,
        label: request.sourceTargetName,
        localPackagePath: materialized.localPackagePath,
        localRepositoryPath: materialized.localRepositoryPath,
        url: scanned.sourcePath,
      },
      trustLevel: "custom",
    });
    return persistInstalledPlugin(library, plugin, []);
  }

  checkInstalledPluginPackage(pluginId: string): PluginPackageHealthCheck {
    return checkInstalledPluginPackage(this.read(), pluginId);
  }

  async getPluginSourceUpdateStatus(
    pluginId: string,
    sources = this.marketSources,
  ): Promise<PluginSourceUpdateCheck> {
    const library = this.read();
    const plugin = library.plugins.find((entry) => entry.id === pluginId);
    if (!plugin) {
      return {
        status: "not-installed",
        localModified: false,
        remoteChanged: false,
      };
    }

    const preview = await this.buildPreviewForInstalledPlugin(plugin, sources);
    const remoteManifestHash = computePluginPreviewFingerprint(preview);
    const installedManifestHash =
      plugin.installedManifestHash ??
      computePluginEntryManifestFingerprint(plugin);
    const localPackageHash = computePluginPackageFingerprint(
      getPluginLocalPackagePath(plugin),
    );
    const remotePackageHash = preview.sourcePackageHash;
    const { localModified, remoteChanged } = getPluginPackageUpdateSignals({
      installedManifestHash,
      installedPackageHash: plugin.installedPackageHash,
      localPackageHash,
      remoteManifestHash,
      remotePackageHash,
    });
    const status = getPluginUpdateStatus(localModified, remoteChanged);

    return {
      status,
      plugin,
      preview,
      localPackageHash,
      installedPackageHash: plugin.installedPackageHash,
      remotePackageHash,
      remoteManifestHash,
      installedManifestHash,
      localModified,
      remoteChanged,
    };
  }

  async updatePluginFromSource(
    pluginId: string,
    options: { overwriteLocalChanges?: boolean } = {},
    sources = this.marketSources,
  ): Promise<PluginSourceUpdateResult> {
    const check = await this.getPluginSourceUpdateStatus(pluginId, sources);
    const library = this.read();
    const skipped = getSkippedSourceUpdate(
      check,
      library,
      options.overwriteLocalChanges === true,
    );
    if (skipped) {
      return skipped;
    }
    const plugin = check.plugin!;
    const preview = check.preview!;
    assertBundlePlugin(preview.classification, preview.displayName);
    this.createPluginVersion(
      plugin.id,
      `Source update: ${plugin.version || "unknown"} -> ${
        preview.version || "unknown"
      }`,
    );
    const materialized = await this.materializeUpdatedPluginPackage(
      plugin,
      preview,
    );
    const nextPlugin = buildUpdatedPluginFromPreview(
      plugin,
      preview,
      materialized,
      check.remoteManifestHash,
      nowMs(),
    );
    return persistSourceUpdate(
      library,
      plugin,
      nextPlugin,
      materialized,
      check,
    );
  }

  private async buildPreviewForInstalledPlugin(
    plugin: PluginLibraryEntry,
    sources: PluginMarketSource[],
  ): Promise<PluginMarketPreview> {
    if (plugin.source.kind === "local") {
      return this.buildPreviewForLocalSource(plugin);
    }
    if (isGitTransportSourceKind(plugin.source.kind)) {
      return this.buildPreviewForGitSource(plugin);
    }

    const entries = await this.getMarketEntries(sources);
    const entry = entries.find(
      (item) =>
        item.id === plugin.id ||
        (item.marketplaceId === plugin.source.sourceId &&
          item.name === plugin.name),
    );
    if (!entry) {
      throw new CorePluginError(
        "NOT_FOUND",
        `Plugin 来源不存在: ${plugin.displayName}`,
      );
    }
    const preview = await this.marketplace.buildPreviewForEntry(entry, sources);
    return attachMarketSourcePackageHash(
      preview,
      this.materializeSourcePackageFn,
    );
  }

  private buildPreviewForLocalSource(
    plugin: PluginLibraryEntry,
  ): PluginMarketPreview {
    const sourcePath = plugin.source.url;
    if (!sourcePath) {
      throw new CorePluginError(
        "MISSING_SOURCE",
        `${plugin.displayName} 没有可更新的本地来源`,
      );
    }
    assertReadableDirectory(
      sourcePath,
      `${plugin.displayName} 本地 Plugin 来源`,
    );
    const markerPath = findLocalPluginMarker(sourcePath);
    if (!markerPath) {
      throw new CorePluginError(
        "MISSING_MANIFEST",
        `没有找到可识别的 Plugin manifest: ${sourcePath}`,
      );
    }
    const { manifest } = readLocalPluginManifest(markerPath);
    validateLocalPluginPackage(sourcePath, manifest);
    const inventory = extractLocalPluginInventory(
      sourcePath,
      manifest,
      markerPath,
    );
    const classification = classifyPluginInventory(inventory);
    return this.buildPreviewForLocalPackage(
      sourcePath,
      manifest,
      inventory,
      classification,
      plugin.source.sourceId,
      plugin.source.label,
    );
  }

  private buildPreviewForMaterializedSourcePackage(
    sourceRequest: NormalizedPluginSourceRequest,
    sourcePackage: MaterializedPluginSourcePackage,
  ): PluginMarketPreview {
    assertReadableDirectory(sourcePackage.sourcePath, "Plugin source package");
    const markerPath = findLocalPluginMarker(sourcePackage.sourcePath);
    if (!markerPath) {
      throw new CorePluginError(
        "MISSING_MANIFEST",
        `没有找到可识别的 Plugin manifest: ${sourceRequest.url}`,
      );
    }

    const { manifest } = readLocalPluginManifest(markerPath);
    validateLocalPluginPackage(sourcePackage.sourcePath, manifest);
    const inventory = extractLocalPluginInventory(
      sourcePackage.sourcePath,
      manifest,
      markerPath,
    );
    const classification = classifyPluginInventory(inventory);
    return this.buildPreviewForSourcePackage(
      sourcePackage.sourcePath,
      manifest,
      inventory,
      classification,
      sourceRequest,
    );
  }

  private async buildPreviewForGitSource(
    plugin: PluginLibraryEntry,
  ): Promise<PluginMarketPreview> {
    if (!plugin.source.url) {
      throw new CorePluginError(
        "MISSING_SOURCE",
        `${plugin.displayName} 没有可更新的 Plugin source URL`,
      );
    }
    const sourceRequest = normalizePluginSourceImportRequest({
      branch: plugin.source.branch,
      label: plugin.source.label,
      packagePath: plugin.source.packagePath,
      url: plugin.source.url,
    });
    const sourcePackage = await this.materializeSourcePackageFn(sourceRequest);
    try {
      assertReadableDirectory(
        sourcePackage.sourcePath,
        `${plugin.displayName} Plugin source package`,
      );
      const markerPath = findLocalPluginMarker(sourcePackage.sourcePath);
      if (!markerPath) {
        throw new CorePluginError(
          "MISSING_MANIFEST",
          `没有找到可识别的 Plugin manifest: ${plugin.source.url}`,
        );
      }
      const { manifest } = readLocalPluginManifest(markerPath);
      validateLocalPluginPackage(sourcePackage.sourcePath, manifest);
      const inventory = extractLocalPluginInventory(
        sourcePackage.sourcePath,
        manifest,
        markerPath,
      );
      const classification = classifyPluginInventory(inventory);
      return this.buildPreviewForSourcePackage(
        sourcePackage.sourcePath,
        manifest,
        inventory,
        classification,
        sourceRequest,
      );
    } finally {
      if (sourcePackage.cleanupPath) {
        fs.rmSync(sourcePackage.cleanupPath, { recursive: true, force: true });
      }
    }
  }

  private async materializeUpdatedPluginPackage(
    plugin: PluginLibraryEntry,
    preview: PluginMarketPreview,
  ): Promise<MaterializedPluginPackage | undefined> {
    if (plugin.source.kind === "local") {
      if (!plugin.source.url) {
        throw new CorePluginError("MISSING_SOURCE", "本地 Plugin 来源路径为空");
      }
      return copyPluginPackageToManagedPath(plugin.source.url, plugin.id);
    }
    if (isGitTransportSourceKind(plugin.source.kind)) {
      if (!plugin.source.url) {
        throw new CorePluginError("MISSING_SOURCE", "Plugin source URL 为空");
      }
      const sourcePackage = await this.materializeSourcePackageFn(
        normalizePluginSourceImportRequest({
          branch: plugin.source.branch,
          label: plugin.source.label,
          packagePath: plugin.source.packagePath,
          url: plugin.source.url,
        }),
      );
      try {
        return copyPluginPackageToManagedPath(
          sourcePackage.sourcePath,
          plugin.id,
        );
      } finally {
        if (sourcePackage.cleanupPath) {
          fs.rmSync(sourcePackage.cleanupPath, {
            recursive: true,
            force: true,
          });
        }
      }
    }
    return this.materializePackages
      ? this.materializePackageFn(preview.entry, plugin.id)
      : undefined;
  }

  private buildPreviewForLocalPackage(
    sourcePath: string,
    manifest: RawRecord,
    inventory: PluginInventorySummary,
    classification: PluginSemanticClassification,
    sourceTargetId = "local",
    sourceTargetName?: string,
  ): PluginMarketPreview {
    return buildPackageSourcePreview(
      sourcePath,
      manifest,
      inventory,
      classification,
      {
        kind: "local",
        label: sourceTargetName,
        marketplaceId: `local-${sourceTargetId}`,
        sourceId: sourceTargetId,
        url: sourcePath,
      },
    );
  }

  private buildPreviewForSourcePackage(
    sourcePath: string,
    manifest: RawRecord,
    inventory: PluginInventorySummary,
    classification: PluginSemanticClassification,
    sourceRequest: NormalizedPluginSourceRequest,
  ): PluginMarketPreview {
    return buildPackageSourcePreview(
      sourcePath,
      manifest,
      inventory,
      classification,
      {
        branch: sourceRequest.branch,
        kind: sourceRequest.kind,
        label: sourceRequest.label,
        marketplaceId: sourceRequest.sourceId,
        packagePath: sourceRequest.packagePath,
        repository: sourceRequest.url,
        sourceId: sourceRequest.sourceId,
        url: sourceRequest.url,
      },
    );
  }

  distributePlugin(request: PluginDistributeRequest): PluginDistributeResult {
    return distributePlugin(
      {
        readLibrary: () => this.read(),
        resolveTargetPath: this.resolvePluginTargetPath,
      },
      request,
    );
  }

  removePluginDistribution(
    request: PluginUndistributeRequest,
  ): PluginUndistributeResult {
    return removePluginDistribution(
      {
        readLibrary: () => this.read(),
        resolveTargetPath: this.resolvePluginTargetPath,
      },
      request,
    );
  }

  updatePluginMetadata(
    pluginId: string,
    metadata: PluginMetadataUpdate,
  ): PluginLibraryFile {
    return this.storage.updatePluginMetadata(pluginId, metadata);
  }

  deletePlugin(
    id: string,
    options: PluginDeleteOptions = {},
  ): PluginLibraryFile {
    const library = this.read();
    const deletedPlugin = library.plugins.find((plugin) => plugin.id === id);
    const nextPlugins = library.plugins.filter((plugin) => plugin.id !== id);
    if (nextPlugins.length === library.plugins.length) {
      throw new CorePluginError("NOT_FOUND", `Plugin 不存在: ${id}`);
    }
    if (deletedPlugin && options.removeDistributedTargets) {
      deleteDistributedPluginTargets(
        deletedPlugin,
        this.resolvePluginTargetPath,
      );
    }
    const nextLibrary: PluginLibraryFile = {
      ...library,
      updatedAt: nowIso(),
      plugins: nextPlugins,
    };
    writeJsonFileAtomic(getPluginLibraryFilePath(), nextLibrary);
    if (deletedPlugin?.managedPath) {
      this.deleteManagedPluginPath(deletedPlugin.managedPath);
    }
    return nextLibrary;
  }

  private deleteManagedPluginPath(targetPath: string): void {
    const pluginsDir = path.resolve(getManagedPluginsDir());
    const resolvedTarget = path.resolve(targetPath);
    if (
      resolvedTarget === pluginsDir ||
      !resolvedTarget.startsWith(`${pluginsDir}${path.sep}`)
    ) {
      return;
    }
    fs.rmSync(resolvedTarget, { recursive: true, force: true });
  }
}
