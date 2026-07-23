import { useState } from "react";
import {
  DownloadIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  Paintbrush2Icon,
  PawPrintIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentDesktopThemeSummary,
  AgentPetSummary,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentAppearancePreview } from "./AgentAppearancePreview";
import { useAgentAppearance } from "./use-agent-appearance";

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45";

function SectionHeading({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/[0.08] text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}

function NativeAppearanceSection({
  activeThemeId,
  disabled,
  onRestore,
}: {
  activeThemeId: string | null;
  disabled: boolean;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section>
      <SectionHeading
        icon={<Paintbrush2Icon className="h-4 w-4" />}
        title={t("agents.appearance.nativeTitle")}
        description={t("agents.appearance.nativeDesc")}
        action={
          <button
            type="button"
            onClick={onRestore}
            disabled={disabled || !activeThemeId}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcwIcon className="h-4 w-4" />
            {t("agents.appearance.restoreNative")}
          </button>
        }
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 border border-border/70 bg-muted/15 px-4 py-3">
        <StatusMetric
          label={t("agents.appearance.runtime")}
          value={t("agents.appearance.loopbackRuntime")}
        />
        <StatusMetric
          label={t("agents.appearance.activeSkin")}
          value={activeThemeId || t("agents.appearance.native")}
        />
        <StatusMetric
          label={t("agents.appearance.safety")}
          value={t("agents.appearance.bundleUntouched")}
        />
      </div>
    </section>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="ml-2 font-semibold text-foreground">{value}</span>
    </p>
  );
}

function ThemeCard({
  agentId,
  theme,
  active,
  busy,
  onApply,
  onExport,
  onDelete,
}: {
  agentId: string;
  theme: AgentDesktopThemeSummary;
  active: boolean;
  busy: boolean;
  onApply: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm transition-colors hover:border-primary/35">
      <AgentAppearancePreview
        agentId={agentId}
        assetId={theme.id}
        kind="theme"
        alt={theme.name}
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {theme.name}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              v{theme.version}
            </p>
          </div>
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheckIcon className="h-3 w-3" />
              {t("agents.appearance.active")}
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={busy}
            aria-label={t("agents.appearance.exportTheme", {
              name: theme.name,
            })}
            title={t("agents.appearance.exportTheme", { name: theme.name })}
            className={iconButton}
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={busy || active}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <SparklesIcon className="h-4 w-4" />
            {active
              ? t("agents.appearance.applied")
              : t("agents.appearance.apply")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy || active}
            aria-label={t("agents.appearance.deleteTheme", {
              name: theme.name,
            })}
            title={t("agents.appearance.deleteTheme", { name: theme.name })}
            className={iconButton}
          >
            <Trash2Icon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function PetCard({
  agentId,
  pet,
  busy,
  onExport,
  onDelete,
}: {
  agentId: string;
  pet: AgentPetSummary;
  busy: boolean;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="overflow-hidden rounded-md border border-border/80 bg-card shadow-sm transition-colors hover:border-primary/35">
      <AgentAppearancePreview
        agentId={agentId}
        assetId={pet.id}
        kind="pet"
        alt={pet.name}
        spriteVersionNumber={pet.spriteVersionNumber}
      />
      <div className="p-4">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {pet.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
          {pet.description || pet.id}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {(pet.spritesheetBytes / 1024 / 1024).toFixed(1)} MB
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExport}
              disabled={busy}
              aria-label={t("agents.appearance.exportPet", { name: pet.name })}
              title={t("agents.appearance.exportPet", { name: pet.name })}
              className={iconButton}
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              aria-label={t("agents.appearance.deletePet", { name: pet.name })}
              title={t("agents.appearance.deletePet", { name: pet.name })}
              className={iconButton}
            >
              <Trash2Icon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function AgentAppearancePanel({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const { overview, activeAction, error, refresh, run } = useAgentAppearance(
    agent.id,
  );
  const [restartExisting, setRestartExisting] = useState(false);
  const busy = activeAction !== null;

  if (!overview && activeAction === "refresh") {
    return (
      <div className="flex h-full min-h-64 items-center justify-center text-muted-foreground">
        <LoaderCircleIcon className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!overview) {
    return (
      <AppearanceError message={error || t("agents.appearance.loadFailed")} />
    );
  }

  const applyTheme = (themeId: string) =>
    run("apply-theme", () =>
      window.api.agent.applyAppearanceTheme({
        agentId: agent.id,
        themeId,
        restartExisting,
      }),
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("agents.appearance.title")}
        </h2>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
          {t("agents.appearance.description")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void run("import-theme", () =>
                window.api.agent.importAppearanceTheme(agent.id),
              )
            }
            disabled={busy}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-45"
          >
            <UploadIcon className="h-4 w-4" />
            {t("agents.appearance.importSkin")}
          </button>
          <button
            type="button"
            onClick={() =>
              void run("import-pet", () =>
                window.api.agent.importAgentPet(agent.id),
              )
            }
            disabled={busy}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-45"
          >
            <PawPrintIcon className="h-4 w-4" />
            {t("agents.appearance.importPet")}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            aria-label={t("agents.refresh")}
            title={t("agents.refresh")}
            className={`${iconButton} h-8 w-8`}
          >
            <RefreshCwIcon
              className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-6">
          {error ? <AppearanceError message={error} /> : null}
          {overview.invalidThemeCount + overview.invalidPetCount > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {t("agents.appearance.invalidItems", {
                count: overview.invalidThemeCount + overview.invalidPetCount,
              })}
            </div>
          ) : null}
          <NativeAppearanceSection
            activeThemeId={overview.activeThemeId}
            disabled={busy}
            onRestore={() =>
              void run("restore-theme", () =>
                window.api.agent.restoreAppearanceTheme(agent.id),
              )
            }
          />
          <section>
            <SectionHeading
              icon={<SparklesIcon className="h-4 w-4" />}
              title={t("agents.appearance.skinsTitle")}
              description={t("agents.appearance.skinsDesc", {
                version: overview.engineVersion || "-",
              })}
              action={
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={restartExisting}
                    onChange={(event) =>
                      setRestartExisting(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  {t("agents.appearance.allowRestart")}
                </label>
              }
            />
            {overview.themes.length ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {overview.themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    agentId={agent.id}
                    theme={theme}
                    active={overview.activeThemeId === theme.id}
                    busy={busy}
                    onApply={() => void applyTheme(theme.id)}
                    onExport={() =>
                      void run("export-theme", () =>
                        window.api.agent.exportAppearanceTheme(
                          agent.id,
                          theme.id,
                        ),
                      )
                    }
                    onDelete={() => {
                      if (
                        !window.confirm(
                          t("agents.appearance.deleteThemeConfirm"),
                        )
                      )
                        return;
                      void run("delete-theme", () =>
                        window.api.agent.deleteAppearanceTheme(
                          agent.id,
                          theme.id,
                        ),
                      );
                    }}
                  />
                ))}
              </div>
            ) : (
              <AppearanceEmpty text={t("agents.appearance.noSkins")} />
            )}
          </section>
          <section>
            <SectionHeading
              icon={<PawPrintIcon className="h-4 w-4" />}
              title={t("agents.appearance.petsTitle")}
              description={t("agents.appearance.petsDesc")}
            />
            {overview.pets.length ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {overview.pets.map((pet) => (
                  <PetCard
                    key={pet.id}
                    agentId={agent.id}
                    pet={pet}
                    busy={busy}
                    onExport={() =>
                      void run("export-pet", () =>
                        window.api.agent.exportAgentPet(agent.id, pet.id),
                      )
                    }
                    onDelete={() => {
                      if (
                        !window.confirm(t("agents.appearance.deletePetConfirm"))
                      )
                        return;
                      void run("delete-pet", () =>
                        window.api.agent.deleteAgentPet(agent.id, pet.id),
                      );
                    }}
                  />
                ))}
              </div>
            ) : (
              <AppearanceEmpty text={t("agents.appearance.noPets")} />
            )}
          </section>
          <div className="flex flex-wrap items-center gap-4 border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() =>
                void window.electron?.openPath?.(overview.themeDirectoryPath)
              }
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <FolderOpenIcon className="h-3.5 w-3.5" />
              {t("agents.appearance.openSkinFolder")}
            </button>
            <button
              type="button"
              onClick={() =>
                void window.electron?.openPath?.(overview.petDirectoryPath)
              }
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <FolderOpenIcon className="h-3.5 w-3.5" />
              {t("agents.appearance.openPetFolder")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function AppearanceEmpty({ text }: { text: string }) {
  return (
    <div className="mt-5 flex min-h-28 items-center justify-center rounded-md border border-dashed border-border bg-muted/15 px-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
