import { RuleDB } from "./database";

import { initDatabase } from "./database";
import {
  getDefaultPlatformGlobalRulePath,
  getDefaultPlatformRootDir,
} from "./platform-paths";
import { createRulesWorkspaceService } from "./rules-workspace";
import { getRulesDir, getUserDataPath } from "./runtime-paths";
import { assertStorageMaintenanceAvailable } from "./storage-maintenance-intent";

export const coreRulesWorkspaceService = createRulesWorkspaceService({
  getRulesDir,
  assertStorageAvailable: () =>
    assertStorageMaintenanceAvailable(getUserDataPath()),
  createRuleDb: () => new RuleDB(initDatabase()),
  getPlatformGlobalRulePath: getDefaultPlatformGlobalRulePath,
  getPlatformRootDir: getDefaultPlatformRootDir,
});

export const {
  listRuleDescriptors,
  listCachedRuleDescriptors,
  scanRuleDescriptors,
  getProjectMetaById,
  resolveRuleMeta,
  readRuleContent,
  saveRuleContent,
  deleteRuleVersion,
  createProjectRule,
  bootstrapRuleWorkspace,
  removeProjectRule,
  removeMissingProjectRules,
  exportRuleBackupRecords,
  importRuleBackupRecords,
} = coreRulesWorkspaceService;
