import type { AppCommand } from "@prompthub/shared/types";

interface TrayCommandWindow {
  focus: () => void;
  isDestroyed: () => boolean;
  isMinimized: () => boolean;
  restore: () => void;
  show: () => void;
  webContents: {
    isLoading: () => boolean;
    once: (event: "did-finish-load", listener: () => void) => void;
  };
}

interface DispatchTrayAppCommandOptions {
  command: AppCommand;
  createWindow: () => Promise<void>;
  getWindow: () => TrayCommandWindow | null;
  sendCommand: (command: AppCommand) => void;
}

export async function dispatchTrayAppCommand({
  command,
  createWindow,
  getWindow,
  sendCommand,
}: DispatchTrayAppCommandOptions): Promise<boolean> {
  let windowRef = getWindow();
  if (!windowRef || windowRef.isDestroyed()) {
    await createWindow();
    windowRef = getWindow();
  }
  if (!windowRef || windowRef.isDestroyed()) {
    return false;
  }

  if (windowRef.isMinimized()) {
    windowRef.restore();
  }
  windowRef.show();
  windowRef.focus();

  if (windowRef.webContents.isLoading()) {
    windowRef.webContents.once("did-finish-load", () => {
      if (!windowRef.isDestroyed()) {
        sendCommand(command);
      }
    });
    return true;
  }

  sendCommand(command);
  return true;
}
