/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import {
  calculateAgentUsagePopoverBounds,
  createAgentUsagePopoverController,
} from "../../../src/main/agent-usage-popover-controller";

function createHarness() {
  const handlers = new Map<string, () => void>();
  const window = {
    close: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isVisible: vi.fn(() => false),
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
      return window;
    }),
    setBounds: vi.fn(),
    show: vi.fn(),
  };
  const createWindow = vi.fn(() => window);
  const loadWindow = vi.fn(async () => undefined);
  const onLoadError = vi.fn();
  const controller = createAgentUsagePopoverController({
    createWindow,
    getWorkArea: () => ({ x: 0, y: 25, width: 1440, height: 875 }),
    loadWindow,
    onLoadError,
  });
  const anchor = { x: 1310, y: 0, width: 28, height: 24 };
  return {
    anchor,
    controller,
    createWindow,
    handlers,
    loadWindow,
    onLoadError,
    window,
  };
}

describe("Agent usage popover controller", () => {
  it("ignores an open request when the tray has no bounds", async () => {
    const harness = createHarness();
    await harness.controller.show(null);
    expect(harness.createWindow).not.toHaveBeenCalled();
  });

  it("anchors below a top menu bar and clamps to the display work area", () => {
    expect(
      calculateAgentUsagePopoverBounds({
        anchor: { x: 1400, y: 0, width: 24, height: 24 },
        size: { width: 392, height: 540 },
        workArea: { x: 0, y: 25, width: 1440, height: 875 },
      }),
    ).toEqual({ x: 1040, y: 33, width: 392, height: 540 });
  });

  it("opens above a bottom tray and clamps an oversized origin", () => {
    expect(
      calculateAgentUsagePopoverBounds({
        anchor: { x: -20, y: 880, width: 24, height: 20 },
        size: { width: 392, height: 540 },
        workArea: { x: 0, y: 0, width: 1440, height: 900 },
      }),
    ).toEqual({ x: 8, y: 332, width: 392, height: 540 });
  });

  it("creates once, reuses the window, hides on blur and closes on destroy", async () => {
    const harness = createHarness();
    await harness.controller.show(harness.anchor);

    expect(harness.createWindow).toHaveBeenCalledOnce();
    expect(harness.loadWindow).toHaveBeenCalledOnce();
    expect(harness.window.show).toHaveBeenCalledOnce();
    expect(harness.window.focus).toHaveBeenCalledOnce();

    harness.window.isVisible.mockReturnValue(true);
    await harness.controller.show({ ...harness.anchor, x: 1200 });
    expect(harness.createWindow).toHaveBeenCalledOnce();
    expect(harness.window.setBounds).toHaveBeenCalledTimes(2);

    harness.handlers.get("blur")?.();
    expect(harness.window.hide).toHaveBeenCalledOnce();

    harness.controller.destroy();
    expect(harness.window.close).toHaveBeenCalledOnce();
  });

  it("deduplicates creation and ignores a late load after destroy", async () => {
    let finishLoad: (() => void) | undefined;
    const harness = createHarness();
    harness.loadWindow.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve;
        }),
    );

    const first = harness.controller.show(harness.anchor);
    const second = harness.controller.show(harness.anchor);
    expect(harness.createWindow).toHaveBeenCalledOnce();

    harness.controller.destroy();
    finishLoad?.();
    await Promise.all([first, second]);

    expect(harness.window.close).toHaveBeenCalledOnce();
    expect(harness.window.show).not.toHaveBeenCalled();
  });

  it("ignores a stale load failure after the controller is destroyed", async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    const harness = createHarness();
    harness.loadWindow.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectLoad = reject;
        }),
    );

    const opening = harness.controller.show(harness.anchor);
    harness.controller.destroy();
    rejectLoad?.(new Error("late renderer failure"));
    await opening;

    expect(harness.window.close).toHaveBeenCalledOnce();
    expect(harness.onLoadError).not.toHaveBeenCalled();
  });

  it("clears a closed window and creates a replacement on the next open", async () => {
    const harness = createHarness();
    await harness.controller.show(harness.anchor);
    harness.handlers.get("closed")?.();
    await harness.controller.show(harness.anchor);
    expect(harness.createWindow).toHaveBeenCalledTimes(2);
  });

  it("closes a half-loaded surface and allows a clean retry", async () => {
    const harness = createHarness();
    harness.loadWindow.mockRejectedValueOnce(new Error("renderer unavailable"));

    await expect(
      harness.controller.show(harness.anchor),
    ).resolves.toBeUndefined();
    expect(harness.window.close).toHaveBeenCalledOnce();
    expect(harness.onLoadError).toHaveBeenCalledOnce();

    harness.handlers.get("closed")?.();
    await harness.controller.show(harness.anchor);
    expect(harness.createWindow).toHaveBeenCalledTimes(2);
    expect(harness.window.show).toHaveBeenCalledOnce();
  });
});
