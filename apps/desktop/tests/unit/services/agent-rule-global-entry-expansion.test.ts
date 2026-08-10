import { describe, expect, it } from "vitest";

import { getAgentPlatformCapabilityInventory } from "@prompthub/shared/constants/agent-platform-capabilities";
import {
  getPlatformById,
  getPlatformGlobalRuleTemplate,
} from "@prompthub/shared/constants/platforms";
import {
  KNOWN_RULE_FILE_TEMPLATES,
  RULE_PLATFORM_ORDER,
} from "@prompthub/shared/constants/rules";

const expectedEntries = [
  {
    platformId: "kiro",
    relativePath: "steering/AGENTS.md",
    resolvedTemplate: "~/.kiro/steering/AGENTS.md",
    fileName: "AGENTS.md",
  },
  {
    platformId: "augment",
    relativePath: "user-guidelines.md",
    resolvedTemplate: "~/.augment/user-guidelines.md",
    fileName: "user-guidelines.md",
  },
  {
    platformId: "cline",
    relativePath: "data/settings/rules/AGENTS.md",
    resolvedTemplate: "~/.cline/data/settings/rules/AGENTS.md",
    fileName: "AGENTS.md",
  },
] as const;

const templates = KNOWN_RULE_FILE_TEMPLATES as Record<
  string,
  {
    id: string;
    name: string;
    platformId: string;
  }
>;

describe("verified Agent rule global entries", () => {
  it.each(expectedEntries)(
    "registers $platformId with its documented global entry",
    ({ fileName, platformId, relativePath, resolvedTemplate }) => {
      const platform = getPlatformById(platformId);
      const descriptor = templates[`${platformId}-global`];

      expect(platform?.globalRuleFile).toBe(relativePath);
      expect(getPlatformGlobalRuleTemplate(platform!, "darwin")).toBe(
        resolvedTemplate,
      );
      expect(descriptor).toMatchObject({
        id: `${platformId}-global`,
        name: fileName,
        platformId,
      });
      expect(RULE_PLATFORM_ORDER).toContain(platformId);
      expect(getAgentPlatformCapabilityInventory(platform!).rules).toEqual({
        status: "partial",
        evidence: "global-rule-path",
      });
    },
  );

  it.each(["cursor", "qoder", "cherry-studio", "trae"])(
    "does not invent a global rule file for %s",
    (platformId) => {
      const platform = getPlatformById(platformId);

      expect(platform?.globalRuleFile).toBeUndefined();
      expect(
        Object.values(templates).some(
          (template) => template.platformId === platformId,
        ),
      ).toBe(false);
    },
  );
});
