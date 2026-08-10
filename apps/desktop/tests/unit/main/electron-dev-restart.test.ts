import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import {
  createElectronRestartCoordinator,
  stopElectronBeforeRestart,
} from "../../../src/main/electron-dev-restart";

class FakeElectronChild extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;

  constructor(readonly pid: number | undefined) {
    super();
  }
}

describe("stopElectronBeforeRestart", () => {
  it("does nothing when no Electron child is running", async () => {
    const stopTree = vi.fn();

    await stopElectronBeforeRestart(undefined, stopTree);

    expect(stopTree).not.toHaveBeenCalled();
  });

  it("removes the Vite exit hook and reaps the owned child before resolving", async () => {
    const child = new FakeElectronChild(4312);
    const staleExitHook = vi.fn();
    child.on("exit", staleExitHook);
    const stopTree = vi.fn(() => {
      child.exitCode = 0;
      child.emit("exit", 0, null);
    });

    await stopElectronBeforeRestart(child, stopTree);

    expect(stopTree).toHaveBeenCalledOnce();
    expect(stopTree).toHaveBeenCalledWith(4312);
    expect(staleExitHook).not.toHaveBeenCalled();
  });

  it("does not terminate an Electron child that has already exited", async () => {
    const child = new FakeElectronChild(4313);
    child.exitCode = 0;
    const stopTree = vi.fn();

    await stopElectronBeforeRestart(child, stopTree);

    expect(stopTree).not.toHaveBeenCalled();
  });

  it("rejects an untrackable or non-exiting child instead of racing startup", async () => {
    await expect(
      stopElectronBeforeRestart(new FakeElectronChild(undefined), vi.fn()),
    ).rejects.toThrow("missing a process id");

    await expect(
      stopElectronBeforeRestart(new FakeElectronChild(4314), vi.fn(), 1),
    ).rejects.toThrow("did not exit within 1 ms");
  });
});

describe("createElectronRestartCoordinator", () => {
  it("serializes restarts and coalesces pending requests to the latest build", async () => {
    const coordinator = createElectronRestartCoordinator();
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const calls: number[] = [];

    const first = coordinator.request(async () => {
      calls.push(1);
      markFirstStarted();
      await firstGate;
    });
    await firstStarted;
    const superseded = coordinator.request(async () => {
      calls.push(2);
    });
    const latest = coordinator.request(async () => {
      calls.push(3);
    });
    releaseFirst();

    await Promise.all([first, superseded, latest]);
    expect(calls).toEqual([1, 3]);
  });

  it("allows a later restart after an earlier restart fails", async () => {
    const coordinator = createElectronRestartCoordinator();

    await expect(
      coordinator.request(async () => {
        throw new Error("restart failed");
      }),
    ).rejects.toThrow("restart failed");

    const recovered = vi.fn();
    await coordinator.request(async () => recovered());
    expect(recovered).toHaveBeenCalledOnce();
  });
});
