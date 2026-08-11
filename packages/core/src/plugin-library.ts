export {
  CorePluginError,
  emptyPluginInventory,
  getLegacyPluginLibraryFilePath,
  getLegacyPluginMarketCacheFilePath,
  getPluginLibraryFilePath,
  getPluginMarketCacheFilePath,
  getPluginVersionFilePath,
  normalizeSlug,
} from "./plugin-library/shared";
export type { CorePluginLibraryServiceOptions } from "./plugin-library/shared";
export {
  BUILTIN_PLUGIN_MARKET_SOURCES,
  extractPluginInventoryFromManifest,
} from "./plugin-library/marketplace";
export { classifyPluginInventory } from "./plugin-library/normalization";
export { getPluginTargetMatrix } from "./plugin-library/distribution";
export { CorePluginLibraryService } from "./plugin-library/service";
