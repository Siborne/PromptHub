import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV,
  createPackagedStartupSmokeController,
  createPackagedStartupSmokeExitBarrier,
  resolvePackagedStartupSmokeAppDataPath,
  resolvePackagedStartupSmokeSetup,
  shouldAutoExitPackagedStartupSmoke,
} from "../../../src/main/testing/release-smoke-profile";

describe("packaged startup smoke profile", () => {
  const runnerTemp = path.resolve("tmp", "runner");
  const appDataPath = path.join(runnerTemp, "smoke", "AppData", "Roaming");

  it("accepts a runner-owned AppData root only for packaged Windows CI", () => {
    expect(
      resolvePackagedStartupSmokeAppDataPath({
        env: {
          CI: "true",
          RUNNER_TEMP: runnerTemp,
          PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: appDataPath,
        },
        isPackaged: true,
        platform: "win32",
      }),
    ).toBe(appDataPath);
  });

  it.each([
    { isPackaged: false, platform: "win32" as const, CI: "true" },
    { isPackaged: true, platform: "darwin" as const, CI: "true" },
    { isPackaged: true, platform: "win32" as const, CI: "false" },
  ])("rejects an override outside its release context", (context) => {
    expect(() =>
      resolvePackagedStartupSmokeAppDataPath({
        env: {
          CI: context.CI,
          RUNNER_TEMP: runnerTemp,
          PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: appDataPath,
        },
        isPackaged: context.isPackaged,
        platform: context.platform,
      }),
    ).toThrow(/packaged Windows CI/i);
  });

  it.each([
    runnerTemp,
    path.resolve(runnerTemp, "..", "outside"),
    path.resolve(runnerTemp, "..", `${path.basename(runnerTemp)}-sibling`),
  ])("rejects a non-descendant AppData root: %s", (candidate) => {
    expect(() =>
      resolvePackagedStartupSmokeAppDataPath({
        env: {
          CI: "true",
          RUNNER_TEMP: runnerTemp,
          PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: candidate,
        },
        isPackaged: true,
        platform: "win32",
      }),
    ).toThrow(/RUNNER_TEMP/i);
  });

  it("rejects an AppData override when RUNNER_TEMP is missing", () => {
    expect(() =>
      resolvePackagedStartupSmokeAppDataPath({
        env: {
          CI: "true",
          PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: appDataPath,
        },
        isPackaged: true,
        platform: "win32",
      }),
    ).toThrow(/requires RUNNER_TEMP/i);
  });

  it("does not activate when no override is configured", () => {
    expect(
      resolvePackagedStartupSmokeAppDataPath({
        env: {},
        isPackaged: true,
        platform: "win32",
      }),
    ).toBeNull();
  });

  it("does not activate auto-exit when no auto-exit flag is configured", () => {
    expect(
      shouldAutoExitPackagedStartupSmoke({
        env: {},
        isPackaged: true,
        platform: "win32",
        appDataPath: null,
      }),
    ).toBe(false);
  });

  it("rejects an invalid auto-exit value", () => {
    expect(() =>
      shouldAutoExitPackagedStartupSmoke({
        env: {
          [PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV]: "yes",
        },
        isPackaged: true,
        platform: "win32",
        appDataPath,
      }),
    ).toThrow(/must be true/i);
  });

  it("rejects auto-exit without the validated AppData override", () => {
    expect(() =>
      shouldAutoExitPackagedStartupSmoke({
        env: {
          CI: "true",
          [PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV]: "true",
        },
        isPackaged: true,
        platform: "win32",
        appDataPath: null,
      }),
    ).toThrow(/AppData override/i);
  });

  it("rejects auto-exit when the caller supplies a different AppData path", () => {
    expect(() =>
      shouldAutoExitPackagedStartupSmoke({
        env: {
          CI: "true",
          RUNNER_TEMP: runnerTemp,
          PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: appDataPath,
          [PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV]: "true",
        },
        isPackaged: true,
        platform: "win32",
        appDataPath: path.join(runnerTemp, "smoke", "other"),
      }),
    ).toThrow(/AppData override/i);
  });

  it("allows auto-exit only for the packaged Windows CI profile", () => {
    expect(
      shouldAutoExitPackagedStartupSmoke({
        env: {
          CI: "true",
          RUNNER_TEMP: runnerTemp,
          PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: appDataPath,
          [PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV]: "true",
        },
        isPackaged: true,
        platform: "win32",
        appDataPath,
      }),
    ).toBe(true);
  });

  it("resolves a disabled setup without logging or exiting", () => {
    const exit = vi.fn();
    const logMigration = vi.fn();
    const setup = resolvePackagedStartupSmokeSetup({
      env: {},
      isPackaged: true,
      platform: "win32",
      onExit: exit,
      logMigration,
    });

    expect(setup.appDataPath).toBeNull();
    expect(setup.controller.enabled).toBe(false);
    setup.controller.onWindowReady();
    setup.controller.onRendererPersistenceMigration({ status: "migrated" });
    expect(logMigration).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("resolves an enabled setup around the validated AppData path", () => {
    const exit = vi.fn();
    const logMigration = vi.fn();
    const setup = resolvePackagedStartupSmokeSetup({
      env: {
        CI: "true",
        RUNNER_TEMP: runnerTemp,
        PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA: appDataPath,
        [PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV]: "true",
      },
      isPackaged: true,
      platform: "win32",
      onExit: exit,
      logMigration,
    });

    expect(setup.appDataPath).toBe(appDataPath);
    expect(setup.controller.enabled).toBe(true);
    setup.controller.onRendererPersistenceMigration({ status: "migrated" });
    setup.controller.onWindowReady();
    expect(logMigration).toHaveBeenCalledWith("migrated");
    expect(exit).toHaveBeenCalledOnce();
  });

  it.each(["migration-first", "window-first"] as const)(
    "exits once after both smoke signals arrive (%s)",
    (order) => {
      const exit = vi.fn();
      const barrier = createPackagedStartupSmokeExitBarrier({
        enabled: true,
        onExit: exit,
      });

      if (order === "migration-first") {
        barrier.signalRendererPersistenceMigration("migrated");
        expect(exit).not.toHaveBeenCalled();
        barrier.signalWindowReady();
      } else {
        barrier.signalWindowReady();
        expect(exit).not.toHaveBeenCalled();
        barrier.signalRendererPersistenceMigration("migrated");
      }

      expect(exit).toHaveBeenCalledOnce();
    },
  );

  it("ignores duplicate smoke signals after scheduling the exit", () => {
    const exit = vi.fn();
    const barrier = createPackagedStartupSmokeExitBarrier({
      enabled: true,
      onExit: exit,
    });

    barrier.signalWindowReady();
    barrier.signalWindowReady();
    barrier.signalRendererPersistenceMigration("migrated");
    barrier.signalRendererPersistenceMigration("already-complete");
    barrier.signalWindowReady();

    expect(exit).toHaveBeenCalledOnce();
  });

  it("never exits when the packaged smoke barrier is disabled", () => {
    const exit = vi.fn();
    const barrier = createPackagedStartupSmokeExitBarrier({
      enabled: false,
      onExit: exit,
    });

    barrier.signalRendererPersistenceMigration("migrated");
    barrier.signalWindowReady();

    expect(exit).not.toHaveBeenCalled();
  });

  it("logs and forwards a successful migration through the enabled controller", () => {
    const exit = vi.fn();
    const logMigration = vi.fn();
    const controller = createPackagedStartupSmokeController({
      enabled: true,
      onExit: exit,
      logMigration,
    });

    controller.onWindowReady();
    controller.onRendererPersistenceMigration({ status: "migrated" });

    expect(logMigration).toHaveBeenCalledWith("migrated");
    expect(exit).toHaveBeenCalledOnce();
  });

  it("does not log or exit through a disabled controller", () => {
    const exit = vi.fn();
    const logMigration = vi.fn();
    const controller = createPackagedStartupSmokeController({
      enabled: false,
      onExit: exit,
      logMigration,
    });

    controller.onRendererPersistenceMigration({ status: "already-complete" });
    controller.onWindowReady();

    expect(logMigration).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
