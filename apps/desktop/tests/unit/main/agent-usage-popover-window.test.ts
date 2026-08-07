/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const window = {
    close: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    isDestroyed: vi.fn(() => false),
    loadFile: vi.fn(async () => undefined),
    loadURL: vi.fn(async () => undefined),
    on: vi.fn(() => window),
    setBounds: vi.fn(),
    show: vi.fn(),
    webContents: { setWindowOpenHandler: vi.fn() },
  };
  return {
    BrowserWindow: vi.fn(() => window),
    getDisplayNearestPoint: vi.fn(() => ({
      workArea: { x: 0, y: 25, width: 1440, height: 875 },
    })),
    window,
  };
});

vi.mock("electron", () => ({
  BrowserWindow: mocks.BrowserWindow,
  screen: { getDisplayNearestPoint: mocks.getDisplayNearestPoint },
}));

import {
  createAgentUsagePopoverWindowController,
  createDefaultAgentUsagePopoverWindowController,
  getAgentUsagePopoverMaterialOptions,
} from "../../../src/main/agent-usage-popover-window";

describe("Agent usage popover window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only opts into native popover material on macOS", () => {
    expect(getAgentUsagePopoverMaterialOptions("darwin")).toEqual({
      vibrancy: "popover",
      visualEffectState: "active",
    });
    expect(getAgentUsagePopoverMaterialOptions("linux")).toEqual({});
    expect(getAgentUsagePopoverMaterialOptions("win32")).toEqual({});
  });

  it("creates a sandboxed development surface at the tray display", async () => {
    const controller = createAgentUsagePopoverWindowController({
      devServerUrl: "http://localhost:5173/workbench?existing=1",
      isDev: true,
      preloadPath: "/build/preload.js",
      rendererPath: "/build/index.html",
      onLoadError: vi.fn(),
    });

    await controller.show({ x: 1310, y: 0, width: 28, height: 24 });

    expect(mocks.BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        frame: false,
        height: 540,
        transparent: true,
        width: 392,
        vibrancy: "popover",
        visualEffectState: "active",
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
          preload: "/build/preload.js",
          sandbox: true,
        }),
      }),
    );
    expect(mocks.getDisplayNearestPoint).toHaveBeenCalledWith({
      x: 1324,
      y: 12,
    });
    expect(mocks.window.loadURL).toHaveBeenCalledWith(
      "http://localhost:5173/workbench?existing=1&surface=agent-usage",
    );
    expect(
      mocks.window.webContents.setWindowOpenHandler,
    ).toHaveBeenCalledOnce();
    expect(
      mocks.window.webContents.setWindowOpenHandler.mock.calls[0][0](),
    ).toEqual({ action: "deny" });
  });

  it("loads the production renderer with an isolated surface query", async () => {
    const controller = createAgentUsagePopoverWindowController({
      isDev: false,
      preloadPath: "/build/preload.js",
      rendererPath: "/build/index.html",
      onLoadError: vi.fn(),
    });

    await controller.show({ x: 500, y: 0, width: 24, height: 24 });

    expect(mocks.window.loadFile).toHaveBeenCalledWith("/build/index.html", {
      query: { surface: "agent-usage" },
    });
    expect(mocks.window.loadURL).not.toHaveBeenCalled();
  });

  it("uses the default development URL and reports a sanitized load failure", async () => {
    const previousDevServerUrl = process.env.VITE_DEV_SERVER_URL;
    delete process.env.VITE_DEV_SERVER_URL;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.window.loadURL.mockRejectedValueOnce(new Error("private load error"));
    const controller = createDefaultAgentUsagePopoverWindowController(true);

    await controller.show({ x: 500, y: 0, width: 24, height: 24 });

    expect(mocks.window.loadURL).toHaveBeenCalledWith(
      "http://localhost:5173/?surface=agent-usage",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load Agent usage popover",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "private load error",
    );

    consoleError.mockRestore();
    if (previousDevServerUrl === undefined) {
      delete process.env.VITE_DEV_SERVER_URL;
    } else {
      process.env.VITE_DEV_SERVER_URL = previousDevServerUrl;
    }
  });
});
