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
    withoutProviderLoader?: boolean;
    withoutUsageOpener?: boolean;
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
    getBounds: vi.fn(() => ({ x: 500, y: 0, width: 24, height: 24 })),
    popUpContextMenu: vi.fn(),
    setContextMenu: vi.fn(),
    setToolTip: vi.fn(),
  };
  const buildMenu = vi.fn((template) => ({ template }));
  const createTray = vi.fn(() => tray);
  const getLocale = vi.fn(() => "en-US");
  const getStoredLanguage = vi.fn<() => string | null>(() => null);
  const onCommand = vi.fn();
  const onAgentProviderProfile = vi.fn();
  const onOpenAgentUsage = vi.fn();
  const onQuit = vi.fn();
  const onToggleWindow = vi.fn();
  const loadAgentProviderGroups = vi.fn(async () => []);

  const controller = createTrayController({
    agentManagementEnabled: true,
    buildMenu: buildMenu as never,
    createFromPath: createFromPath as never,
    createTray: createTray as never,
    dirname: "/repo/apps/desktop/out/main",
    getLocale,
    getResourcesPath: () => "/packaged/resources",
    getStoredLanguage,
    getWindowVisibility: () => true,
    isDev: overrides.isDev ?? true,
    ...(overrides.withoutProviderLoader ? {} : { loadAgentProviderGroups }),
    onAgentProviderProfile,
    onCommand,
    ...(overrides.withoutUsageOpener ? {} : { onOpenAgentUsage }),
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
    loadAgentProviderGroups,
    onAgentProviderProfile,
    onOpenAgentUsage,
    onToggleWindow,
    preferredImage,
    tray,
  };
}

describe("tray controller", () => {
  it("opens quotas directly on macOS and keeps actions on right click", () => {
    const harness = createHarness();
    harness.controller.create();

    expect(harness.createFromPath).toHaveBeenCalledWith(
      "/repo/apps/desktop/resources/tray/PromptHubStatusTemplate.png",
    );
    expect(harness.preferredImage.setTemplateImage).toHaveBeenCalledWith(true);
    expect(harness.preferredImage.resize).not.toHaveBeenCalled();
    expect(harness.tray.setToolTip).toHaveBeenCalledWith("PromptHub");
    expect(harness.handlers.has("click")).toBe(true);
    expect(harness.handlers.has("right-click")).toBe(true);
    expect(harness.tray.setContextMenu).not.toHaveBeenCalled();

    harness.handlers.get("click")?.();
    expect(harness.onOpenAgentUsage).toHaveBeenCalledOnce();

    harness.getStoredLanguage.mockReturnValue("zh");
    harness.handlers.get("right-click")?.();
    const latestTemplate = harness.buildMenu.mock.calls.at(-1)?.[0];
    expect(latestTemplate[0].label).toBe("添加 Agent 资产");
    expect(
      latestTemplate.some(
        (item: { label?: string }) => item.label === "Agent 额度",
      ),
    ).toBe(false);
    expect(harness.tray.popUpContextMenu).toHaveBeenCalledOnce();
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
    expect(harness.controller.getBounds()).toBeNull();
  });

  it("loads provider profiles into the existing Agent menu and routes switches", async () => {
    const harness = createHarness();
    harness.loadAgentProviderGroups.mockResolvedValue([
      {
        agentId: "claude",
        name: "Claude Code",
        currentProfileId: "profile-1",
        profiles: [
          {
            id: "profile-1",
            name: "Primary",
            model: "claude-opus-4",
            isCurrent: true,
          },
          {
            id: "profile-2",
            name: "Backup",
            model: null,
            isCurrent: false,
          },
        ],
      },
    ]);

    harness.controller.create();
    await harness.controller.reloadAgentProviders();

    const latestTemplate = harness.buildMenu.mock.calls.at(-1)?.[0];
    const agentsItem = latestTemplate.find(
      (item: { label?: string }) => item.label === "Agents",
    );
    const claudeItem = agentsItem.submenu.find(
      (item: { label?: string }) => item.label === "Claude Code",
    );
    const backup = claudeItem.submenu.find(
      (item: { label?: string }) => item.label === "Backup",
    );
    backup.click();
    expect(harness.onAgentProviderProfile).toHaveBeenCalledWith(
      "claude",
      "profile-2",
    );
  });

  it("falls back to the app window when a macOS quota surface is unavailable", () => {
    const harness = createHarness({ withoutUsageOpener: true });
    harness.controller.create();
    harness.handlers.get("click")?.();
    expect(harness.onToggleWindow).toHaveBeenCalledOnce();
    expect(harness.controller.getBounds()).toEqual({
      x: 500,
      y: 0,
      width: 24,
      height: 24,
    });
  });

  it("ignores a late provider load after the tray is destroyed", async () => {
    let resolveGroups:
      | ((
          groups: Array<{
            agentId: string;
            name: string;
            currentProfileId: null;
            profiles: [];
          }>,
        ) => void)
      | undefined;
    const harness = createHarness();
    harness.loadAgentProviderGroups.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGroups = resolve;
        }),
    );

    harness.controller.create();
    const pending = harness.controller.reloadAgentProviders();
    harness.controller.destroy();
    resolveGroups?.([
      {
        agentId: "claude",
        name: "Claude Code",
        currentProfileId: null,
        profiles: [],
      },
    ]);
    await pending;

    expect(harness.tray.setContextMenu).not.toHaveBeenCalled();
  });

  it("keeps the current menu when provider refresh fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const harness = createHarness();
    harness.loadAgentProviderGroups.mockRejectedValue(
      new Error("private failure"),
    );

    harness.controller.create();
    await harness.controller.reloadAgentProviders();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to refresh Agent provider tray state",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "private failure",
    );
  });

  it("allows provider refresh to be omitted", async () => {
    const harness = createHarness({ withoutProviderLoader: true });
    harness.controller.create();

    await expect(
      harness.controller.reloadAgentProviders(),
    ).resolves.toBeUndefined();
    expect(harness.loadAgentProviderGroups).not.toHaveBeenCalled();
  });
});
