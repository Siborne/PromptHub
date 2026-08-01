import type { AgentScannedSkill, Skill } from "@prompthub/shared/types";
import { SkillFullDetailPage } from "./SkillFullDetailPage";

interface AgentSkillDetailPageProps {
  detailSkill: Skill;
  isImporting?: boolean;
  isUninstalling?: boolean;
  managedSkill?: Skill | null;
  platformId: string;
  platformName: string;
  scannedSkill: AgentScannedSkill;
  onBack: () => void;
  onImport: () => void | Promise<void>;
  onOpenManagedSkill?: () => void | Promise<void>;
  onUninstall?: () => void | Promise<void>;
}

export function AgentSkillDetailPage({
  detailSkill,
  isImporting,
  isUninstalling,
  managedSkill,
  platformId,
  platformName,
  scannedSkill,
  onBack,
  onImport,
  onOpenManagedSkill,
  onUninstall,
}: AgentSkillDetailPageProps) {
  return (
    <SkillFullDetailPage
      overrideSkill={detailSkill}
      agentContext={{
        installMode: scannedSkill.installMode,
        isManaged: Boolean(managedSkill),
        isPlatformBuiltin: scannedSkill.isPlatformBuiltin,
        platformId,
        platformName,
        sourcePath: scannedSkill.localPath,
        symlinkTargetPath: scannedSkill.symlinkTargetPath,
      }}
      agentActions={{
        isImporting,
        isUninstalling,
        onImport: managedSkill ? undefined : onImport,
        onOpenFolder: async () => {
          await window.electron?.openPath?.(scannedSkill.localPath);
        },
        onOpenManagedSkill: managedSkill ? onOpenManagedSkill : undefined,
        onOpenSymlinkTarget: scannedSkill.symlinkTargetPath
          ? async () => {
              await window.electron?.openPath?.(
                scannedSkill.symlinkTargetPath ?? "",
              );
            }
          : undefined,
        onUninstall: scannedSkill.isReadOnlyDiscovery ? undefined : onUninstall,
      }}
      onBack={onBack}
    />
  );
}
