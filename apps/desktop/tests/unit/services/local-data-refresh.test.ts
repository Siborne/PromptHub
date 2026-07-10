import { describe, expect, it, vi } from "vitest";

import { createLocalDataRefreshController } from "../../../src/renderer/services/local-data-refresh";

describe("local data refresh controller", () => {
  it("refreshes prompts and folders when Desktop resumes", async () => {
    const fetchPrompts = vi.fn().mockResolvedValue(undefined);
    const fetchFolders = vi.fn().mockResolvedValue(undefined);
    const controller = createLocalDataRefreshController({
      fetchPrompts,
      fetchFolders,
    });

    await controller.refresh();

    expect(fetchPrompts).toHaveBeenCalledTimes(1);
    expect(fetchFolders).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent resume events into one refresh", async () => {
    let resolvePrompts: (() => void) | undefined;
    const fetchPrompts = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePrompts = resolve;
        }),
    );
    const fetchFolders = vi.fn().mockResolvedValue(undefined);
    const controller = createLocalDataRefreshController({
      fetchPrompts,
      fetchFolders,
    });

    const first = controller.refresh();
    const second = controller.refresh();
    resolvePrompts?.();
    await Promise.all([first, second]);

    expect(fetchPrompts).toHaveBeenCalledTimes(1);
    expect(fetchFolders).toHaveBeenCalledTimes(1);
  });

  it("skips refresh while Desktop is hidden", async () => {
    const fetchPrompts = vi.fn().mockResolvedValue(undefined);
    const fetchFolders = vi.fn().mockResolvedValue(undefined);
    const controller = createLocalDataRefreshController({
      fetchPrompts,
      fetchFolders,
      isVisible: () => false,
    });

    await controller.refresh();

    expect(fetchPrompts).not.toHaveBeenCalled();
    expect(fetchFolders).not.toHaveBeenCalled();
  });

  it("allows a later refresh after a failed attempt", async () => {
    const fetchPrompts = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValue(undefined);
    const fetchFolders = vi.fn().mockResolvedValue(undefined);
    const controller = createLocalDataRefreshController({
      fetchPrompts,
      fetchFolders,
    });

    await expect(controller.refresh()).rejects.toThrow(
      "temporary read failure",
    );
    await controller.refresh();

    expect(fetchPrompts).toHaveBeenCalledTimes(2);
    expect(fetchFolders).toHaveBeenCalledTimes(2);
  });
});
