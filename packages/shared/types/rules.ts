import {
  KNOWN_RULE_FILE_TEMPLATES,
  RULE_FILE_GROUPS,
} from "../constants/rules";
import type { AIProtocol } from "./ai";

export type KnownRuleFileId = keyof typeof KNOWN_RULE_FILE_TEMPLATES;
export type CustomRuleFileId = `custom:${string}`;
export type RulePlatformId =
  | (typeof KNOWN_RULE_FILE_TEMPLATES)[keyof typeof KNOWN_RULE_FILE_TEMPLATES]["platformId"]
  | `custom:${string}`
  | "workspace";

export type RuleFileId = KnownRuleFileId | CustomRuleFileId | `project:${string}`;

export type RuleFileGroup = (typeof RULE_FILE_GROUPS)[number];

export type RuleSyncStatus =
  | "synced"
  | "target-missing"
  | "out-of-sync"
  | "sync-error";

export interface RuleVersionSnapshot {
  id: string;
  savedAt: string;
  content: string;
  source: "manual-save" | "ai-rewrite" | "create";
}

export interface RuleFileDescriptor {
  id: RuleFileId;
  platformId: RulePlatformId;
  platformName: string;
  platformIcon: string;
  platformDescription: string;
  name: string;
  description: string;
  path: string;
  exists: boolean;
  group: RuleFileGroup;
  managedPath?: string;
  targetPath?: string;
  projectRootPath?: string | null;
  syncStatus?: RuleSyncStatus;
}

export interface RuleFileContent extends RuleFileDescriptor {
  content: string;
  targetContent?: string;
  versions: RuleVersionSnapshot[];
}

export type RuleConflictResolutionStrategy = "use-managed" | "use-target";

export interface CreateRuleProjectInput {
  id?: string;
  name: string;
  rootPath: string;
}

export interface RuleMissingCleanupResult {
  removed: RuleFileId[];
  skipped: string[];
  failed: string[];
}

export interface RuleBackupRecord {
  id: RuleFileId;
  platformId: RulePlatformId;
  platformName: string;
  platformIcon: string;
  platformDescription: string;
  name: string;
  description: string;
  path: string;
  managedPath?: string;
  targetPath?: string;
  projectRootPath?: string | null;
  syncStatus?: RuleSyncStatus;
  content: string;
  versions: RuleVersionSnapshot[];
}

export interface RuleRecord {
  id: RuleFileId;
  scope: "global" | "project";
  platformId: RulePlatformId;
  platformName: string;
  platformIcon: string;
  platformDescription: string;
  canonicalFileName: string;
  description: string;
  managedPath: string;
  targetPath: string;
  projectRootPath?: string | null;
  syncStatus: RuleSyncStatus;
  currentVersion: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleVersionRecord {
  id: string;
  ruleId: RuleFileId;
  version: number;
  filePath: string;
  source: RuleVersionSnapshot["source"];
  createdAt: string;
}

export interface RuleRewriteRequest {
  aiConfig?: {
    apiKey: string;
    apiUrl: string;
    model: string;
    provider: string;
    apiProtocol: AIProtocol;
  };
  instruction: string;
  currentContent: string;
  fileName: string;
  platformName: string;
}

export interface RuleRewriteResult {
  content: string;
  summary: string;
}

export function isRuleFileId(value: string): value is RuleFileId {
  return (
    value.startsWith('project:') ||
    value.startsWith('custom:') ||
    value in KNOWN_RULE_FILE_TEMPLATES
  );
}

export function isRulePlatformId(value: string): value is RulePlatformId {
  if (value === 'workspace') {
    return true;
  }

  if (value.startsWith('custom:')) {
    return true;
  }

  return Object.values(KNOWN_RULE_FILE_TEMPLATES).some((template) => template.platformId === value);
}
