import { describe, expect, it } from "vitest";

import {
  filterDetectedPlatforms,
  filterDeployablePlatforms,
  filterVisiblePlatforms,
} from "../../../src/renderer/services/platform-visibility";

describe("platform visibility", () => {
  it("filters disabled platforms from generic platform lists", () => {
    expect(
      filterVisiblePlatforms(
        [
          { id: "claude", name: "Claude Code" },
          { id: "codex", name: "Codex CLI" },
          { id: "opencode", name: "OpenCode" },
        ],
        ["codex"],
      ),
    ).toEqual([
      { id: "claude", name: "Claude Code" },
      { id: "opencode", name: "OpenCode" },
    ]);
  });

  it("filters disabled platforms after detection", () => {
    expect(
      filterDetectedPlatforms(
        [
          { id: "claude", name: "Claude Code" } as any,
          { id: "codex", name: "Codex CLI" } as any,
          { id: "opencode", name: "OpenCode" } as any,
        ],
        ["claude", "codex", "opencode"],
        ["claude", "opencode"],
      ).map((platform) => platform.id),
    ).toEqual(["codex"]);
  });

  it("includes configured custom and overridden platforms even when undetected", () => {
    expect(
      filterDeployablePlatforms(
        [
          { id: "claude", name: "Claude Code", isConfigured: true } as any,
          { id: "codex", name: "Codex CLI" } as any,
          { id: "custom-agent-1", name: "Team Agent", isCustom: true } as any,
          { id: "opencode", name: "OpenCode" } as any,
        ],
        [],
        [],
      ).map((platform) => platform.id),
    ).toEqual(["claude", "custom-agent-1"]);
  });

  it("keeps disabled platforms hidden even when explicitly configured", () => {
    expect(
      filterDeployablePlatforms(
        [
          { id: "claude", name: "Claude Code", isConfigured: true } as any,
          { id: "custom-agent-1", name: "Team Agent", isCustom: true } as any,
        ],
        [],
        ["custom-agent-1"],
      ).map((platform) => platform.id),
    ).toEqual(["claude"]);
  });
});
