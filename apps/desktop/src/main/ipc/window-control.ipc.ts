import { app, ipcMain, type BrowserWindow } from "electron";

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import { toggleWindowForShowApp } from "../shortcuts";

type CloseAction = "ask" | "minimize" | "exit";

export interface WindowControlIpcOptions {
  emitVisibility: (isVisible: boolean) => void;
  getWindow: () => BrowserWindow | null;
  onCloseAction: (action: CloseAction) => void;
  onCloseDialogCancel: () => void;
  onCloseDialogResult: (data: {
    action: "minimize" | "exit";
    remember: boolean;
  }) => void;
  onDebugMode: (enabled: boolean) => void;
  onMinimizeToTray: (enabled: boolean) => void;
  scheduleRelaunch: () => void;
}

export function registerWindowControlIPC(
  options: WindowControlIpcOptions,
): void {
  ipcMain.on("window:minimize", () => options.getWindow()?.minimize());
  ipcMain.on("window:maximize", () => {
    const window = options.getWindow();
    if (window?.isMaximized()) window.unmaximize();
    else window?.maximize();
  });
  ipcMain.on("window:close", () => options.getWindow()?.close());
  ipcMain.on("window:enterFullscreen", () =>
    options.getWindow()?.setFullScreen(true),
  );
  ipcMain.on("window:exitFullscreen", () =>
    options.getWindow()?.setFullScreen(false),
  );
  ipcMain.handle(
    "window:isFullscreen",
    () => options.getWindow()?.isFullScreen() ?? false,
  );
  ipcMain.handle(
    "window:isVisible",
    () => options.getWindow()?.isVisible() ?? false,
  );
  ipcMain.on("window:toggleVisibility", () => {
    const window = options.getWindow();
    if (window) toggleWindowForShowApp(window, options.emitVisibility);
  });
  ipcMain.on("window:toggleFullscreen", () => {
    const window = options.getWindow();
    if (window) window.setFullScreen(!window.isFullScreen());
  });

  ipcMain.on(
    "app:setAutoLaunch",
    (_event, enabled: boolean, minimizeOnLaunch?: boolean) => {
      if (typeof enabled !== "boolean") {
        console.error("app:setAutoLaunch requires enabled to be a boolean");
        return;
      }
      const startHidden = enabled && minimizeOnLaunch === true;
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: startHidden,
          args: startHidden ? ["--hidden"] : [],
        });
      } catch (error) {
        console.error(
          "app:setAutoLaunch failed to apply login item settings:",
          error instanceof Error ? error.message : error,
        );
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.APP_RELAUNCH, () => {
    options.scheduleRelaunch();
    return { success: true };
  });
  ipcMain.on("app:setMinimizeToTray", (_event, enabled: boolean) =>
    options.onMinimizeToTray(enabled),
  );
  ipcMain.on("app:setCloseAction", (_event, action: CloseAction) => {
    if (action !== "ask" && action !== "minimize" && action !== "exit") {
      console.error(
        "app:setCloseAction requires action to be 'ask', 'minimize', or 'exit'",
      );
      return;
    }
    options.onCloseAction(action);
  });
  ipcMain.on("app:setDebugMode", (_event, enabled: boolean) =>
    options.onDebugMode(enabled),
  );
  ipcMain.on("window:toggleDevTools", () =>
    options.getWindow()?.webContents.toggleDevTools(),
  );
  ipcMain.on("window:closeDialogResult", (_event, data) => {
    if (!data || typeof data !== "object") {
      console.error("window:closeDialogResult requires a non-null data object");
      options.onCloseDialogCancel();
      return;
    }
    if (data.action !== "minimize" && data.action !== "exit") {
      console.error(
        "window:closeDialogResult requires action to be 'minimize' or 'exit'",
      );
      options.onCloseDialogCancel();
      return;
    }
    options.onCloseDialogResult({
      action: data.action,
      remember: data.remember === true,
    });
  });
  ipcMain.on("window:closeDialogCancel", options.onCloseDialogCancel);
}
