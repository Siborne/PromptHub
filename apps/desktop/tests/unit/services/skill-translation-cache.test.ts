import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSkillTranslationCacheState,
  pruneSkillTranslationCache,
} from "../../../src/renderer/services/skill-translation-cache";

describe("Skill translation cache", () => {
  afterEach(() => vi.restoreAllMocks());

  it("marks a translation stale when its source fingerprint changes", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    expect(
      getSkillTranslationCacheState(
        {
          skill: {
            value: "translation",
            timestamp: 900,
            sourceFingerprint: "old",
          },
        },
        "skill",
        "new",
      ),
    ).toEqual({ value: null, hasTranslation: true, isStale: true });
  });

  it("removes expired entries and evicts the oldest entries over budget", () => {
    const now = 8 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const cache = Object.fromEntries(
      Array.from({ length: 201 }, (_, index) => [
        `skill-${index}`,
        { value: String(index), timestamp: now - 1000 + index },
      ]),
    );
    cache.expired = { value: "expired", timestamp: 0 };

    const pruned = pruneSkillTranslationCache(cache);

    expect(Object.keys(pruned)).toHaveLength(150);
    expect(pruned.expired).toBeUndefined();
    expect(pruned["skill-0"]).toBeUndefined();
    expect(pruned["skill-200"]).toBeDefined();
  });
});
