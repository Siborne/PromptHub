import { useTranslation } from "react-i18next";
import {
  CheckSquareIcon,
  CopyIcon,
  FileTextIcon,
  FolderOpenIcon,
  HashIcon,
  Link2Icon,
  LoaderIcon,
  SearchIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { CreateSkillScanSourceChooser } from "./CreateSkillScanSourceChooser";
import { getImportModeButtonStyle } from "./create-skill-modal-utils";
import type { CreateSkillModalController } from "./useCreateSkillModalController";

interface CreateSkillLocalScanPanelProps {
  controller: CreateSkillModalController;
}

export function CreateSkillLocalScanPanel({
  controller,
}: CreateSkillLocalScanPanelProps) {
  if (!controller.scanDone)
    return <ScanSourceChooser controller={controller} />;
  if (!controller.annotatedScanResults.length)
    return <EmptyScanResults controller={controller} />;
  return <ScanResultWorkspace controller={controller} />;
}

function ScanSourceChooser({ controller }: CreateSkillLocalScanPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <CreateSkillScanSourceChooser
        isScanning={controller.isScanning}
        onChooseLocalFolder={controller.handleChooseLocalSkillFolder}
        onImportFromAgents={controller.handleImportFromAgentSkills}
        t={t}
      />
    </div>
  );
}

function EmptyScanResults({ controller }: CreateSkillLocalScanPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-8">
      <FolderOpenIcon
        className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground mb-4">
        {t("skill.noSkillsFound", "No new local SKILL.md files found.")}
      </p>
      <RescanButton controller={controller} large />
    </div>
  );
}

function ScanResultWorkspace({ controller }: CreateSkillLocalScanPanelProps) {
  return (
    <div className="space-y-3">
      <ScanImportNotice controller={controller} />
      <ScanStats controller={controller} />
      <ScanFilters controller={controller} />
      <ScanImportMode controller={controller} />
      <ScanResultsHeader controller={controller} />
      <ScanResultList controller={controller} />
      <div className="flex justify-center">
        <RescanButton controller={controller} />
      </div>
    </div>
  );
}

function ScanImportNotice({ controller }: CreateSkillLocalScanPanelProps) {
  return controller.scanImportNotice ? (
    <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
      {controller.scanImportNotice}
    </div>
  ) : null;
}

function ScanStats({ controller }: CreateSkillLocalScanPanelProps) {
  const { t } = useTranslation();
  const stats = [
    [
      "skill.scanStatsTotal",
      "总数",
      controller.annotatedScanResults.length,
      false,
    ],
    ["skill.scanStatsImported", "已导入", controller.importedScanCount, false],
    [
      "skill.scanStatsImportable",
      "可导入",
      controller.selectableScanResults.length,
      false,
    ],
    [
      "skill.scanStatsSelected",
      "已选择",
      controller.selectedScanItems.size,
      true,
    ],
  ] as const;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {stats.map(([key, fallback, value, selected]) => (
        <div
          key={key}
          className={`rounded-xl border px-3 py-2 ${selected ? "border-primary/20 bg-primary/5" : "border-border bg-accent/25"}`}
        >
          <div className="text-[11px] text-muted-foreground">
            {t(key, fallback)}
          </div>
          <div
            className={`mt-1 text-lg font-semibold ${selected ? "text-primary" : ""}`}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScanFilters({ controller }: CreateSkillLocalScanPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-3 sm:flex-row sm:items-center">
      <label className="relative block flex-1">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={controller.scanSearchQuery}
          onChange={(event) =>
            controller.setScanSearchQuery(event.target.value)
          }
          placeholder={t(
            "skill.searchImportPlaceholder",
            "搜索名称、描述、标签、平台或路径",
          )}
          className="h-10 w-full rounded-xl border border-border app-wallpaper-surface pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/40"
        />
      </label>
      <button
        type="button"
        onClick={() =>
          controller.setShowScanOptionalTags((visible) => !visible)
        }
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${controller.showScanOptionalTags ? "border-primary/40 bg-primary/5 text-primary" : "border-border app-wallpaper-surface text-muted-foreground hover:text-foreground"}`}
      >
        <HashIcon aria-hidden="true" className="h-4 w-4" />
        {controller.showScanOptionalTags
          ? t("skill.hideOptionalTags", "隐藏可选标签")
          : t("skill.showOptionalTags", "需要时再加标签")}
      </button>
    </div>
  );
}

function ScanImportMode({ controller }: CreateSkillLocalScanPanelProps) {
  const { t } = useTranslation();
  const isCopy = controller.scanImportMode === "copy";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs font-medium text-foreground">
          {t("skill.importMode", "Import Mode")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {isCopy
            ? t(
                "skill.mySkillsCopyModeHint",
                "Copy a standalone snapshot into My Skills.",
              )
            : t(
                "skill.mySkillsLinkModeHint",
                "Link My Skills to the original local source folder.",
              )}
        </div>
      </div>
      <div className="inline-flex rounded-lg border border-border app-wallpaper-surface p-0.5">
        <ImportModeButton
          active={isCopy}
          icon={<CopyIcon aria-hidden="true" className="h-3.5 w-3.5" />}
          label={t("skill.copyMode", "Copy")}
          onClick={() => controller.setScanImportMode("copy")}
        />
        <ImportModeButton
          active={!isCopy}
          icon={<Link2Icon aria-hidden="true" className="h-3.5 w-3.5" />}
          label={t("skill.linkMode", "Link")}
          onClick={() => controller.setScanImportMode("symlink")}
        />
      </div>
    </div>
  );
}

function ImportModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      style={getImportModeButtonStyle(active)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ScanResultsHeader({ controller }: CreateSkillLocalScanPanelProps) {
  const { t } = useTranslation();
  const allSelected = controller.visibleSelectableScanResults.every((skill) =>
    controller.selectedScanItems.has(skill.filePath),
  );
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">
        {t("skill.scanFound", "Found {{count}} skill(s)").replace(
          "{{count}}",
          String(controller.visibleAnnotatedScanResults.length),
        )}
      </p>
      {controller.visibleSelectableScanResults.length ? (
        <button
          type="button"
          onClick={controller.toggleSelectAll}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          {allSelected ? (
            <>
              <CheckSquareIcon className="w-3.5 h-3.5" aria-hidden="true" />{" "}
              {t("skill.deselectAll", "Deselect All")}
            </>
          ) : (
            <>
              <SquareIcon className="w-3.5 h-3.5" aria-hidden="true" />{" "}
              {t("skill.selectAll", "Select All")}
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

function ScanResultList({ controller }: CreateSkillLocalScanPanelProps) {
  return (
    <div className="max-h-[480px] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {controller.visibleAnnotatedScanResults.map((skill) => (
          <ScanResultCard
            key={skill.filePath}
            controller={controller}
            skill={skill}
          />
        ))}
      </div>
    </div>
  );
}

function ScanResultCard({
  controller,
  skill,
}: CreateSkillLocalScanPanelProps & {
  skill: CreateSkillModalController["visibleAnnotatedScanResults"][number];
}) {
  const { t } = useTranslation();
  const isSelected = controller.selectedScanItems.has(skill.filePath);
  return (
    <div
      role="button"
      tabIndex={skill.isImported ? -1 : 0}
      aria-disabled={skill.isImported}
      onClick={() =>
        !skill.isImported && controller.toggleScanItem(skill.filePath)
      }
      onKeyDown={(event) =>
        handleResultCardKeyDown(event, skill.isImported, () =>
          controller.toggleScanItem(skill.filePath),
        )
      }
      className={`w-full rounded-2xl border p-4 text-left transition-all shadow-sm ${getScanResultCardClassName(skill.isImported, isSelected)}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${skill.isImported ? "bg-accent text-muted-foreground" : "bg-primary/10 text-primary"}`}
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
              {skill.author ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {skill.author}
                </p>
              ) : null}
            </div>
            <ScanSelectionIcon selected={skill.isImported || isSelected} />
          </div>
          {skill.description ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground line-clamp-3">
              {skill.description}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skill.platforms.map((platform) => (
              <span
                key={platform}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/8 text-primary/80"
              >
                {platform}
              </span>
            ))}
          </div>
          {!skill.isImported &&
          isSelected &&
          controller.showScanOptionalTags ? (
            <ScanOptionalTags controller={controller} path={skill.localPath} />
          ) : null}
          <div
            className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground/60 font-mono truncate"
            title={skill.localPath}
          >
            <FolderOpenIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{getShortPath(skill.localPath)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function handleResultCardKeyDown(
  event: React.KeyboardEvent,
  isImported: boolean,
  onSelect: () => void,
) {
  if (isImported || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  onSelect();
}

function getScanResultCardClassName(
  isImported: boolean,
  isSelected: boolean,
): string {
  if (isImported)
    return "border-border bg-muted/30 opacity-70 cursor-not-allowed";
  return isSelected
    ? "border-primary/40 bg-primary/5 shadow-primary/10"
    : "border-border app-wallpaper-surface hover:border-primary/30 hover:shadow-md";
}

function ScanSelectionIcon({ selected }: { selected: boolean }) {
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

function ScanOptionalTags({
  controller,
  path,
}: CreateSkillLocalScanPanelProps & { path: string }) {
  const { t } = useTranslation();
  const tags = controller.scanTagDrafts[path] || [];
  const input = controller.scanTagInputs[path] || "";
  return (
    <div
      className="mt-4 rounded-xl border border-border bg-accent/20 p-3 space-y-2"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="text-[11px] font-medium text-foreground">
        {t("skill.importTagsOptional", "导入标签（可选）")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-white"
          >
            <HashIcon aria-hidden="true" className="w-3 h-3" />
            {tag}
            <button
              type="button"
              onClick={() => controller.handleRemoveScanTag(path, tag)}
              className="hover:text-white/70"
            >
              <XIcon aria-hidden="true" className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) =>
            controller.setScanTagInputs((inputs) => ({
              ...inputs,
              [path]: event.target.value,
            }))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              controller.handleAddScanTag(path);
            }
          }}
          placeholder={t("skill.enterTagHint", "输入新标签后按回车")}
          className="flex-1 h-9 rounded-xl border-0 bg-background px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => controller.handleAddScanTag(path)}
          disabled={!input.trim()}
          className="rounded-xl bg-background px-3 text-xs font-medium text-foreground transition-colors hover:app-wallpaper-surface disabled:opacity-50"
        >
          {t("skill.addTag", "添加标签")}
        </button>
      </div>
    </div>
  );
}

function getShortPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length >= 2
    ? `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`
    : path;
}

function RescanButton({
  controller,
  large = false,
}: CreateSkillLocalScanPanelProps & { large?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => void controller.handleScanLocal(controller.scanRootPaths)}
      disabled={controller.isScanning}
      className={
        large
          ? "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          : "flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
      }
    >
      {controller.isScanning ? (
        <LoaderIcon
          className={
            large ? "w-3.5 h-3.5 animate-spin" : "w-3 h-3 animate-spin"
          }
          aria-hidden="true"
        />
      ) : (
        <SearchIcon
          className={large ? "w-3.5 h-3.5" : "w-3 h-3"}
          aria-hidden="true"
        />
      )}
      {t("skill.rescan", "Rescan")}
    </button>
  );
}
