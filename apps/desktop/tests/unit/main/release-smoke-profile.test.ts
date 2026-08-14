import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolvePackagedStartupSmokeAppDataPath } from "../../../src/main/testing/release-smoke-profile";

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

  it("does not activate when no override is configured", () => {
    expect(
      resolvePackagedStartupSmokeAppDataPath({
        env: {},
        isPackaged: true,
        platform: "win32",
      }),
    ).toBeNull();
  });
});
