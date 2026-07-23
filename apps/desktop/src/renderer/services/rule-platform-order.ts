import { DEFAULT_SKILL_PLATFORM_ORDER } from "@prompthub/shared/constants/platforms";
import { RULE_PLATFORM_ORDER } from "@prompthub/shared/constants/rules";
import { getAgentPlatformFamily } from "@prompthub/shared/constants/platforms";
import { isRulePlatformId } from "@prompthub/shared/types";
import type { RuleFileDescriptor } from "@prompthub/shared/types";

/**
 * Order global rule cards the same way Agent management / Skills do:
 * user `skillPlatformOrder` first, then shared DEFAULT_SKILL_PLATFORM_ORDER,
 * then rules-only whitelist, then any remaining discovered platforms.
 */
export function getOrderedGlobalRuleFiles(
  files: RuleFileDescriptor[],
  preferredOrder: string[] = [],
): RuleFileDescriptor[] {
  const globalFiles = files.filter((file) => !file.id.startsWith("project:"));
  const fileByPlatformId = new Map(
    globalFiles.map((file) => [file.platformId, file] as const),
  );
  const seenPlatformIds = new Set<string>();
  const ordered: RuleFileDescriptor[] = [];

  const pushPlatform = (platformId: string) => {
    if (!platformId || seenPlatformIds.has(platformId) || !isRulePlatformId(platformId)) {
      return;
    }
    seenPlatformIds.add(platformId);
    const file = fileByPlatformId.get(platformId);
    if (file) {
      ordered.push(file);
    }
  };

  for (const platformId of preferredOrder) {
    pushPlatform(platformId);
  }

  // Align with Agent management / Skills default order (not Rules-only order).
  for (const platformId of DEFAULT_SKILL_PLATFORM_ORDER) {
    pushPlatform(platformId);
  }

  for (const platformId of RULE_PLATFORM_ORDER) {
    pushPlatform(platformId);
  }

  for (const file of globalFiles) {
    pushPlatform(file.platformId);
  }

  return ordered;
}

export function partitionGlobalRuleFilesByFamily(
  files: RuleFileDescriptor[],
): {
  codeWork: RuleFileDescriptor[];
  claw: RuleFileDescriptor[];
} {
  const codeWork: RuleFileDescriptor[] = [];
  const claw: RuleFileDescriptor[] = [];

  for (const file of files) {
    if (getAgentPlatformFamily(file.platformId) === "claw") {
      claw.push(file);
    } else {
      codeWork.push(file);
    }
  }

  return { codeWork, claw };
}
