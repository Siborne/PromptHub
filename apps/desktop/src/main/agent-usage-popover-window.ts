import { BrowserWindow, screen } from "electron";
import path from "node:path";

import {
  AGENT_USAGE_POPOVER_SIZE,
  createAgentUsagePopoverController,
  type AgentUsagePopoverController,
} from "./agent-usage-popover-controller";

interface AgentUsagePopoverWindowOptions {
  devServerUrl?: string;
  isDev: boolean;
  onLoadError: () => void;
  preloadPath: string;
  rendererPath: string;
}

export function getAgentUsagePopoverMaterialOptions(
  platform: NodeJS.Platform = process.platform,
): { vibrancy?: "popover"; visualEffectState?: "active" } {
  return platform === "darwin"
    ? { vibrancy: "popover", visualEffectState: "active" }
    : {};
}

export function createAgentUsagePopoverWindowController(
  options: AgentUsagePopoverWindowOptions,
): AgentUsagePopoverController {
  return createAgentUsagePopoverController({
    createWindow: () =>
      new BrowserWindow({
        ...AGENT_USAGE_POPOVER_SIZE,
        show: false,
        frame: false,
        transparent: true,
        ...getAgentUsagePopoverMaterialOptions(),
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hasShadow: true,
        webPreferences: {
          preload: options.preloadPath,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      }),
    getWorkArea: (anchor) =>
      screen.getDisplayNearestPoint({
        x: Math.round(anchor.x + anchor.width / 2),
        y: Math.round(anchor.y + anchor.height / 2),
      }).workArea,
    loadWindow: async (popoverWindow) => {
      const browserWindow = popoverWindow as BrowserWindow;
      browserWindow.webContents.setWindowOpenHandler(() => ({
        action: "deny",
      }));
      if (options.isDev) {
        const url = new URL(options.devServerUrl || "http://localhost:5173");
        url.searchParams.set("surface", "agent-usage");
        await browserWindow.loadURL(url.toString());
        return;
      }
      await browserWindow.loadFile(options.rendererPath, {
        query: { surface: "agent-usage" },
      });
    },
    onLoadError: options.onLoadError,
  });
}

export function createDefaultAgentUsagePopoverWindowController(
  isDev: boolean,
): AgentUsagePopoverController {
  return createAgentUsagePopoverWindowController({
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    isDev,
    preloadPath: path.join(__dirname, "../preload/index.js"),
    rendererPath: path.join(__dirname, "../renderer/index.html"),
    onLoadError: () => console.error("Failed to load Agent usage popover"),
  });
}
