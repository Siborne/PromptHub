import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeProjectDeployTargets,
  normalizeSkillProjects,
} from "../../../src/renderer/services/skill-project-settings";

describe("Skill project settings normalization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds the default project deploy target and removes duplicate paths", () => {
    expect(normalizeProjectDeployTargets(undefined, "/repo/ ")).toEqual([
      "/repo/.agents/skills",
    ]);
    expect(
      normalizeProjectDeployTargets(
        [" /repo/.claude/skills ", "/repo/.claude/skills"],
        "/repo",
      ),
    ).toEqual(["/repo/.claude/skills"]);
  });

  it("rejects malformed projects and normalizes durable path fields", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    expect(
      normalizeSkillProjects([
        null,
        { id: "missing-root", name: "Missing" },
        {
          id: " project-1 ",
          name: " Demo ",
          rootPath: " /repo ",
          scanPaths: ["/repo", " /repo/packages ", "/repo/packages"],
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "project-1",
        name: "Demo",
        rootPath: "/repo",
        scanPaths: ["/repo/packages"],
        deployTargets: ["/repo/.agents/skills"],
        createdAt: 123,
        updatedAt: 123,
      }),
    ]);
  });
});
