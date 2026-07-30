import { describe, expect, it, vi } from "vitest";

import { revealRuleFile } from "../../../src/renderer/components/rules/rule-open-location";

describe("revealRuleFile", () => {
  it("passes the exact rule file to the shell boundary", async () => {
    const openPath = vi.fn().mockResolvedValue({ success: true });

    await expect(
      revealRuleFile("/Users/test/.claude/CLAUDE.md", openPath),
    ).resolves.toEqual({ success: true });
    expect(openPath).toHaveBeenCalledWith("/Users/test/.claude/CLAUDE.md");
  });

  it("normalizes missing, rejected, and failed shell boundaries", async () => {
    await expect(
      revealRuleFile("/Users/test/.claude/CLAUDE.md", undefined),
    ).resolves.toEqual({
      success: false,
      error: "Shell bridge is unavailable",
    });

    await expect(
      revealRuleFile(
        "/Users/test/.claude/CLAUDE.md",
        vi.fn().mockRejectedValue(new Error("Finder unavailable")),
      ),
    ).resolves.toEqual({
      success: false,
      error: "Finder unavailable",
    });

    await expect(
      revealRuleFile(
        "/Users/test/.claude/CLAUDE.md",
        vi.fn().mockRejectedValue("Blocked by policy"),
      ),
    ).resolves.toEqual({
      success: false,
      error: "Blocked by policy",
    });

    await expect(
      revealRuleFile(
        "/Users/test/.claude/CLAUDE.md",
        vi.fn().mockResolvedValue(undefined),
      ),
    ).resolves.toEqual({
      success: false,
      error: "Shell did not return a result",
    });

    await expect(
      revealRuleFile(
        "/Users/test/.claude/CLAUDE.md",
        vi.fn().mockResolvedValue({ success: false, error: "Missing file" }),
      ),
    ).resolves.toEqual({
      success: false,
      error: "Missing file",
    });
  });
});
