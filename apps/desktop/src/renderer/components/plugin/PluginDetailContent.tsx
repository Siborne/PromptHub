import { lazy, Suspense, useMemo } from "react";
import {
  CopyPlusIcon,
  FolderOpenIcon,
  LanguagesIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  SaveIcon,
  ServerIcon,
  StickyNoteIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  PluginDistributeMode,
  PluginLibraryEntry,
  PluginTargetCompatibility,
} from "@prompthub/shared/types/plugin";
import { Spinner } from "../ui/Spinner";
import { Textarea } from "../ui";
import {
  DETAIL_PAGE_PREVIEW_GRID_CLASS,
  DETAIL_PAGE_SOURCE_CLASS,
} from "../layout/detailPageLayout";
import { AgentPluginPreviewSidebar } from "./AgentPluginPreviewSidebar";
import { PluginPlatformPanel } from "./PluginPlatformPanel";
import { InventorySummary } from "./plugin-detail-utils";

const LazySkillFileEditor = lazy(() =>
  import("../skill/SkillFileEditor").then((module) => ({
    default: module.SkillFileEditor,
  })),
);

function PluginContentPreview({
  localPackagePath,
  plugin,
}: {
  localPackagePath: string;
  plugin: PluginLibraryEntry;
}) {
  const { t } = useTranslation();
  const contentBlocks = [
    plugin.longDescription,
    plugin.homepage
      ? `${t("plugin.homepage", "Homepage")}: ${plugin.homepage}`
      : "",
    plugin.repository || plugin.source.repository
      ? `${t("plugin.repository", "Repository")}: ${
          plugin.repository || plugin.source.repository
        }`
      : "",
    localPackagePath
      ? `${t("plugin.localPackagePath", "Local package")}: ${localPackagePath}`
      : "",
  ].filter((value): value is string => Boolean(value?.trim()));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("plugin.contentTitle", "Plugin Content")}
        </h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {t("plugin.manifestLabel", "Manifest")}
        </span>
      </div>
      <div className="rounded-2xl border border-border app-wallpaper-panel p-5">
        {contentBlocks.length > 0 ? (
          <div className="space-y-4">
            {contentBlocks.map((block, index) => (
              <p
                key={`${index}-${block.slice(0, 24)}`}
                className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90"
              >
                {block}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-7 text-muted-foreground">
            {t(
              "plugin.contentEmpty",
              "No extended Plugin content is available yet. Open the Files tab to inspect the package files.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}

export function PluginOverview({
  agentActions,
  agentContext,
  descriptionText,
  draftUserNotes,
  hasTranslatedDescription,
  isEditingUserNotes,
  isImportingChildMcp,
  isImportingChildSkills,
  isSavingUserNotes,
  isShowingTranslatedDescription,
  isTranslatingDescription,
  localPackagePath,
  onCancelUserNotes,
  onDistribute,
  onRemoveDistribution,
  onImportChildMcp,
  onImportChildSkills,
  onSaveUserNotes,
  onStartEditUserNotes,
  onTranslateDescription,
  onUserNotesChange,
  plugin,
  targetMatrix,
}: {
  agentActions?: {
    isImporting?: boolean;
    onImport?: () => void | Promise<void>;
    onOpenFolder?: () => void | Promise<void>;
    onOpenManagedPlugin?: () => void | Promise<void>;
  } | null;
  agentContext?: {
    isManaged?: boolean;
    platformId: string;
    platformName: string;
    sourcePath: string;
  } | null;
  descriptionText: string;
  draftUserNotes: string;
  hasTranslatedDescription: boolean;
  isEditingUserNotes: boolean;
  isImportingChildMcp?: boolean;
  isImportingChildSkills?: boolean;
  isSavingUserNotes: boolean;
  isShowingTranslatedDescription: boolean;
  isTranslatingDescription: boolean;
  localPackagePath: string;
  onCancelUserNotes: () => void;
  onDistribute: (
    targetIds: string[],
    mode: PluginDistributeMode,
  ) => Promise<void>;
  onRemoveDistribution?: (
    target: PluginTargetCompatibility,
  ) => Promise<void> | void;
  onImportChildMcp?: (plugin: PluginLibraryEntry) => void | Promise<void>;
  onImportChildSkills?: (plugin: PluginLibraryEntry) => void | Promise<void>;
  onSaveUserNotes: () => void | Promise<void>;
  onStartEditUserNotes: () => void;
  onTranslateDescription: (forceRefresh?: boolean) => void | Promise<void>;
  onUserNotesChange: (notes: string) => void;
  plugin: PluginLibraryEntry;
  targetMatrix: PluginTargetCompatibility[];
}) {
  const { t } = useTranslation();
  const canImportChildSkills = plugin.inventory.skills > 0;
  const canImportChildMcp = plugin.inventory.mcpServers > 0;
  const userNotes = plugin.userNotes ?? "";
  const isAgentDetail = Boolean(agentContext);

  return (
    <div
      className={`${DETAIL_PAGE_SOURCE_CLASS} ${DETAIL_PAGE_PREVIEW_GRID_CLASS}`}
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("plugin.descriptionTitle", "Plugin Description")}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onTranslateDescription(false)}
                disabled={isTranslatingDescription}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                  isShowingTranslatedDescription && hasTranslatedDescription
                    ? "bg-primary/10 text-primary"
                    : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isTranslatingDescription ? (
                  <Loader2Icon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-spin"
                  />
                ) : (
                  <LanguagesIcon aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {isTranslatingDescription
                  ? t("skill.translating", "Translating...")
                  : isShowingTranslatedDescription && hasTranslatedDescription
                    ? t("skill.showOriginal", "Show Original")
                    : hasTranslatedDescription
                      ? t("skill.showTranslation", "Show Translation")
                      : t("skill.translate", "AI Translate")}
              </button>
              {hasTranslatedDescription ? (
                <button
                  type="button"
                  onClick={() => void onTranslateDescription(true)}
                  disabled={isTranslatingDescription}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  title={t("skill.refreshTranslation", "Refresh Translation")}
                  aria-label={t(
                    "skill.refreshTranslation",
                    "Refresh Translation",
                  )}
                >
                  <RefreshCwIcon
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 ${isTranslatingDescription ? "animate-spin" : ""}`}
                  />
                </button>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-border app-wallpaper-panel p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {descriptionText}
            </p>
          </div>
        </section>

        {!isAgentDetail ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <StickyNoteIcon className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="truncate text-xs font-bold uppercase tracking-[0.2em]">
                  {t("plugin.userNotes", "Personal Notes")}
                </h3>
              </div>
              {isEditingUserNotes ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void onSaveUserNotes()}
                    disabled={isSavingUserNotes}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                    aria-label={t("common.save", "Save")}
                    title={t("common.save", "Save")}
                  >
                    {isSavingUserNotes ? (
                      <Loader2Icon
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <SaveIcon aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelUserNotes}
                    disabled={isSavingUserNotes}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label={t("common.cancel", "Cancel")}
                    title={t("common.cancel", "Cancel")}
                  >
                    <XIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onStartEditUserNotes}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                  aria-label={t("plugin.editUserNotes", "Edit notes")}
                  title={t("plugin.editUserNotes", "Edit notes")}
                >
                  <PencilIcon aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
            </div>

            <div
              data-testid="plugin-user-notes-card"
              className="rounded-2xl border border-border app-wallpaper-panel p-4"
            >
              {isEditingUserNotes ? (
                <Textarea
                  aria-label={t("plugin.userNotes", "Personal Notes")}
                  value={draftUserNotes}
                  onChange={(event) => onUserNotesChange(event.target.value)}
                  placeholder={t(
                    "plugin.userNotesPlaceholder",
                    "Add private notes about how you use this Plugin...",
                  )}
                  rows={5}
                  disabled={isSavingUserNotes}
                  className="min-h-[120px] resize-y"
                />
              ) : userNotes.trim() ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">
                  {userNotes}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("plugin.userNotesEmpty", "No personal notes yet.")}
                </p>
              )}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {t("plugin.inventoryTitle", "Inventory")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {canImportChildSkills ? (
                <button
                  type="button"
                  onClick={() => void onImportChildSkills?.(plugin)}
                  disabled={!localPackagePath || isImportingChildSkills}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("plugin.importChildSkillsFromPlugin", {
                    defaultValue: "Import Skills from {{name}}",
                    name: plugin.displayName,
                  })}
                  title={
                    localPackagePath
                      ? t("plugin.importChildSkills", "Import Skills")
                      : t(
                          "plugin.localPackageMissing",
                          "Local package not available",
                        )
                  }
                >
                  {isImportingChildSkills ? (
                    <Loader2Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                  ) : (
                    <CopyPlusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {t("plugin.importChildSkills", "Import Skills")}
                </button>
              ) : null}
              {canImportChildMcp ? (
                <button
                  type="button"
                  onClick={() => void onImportChildMcp?.(plugin)}
                  disabled={!localPackagePath || isImportingChildMcp}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("plugin.importChildMcpFromPlugin", {
                    defaultValue: "Import MCP from {{name}}",
                    name: plugin.displayName,
                  })}
                  title={
                    localPackagePath
                      ? t("plugin.importChildMcp", "Import MCP")
                      : t(
                          "plugin.localPackageMissing",
                          "Local package not available",
                        )
                  }
                >
                  {isImportingChildMcp ? (
                    <Loader2Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                  ) : (
                    <ServerIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {t("plugin.importChildMcp", "Import MCP")}
                </button>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-border app-wallpaper-panel p-5">
            <InventorySummary inventory={plugin.inventory} />
          </div>
        </section>

        <PluginContentPreview
          localPackagePath={localPackagePath}
          plugin={plugin}
        />
      </div>

      <div className="space-y-6">
        {isAgentDetail && agentContext ? (
          <AgentPluginPreviewSidebar
            isImporting={agentActions?.isImporting}
            isManaged={agentContext.isManaged}
            onImport={agentActions?.onImport}
            onOpenFolder={agentActions?.onOpenFolder}
            onOpenManagedPlugin={agentActions?.onOpenManagedPlugin}
            platformId={agentContext.platformId}
            platformName={agentContext.platformName}
            sourcePath={agentContext.sourcePath}
          />
        ) : (
          <>
            <PluginPlatformPanel
              plugin={plugin}
              localPackagePath={localPackagePath}
              onDistribute={onDistribute}
              onRemoveDistribution={onRemoveDistribution}
              targetMatrix={targetMatrix}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function PluginSourcePanel({
  localPackagePath,
  plugin,
}: {
  localPackagePath: string;
  plugin: PluginLibraryEntry;
}) {
  const { t } = useTranslation();
  const sourceJson = useMemo(
    () => JSON.stringify(plugin.source, null, 2),
    [plugin],
  );

  return (
    <div className={`${DETAIL_PAGE_SOURCE_CLASS} space-y-6`}>
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("plugin.metadata", "Plugin Metadata")}
        </h3>
        <div className="grid gap-3 rounded-2xl border border-border app-wallpaper-panel p-4 md:grid-cols-2">
          <MetadataItem label={t("plugin.id", "Plugin ID")} value={plugin.id} />
          <MetadataItem
            label={t("plugin.classificationLabel", "Classification")}
            value={plugin.classification}
          />
          <MetadataItem
            label={t("plugin.localPackagePath", "Local package")}
            value={
              localPackagePath ||
              t("plugin.localPackageMissing", "Not available")
            }
            wide
          />
          <MetadataItem
            label={t("plugin.source", "Source")}
            value={
              plugin.source.label ||
              plugin.source.repository ||
              plugin.source.url ||
              "-"
            }
            wide
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t("plugin.sourceManifest", "Source / Manifest")}
        </h3>
        <div className="overflow-hidden rounded-2xl border border-border app-wallpaper-panel">
          <pre className="max-h-[52vh] overflow-auto whitespace-pre-wrap break-words p-5 text-xs text-foreground/80">
            {sourceJson}
          </pre>
        </div>
      </section>
    </div>
  );
}

function MetadataItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <div className="text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-xs text-foreground">
        {value}
      </div>
    </div>
  );
}

export function PluginFilesPanel({
  localPackagePath,
  onUnsavedChange,
  plugin,
  readOnly = false,
}: {
  localPackagePath: string;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
  plugin: PluginLibraryEntry;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();

  if (!localPackagePath) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center">
        <FolderOpenIcon className="h-10 w-10 text-muted-foreground/50" />
        <h2 className="mt-3 text-base font-semibold text-foreground">
          {t("plugin.noLocalFilesTitle", "No local Plugin files")}
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t(
            "plugin.noLocalFilesDesc",
            "Install or materialize the Plugin package before browsing files.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden app-wallpaper-panel">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner
              size="lg"
              tone="muted"
              label={t("common.loading", "Loading...")}
            />
          </div>
        }
      >
        <LazySkillFileEditor
          skillId={plugin.id}
          localPath={localPackagePath}
          skillName={plugin.displayName}
          isOpen
          mode="inline"
          onUnsavedChange={onUnsavedChange}
          readOnly={readOnly}
          surfaceLabels={{
            noFiles: t("plugin.noFiles", "No local files for this Plugin"),
            modalTitle: t("plugin.fileEditor", "Plugin File Editor"),
          }}
        />
      </Suspense>
    </div>
  );
}
