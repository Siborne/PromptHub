import { useEffect, useMemo, useState } from "react";
import { RefreshCwIcon, SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentScannedSkill,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import {
  useAgentAssetInventoryMap,
  type AgentAssetDomain,
} from "./use-agent-asset-domain";
import {
  AgentSkillAssetPanel,
  useAgentSkillAssets,
} from "./AgentSkillAssetPanel";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SkillFullDetailPage } from "../skill/SkillFullDetailPage";
import { SkillLibraryImportModal } from "../skill/SkillLibraryImportModal";
import { buildProjectDetailSkill } from "../skill/project-detail-adapter";

const DOMAIN_META: Record<
  AgentAssetDomain,
  {
    labelKey: string;
    fallback: string;
    emptyKey: string;
    emptyFallback: string;
  }
> = {
  skills: {
    labelKey: "agents.skills",
    fallback: "Skills",
    emptyKey: "agents.noSkillsDetected",
    emptyFallback: "No skills were detected for this Agent.",
  },
  mcp: {
    labelKey: "agents.mcp",
    fallback: "MCP",
    emptyKey: "agents.noMcpDetected",
    emptyFallback: "No MCP servers were detected for this Agent.",
  },
  rules: {
    labelKey: "agents.rules",
    fallback: "Rules",
    emptyKey: "agents.noRulesDetected",
    emptyFallback: "No rules file was detected for this Agent.",
  },
  plugins: {
    labelKey: "agents.plugins",
    fallback: "Plugins",
    emptyKey: "agents.noPluginsDetected",
    emptyFallback: "No plugins were detected for this Agent.",
  },
};

export function AgentAssetsWorkspace({
  agent,
  domain,
}: {
  agent: ManagedAgentSummary;
  domain: AgentAssetDomain;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const inventories = useAgentAssetInventoryMap(agent);
  const skillAssets = useAgentSkillAssets(agent);
  const [selectedSkillPath, setSelectedSkillPath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setSelectedSkillPath((current) =>
      current && skillAssets.rows.some((row) => row.skill.localPath === current)
        ? current
        : null,
    );
  }, [skillAssets.rows]);

  const activeDomain = agent.paths[domain] ? domain : null;

  const activeInventory = activeDomain ? inventories[activeDomain] : null;
  const filteredItems = useMemo(() => {
    const items = activeInventory?.items ?? [];
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.label, item.meta]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalized)),
    );
  }, [activeInventory?.items, query]);

  const selectedSkillRow = useMemo(
    () =>
      skillAssets.rows.find(
        (row) => row.skill.localPath === selectedSkillPath,
      ) ?? null,
    [skillAssets.rows, selectedSkillPath],
  );

  const selectedManagedSkill = selectedSkillRow?.status.managedSkill ?? null;

  const detailSkill = useMemo(() => {
    if (!selectedSkillRow) {
      return null;
    }
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
        {!activeDomain || !activeInventory ? (
          <div className="flex min-h-48 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
            {t("agents.notAvailable", "Not available")}
          </div>
        ) : activeDomain === "skills" ? (
          detailSkill && selectedSkillRow ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SkillFullDetailPage
                overrideSkill={detailSkill}
                agentContext={{
                  installMode: selectedSkillRow.skill.installMode,
                  isManaged: Boolean(selectedManagedSkill),
                  isPlatformBuiltin: selectedSkillRow.skill.isPlatformBuiltin,
                  platformId: agent.id,
                  platformName: agent.name,
                  sourcePath: selectedSkillRow.skill.localPath,
                  symlinkTargetPath: selectedSkillRow.skill.symlinkTargetPath,
                }}
                agentActions={{
                  isImporting:
                    skillAssets.importingSkillPath ===
                    selectedSkillRow.skill.localPath,
                  isUninstalling: skillAssets.isUninstalling,
                  onImport: selectedManagedSkill
                    ? undefined
                    : () =>
                        void skillAssets.importSkill(selectedSkillRow.skill),
                  onOpenFolder: async () => {
                    await window.electron?.openPath?.(
                      selectedSkillRow.skill.localPath,
                    );
                  },
                  onOpenSymlinkTarget: selectedSkillRow.skill.symlinkTargetPath
                    ? async () => {
                        await window.electron?.openPath?.(
                          selectedSkillRow.skill.symlinkTargetPath ?? "",
                        );
                      }
                    : undefined,
                  onOpenManagedSkill: selectedManagedSkill
                    ? () => skillAssets.openManagedSkill(selectedManagedSkill)
                    : undefined,
                  onUninstall: selectedSkillRow.skill.isReadOnlyDiscovery
                    ? undefined
                    : () =>
                        skillAssets.setPendingUninstall(selectedSkillRow.skill),
                }}
                onBack={() => setSelectedSkillPath(null)}
              />
            </div>
          ) : (
            <AgentSkillAssetPanel
              agent={agent}
              assets={skillAssets}
              onOpenDetail={handleOpenSkillDetail}
            />
          )
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t(
                  DOMAIN_META[activeDomain].labelKey,
                  DOMAIN_META[activeDomain].fallback,
                )}
              </h2>
              <label className="relative block min-w-40 flex-1 sm:max-w-72">
                <SearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={t("agents.searchAssets", "Search assets")}
                  placeholder={t("agents.searchAssets", "Search assets")}
                  className="h-8 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <span className="hidden min-w-0 flex-1 truncate text-right font-mono text-xs text-muted-foreground lg:block">
                {agent.paths[activeDomain]}
              </span>
              <button
                type="button"
                onClick={activeInventory.refresh}
                aria-label={t(
                  "agents.refreshCurrentAsset",
                  "Refresh current view",
                )}
                title={t("agents.refreshCurrentAsset", "Refresh current view")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="max-w-md text-sm leading-6 text-muted-foreground">
                    {t(
                      DOMAIN_META[activeDomain].emptyKey,
                      DOMAIN_META[activeDomain].emptyFallback,
                    )}
                  </p>
                </div>
              ) : (
                <ul>
                  {filteredItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex min-h-11 items-center justify-between gap-4 border-b border-border/60 px-5 py-2.5 transition-colors hover:bg-accent/45"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      {item.meta ? (
                        <span className="shrink-0 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {item.meta}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
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
