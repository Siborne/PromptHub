import { describe, expect, it } from "vitest";

import {
  getOrderedGlobalRuleFiles,
  partitionGlobalRuleFilesByFamily,
} from "../../../src/renderer/services/rule-platform-order";
import type { RuleFileDescriptor } from "@prompthub/shared/types";

function ruleFile(
  platformId: string,
  overrides: Partial<RuleFileDescriptor> = {},
): RuleFileDescriptor {
  return {
    id: `${platformId}-global`,
    platformId: platformId as RuleFileDescriptor["platformId"],
    platformName: platformId,
    platformIcon: "Bot",
    platformDescription: platformId,
    name: "AGENTS.md",
    description: platformId,
    path: `~/.${platformId}/AGENTS.md`,
    exists: true,
    group: "assistant",
    ...overrides,
  };
}

describe("rule platform order", () => {
  it("follows skillPlatformOrder before shared default order", () => {
    const files = [
      ruleFile("claude"),
      ruleFile("codex"),
      ruleFile("openclaw", { name: "SOUL.md" }),
      ruleFile("gemini", { name: "GEMINI.md" }),
    ];

    const ordered = getOrderedGlobalRuleFiles(files, [
      "gemini",
      "openclaw",
      "claude",
    ]);

    expect(ordered.map((file) => file.platformId)).toEqual([
      "gemini",
      "openclaw",
      "claude",
      "codex",
    ]);
  });

  it("partitions claw platforms from code/work platforms", () => {
    const files = [
      ruleFile("claude"),
      ruleFile("openclaw", { name: "SOUL.md" }),
      ruleFile("codex"),
      ruleFile("qclaw", {
        id: "custom:qclaw",
        platformId: "qclaw" as RuleFileDescriptor["platformId"],
      }),
    ];

    const { codeWork, claw } = partitionGlobalRuleFilesByFamily(files);
    expect(codeWork.map((file) => file.platformId)).toEqual(["claude", "codex"]);
    expect(claw.map((file) => file.platformId)).toEqual(["openclaw", "qclaw"]);
  });
});
