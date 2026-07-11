const TRANSLATION_CACHE_MAX_SIZE = 200;
const TRANSLATION_CACHE_EVICT_COUNT = 50;
const TRANSLATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SkillTranslationCacheEntry {
  value: string;
  timestamp: number;
  sourceFingerprint?: string;
}

export interface SkillTranslationLookup {
  value: string | null;
  hasTranslation: boolean;
  isStale: boolean;
}

let skillTranslationAIPromise: Promise<{
  chatCompletion: typeof import("./ai").chatCompletion;
}> | null = null;

export function loadSkillTranslationAI() {
  skillTranslationAIPromise ??= import("./ai").then((aiService) => ({
    chatCompletion: aiService.chatCompletion,
  }));
  return skillTranslationAIPromise;
}

/** Remove expired translations and evict the oldest entries over budget. */
export function pruneSkillTranslationCache(
  cache: Record<string, SkillTranslationCacheEntry>,
): Record<string, SkillTranslationCacheEntry> {
  const now = Date.now();
  const entries = Object.entries(cache).filter(
    ([, entry]) => now - entry.timestamp < TRANSLATION_CACHE_TTL_MS,
  );
  if (entries.length <= TRANSLATION_CACHE_MAX_SIZE) {
    return Object.fromEntries(entries);
  }
  entries.sort((left, right) => left[1].timestamp - right[1].timestamp);
  return Object.fromEntries(
    entries.slice(
      entries.length -
        (TRANSLATION_CACHE_MAX_SIZE - TRANSLATION_CACHE_EVICT_COUNT),
    ),
  );
}

export function getSkillTranslationCacheState(
  cache: Record<string, SkillTranslationCacheEntry>,
  cacheKey: string,
  sourceFingerprint?: string,
): SkillTranslationLookup {
  const entry = cache[cacheKey];
  if (!entry || Date.now() - entry.timestamp >= TRANSLATION_CACHE_TTL_MS) {
    return { value: null, hasTranslation: false, isStale: false };
  }
  const isStale = Boolean(
    sourceFingerprint &&
    entry.sourceFingerprint &&
    entry.sourceFingerprint !== sourceFingerprint,
  );
  return {
    value: isStale ? null : entry.value,
    hasTranslation: true,
    isStale,
  };
}
