import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const changeLanguageMock = vi.fn<() => Promise<void>>();

vi.mock("../../../src/renderer/i18n", () => ({
  __esModule: true,
  default: { language: "en" },
  changeLanguage: changeLanguageMock,
}));

describe("settings language actions", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    changeLanguageMock.mockReset();
    changeLanguageMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("normalizes locale variants before updating settings", async () => {
    const setSettings = vi.fn().mockResolvedValue(true);
    window.api.settings.set = setSettings;
    const { useSettingsStore } = await import(
      "../../../src/renderer/stores/settings.store"
    );
    setSettings.mockClear();

    useSettingsStore.getState().setLanguage("fr-FR");

    expect(useSettingsStore.getState().language).toBe("fr");
    expect(changeLanguageMock).toHaveBeenCalledWith("fr");
    await vi.waitFor(() => {
      expect(setSettings).toHaveBeenCalledWith({ language: "fr" });
    });
  });

  it("migrates the persisted renderer language to main-process settings", async () => {
    const setSettings = vi.fn().mockResolvedValue(true);
    window.api.settings.set = setSettings;
    localStorage.setItem(
      "prompthub-settings",
      JSON.stringify({
        state: { language: "zh-TW" },
        version: 16,
      }),
    );

    await import("../../../src/renderer/stores/settings.store");

    await vi.waitFor(() => {
      expect(setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ language: "zh-TW" }),
      );
    });
  });

  it("logs storage hydration failures with the original error", async () => {
    const error = new Error("local storage unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const getItem = vi
      .spyOn(localStorage, "getItem")
      .mockImplementationOnce(() => {
        throw error;
      });

    await import("../../../src/renderer/stores/settings.store");

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to rehydrate settings store:",
      error,
    );
    getItem.mockRestore();
    consoleError.mockRestore();
  });

  it("maps traditional chinese locale aliases to zh-TW", async () => {
    const { useSettingsStore } = await import(
      "../../../src/renderer/stores/settings.store"
    );

    useSettingsStore.getState().setLanguage("zh-Hant");

    expect(useSettingsStore.getState().language).toBe("zh-TW");
    expect(changeLanguageMock).toHaveBeenCalledWith("zh-TW");
  });

  it("handles async i18n switch failures without reverting persisted settings", async () => {
    const error = new Error("locale chunk failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    changeLanguageMock.mockRejectedValueOnce(error);

    const { useSettingsStore } = await import(
      "../../../src/renderer/stores/settings.store"
    );

    useSettingsStore.getState().setLanguage("de");
    await Promise.resolve();

    expect(useSettingsStore.getState().language).toBe("de");
    expect(changeLanguageMock).toHaveBeenCalledWith("de");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to change language:",
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
