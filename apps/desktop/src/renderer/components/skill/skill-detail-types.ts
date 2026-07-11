import type { Skill } from "@prompthub/shared/types";
import type { ProjectDetailSkillContext } from "./project-detail-adapter";

export interface SkillAgentDetailContext {
  installMode: "copy" | "symlink";
  isManaged?: boolean;
  isPlatformBuiltin?: boolean;
  platformId: string;
  platformName: string;
  sourcePath: string;
  symlinkTargetPath?: string;
}

export interface SkillProjectDetailActions {
  isImporting?: boolean;
  isDeploying?: boolean;
  isRemoving?: boolean;
  onAddDeployTarget?: () => void | Promise<void>;
  onDeployToProjectTargets?: (targetDirs: string[]) => void | Promise<void>;
  onImport?: () => void | Promise<void>;
  onOpenManagedSkill?: () => void | Promise<void>;
  onRemoveFromProject?: () => void | Promise<void>;
}

export interface SkillAgentDetailActions {
  isImporting?: boolean;
  isUninstalling?: boolean;
  onImport?: () => void | Promise<void>;
  onOpenFolder?: () => void | Promise<void>;
  onOpenManagedSkill?: () => void | Promise<void>;
  onOpenSymlinkTarget?: () => void | Promise<void>;
  onUninstall?: () => void | Promise<void>;
}

export interface SkillFullDetailPageProps {
  overrideSkill?: Skill;
  projectContext?: ProjectDetailSkillContext | null;
  agentContext?: SkillAgentDetailContext | null;
  projectActions?: SkillProjectDetailActions | null;
  agentActions?: SkillAgentDetailActions | null;
  onBack?: () => void;
}

export type SkillDetailTab = "preview" | "code" | "files";
