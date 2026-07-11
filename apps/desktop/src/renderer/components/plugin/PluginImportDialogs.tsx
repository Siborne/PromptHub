import {
  CheckSquareIcon,
  FolderOpenIcon,
  GlobeIcon,
  Loader2Icon,
  PackagePlusIcon,
  XIcon,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { PluginSourcePreviewModal } from "./PluginStoreViews";
import type { PluginManagerViewModel } from "./usePluginManagerController";

export function PluginImportDialogs({
  model,
}: {
  model: PluginManagerViewModel;
}) {
  const {
    handleBackToSourceImportEdit,
    handleCloseSourceImport,
    handleCloseSourcePreview,
    handleConfirmSourceImport,
    handleImportLocalPlugin,
    handlePreviewSourcePlugin,
    isAddPluginModalOpen,
    isBatchMode,
    isImportingLocalPlugin,
    isImportingSourcePlugin,
    isPreviewingSourcePlugin,
    isSourceImportOpen,
    setIsAddPluginModalOpen,
    setIsSourceImportOpen,
    setSourceImportBranch,
    setSourceImportLabel,
    setSourceImportPackagePath,
    setSourceImportUrl,
    sourceImportBranch,
    sourceImportLabel,
    sourceImportPackagePath,
    sourceImportPreview,
    sourceImportUrl,
    t,
    handleToggleBatchMode,
  } = model;

  return (
    <>
      <Modal
        isOpen={isAddPluginModalOpen}
        onClose={() => setIsAddPluginModalOpen(false)}
        size="md"
        showCloseButton
        title={t("plugin.addPlugin", "New Plugin")}
        subtitle={t(
          "plugin.chooseAddMethod",
          "Choose how you want to add or manage Plugins.",
        )}
      >
        <div className="space-y-3 px-6 py-5">
          <button
            type="button"
            aria-label={t("plugin.importFromUrl", "Import from URL")}
            onClick={() => {
              setIsAddPluginModalOpen(false);
              setIsSourceImportOpen(true);
            }}
            disabled={isImportingSourcePlugin || isPreviewingSourcePlugin}
            className="group flex w-full items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="rounded-lg bg-primary p-3 text-primary-foreground">
              {isImportingSourcePlugin || isPreviewingSourcePlugin ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin"
                />
              ) : (
                <GlobeIcon aria-hidden="true" className="h-6 w-6" />
              )}
            </div>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">
                {t("plugin.importFromUrl", "Import from URL")}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t(
                  "plugin.importFromUrlOptionDesc",
                  "Paste a Git, SSH, or HTTPS Plugin source URL.",
                )}
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-label={t("plugin.importLocalPlugin", "Import local Plugin")}
            onClick={() => {
              setIsAddPluginModalOpen(false);
              void handleImportLocalPlugin();
            }}
            disabled={isImportingLocalPlugin}
            className="group flex w-full items-center gap-4 rounded-xl border border-border bg-accent/50 p-4 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="rounded-lg bg-background p-3 transition-colors group-hover:bg-primary/10">
              {isImportingLocalPlugin ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin text-foreground"
                />
              ) : (
                <FolderOpenIcon
                  aria-hidden="true"
                  className="h-6 w-6 text-foreground"
                />
              )}
            </div>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">
                {t("plugin.importLocalPlugin", "Import local Plugin")}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t(
                  "plugin.importLocalPluginOptionDesc",
                  "Choose a local Plugin package folder.",
                )}
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-label={t("plugin.batchManage", "Batch manage Plugins")}
            onClick={() => {
              setIsAddPluginModalOpen(false);
              handleToggleBatchMode();
            }}
            className="group flex w-full items-center gap-4 rounded-xl border border-border bg-accent/50 p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="rounded-lg bg-background p-3 transition-colors group-hover:bg-primary/10">
              {isBatchMode ? (
                <XIcon aria-hidden="true" className="h-6 w-6 text-foreground" />
              ) : (
                <CheckSquareIcon
                  aria-hidden="true"
                  className="h-6 w-6 text-foreground"
                />
              )}
            </div>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">
                {t("plugin.batchManage", "Batch manage Plugins")}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t(
                  "plugin.batchManageOptionDesc",
                  "Select multiple installed Plugins for tags, distribution, or deletion.",
                )}
              </span>
            </span>
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={isSourceImportOpen}
        onClose={handleCloseSourceImport}
        size="lg"
        showCloseButton
        closeOnBackdrop={!isImportingSourcePlugin && !isPreviewingSourcePlugin}
        closeOnEscape={!isImportingSourcePlugin && !isPreviewingSourcePlugin}
        title={t("plugin.importFromUrl", "Import from URL")}
        subtitle={t(
          "plugin.importFromUrlDesc",
          "Clone a Git, SSH, or HTTPS Plugin source and import a complete bundle into My Plugins.",
        )}
      >
        <form
          className="space-y-4 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePreviewSourcePlugin();
          }}
        >
          <label className="block space-y-1.5" htmlFor="plugin-source-url">
            <span className="text-sm font-medium text-foreground">
              {t("plugin.sourceUrlLabel", "Plugin URL")}
            </span>
            <input
              id="plugin-source-url"
              value={sourceImportUrl}
              onChange={(event) => setSourceImportUrl(event.target.value)}
              placeholder="git@github.com:owner/repo.git"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1.5" htmlFor="plugin-source-branch">
              <span className="text-sm font-medium text-foreground">
                {t("plugin.sourceBranchLabel", "Branch")}
              </span>
              <input
                id="plugin-source-branch"
                value={sourceImportBranch}
                onChange={(event) => setSourceImportBranch(event.target.value)}
                placeholder="main"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label
              className="block space-y-1.5"
              htmlFor="plugin-source-package-path"
            >
              <span className="text-sm font-medium text-foreground">
                {t("plugin.sourcePackagePathLabel", "Package path")}
              </span>
              <input
                id="plugin-source-package-path"
                value={sourceImportPackagePath}
                onChange={(event) =>
                  setSourceImportPackagePath(event.target.value)
                }
                placeholder="plugins/example"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>

          <label className="block space-y-1.5" htmlFor="plugin-source-label">
            <span className="text-sm font-medium text-foreground">
              {t("plugin.sourceLabelLabel", "Source label")}
            </span>
            <input
              id="plugin-source-label"
              value={sourceImportLabel}
              onChange={(event) => setSourceImportLabel(event.target.value)}
              placeholder={t("plugin.sourceLabelPlaceholder", "Team Plugins")}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {t(
              "plugin.importFromUrlHelp",
              "SSH URLs use your local git and SSH keys. HTTPS URLs are cloned as Git sources; for GitHub rate limits, prefer SSH or retry later.",
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleCloseSourceImport}
              disabled={isImportingSourcePlugin || isPreviewingSourcePlugin}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={
                isImportingSourcePlugin ||
                isPreviewingSourcePlugin ||
                !sourceImportUrl.trim()
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {isPreviewingSourcePlugin ? (
                <Loader2Icon
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <PackagePlusIcon aria-hidden="true" className="h-4 w-4" />
              )}
              {isPreviewingSourcePlugin
                ? t("plugin.scanningPlugin", "Scanning...")
                : t("plugin.scanPlugin", "Scan Plugin")}
            </button>
          </div>
        </form>
      </Modal>
      <PluginSourcePreviewModal
        importing={isImportingSourcePlugin}
        onBackToEdit={handleBackToSourceImportEdit}
        onClose={handleCloseSourcePreview}
        onImport={() => void handleConfirmSourceImport()}
        preview={sourceImportPreview?.preview ?? null}
        request={sourceImportPreview?.request ?? null}
      />
    </>
  );
}
