import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/i18n", () => ({
  __esModule: true,
  default: { language: "en" },
  changeLanguage: vi.fn(),
}));

async function importStore() {
  vi.resetModules();
  window.api = {
    ...(window.api ?? {}),
    settings: {
      ...(window.api?.settings ?? {}),
      get: vi.fn().mockResolvedValue({ githubToken: "" }),
      set: vi.fn().mockResolvedValue(undefined),
    },
  };
  return import("../../../src/renderer/stores/settings.store");
}

describe("settings store Skill safety policy", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("persists explicit channel and store policies and removes inherited keys", async () => {
    const { useSettingsStore } = await importStore();

    useSettingsStore
      .getState()
      .setSkillSafetyChannelPolicy("git-repo", "disabled");
    useSettingsStore
      .getState()
      .setSkillSafetyStorePolicy("team-gitea", "enabled");

    expect(useSettingsStore.getState().skillSafetyChannelPolicies).toEqual({
      "git-repo": "disabled",
    });
    expect(useSettingsStore.getState().skillSafetyStorePolicies).toEqual({
      "team-gitea": "enabled",
    });

    useSettingsStore
      .getState()
      .setSkillSafetyStorePolicy("team-gitea", "inherit");
    expect(useSettingsStore.getState().skillSafetyStorePolicies).toEqual({});
  });

  it("normalizes malformed and oversized persisted policy data", async () => {
    localStorage.setItem(
      "prompthub-settings",
      JSON.stringify({
        version: 19,
        state: {
          skillSafetyChannelPolicies: {
            "git-repo": "disabled",
            official: "invalid",
            unknown: "enabled",
          },
          skillSafetyStorePolicies: Object.fromEntries([
            [" team-gitea ", "enabled"],
            ["bad-policy", "inherit"],
            ["x".repeat(513), "disabled"],
            ...Array.from({ length: 520 }, (_, index) => [
              `store-${index}`,
              "disabled",
            ]),
          ]),
        },
      }),
    );

    const { useSettingsStore } = await importStore();
    const state = useSettingsStore.getState();

    expect(state.skillSafetyChannelPolicies).toEqual({
      "git-repo": "disabled",
    });
    expect(state.skillSafetyStorePolicies["team-gitea"]).toBe("enabled");
    expect(state.skillSafetyStorePolicies["bad-policy"]).toBeUndefined();
    expect(Object.keys(state.skillSafetyStorePolicies)).toHaveLength(512);
  });
});
