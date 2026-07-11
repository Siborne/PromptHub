import { useTranslation } from "react-i18next";
import { CheckIcon, LoaderIcon } from "lucide-react";
import type { CreateSkillModalController } from "./useCreateSkillModalController";

interface CreateSkillModalFootersProps {
  controller: CreateSkillModalController;
}

export function CreateSkillModalFooters({
  controller,
}: CreateSkillModalFootersProps) {
  if (controller.mode === "github")
    return <GithubImportFooter controller={controller} />;
  if (
    controller.mode === "scan" &&
    controller.scanDone &&
    controller.annotatedScanResults.length
  )
    return <ScanImportFooter controller={controller} />;
  if (controller.mode === "manual")
    return <ManualCreateFooter controller={controller} />;
  return null;
}

function GithubImportFooter({ controller }: CreateSkillModalFootersProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="github-mode-footer"
      className="flex items-center justify-end gap-3 border-t border-border app-wallpaper-surface px-6 py-4 shrink-0"
    >
      <button
        type="button"
        onClick={() => {
          controller.resetGitHubImportState();
          controller.setMode("select");
        }}
        className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
      >
        {t("common.back", "Back")}
      </button>
      {controller.githubScanDone ? (
        <button
          type="button"
          onClick={controller.handleImportSelectedGitHubSkills}
          disabled={
            controller.isLoading || !controller.selectedGitHubSkills.size
          }
          className="flex min-w-[12rem] items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {controller.isLoading ? (
            <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckIcon className="w-4 h-4" aria-hidden="true" />
          )}
          {t("skill.importSelected", "Import Selected")}
        </button>
      ) : null}
    </div>
  );
}

function ScanImportFooter({ controller }: CreateSkillModalFootersProps) {
  const { t } = useTranslation();
  const selectedVisibleCount = controller.visibleSelectableScanResults.filter(
    (skill) => controller.selectedScanItems.has(skill.filePath),
  ).length;
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border shrink-0 app-wallpaper-surface">
      <span className="text-xs text-muted-foreground">
        {selectedVisibleCount} /{" "}
        {controller.visibleSelectableScanResults.length}{" "}
        {t("skill.selected", "selected")}
      </span>
      <button
        type="button"
        onClick={controller.handleImportSelected}
        disabled={controller.isLoading || !controller.selectedScanItems.size}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {controller.isLoading ? (
          <>
            <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t("skill.importing", "Importing...")} ({controller.importingCount}/
            {controller.selectedScanItems.size})
          </>
        ) : (
          <>
            <CheckIcon className="w-4 h-4" aria-hidden="true" />
            {t("skill.importSelected", "Import Selected")} (
            {controller.selectedScanItems.size})
          </>
        )}
      </button>
    </div>
  );
}

function ManualCreateFooter({ controller }: CreateSkillModalFootersProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0 app-wallpaper-surface">
      <button
        type="button"
        onClick={() => controller.setMode("select")}
        className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
      >
        {t("common.back", "Back")}
      </button>
      <button
        type="button"
        onClick={controller.handleManualCreate}
        disabled={
          controller.isLoading ||
          controller.isGenerating ||
          !controller.name.trim()
        }
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {controller.isLoading ? (
          <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckIcon className="w-4 h-4" aria-hidden="true" />
        )}
        {t("skill.create", "Create")}
      </button>
    </div>
  );
}
