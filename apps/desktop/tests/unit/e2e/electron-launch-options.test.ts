import { describe, expect, it } from "vitest";

import { getElectronLaunchArgs } from "../../e2e/helpers/electron-launch-options";

describe("Electron E2E launch options", () => {
  it("disables the Chromium sandbox only on hosted Linux CI", () => {
    expect(getElectronLaunchArgs("/app/main.js", "linux", true)).toEqual([
      "--no-sandbox",
      "/app/main.js",
    ]);
    expect(getElectronLaunchArgs("/app/main.js", "linux", false)).toEqual([
      "/app/main.js",
    ]);
    expect(getElectronLaunchArgs("/app/main.js", "darwin", true)).toEqual([
      "/app/main.js",
    ]);
    expect(getElectronLaunchArgs("C:\\app\\main.js", "win32", true)).toEqual([
      "C:\\app\\main.js",
    ]);
  });
});
