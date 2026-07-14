/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import { dispatchTrayAppCommand } from "../../../src/main/tray-command-dispatcher";

function createWindow(
  options: { destroyed?: boolean; loading?: boolean } = {},
) {
  let destroyed = options.destroyed ?? false;
  let didFinishLoad: (() => void) | null = null;
  return {
    focus: vi.fn(),
    isDestroyed: () => destroyed,
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    setDestroyed: (value: boolean) => {
      destroyed = value;
    },
    show: vi.fn(),
    webContents: {
      isLoading: vi.fn(() => options.loading ?? false),
      once: vi.fn((_event: "did-finish-load", listener: () => void) => {
        didFinishLoad = listener;
      }),
    },
    finishLoading: () => didFinishLoad?.(),
  };
}

describe("dispatchTrayAppCommand", () => {
  it("shows, focuses, and immediately sends to an existing window", async () => {
    const windowRef = createWindow();
    const sendCommand = vi.fn();
    const onWindowShown = vi.fn();

    await expect(
      dispatchTrayAppCommand({
        command: { type: "settings:open" },
        createWindow: vi.fn(),
        getWindow: () => windowRef,
        onWindowShown,
        sendCommand,
      }),
    ).resolves.toBe(true);
    expect(windowRef.show).toHaveBeenCalledOnce();
    expect(windowRef.focus).toHaveBeenCalledOnce();
    expect(onWindowShown).toHaveBeenCalledOnce();
    expect(sendCommand).toHaveBeenCalledWith({ type: "settings:open" });
  });

  it("restores a minimized window before sending", async () => {
    const windowRef = createWindow();
    windowRef.isMinimized.mockReturnValue(true);

    await dispatchTrayAppCommand({
      command: { type: "updater:open" },
      createWindow: vi.fn(),
      getWindow: () => windowRef,
      sendCommand: vi.fn(),
    });

    expect(windowRef.restore).toHaveBeenCalledOnce();
  });

  it("creates a missing window and queues delivery until loading finishes", async () => {
    const windowRef = createWindow({ loading: true });
    let currentWindow: typeof windowRef | null = null;
    const sendCommand = vi.fn();
    const createWindowAction = vi.fn(async () => {
      currentWindow = windowRef;
    });

    await expect(
      dispatchTrayAppCommand({
        command: { type: "asset:create", asset: "skill" },
        createWindow: createWindowAction,
        getWindow: () => currentWindow,
        sendCommand,
      }),
    ).resolves.toBe(true);
    expect(createWindowAction).toHaveBeenCalledOnce();
    expect(sendCommand).not.toHaveBeenCalled();

    windowRef.finishLoading();
    expect(sendCommand).toHaveBeenCalledWith({
      type: "asset:create",
      asset: "skill",
    });
  });

  it("does not deliver after a loading window is destroyed", async () => {
    const windowRef = createWindow({ loading: true });
    const sendCommand = vi.fn();
    await dispatchTrayAppCommand({
      command: { type: "settings:open" },
      createWindow: vi.fn(),
      getWindow: () => windowRef,
      sendCommand,
    });

    windowRef.setDestroyed(true);
    windowRef.finishLoading();
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it.each([null, createWindow({ destroyed: true })])(
    "returns false when window creation leaves %s",
    async (unavailableWindow) => {
      await expect(
        dispatchTrayAppCommand({
          command: { type: "settings:open" },
          createWindow: vi.fn().mockResolvedValue(undefined),
          getWindow: () => unavailableWindow,
          sendCommand: vi.fn(),
        }),
      ).resolves.toBe(false);
    },
  );
});
