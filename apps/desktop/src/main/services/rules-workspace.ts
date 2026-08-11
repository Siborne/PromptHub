import {
  assertStorageMaintenanceAvailable,
  createRulesWorkspaceService,
} from "@prompthub/core";

import { initDatabase, RuleDB } from "../database";
import { getRulesDir, getUserDataPath } from "../runtime-paths";
import {
  getPlatformGlobalRulePath,
  getPlatformRootDir,
  readCustomAgentsFromSettings,
  resolvePlatformPath,
} from "./skill-installer-utils";

export const desktopRulesWorkspaceService = createRulesWorkspaceService({
  getRulesDir,
  assertStorageAvailable: () =>
    assertStorageMaintenanceAvailable(getUserDataPath()),
  createRuleDb: () => new RuleDB(initDatabase()),
  getPlatformGlobalRulePath,
  getPlatformRootDir,
  getExtraGlobalRuleTemplates: () =>
    readCustomAgentsFromSettings()
      .filter(
        (agent) =>
          agent.enabled !== false &&
          typeof agent.rulesRelativePath === "string" &&
          agent.rulesRelativePath.trim().length > 0,
      )
      .map((agent) => ({
        id: `custom:${agent.id}` as const,
        platformId: `custom:${agent.id}` as const,
        platformName: agent.name,
        platformIcon: "Bot",
        platformDescription: `Custom agent rules loaded from ${agent.rootPath}`,
        name:
          agent
            .rulesRelativePath!.split(/[\\/]+/)
            .filter(Boolean)
            .pop() || "AGENTS.md",
        description: `Global rules for custom agent ${agent.name}.`,
        group: "assistant" as const,
      })),
  getExtraGlobalRuleTargetPath: (template) => {
    const customAgentId = template.id.slice("custom:".length);
    const agent = readCustomAgentsFromSettings().find(
      (entry) => entry.id === customAgentId,
    );
    if (!agent?.rulesRelativePath) {
      return resolvePlatformPath(agent?.rootPath ?? "");
    }
    const root = resolvePlatformPath(agent.rootPath);
    return [
      root,
      ...agent.rulesRelativePath.split(/[\\/]+/).filter(Boolean),
    ].join(root.includes("\\") ? "\\" : "/");
  },
});

export const {
  listRuleDescriptors,
  listCachedRuleDescriptors,
  scanRuleDescriptors,
  getProjectMetaById,
  resolveRuleMeta,
  readRuleContent,
  saveRuleContent,
  resolveRuleConflict,
  deleteRuleVersion,
  createProjectRule,
  bootstrapRuleWorkspace,
  removeProjectRule,
  removeMissingProjectRules,
  exportRuleBackupRecords,
  importRuleBackupRecords,
} = desktopRulesWorkspaceService;
