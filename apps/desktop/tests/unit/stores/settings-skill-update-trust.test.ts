import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/i18n", () => ({
  __esModule: true,
  default: { language: "en" },
  changeLanguage: vi.fn().mockResolvedValue(undefined),
}));

describe("Skill update source trust settings", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("deduplicates exact source trust and supports revocation", async () => {
    const { useSettingsStore } =
      await import("../../../src/renderer/stores/settings.store");
    const sourceKey = "gitea:team/prompthub-web";

    useSettingsStore.getState().trustSkillUpdateSource(sourceKey);
    useSettingsStore.getState().trustSkillUpdateSource(` ${sourceKey} `);
    expect(useSettingsStore.getState().trustedSkillUpdateSourceKeys).toEqual([
      sourceKey,
    ]);

    useSettingsStore.getState().revokeSkillUpdateSourceTrust(sourceKey);
    expect(useSettingsStore.getState().trustedSkillUpdateSourceKeys).toEqual(
      [],
    );
  });
});
