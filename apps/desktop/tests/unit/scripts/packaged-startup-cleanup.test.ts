import fs from "node:fs";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PACKAGED_STARTUP_CLEANUP_MAX_ATTEMPTS,
  removePackagedStartupRoot,
  waitForPackagedStartupRetry,
  waitForPackagedProcessExit,
} from "../../../scripts/packaged-startup-cleanup.mts";

const temporaryRoots: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("packaged startup cleanup", () => {
  it("removes an owned temporary root with the production filesystem dependency", async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-packaged-cleanup-"),
    );
    temporaryRoots.push(root);
    fs.writeFileSync(path.join(root, "owned.txt"), "owned", "utf8");

    await removePackagedStartupRoot(root);

    expect(fs.existsSync(root)).toBe(false);
  });

  it.each(["EBUSY", "EMFILE", "ENFILE", "ENOTEMPTY", "EPERM"])(
    "retries transient Windows cleanup error %s",
    async (code) => {
      const remove = vi
        .fn()
        .mockImplementationOnce(() => {
          throw Object.assign(new Error(code), { code });
        })
        .mockImplementationOnce(() => undefined);
      const wait = vi.fn(async () => undefined);

      await removePackagedStartupRoot("C:\\runner\\owned", { remove, wait });

      expect(remove).toHaveBeenCalledTimes(2);
      expect(wait).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    Object.assign(new Error("access denied"), { code: "EACCES" }),
    new Error("missing error code"),
  ])("does not hide a non-transient cleanup failure", async (failure) => {
    const remove = vi.fn(() => {
      throw failure;
    });
    const wait = vi.fn(async () => undefined);

    await expect(
      removePackagedStartupRoot("C:\\runner\\owned", { remove, wait }),
    ).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("does not wait for a process that already exited", async () => {
    const child = Object.assign(new EventEmitter(), { exitCode: 0 });

    await waitForPackagedProcessExit(child, 5_000);

    expect(child.listenerCount("close")).toBe(0);
  });

  it("waits for the packaged process close event", async () => {
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
    });

    const waiting = waitForPackagedProcessExit(child, 5_000);
    child.emit("close");
    await waiting;

    expect(child.listenerCount("close")).toBe(0);
  });

  it("bounds the process-close grace period", async () => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
    });

    const waiting = waitForPackagedProcessExit(child, 5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await waiting;

    expect(child.listenerCount("close")).toBe(0);
  });

  it("fails after the bounded retry budget is exhausted", async () => {
    const failure = Object.assign(new Error("still busy"), { code: "EPERM" });
    const remove = vi.fn(() => {
      throw failure;
    });
    const wait = vi.fn(async () => undefined);

    await expect(
      removePackagedStartupRoot("C:\\runner\\owned", { remove, wait }),
    ).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledTimes(PACKAGED_STARTUP_CLEANUP_MAX_ATTEMPTS);
    expect(wait).toHaveBeenCalledTimes(
      PACKAGED_STARTUP_CLEANUP_MAX_ATTEMPTS - 1,
    );
  });

  it("bounds the production retry delay", async () => {
    vi.useFakeTimers();

    const waiting = waitForPackagedStartupRetry(250);
    await vi.advanceTimersByTimeAsync(250);

    await expect(waiting).resolves.toBeUndefined();
  });
});
