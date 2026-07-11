import { describe, expect, it } from "vitest";

import { resolveVisibleDesktopHomeModules } from "../../../src/renderer/services/desktop-home-modules";

describe("resolveVisibleDesktopHomeModules", () => {
  it("keeps Desktop legacy module expansion intact", () => {
    expect(
      resolveVisibleDesktopHomeModules(["prompt", "skill", "rules"], false),
    ).toEqual(["prompt", "skill", "mcp", "plugin", "rules"]);
  });

  it("honors an explicit Desktop module selection", () => {
    expect(
      resolveVisibleDesktopHomeModules(["prompt", "rules"], false),
    ).toEqual(["prompt", "rules"]);
  });

  it("excludes Desktop-owned MCP and Plugin modules in the Web runtime", () => {
    expect(
      resolveVisibleDesktopHomeModules(
        ["prompt", "skill", "mcp", "plugin", "rules"],
        true,
      ),
    ).toEqual(["prompt", "skill", "rules"]);
  });
});
