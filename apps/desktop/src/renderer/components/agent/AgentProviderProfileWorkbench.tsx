import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArchiveIcon,
  CheckCircle2Icon,
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  FileInputIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  WifiIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderConnectionTestResult,
  AgentProviderModelTestResult,
  AgentProviderProfilePublic,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { copyTextToClipboard } from "../../utils/clipboard";
import { isWebRuntime } from "../../runtime";
import { useAgentProviderStore } from "../../stores/agent-provider.store";
import { Button, ConfirmDialog } from "../ui";
import {
  AgentProviderActivationDialog,
  AgentProviderImportDialog,
} from "./AgentProviderProfileDialogs";
import { AgentProviderMigrationNotice } from "./AgentProviderMigrationNotice";
import {
  AgentProviderNativeDetail,
  AgentProviderNativeListItem,
} from "./AgentProviderNativeConfig";
import { AgentProviderProfileFormDialog } from "./AgentProviderProfileFormDialog";
import { AgentProviderSourceDialog } from "./AgentProviderSourceDialog";
import {
  AgentProviderDetailHeader,
  AgentProviderDetailRow,
  AgentProviderDetailSection,
  AgentProviderDetailSurface,
  AgentProviderWorkbenchLayout,
  providerWorkbenchListItemClass,
} from "./AgentProviderWorkbenchLayout";

const PROFILE_ROW_HEIGHT = 64;

function secretStateClass(state: AgentProviderProfilePublic["secretState"]) {
  return state === "available"
    ? "text-emerald-600 dark:text-emerald-400"
    : state === "missing"
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
}

function primaryModel(profile: AgentProviderProfilePublic): string | null {
  return (
    profile.modelMappings.find((mapping) => mapping.routeKey === "primary")
      ?.modelId ?? null
  );
}

function ProfileListItem({
  profile,
  isCurrent,
  selected,
  onSelect,
  virtualIndex,
  virtualStart,
  virtualSize,
  virtualSetSize,
}: {
  profile: AgentProviderProfilePublic;
  isCurrent: boolean;
  selected: boolean;
  onSelect: () => void;
  virtualIndex: number;
  virtualStart: number;
  virtualSize: number;
  virtualSetSize: number;
}) {
  const { t } = useTranslation();
  return (
    <li
      data-index={virtualIndex}
      aria-posinset={virtualIndex + 1}
      aria-setsize={virtualSetSize}
      className="absolute left-0 top-0 w-full p-1"
      style={{
        height: `${virtualSize}px`,
        transform: `translateY(${virtualStart}px)`,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={providerWorkbenchListItemClass(
          selected,
          "h-full overflow-hidden px-3 py-2",
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {profile.name}
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[11px]">
            {isCurrent ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {t("agents.providerProfiles.current")}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              {t(`agents.providerProfiles.source.${profile.source}`)}
            </span>
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {primaryModel(profile) ?? t("agents.providerProfiles.noPrimaryModel")}
        </span>
      </button>
    </li>
  );
}

function ProfileDetail({
  profile,
  isCurrent,
  busy,
  activating,
  testing,
  modelTesting,
  copied,
  connectionResult,
  modelTestResult,
  supportsConnectionTest,
  supportsActivation,
  onEdit,
  onTestConnection,
  onTestModel,
  onCancelModelTest,
  onActivate,
  onDuplicate,
  onExport,
  onArchive,
  onDelete,
}: {
  profile: AgentProviderProfilePublic;
  isCurrent: boolean;
  busy: boolean;
  activating: boolean;
  testing: boolean;
  modelTesting: boolean;
  copied: boolean;
  connectionResult: AgentProviderConnectionTestResult | null;
  modelTestResult: AgentProviderModelTestResult | null;
  supportsConnectionTest: boolean;
  supportsActivation: boolean;
  onEdit: () => void;
  onTestConnection: () => void;
  onTestModel: () => void;
  onCancelModelTest: () => void;
  onActivate: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AgentProviderDetailSurface>
      <AgentProviderDetailSection>
        <AgentProviderDetailHeader>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {profile.name}
              </h2>
              {isCurrent ? (
                <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t("agents.providerProfiles.current")}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {profile.providerKind} · {profile.protocol}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onEdit}
              disabled={busy}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {t("common.edit")}
            </Button>
            {supportsActivation ? (
              <Button
                size="sm"
                onClick={onActivate}
                disabled={busy || isCurrent}
              >
                {isCurrent ? (
                  <CheckCircle2Icon className="h-3.5 w-3.5" />
                ) : activating ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCwIcon className="h-3.5 w-3.5" />
                )}
                {t(
                  isCurrent
                    ? "agents.providerProfiles.current"
                    : "agents.providerProfiles.activate",
                )}
              </Button>
            ) : null}
          </div>
        </AgentProviderDetailHeader>
      </AgentProviderDetailSection>

      <div className="mt-4 space-y-4">
        <AgentProviderDetailSection className="p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("agents.providerProfiles.details")}
          </h3>
          <dl className="mt-2">
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.providerKind")}
            >
              {profile.providerKind}
            </AgentProviderDetailRow>
            {typeof profile.config.providerId === "string" ||
            typeof profile.config.legacyProviderId === "string" ? (
              <AgentProviderDetailRow
                label={t("agents.providerProfiles.providerId")}
              >
                {String(
                  profile.config.providerId ?? profile.config.legacyProviderId,
                )}
              </AgentProviderDetailRow>
            ) : null}
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.protocol")}
            >
              {profile.protocol}
            </AgentProviderDetailRow>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.endpoint")}
            >
              {profile.endpoint || t("agents.providerProfiles.platformNative")}
            </AgentProviderDetailRow>
            <AgentProviderDetailRow
              label={t("agents.providerProfiles.credential")}
            >
              <span
                className={`inline-flex items-center gap-1.5 ${secretStateClass(profile.secretState)}`}
              >
                {profile.secretState === "missing" ? (
                  <ShieldAlertIcon className="h-4 w-4" />
                ) : (
                  <KeyRoundIcon className="h-4 w-4" />
                )}
                {t(
                  `agents.providerProfiles.secretState.${profile.secretState}`,
                )}
              </span>
            </AgentProviderDetailRow>
          </dl>
        </AgentProviderDetailSection>

        {supportsConnectionTest ? (
          <AgentProviderDetailSection className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("agents.providerProfiles.connection.title")}
                </h3>
                {connectionResult ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span
                      className={
                        connectionResult.status === "ok"
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "font-medium text-amber-600 dark:text-amber-400"
                      }
                    >
                      {t(
                        `agents.providerProfiles.connection.status.${connectionResult.status}`,
                      )}
                    </span>
                    {connectionResult.modelCount !== null ? (
                      <span>
                        {t(
                          "agents.providerProfiles.connection.modelsAvailable",
                          { count: connectionResult.modelCount },
                        )}
                      </span>
                    ) : null}
                    <span>
                      {t("agents.providerProfiles.connection.latency", {
                        ms: connectionResult.totalMs,
                      })}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("agents.providerProfiles.connection.hint")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onTestConnection}
                  disabled={busy}
                >
                  {testing ? (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <WifiIcon className="h-3.5 w-3.5" />
                  )}
                  {testing
                    ? t("agents.providerProfiles.connection.testing")
                    : t("agents.providerProfiles.connection.test")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={modelTesting ? onCancelModelTest : onTestModel}
                  disabled={modelTesting ? false : busy}
                >
                  {modelTesting ? (
                    <XIcon className="h-3.5 w-3.5" />
                  ) : (
                    <FlaskConicalIcon className="h-3.5 w-3.5" />
                  )}
                  {modelTesting
                    ? t("agents.providerProfiles.modelTest.cancel")
                    : t("agents.providerProfiles.modelTest.test")}
                </Button>
              </div>
            </div>
            {modelTestResult ? (
              <div
                role="status"
                className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={
                      modelTestResult.status === "ok"
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : "font-medium text-amber-600 dark:text-amber-400"
                    }
                  >
                    {t(
                      `agents.providerProfiles.modelTest.status.${modelTestResult.status}`,
                    )}
                  </span>
                  {modelTestResult.firstTokenMs !== null ? (
                    <span className="text-muted-foreground">
                      {t("agents.providerProfiles.modelTest.firstToken", {
                        ms: modelTestResult.firstTokenMs,
                      })}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {t("agents.providerProfiles.modelTest.total", {
                      ms: modelTestResult.totalMs,
                    })}
                  </span>
                  {modelTestResult.retryCount > 0 ? (
                    <span className="text-muted-foreground">
                      {t("agents.providerProfiles.modelTest.retries", {
                        count: modelTestResult.retryCount,
                      })}
                    </span>
                  ) : null}
                </div>
                {modelTestResult.outputPreview ? (
                  <div className="mt-2">
                    <span className="text-muted-foreground">
                      {t("agents.providerProfiles.modelTest.preview")}
                    </span>
                    <code className="mt-1 block whitespace-pre-wrap break-words rounded bg-background px-2 py-1.5 text-foreground">
                      {modelTestResult.outputPreview}
                    </code>
                  </div>
                ) : null}
              </div>
            ) : null}
          </AgentProviderDetailSection>
        ) : null}

        <AgentProviderDetailSection className="p-4">
          <h3 className="text-sm font-semibold text-foreground">
            {t("agents.providerProfiles.modelMappings")}
          </h3>
          {profile.modelMappings.length > 0 ? (
            <ul className="mt-2 divide-y divide-border/60 border-y border-border/60">
              {profile.modelMappings.map((mapping) => (
                <li
                  key={mapping.id}
                  className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    {mapping.routeKey}
                  </span>
                  <code className="break-all text-sm text-foreground">
                    {mapping.modelId}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("agents.providerProfiles.noMappings")}
            </p>
          )}
        </AgentProviderDetailSection>

        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Button
            size="sm"
            variant="secondary"
            onClick={onDuplicate}
            disabled={busy}
          >
            <CopyIcon className="h-3.5 w-3.5" />
            {t("agents.providerProfiles.duplicate")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onExport}
            disabled={busy}
          >
            {copied ? (
              <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <DownloadIcon className="h-3.5 w-3.5" />
            )}
            {copied
              ? t("agents.providerProfiles.exportCopied")
              : t("agents.providerProfiles.export")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onArchive}
            disabled={busy}
          >
            <ArchiveIcon className="h-3.5 w-3.5" />
            {t("agents.providerProfiles.archive")}
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
            <Trash2Icon className="h-3.5 w-3.5" />
            {t("common.delete")}
          </Button>
        </div>
      </div>
    </AgentProviderDetailSurface>
  );
}

export function AgentProviderProfileWorkbench({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const webRuntime = isWebRuntime();
  const store = useAgentProviderStore();
  const [editing, setEditing] = useState<AgentProviderProfilePublic | null>();
  const [deleteTarget, setDeleteTarget] =
    useState<AgentProviderProfilePublic | null>(null);
  const [modelTestConfirmOpen, setModelTestConfirmOpen] = useState(false);
  const [copiedProfileId, setCopiedProfileId] = useState<string | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const profileScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setEditing(undefined);
    void store.load(agent.id);
  }, [agent.id, store.load]);

  const selectedProfile = useMemo(
    () =>
      store.profiles.find(
        (profile) => profile.id === store.selectedProfileId,
      ) ?? null,
    [store.profiles, store.selectedProfileId],
  );
  const busy = store.busyAction !== null;
  const isFormOpen = editing !== undefined;
  const verifiedCurrentProfileId =
    store.currentState?.status === "verified"
      ? store.currentState.currentProfileId
      : null;
  const profileVirtualizer = useVirtualizer({
    count: store.profiles.length,
    getScrollElement: () => profileScrollRef.current,
    estimateSize: () => PROFILE_ROW_HEIGHT,
    overscan: 6,
    getItemKey: (index) => store.profiles[index].id,
  });
  const virtualProfiles = profileVirtualizer.getVirtualItems();

  useEffect(() => {
    setModelTestConfirmOpen(false);
  }, [agent.id, selectedProfile?.id]);

  async function exportSelected(): Promise<void> {
    if (!selectedProfile) return;
    const exported = await store.exportProfile(selectedProfile.id);
    if (!exported) return;
    try {
      await copyTextToClipboard(JSON.stringify(exported, null, 2));
      setCopiedProfileId(selectedProfile.id);
    } catch {
      useAgentProviderStore.setState({
        errorCode: "AGENT_PROVIDER_OPERATION_FAILED",
      });
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    const deleted = await store.deleteProfile(deleteTarget.id);
    if (deleted) setDeleteTarget(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!webRuntime && agent.id === "codex" ? (
        <AgentProviderMigrationNotice onMigrated={() => store.load(agent.id)} />
      ) : null}
      <AgentProviderWorkbenchLayout
        toolbar={
          <>
            {!webRuntime ? (
              <Button
                size="sm"
                variant="secondary"
                className="w-full min-w-0"
                aria-label={t("agents.providerProfiles.import.title")}
                title={t("agents.providerProfiles.import.title")}
                onClick={() => void store.importCurrent(agent.id)}
                disabled={busy}
              >
                {store.busyAction === "import" ? (
                  <Loader2Icon className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <FileInputIcon className="h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0 truncate">
                  {t("agents.providerProfiles.import.title")}
                </span>
              </Button>
            ) : null}
            {!webRuntime ? (
              <Button
                size="sm"
                variant="secondary"
                className="w-full min-w-0"
                aria-label={t("agents.providerProfiles.sourceImport.open")}
                title={t("agents.providerProfiles.sourceImport.open")}
                onClick={() => setSourceDialogOpen(true)}
                disabled={busy}
              >
                <DatabaseIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">
                  {t("agents.providerProfiles.sourceImport.open")}
                </span>
              </Button>
            ) : null}
          </>
        }
        sidebar={
          <nav
            ref={profileScrollRef}
            aria-label={t("agents.providerProfiles.listLabel")}
            className="h-full min-h-0 overflow-x-hidden overflow-y-auto p-1"
          >
            {store.currentState?.nativeConfig ? (
              <AgentProviderNativeListItem
                summary={store.currentState.nativeConfig}
                selected={selectedProfile === null}
                onSelect={() => {
                  setEditing(undefined);
                  store.select(null);
                }}
              />
            ) : null}
            {store.profiles.length > 0 ? (
              <ul
                className="relative w-full"
                style={{ height: `${profileVirtualizer.getTotalSize()}px` }}
              >
                {virtualProfiles.map((virtualRow) => {
                  const profile = store.profiles[virtualRow.index];
                  return (
                    <ProfileListItem
                      key={profile.id}
                      profile={profile}
                      isCurrent={profile.id === verifiedCurrentProfileId}
                      selected={profile.id === store.selectedProfileId}
                      onSelect={() => {
                        setEditing(undefined);
                        store.select(profile.id);
                      }}
                      virtualIndex={virtualRow.index}
                      virtualStart={virtualRow.start}
                      virtualSize={virtualRow.size}
                      virtualSetSize={store.profiles.length}
                    />
                  );
                })}
              </ul>
            ) : store.busyAction === "load" ? (
              <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
                <Loader2Icon className="h-4 w-4 animate-spin" />
                {t("agents.providerProfiles.loading")}
              </div>
            ) : store.currentState?.nativeConfig ? null : (
              <p className="px-4 py-4 text-xs leading-5 text-muted-foreground">
                {t(
                  webRuntime
                    ? "agents.providerProfiles.webEmpty"
                    : "agents.providerProfiles.empty",
                )}
              </p>
            )}
          </nav>
        }
        footer={
          <Button
            size="sm"
            variant="secondary"
            className="w-full bg-card"
            onClick={() => setEditing(null)}
            disabled={busy}
          >
            <PlusIcon className="h-4 w-4" />
            {t("agents.providerProfiles.add")}
          </Button>
        }
      >
        {store.errorCode ? (
          <div
            role="alert"
            className="border-b border-destructive/30 bg-destructive/[0.06] px-5 py-2.5 text-xs text-destructive"
          >
            {t("agents.providerProfiles.errors.operation")}
          </div>
        ) : null}
        {store.currentState?.status === "stale" ||
        store.currentState?.status === "unavailable" ? (
          <div
            role="status"
            className="border-b border-amber-500/30 bg-amber-500/[0.08] px-5 py-2.5 text-xs text-amber-700 dark:text-amber-300"
          >
            {t(
              `agents.providerProfiles.currentState.${store.currentState.status}`,
            )}
          </div>
        ) : null}
        {isFormOpen ? (
          <AgentProviderProfileFormDialog
            isOpen
            platformId={agent.id}
            profile={editing ?? null}
            busy={
              store.busyAction === "create" || store.busyAction === "update"
            }
            onClose={() => setEditing(undefined)}
            onCreate={store.createProfile}
            onUpdate={store.updateProfile}
          />
        ) : selectedProfile ? (
          <ProfileDetail
            profile={selectedProfile}
            isCurrent={selectedProfile.id === verifiedCurrentProfileId}
            busy={busy}
            activating={
              store.busyAction === "preview" || store.busyAction === "activate"
            }
            testing={store.busyAction === "test-connection"}
            modelTesting={store.busyAction === "test-model"}
            copied={copiedProfileId === selectedProfile.id}
            connectionResult={
              store.connectionResult?.profileId === selectedProfile.id
                ? store.connectionResult
                : null
            }
            modelTestResult={
              store.modelTestResult?.profileId === selectedProfile.id
                ? store.modelTestResult
                : null
            }
            supportsConnectionTest={
              !webRuntime && agent.capabilities.provider.status === "supported"
            }
            supportsActivation={!webRuntime}
            onEdit={() => setEditing(selectedProfile)}
            onTestConnection={() =>
              void store.testConnection(agent.id, selectedProfile.id)
            }
            onTestModel={() => setModelTestConfirmOpen(true)}
            onCancelModelTest={() => void store.cancelModelTest()}
            onActivate={() =>
              void store.previewActivation(agent.id, selectedProfile.id)
            }
            onDuplicate={() =>
              void store.duplicateProfile(
                selectedProfile.id,
                t("agents.providerProfiles.duplicateName", {
                  name: selectedProfile.name,
                }),
              )
            }
            onExport={() => void exportSelected()}
            onArchive={() =>
              void store.archiveProfile(
                selectedProfile.id,
                selectedProfile.updatedAt,
              )
            }
            onDelete={() => setDeleteTarget(selectedProfile)}
          />
        ) : store.currentState?.nativeConfig ? (
          <AgentProviderNativeDetail
            summary={store.currentState.nativeConfig}
            busyAction={store.busyAction}
            onImport={() => void store.importCurrent(agent.id)}
            onRestoreOfficial={() => void store.restoreOfficial(agent.id)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-sm">
              <KeyRoundIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <h2 className="mt-3 text-sm font-semibold text-foreground">
                {t("agents.providerProfiles.emptyTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t(
                  webRuntime
                    ? "agents.providerProfiles.webEmptyHint"
                    : "agents.providerProfiles.emptyHint",
                )}
              </p>
            </div>
          </div>
        )}
      </AgentProviderWorkbenchLayout>

      <AgentProviderSourceDialog
        isOpen={sourceDialogOpen}
        platformId={agent.id}
        candidates={store.sourceCandidates}
        loading={store.busyAction === "load-sources"}
        importing={store.busyAction === "import-source"}
        onLoad={store.loadSources}
        onImport={store.importSource}
        onClose={() => setSourceDialogOpen(false)}
      />
      <AgentProviderImportDialog
        preview={store.importPreview}
        busy={store.busyAction === "adopt-import"}
        onClose={store.clearTransient}
        onAdopt={async () => {
          const created = await store.adoptImport();
          if (created) setEditing(created);
          return created;
        }}
      />
      <AgentProviderActivationDialog
        plan={store.activationPlan}
        result={store.activationResult}
        busy={store.busyAction === "activate"}
        errorCode={store.errorCode}
        onClose={store.clearTransient}
        onActivate={(resolutions) =>
          store.activatePreview(agent.id, resolutions)
        }
      />
      <ConfirmDialog
        isOpen={modelTestConfirmOpen}
        onClose={() => setModelTestConfirmOpen(false)}
        onConfirm={() => {
          if (!selectedProfile) return;
          setModelTestConfirmOpen(false);
          void store.testModel(agent.id, selectedProfile.id);
        }}
        title={t("agents.providerProfiles.modelTest.confirmTitle")}
        message={t("agents.providerProfiles.modelTest.confirmMessage")}
        confirmText={t("agents.providerProfiles.modelTest.confirm")}
        cancelText={t("common.cancel")}
      />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title={t("agents.providerProfiles.deleteTitle")}
        message={t("agents.providerProfiles.deleteMessage", {
          name: deleteTarget?.name ?? "",
        })}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
        isLoading={store.busyAction === "delete"}
      />
    </div>
  );
}
