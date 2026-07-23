import { describe, expect, it } from "vitest";

import { resolveVisibleDesktopHomeModules } from "../../../src/renderer/services/desktop-home-modules";

describe("resolveVisibleDesktopHomeModules", () => {
  it("keeps the migrated Desktop default module order intact", () => {
    expect(
      resolveVisibleDesktopHomeModules(
        ["prompt", "agents", "skill", "mcp", "plugin", "rules"],
        false,
      ),
    ).toEqual(["prompt", "agents", "skill", "mcp", "plugin", "rules"]);
  });

  it("honors an explicit Desktop module selection", () => {
    expect(
      resolveVisibleDesktopHomeModules(["prompt", "rules"], false),
    ).toEqual(["prompt", "rules"]);
  });

  it("excludes Desktop-owned Agent, MCP, and Plugin modules in the Web runtime", () => {
    expect(
      resolveVisibleDesktopHomeModules(
        ["prompt", "skill", "agents", "mcp", "plugin", "rules"],
        true,
      ),
    ).toEqual(["prompt", "skill", "rules"]);
  });
});
