import assert from "node:assert/strict";
import test from "node:test";

import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";
import {
  SHARED_SKILL_DISTRIBUTION_TARGETS,
  getSkillDistributionTargets,
} from "@prompthub/shared/constants/skill-distribution-targets";

test("projects the shared target without registering a pseudo-agent", () => {
  assert.equal(
    SKILL_PLATFORMS.some((platform) => platform.id === "agent-skills-global"),
    false,
  );
  assert.deepEqual(SHARED_SKILL_DISTRIBUTION_TARGETS, [
    {
      id: "agent-skills-global",
      kind: "shared",
      name: "Shared Agent Skills",
      maturity: "experimental",
      relativePath: ".agents/skills",
    },
  ]);
  assert.equal(
    getSkillDistributionTargets().filter(
      (target) => target.id === "agent-skills-global",
    ).length,
    1,
  );
});
