import { describe, expect, it, vi } from "vitest";

import { formatSkillBranchListError } from "../../../src/renderer/services/skill-git-error";

describe("Skill Git error copy", () => {
  const t = vi.fn((_key: string, fallback: string) => fallback);

  it("distinguishes missing Git from a generic branch-list failure", () => {
    expect(
      formatSkillBranchListError(
        new Error("GIT_EXECUTABLE_UNAVAILABLE"),
        t as never,
      ),
    ).toContain("Install Git");
    expect(
      formatSkillBranchListError(new Error("network down"), t as never),
    ).toBe("Could not load remote branches. You can still type one manually.");
    expect(formatSkillBranchListError(503, t as never)).toBe(
      "Could not load remote branches. You can still type one manually.",
    );
  });
});
