/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import { createTrayController } from "../../../src/main/tray-controller";

function createHarness(
  overrides: {
    isDev?: boolean;
    platform?: NodeJS.Platform;
    preferredEmpty?: boolean;
    alternateEmpty?: boolean;
  } = {},
) {
  const handlers = new Map<string, () => void>();
  const preferredImage = {
    isEmpty: () => overrides.preferredEmpty ?? false,
    resize: vi.fn(function resize() {
      return preferredImage;
    }),
    setTemplateImage: vi.fn(),
  };
  const fallbackImage = {
    isEmpty: () => false,
    resize: vi.fn(function resize() {
      return fallbackImage;
    }),
    setTemplateImage: vi.fn(),
  };
  const alternateImage = {
    isEmpty: () => overrides.alternateEmpty ?? false,
    resize: vi.fn(function resize() {
      return alternateImage;
    }),
    setTemplateImage: vi.fn(),
  };
  const createFromPath = vi.fn((filePath: string) => {
    if (filePath.includes("icon.iconset")) return fallbackImage;
    if (filePath.includes("app.asar.unpacked")) return alternateImage;
    return preferredImage;
  });
  const tray = {
    destroy: vi.fn(),
    on: vi.fn((event: string, listener: () => void) => {
      handlers.set(event, listener);
      return tray;
    }),
    setContextMenu: vi.fn(),
    setToolTip: vi.fn(),
  };
  const buildMenu = vi.fn((template) => ({ template }));
  const createTray = vi.fn(() => tray);
  const getLocale = vi.fn(() => "en-US");
  const getStoredLanguage = vi.fn<() => string | null>(() => null);
  const onCommand = vi.fn();
  const onQuit = vi.fn();
  const onToggleWindow = vi.fn();

  const controller = createTrayController({
    agentManagementEnabled: false,
    buildMenu: buildMenu as never,
    createFromPath: createFromPath as never,
    createTray: createTray as never,
    dirname: "/repo/apps/desktop/out/main",
    getLocale,
    getResourcesPath: () => "/packaged/resources",
    getStoredLanguage,
    getWindowVisibility: () => true,
    isDev: overrides.isDev ?? true,
    onCommand,
    onQuit,
    onToggleWindow,
    platform: overrides.platform ?? "darwin",
  });

  return {
    alternateImage,
    buildMenu,
    controller,
    createFromPath,
    createTray,
    fallbackImage,
    getStoredLanguage,
    handlers,
    onToggleWindow,
    preferredImage,
    tray,
  };
}

describe("tray controller", () => {
  it("creates a macOS template tray and refreshes localization before opening", () => {
    const harness = createHarness();
    harness.controller.create();

    expect(harness.createFromPath).toHaveBeenCalledWith(
      "/repo/apps/desktop/resources/tray/PromptHubStatusTemplate.png",
    );
    expect(harness.preferredImage.setTemplateImage).toHaveBeenCalledWith(true);
    expect(harness.preferredImage.resize).not.toHaveBeenCalled();
    expect(harness.tray.setToolTip).toHaveBeenCalledWith("PromptHub");
    expect(harness.handlers.has("mouse-down")).toBe(true);
    expect(harness.handlers.has("click")).toBe(false);

    harness.getStoredLanguage.mockReturnValue("zh");
    harness.handlers.get("mouse-down")?.();
    const latestTemplate = harness.buildMenu.mock.calls.at(-1)?.[0];
    expect(latestTemplate[0].label).toBe("添加 Agent 资产");
  });

  it("uses the platform icon and left-click toggle outside macOS", () => {
    const harness = createHarness({ platform: "win32", isDev: false });
    harness.controller.create();

    expect(harness.createFromPath).toHaveBeenCalledWith(
      "/packaged/resources/icon.ico",
    );
    expect(harness.preferredImage.resize).toHaveBeenCalledWith({
      height: 16,
      width: 16,
    });
    harness.handlers.get("click")?.();
    expect(harness.onToggleWindow).toHaveBeenCalledOnce();
  });

  it("resolves the development platform icon path", () => {
    const harness = createHarness({ platform: "linux", isDev: true });
    harness.controller.create();

    expect(harness.createFromPath).toHaveBeenCalledWith(
      "/repo/apps/desktop/resources/icon.ico",
    );
  });

  it("uses the unpacked platform icon when the packaged icon is empty", () => {
    const harness = createHarness({
      platform: "win32",
      isDev: false,
      preferredEmpty: true,
    });
    harness.controller.create();

    expect(harness.createFromPath).toHaveBeenCalledWith(
      "/packaged/resources/app.asar.unpacked/resources/icon.ico",
    );
    expect(harness.alternateImage.resize).toHaveBeenCalledWith({
      height: 16,
      width: 16,
    });
  });

  it("falls back when both platform icon candidates are empty", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const harness = createHarness({
      alternateEmpty: true,
      platform: "win32",
      preferredEmpty: true,
    });
    harness.controller.create();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load tray icon:",
      expect.objectContaining({ message: "platform tray icon is missing" }),
    );
    expect(harness.createTray).toHaveBeenCalledWith(harness.fallbackImage);
  });

  it("falls back safely when the preferred image is empty", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const harness = createHarness({ preferredEmpty: true });
    harness.controller.create();

    expect(harness.createFromPath).toHaveBeenCalledWith(
      "/repo/apps/desktop/resources/icon.iconset/icon_16x16@2x.png",
    );
    expect(harness.fallbackImage.resize).toHaveBeenCalledWith({
      height: 18,
      width: 18,
    });
    expect(harness.createTray).toHaveBeenCalledWith(harness.fallbackImage);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load tray icon:",
      expect.objectContaining({
        message: expect.stringContaining("macOS tray template icon is missing"),
      }),
    );
  });

  it("is idempotent and destroys the owned tray once", () => {
    const harness = createHarness();
    harness.controller.refresh();
    expect(harness.buildMenu).not.toHaveBeenCalled();
    harness.controller.create();
    harness.controller.create();
    expect(harness.createTray).toHaveBeenCalledOnce();

    harness.controller.destroy();
    harness.controller.destroy();
    expect(harness.tray.destroy).toHaveBeenCalledOnce();
  });
});
