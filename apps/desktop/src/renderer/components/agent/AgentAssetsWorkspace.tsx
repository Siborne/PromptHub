import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AgentScannedSkill,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import type { AgentAssetDomain } from "./use-agent-asset-domain";
import {
  AgentSkillAssetPanel,
  useAgentSkillAssets,
} from "./AgentSkillAssetPanel";
import { AgentMcpAssetPanel } from "./AgentMcpAssetPanel";
import { AgentPluginAssetPanel } from "./AgentPluginAssetPanel";
import { AgentRulesWorkspace } from "./AgentRulesWorkspace";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { AgentSkillDetailPage } from "../skill/AgentSkillDetailPage";
import { SkillLibraryImportModal } from "../skill/SkillLibraryImportModal";
import { buildProjectDetailSkill } from "../skill/project-detail-adapter";

/**
 * Renders the selected asset domain for one Agent.
 *
 * Each domain owns its workflow and store. Keeping the dispatch here prevents
 * the agent page from turning MCP and Plugin data into a read-only inventory
 * that cannot perform the same actions as the top-level managers.
 */
export function AgentAssetsWorkspace({
  agent,
  domain,
  onDetailOpenChange,
}: {
  agent: ManagedAgentSummary;
  domain: AgentAssetDomain;
  onDetailOpenChange?: (isOpen: boolean) => void;
}) {
  if (domain === "rules") {
    return (
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <AgentRulesWorkspace agent={agent} />
      </section>
    );
  }

  if (domain === "mcp") {
    return (
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <AgentMcpAssetPanel
          agent={agent}
          onDetailOpenChange={onDetailOpenChange}
        />
      </section>
    );
  }

  if (domain === "plugins") {
    return (
      <section className="flex h-full min-w-0 flex-1 flex-col">
        <AgentPluginAssetPanel
          agent={agent}
          onDetailOpenChange={onDetailOpenChange}
        />
      </section>
    );
  }

  return (
    <AgentSkillWorkspace
      agent={agent}
      onDetailOpenChange={onDetailOpenChange}
    />
  );
}

function AgentSkillWorkspace({
  agent,
  onDetailOpenChange,
}: {
  agent: ManagedAgentSummary;
  onDetailOpenChange?: (isOpen: boolean) => void;
}) {
  const { t } = useTranslation();
  const skillAssets = useAgentSkillAssets(agent);
  const [selectedSkillPath, setSelectedSkillPath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    onDetailOpenChange?.(Boolean(selectedSkillPath));
  }, [onDetailOpenChange, selectedSkillPath]);

  useEffect(() => () => onDetailOpenChange?.(false), [onDetailOpenChange]);

  useEffect(() => {
    setSelectedSkillPath((current) =>
      current && skillAssets.rows.some((row) => row.skill.localPath === current)
        ? current
        : null,
    );
  }, [skillAssets.rows]);

  const selectedSkillRow = useMemo(
    () =>
      skillAssets.rows.find(
        (row) => row.skill.localPath === selectedSkillPath,
      ) ?? null,
    [skillAssets.rows, selectedSkillPath],
  );
  const selectedManagedSkill = selectedSkillRow?.status.managedSkill ?? null;
  const detailSkill = useMemo(() => {
    if (!selectedSkillRow) return null;
    return buildProjectDetailSkill({
      scannedSkill: selectedSkillRow.skill,
      importedSkill: selectedSkillRow.status.managedSkill,
      projectName: agent.name,
      projectRootPath: skillAssets.skillsDir,
    });
  }, [agent.name, selectedSkillRow, skillAssets.skillsDir]);

  const handleOpenSkillDetail = (skill: AgentScannedSkill): void => {
    setSelectedSkillPath(skill.localPath);
  };

  return (
    <>
      <section className="flex h-full min-w-0 flex-1 flex-col">
        {!agent.paths.skills ? (
          <div className="flex min-h-48 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
            {t("agents.notAvailable", "Not available")}
          </div>
        ) : detailSkill && selectedSkillRow ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AgentSkillDetailPage
              detailSkill={detailSkill}
              isImporting={
                skillAssets.importingSkillPath ===
                selectedSkillRow.skill.localPath
              }
              isUninstalling={skillAssets.isUninstalling}
              managedSkill={selectedManagedSkill}
              platformId={agent.id}
              platformName={agent.name}
              scannedSkill={selectedSkillRow.skill}
              onBack={() => setSelectedSkillPath(null)}
              onImport={() =>
                void skillAssets.importSkill(selectedSkillRow.skill)
              }
              onOpenManagedSkill={
                selectedManagedSkill
                  ? () => skillAssets.openManagedSkill(selectedManagedSkill)
                  : undefined
              }
              onUninstall={() =>
                skillAssets.setPendingUninstall(selectedSkillRow.skill)
              }
            />
          </div>
        ) : (
          <AgentSkillAssetPanel
            agent={agent}
            assets={skillAssets}
            onOpenDetail={handleOpenSkillDetail}
          />
        )}
      </section>

      <SkillLibraryImportModal
        isOpen={skillAssets.isInstallModalOpen}
        onClose={() => skillAssets.setInstallModalOpen(false)}
        onConfirm={({ skillIds, importMode }) =>
          skillAssets.installLibrarySkills({ skillIds, importMode })
        }
        isDeploying={skillAssets.isInstallingLibrary}
        scannedSkills={skillAssets.rows.map((row) => row.skill)}
        skills={skillAssets.librarySkills}
        fixedTargetDirs={skillAssets.skillsDir ? [skillAssets.skillsDir] : []}
        showTargetSettings={false}
        title={t("skill.installMySkillToAgent", "Install My Skill")}
        description={t(
          "skill.installMySkillToAgentHint",
          "Select one or more skills from My Skills and install them into the selected agent's skill folder.",
        )}
        selectHint={t(
          "skill.selectSkillsToAgentHint",
          "Choose one or more skills to install into this agent.",
        )}
        confirmLabel={(count) =>
          t("skill.importSelectedToAgent", {
            count,
            defaultValue: `Install ${count} selected skill(s)`,
          })
        }
      />

      <ConfirmDialog
        isOpen={Boolean(skillAssets.pendingUninstall)}
        onClose={() => skillAssets.setPendingUninstall(null)}
        onConfirm={() => void skillAssets.confirmUninstall()}
        title={t("skill.uninstallFromAgent", "Uninstall from agent")}
        message={t(
          "skill.uninstallFromAgentConfirm",
          "Remove this skill folder from the selected agent? Symlink installs only remove the link.",
        )}
        confirmText={t("common.uninstall", "Uninstall")}
        cancelText={t("common.cancel", "Cancel")}
        variant="destructive"
        isLoading={skillAssets.isUninstalling}
      />
    </>
  );
}
