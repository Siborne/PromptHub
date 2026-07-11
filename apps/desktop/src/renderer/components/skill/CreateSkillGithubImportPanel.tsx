import { useTranslation } from "react-i18next";
import {
  CheckSquareIcon,
  FileTextIcon,
  LoaderIcon,
  SearchIcon,
  SquareIcon,
} from "lucide-react";
import { getRegistrySelectionKey } from "./create-skill-modal-utils";
import type { CreateSkillModalController } from "./useCreateSkillModalController";

interface CreateSkillGithubImportPanelProps {
  controller: CreateSkillModalController;
}

export function CreateSkillGithubImportPanel({
  controller,
}: CreateSkillGithubImportPanelProps) {
  const { t } = useTranslation();
  const hasResults =
    controller.githubScanDone && controller.annotatedGitHubResults.length > 0;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <GithubRepositoryInput controller={controller} hasResults={hasResults} />
      {hasResults ? <GithubSkillResults controller={controller} /> : null}
    </div>
  );
}

function GithubRepositoryInput({
  controller,
  hasResults,
}: CreateSkillGithubImportPanelProps & { hasResults: boolean }) {
  const { t } = useTranslation();
  return (
    <div data-testid="github-mode-intro" className="space-y-3">
      <label className="block text-sm font-medium mb-2">
        {t("skill.githubUrl", "Git Repository URL")}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={controller.githubUrl}
          onChange={(event) =>
            updateRepositoryUrl(controller, event.target.value)
          }
          placeholder="https://github.com/owner/skill-repo"
          className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => void controller.handleGitHubInstall()}
          disabled={controller.isLoading || !controller.normalizedGithubUrl}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {controller.isLoading ? (
            <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <SearchIcon className="w-4 h-4" aria-hidden="true" />
          )}
          {controller.githubScanNeedsRefresh
            ? t("skill.rescanRepository", "Rescan Repository")
            : t("skill.scanRepository", "Scan Repository")}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(
          "skill.githubUrlHint",
          "Use the repository root URL. PromptHub supports GitHub, Gitea, and other self-hosted Git repositories over HTTPS or SSH, then scans the repo for importable SKILL.md entries before you choose what to import.",
        )}
      </p>
      {controller.githubScanNeedsRefresh ? <GithubRescanWarning /> : null}
      {hasResults ? <GithubFallbackHint /> : <GithubRepositoryConstraints />}
    </div>
  );
}

function updateRepositoryUrl(
  controller: CreateSkillModalController,
  url: string,
) {
  controller.setGithubUrl(url);
  controller.setError(null);
  if (controller.githubScanDone || controller.githubScanResults.length) {
    controller.setGithubScanResults([]);
    controller.setSelectedGitHubSkills(new Set());
    controller.setGithubScanDone(false);
    controller.setGithubImportNotice(null);
  }
}

function GithubRescanWarning() {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      {t(
        "skill.githubScanNeedsRefresh",
        "The repository URL changed. Scan again to refresh the import options.",
      )}
    </div>
  );
}

function GithubFallbackHint() {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      {t(
        "skill.githubFallbackHint",
        "PromptHub will scan the repository for multiple SKILL.md entries. If none exist, it will fall back to the root README.md as a single import option.",
      )}
    </div>
  );
}

function GithubRepositoryConstraints() {
  const { t } = useTranslation();
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1.5">
      <p>
        {t(
          "skill.githubConstraintHint",
          "Only repository root URLs are supported, such as https://github.com/owner/repo, https://gitea.example.com/owner/repo, or git@host:owner/repo.git",
        )}
      </p>
      <p>
        {t(
          "skill.githubFallbackHint",
          "PromptHub will scan the repository for multiple SKILL.md entries. If none exist, it will fall back to the root README.md as a single import option.",
        )}
      </p>
    </div>
  );
}

function GithubSkillResults({ controller }: CreateSkillGithubImportPanelProps) {
  const { t } = useTranslation();
  const allSelected = controller.selectableGitHubResults.every((skill) =>
    controller.selectedGitHubSkills.has(getRegistrySelectionKey(skill)),
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden rounded-xl border border-border bg-background/60 p-4">
      {controller.githubImportNotice ? (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
          {controller.githubImportNotice}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-foreground">
            {t(
              "skill.githubScanFound",
              "Found {{count}} import option(s)",
            ).replace(
              "{{count}}",
              String(controller.annotatedGitHubResults.length),
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t(
              "skill.githubScanHint",
              "Select one or more skills from this repository before importing.",
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectAllGithubSkills(controller, allSelected)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          {allSelected ? (
            <>
              <CheckSquareIcon aria-hidden="true" className="w-3.5 h-3.5" />
              {t("skill.deselectAll", "Deselect All")}
            </>
          ) : (
            <>
              <SquareIcon aria-hidden="true" className="w-3.5 h-3.5" />
              {t("skill.selectAll", "Select All")}
            </>
          )}
        </button>
      </div>
      <div
        data-testid="github-results-scroll-area"
        className="min-h-[24rem] flex-1 overflow-y-auto pr-2"
      >
        <div className="grid grid-cols-1 gap-3">
          {controller.annotatedGitHubResults.map((skill) => (
            <GithubSkillResultCard
              controller={controller}
              key={getRegistrySelectionKey(skill)}
              skill={skill}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function selectAllGithubSkills(
  controller: CreateSkillModalController,
  allSelected: boolean,
) {
  controller.setSelectedGitHubSkills(
    allSelected
      ? new Set()
      : new Set(
          controller.selectableGitHubResults.map(getRegistrySelectionKey),
        ),
  );
}

function GithubSkillResultCard({
  controller,
  skill,
}: CreateSkillGithubImportPanelProps & {
  skill: CreateSkillModalController["annotatedGitHubResults"][number];
}) {
  const { t } = useTranslation();
  const key = getRegistrySelectionKey(skill);
  const isSelected = controller.selectedGitHubSkills.has(key);
  return (
    <button
      type="button"
      onClick={() => !skill.isImported && controller.toggleGitHubSkill(key)}
      disabled={skill.isImported}
      className={`w-full rounded-2xl border p-3.5 text-left transition-all shadow-sm ${getResultCardClassName(skill.isImported, isSelected)}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${skill.isImported ? "bg-accent text-muted-foreground" : "bg-primary/10 text-primary"}`}
        >
          <FileTextIcon aria-hidden="true" className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm truncate">{skill.name}</h4>
                {skill.isImported ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-accent text-muted-foreground shrink-0">
                    {t("skill.importedBadge", "Already Imported")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground break-all">
                {skill.source_url}
              </p>
            </div>
            <GithubSelectionIcon selected={skill.isImported || isSelected} />
          </div>
          <p className="mt-2.5 text-xs leading-5 text-muted-foreground line-clamp-2">
            {skill.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function getResultCardClassName(
  isImported: boolean,
  isSelected: boolean,
): string {
  if (isImported)
    return "border-border bg-muted/30 opacity-70 cursor-not-allowed";
  return isSelected
    ? "border-primary/40 bg-primary/5 shadow-primary/10"
    : "border-border app-wallpaper-surface hover:border-primary/30 hover:shadow-md";
}

function GithubSelectionIcon({ selected }: { selected: boolean }) {
  return (
    <div className="shrink-0 pt-0.5">
      {selected ? (
        <CheckSquareIcon aria-hidden="true" className="w-4 h-4 text-primary" />
      ) : (
        <SquareIcon
          aria-hidden="true"
          className="w-4 h-4 text-muted-foreground"
        />
      )}
    </div>
  );
}
