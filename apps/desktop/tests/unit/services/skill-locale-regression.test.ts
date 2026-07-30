import { describe, expect, it } from "vitest";

import de from "../../../src/renderer/i18n/locales/de.json";
import en from "../../../src/renderer/i18n/locales/en.json";
import es from "../../../src/renderer/i18n/locales/es.json";
import fr from "../../../src/renderer/i18n/locales/fr.json";
import ja from "../../../src/renderer/i18n/locales/ja.json";
import zhTW from "../../../src/renderer/i18n/locales/zh-TW.json";
import zh from "../../../src/renderer/i18n/locales/zh.json";

const locales = {
  de,
  en,
  es,
  fr,
  ja,
  zh,
  "zh-TW": zhTW,
} as const;

const requiredPaths = [
  "common.clear",
  "common.content",
  "common.disable",
  "common.disabled",
  "common.enable",
  "common.enabled",
  "common.refresh",
  "common.refreshing",
  "common.select",
  "common.selectAll",
  "common.open",
  "common.uninstall",
  "header.searchAgentSkills",
  "nav.agentSkills",
  "settings.autoScanStoreSkillsBeforeInstallDesc",
  "settings.exportAgents",
  "settings.skillSafetyChannelPolicies",
  "settings.skillSafetyStorePolicies",
  "settings.skillSafetyPolicyPrecedence",
  "settings.skillSafetyPolicyEnabled",
  "settings.skillSafetyPolicyDisabled",
  "settings.skillSafetyPolicyInheritGlobal",
  "settings.skillSafetyPolicyInheritChannel",
  "settings.skillSafetyChannelOfficial",
  "settings.skillSafetyChannelCommunity",
  "settings.skillSafetyChannelGitRepo",
  "settings.skillSafetyChannelMarketplace",
  "settings.skillSafetyChannelLocalDirectory",
  "settings.skillSafetyImmutableChecks",
  "skill.batchDeploy",
  "skill.batchManage",
  "skill.distributionStats",
  "skill.invalidGitRepo",
  "skill.loadingCommunityStore",
  "skill.loadingCustomStore",
  "skill.noCustomStores",
  "skill.noCustomStoresHint",
  "skill.customProjectDeployTarget",
  "skill.defaultProjectDeployTarget",
  "skill.deployToProjectFolders",
  "skill.remoteStoreRateLimitHint",
  "skill.remoteStoreRetry",
  "skill.projectDeploy",
  "skill.projectDeployHint",
  "skill.projectDeployedTargetCount",
  "skill.selectedCount",
  "skill.skillsCount",
  "skill.sourceClaudeLocalFolder",
  "skill.sourceCursorLocalFolder",
  "skill.sourceGithubRepo",
  "skill.sourceGithubStore",
  "skill.sourceLocalFolder",
  "skill.sourceRemoteGitRepo",
  "skill.sourceRemoteLink",
  "skill.sourceRemoteStore",
] as const;

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("skill locale regression", () => {
  for (const [locale, source] of Object.entries(locales)) {
    it(`${locale} defines required skill i18n keys`, () => {
      for (const path of requiredPaths) {
        const value = getPathValue(source as Record<string, unknown>, path);
        expect(typeof value, `${locale}:${path}`).toBe("string");
        expect(
          String(value).trim().length,
          `${locale}:${path}`,
        ).toBeGreaterThan(0);
      }
    });
  }
});
