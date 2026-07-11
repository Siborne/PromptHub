import { describe, expect, it } from "vitest";

import {
  getScreenshotPlanMismatch,
  README_DESKTOP_MODULES,
  README_DESKTOP_SCREENSHOT_FILENAMES,
  README_DESKTOP_SCREENSHOTS,
} from "../../../scripts/readme-screenshot-plan.mts";

describe("README desktop screenshot plan", () => {
  it("covers each top-level desktop module with a unique image", () => {
    expect(README_DESKTOP_MODULES).toEqual([
      "prompt",
      "skill",
      "mcp",
      "plugin",
      "rules",
    ]);

    for (const module of README_DESKTOP_MODULES) {
      expect(README_DESKTOP_SCREENSHOTS[module]).not.toHaveLength(0);
    }

    expect(new Set(README_DESKTOP_SCREENSHOT_FILENAMES).size).toBe(
      README_DESKTOP_SCREENSHOT_FILENAMES.length,
    );
  });

  it("reports missing and unlisted capture outputs before Electron starts", () => {
    expect(
      getScreenshotPlanMismatch(
        README_DESKTOP_SCREENSHOT_FILENAMES.filter(
          (filename) => filename !== "19-plugin-workspace.png",
        ),
      ),
    ).toEqual({
      missing: ["19-plugin-workspace.png"],
      unlisted: [],
    });

    expect(
      getScreenshotPlanMismatch([
        ...README_DESKTOP_SCREENSHOT_FILENAMES,
        "orphan.png",
      ]),
    ).toEqual({
      missing: [],
      unlisted: ["orphan.png"],
    });
  });
});
