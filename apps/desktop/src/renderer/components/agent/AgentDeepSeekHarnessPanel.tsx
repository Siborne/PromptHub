import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowUpCircleIcon,
  CheckCircle2Icon,
  PackageIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentHarnessOverview,
  AgentHarnessPluginMutationRequest,
  AgentHarnessPluginSummary,
  AgentHarnessProfileDetail,
} from "@prompthub/shared/types";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

interface PendingMutation {
  operation: "update" | "remove";
  plugin: AgentHarnessPluginSummary;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] gap-4 border-b border-border/70 py-3 last:border-b-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}

function PluginListItem({
  plugin,
  selected,
  onSelect,
}: {
  plugin: AgentHarnessPluginSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full min-w-0 items-start gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors last:border-b-0 ${
        selected ? "bg-primary/10" : "hover:bg-accent"
      }`}
    >
      <PackageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {plugin.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {plugin.sourceSpec || "—"}
        </span>
      </span>
      {plugin.enabled ? (
        <CheckCircle2Icon className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-500" />
      )}
    </button>
  );
}

export function AgentDeepSeekHarnessPanel() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [overview, setOverview] = useState<AgentHarnessOverview | null>(null);
  const [profile, setProfile] = useState<AgentHarnessProfileDetail | null>(
    null,
  );
  const [profileName, setProfileName] = useState("");
  const [pluginName, setPluginName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [installProfile, setInstallProfile] = useState("");
  const [packageSpec, setPackageSpec] = useState("");
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [pendingMutation, setPendingMutation] =
    useState<PendingMutation | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const selectedPlugin = useMemo(
    () => profile?.plugins.find((item) => item.name === pluginName) || null,
    [pluginName, profile],
  );

  async function readSelectedProfile(nextName: string) {
    setProfileName(nextName);
    setPluginName("");
    if (!nextName) {
      setProfile(null);
      return;
    }
    try {
      const nextProfile = await window.api.agent.readHarnessProfile(nextName);
      setProfile(nextProfile);
      setPluginName(nextProfile.plugins[0]?.name || "");
    } catch {
      setProfile(null);
      showToast(t("agents.deepseekHarness.loadFailed"), "error");
    }
  }

  async function loadOverview(preferredProfile?: string) {
    setIsLoading(true);
    try {
      const nextOverview = await window.api.agent.listHarnessProfiles();
      setOverview(nextOverview);
      const nextName =
        nextOverview.profiles.find(
          (item) => item.name === (preferredProfile || profileName),
        )?.name ||
        nextOverview.profiles.find((item) => item.status === "valid")?.name ||
        "";
      await readSelectedProfile(nextName);
    } catch {
      setOverview(null);
      setProfile(null);
      showToast(t("agents.deepseekHarness.loadFailed"), "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  function openInstall() {
    setInstallProfile(profileName || "web");
    setPackageSpec("");
    setRiskAccepted(false);
    setIsInstallOpen(true);
  }

  async function mutate(request: AgentHarnessPluginMutationRequest) {
    setIsMutating(true);
    try {
      const result = await window.api.agent.mutateHarnessPlugin(request);
      if (result.success === false) {
        showToast(
          t(`agents.deepseekHarness.errors.${result.errorCode}`),
          "error",
        );
        return;
      }
      setProfile(result.profile);
      setProfileName(result.profile.name);
      setPluginName(result.profile.plugins[0]?.name || "");
      setIsInstallOpen(false);
      setPendingMutation(null);
      const nextOverview = await window.api.agent.listHarnessProfiles();
      setOverview(nextOverview);
      showToast(t("agents.deepseekHarness.operationComplete"), "success");
    } catch {
      showToast(t("agents.deepseekHarness.operationFailed"), "error");
    } finally {
      setIsMutating(false);
    }
  }

  const profileOptions = (overview?.profiles || [])
    .filter((item) => item.status === "valid")
    .map((item) => ({ value: item.name, label: item.name }));

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        {t("agents.deepseekHarness.loading")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border bg-background px-5 py-3">
        <Select
          value={profileName}
          onChange={(value) => void readSelectedProfile(value)}
          options={profileOptions}
          placeholder={t("agents.deepseekHarness.noProfile")}
          ariaLabel={t("agents.deepseekHarness.selectProfile")}
          className="w-52"
          disabled={profileOptions.length === 0}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadOverview()}
        >
          <RefreshCwIcon className="h-4 w-4" />
          {t("agents.deepseekHarness.refresh")}
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          onClick={openInstall}
          disabled={!overview?.cliAvailable}
        >
          <PlusIcon className="h-4 w-4" />
          {t("agents.deepseekHarness.installPlugin")}
        </Button>
      </div>

      {!overview?.cliAvailable ? (
        <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t("agents.deepseekHarness.cliUnavailable")}
        </div>
      ) : null}

      {profile ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(10rem,35vh)_minmax(0,1fr)] lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)] lg:grid-rows-none">
          <section
            aria-label={t("agents.deepseekHarness.pluginList")}
            className="min-h-0 overflow-y-auto border-b border-border bg-background lg:border-b-0 lg:border-r"
          >
            {profile.plugins.length ? (
              profile.plugins.map((plugin) => (
                <PluginListItem
                  key={plugin.name}
                  plugin={plugin}
                  selected={plugin.name === pluginName}
                  onSelect={() => setPluginName(plugin.name)}
                />
              ))
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {t("agents.deepseekHarness.emptyPlugins")}
              </p>
            )}
          </section>

          <section className="min-h-0 overflow-y-auto p-6">
            {selectedPlugin ? (
              <div className="mx-auto max-w-3xl">
                <div className="flex min-w-0 flex-wrap items-start gap-3 border-b border-border pb-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-xl font-bold text-foreground">
                      {selectedPlugin.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedPlugin.description ||
                        t("agents.deepseekHarness.noDescription")}
                    </p>
                  </div>
                  {selectedPlugin.directDependency ? (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!overview?.cliAvailable}
                        onClick={() =>
                          setPendingMutation({
                            operation: "update",
                            plugin: selectedPlugin,
                          })
                        }
                      >
                        <ArrowUpCircleIcon className="h-4 w-4" />
                        {t("agents.deepseekHarness.updatePlugin")}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!overview?.cliAvailable}
                        onClick={() =>
                          setPendingMutation({
                            operation: "remove",
                            plugin: selectedPlugin,
                          })
                        }
                      >
                        <Trash2Icon className="h-4 w-4" />
                        {t("agents.deepseekHarness.removePlugin")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                <dl className="mt-4 border-y border-border">
                  <MetadataRow
                    label={t("agents.deepseekHarness.version")}
                    value={selectedPlugin.version || "—"}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.source")}
                    value={
                      selectedPlugin.sourceSpec ||
                      t("agents.deepseekHarness.builtinBundle")
                    }
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.state")}
                    value={t(
                      `agents.deepseekHarness.status.${selectedPlugin.status}`,
                    )}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.bundleEnabled")}
                    value={t(
                      selectedPlugin.enabled
                        ? "agents.deepseekHarness.yes"
                        : "agents.deepseekHarness.no",
                    )}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.managedDependency")}
                    value={t(
                      selectedPlugin.directDependency
                        ? "agents.deepseekHarness.yes"
                        : "agents.deepseekHarness.no",
                    )}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.bundlePatch")}
                    value={selectedPlugin.bundlePatch || "—"}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.clientPlatform")}
                    value={selectedPlugin.clientPlatform || "—"}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.lifecycleScripts")}
                    value={
                      selectedPlugin.lifecycleScripts.join(", ") ||
                      t("agents.deepseekHarness.none")
                    }
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.license")}
                    value={selectedPlugin.license || "—"}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.repository")}
                    value={selectedPlugin.repositoryUrl || "—"}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.homepage")}
                    value={selectedPlugin.homepage || "—"}
                  />
                  <MetadataRow
                    label={t("agents.deepseekHarness.warnings")}
                    value={
                      selectedPlugin.warnings.join(", ") ||
                      t("agents.deepseekHarness.none")
                    }
                  />
                </dl>
              </div>
            ) : (
              <p className="pt-16 text-center text-sm text-muted-foreground">
                {t("agents.deepseekHarness.selectPlugin")}
              </p>
            )}
          </section>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <PackageIcon className="h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            {t("agents.deepseekHarness.noProfilesTitle")}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {t("agents.deepseekHarness.noProfilesDescription")}
          </p>
          <Button
            className="mt-4"
            onClick={openInstall}
            disabled={!overview?.cliAvailable}
          >
            <PlusIcon className="h-4 w-4" />
            {t("agents.deepseekHarness.installPlugin")}
          </Button>
        </div>
      )}

      <Modal
        isOpen={isInstallOpen}
        onClose={() => !isMutating && setIsInstallOpen(false)}
        title={t("agents.deepseekHarness.installTitle")}
        subtitle={t("agents.deepseekHarness.installDescription")}
        size="lg"
        closeOnBackdrop={!isMutating}
        closeOnEscape={!isMutating}
      >
        <div className="space-y-5">
          <Input
            variant="outlined"
            label={t("agents.deepseekHarness.profileName")}
            value={installProfile}
            onChange={(event) => setInstallProfile(event.target.value)}
          />
          <Input
            variant="outlined"
            label={t("agents.deepseekHarness.packageSource")}
            placeholder="@scope/plugin@latest"
            value={packageSpec}
            onChange={(event) => setPackageSpec(event.target.value)}
          />
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              <Checkbox
                checked={riskAccepted}
                onChange={setRiskAccepted}
                label={t("agents.deepseekHarness.riskAcknowledgement")}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button
              variant="secondary"
              onClick={() => setIsInstallOpen(false)}
              disabled={isMutating}
            >
              {t("common.cancel")}
            </Button>
            <Button
              disabled={
                !installProfile.trim() ||
                !packageSpec.trim() ||
                !riskAccepted ||
                isMutating
              }
              onClick={() =>
                void mutate({
                  agentId: "deepseek-harness",
                  operation: "install",
                  profileName: installProfile.trim(),
                  packageSpec: packageSpec.trim(),
                  acknowledgeLifecycleScripts: true,
                })
              }
            >
              {isMutating ? (
                <Spinner size="sm" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
              {t("agents.deepseekHarness.install")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingMutation)}
        onClose={() => !isMutating && setPendingMutation(null)}
        onConfirm={() => {
          if (!pendingMutation) return;
          void mutate({
            agentId: "deepseek-harness",
            operation: pendingMutation.operation,
            profileName,
            packageName: pendingMutation.plugin.name,
            acknowledgeLifecycleScripts: true,
          });
        }}
        title={
          pendingMutation?.operation === "remove"
            ? t("agents.deepseekHarness.removeTitle")
            : t("agents.deepseekHarness.updateTitle")
        }
        message={
          pendingMutation?.operation === "remove"
            ? t("agents.deepseekHarness.removeDescription", {
                plugin: pendingMutation?.plugin.name,
              })
            : t("agents.deepseekHarness.updateDescription", {
                plugin: pendingMutation?.plugin.name,
              })
        }
        confirmText={
          pendingMutation?.operation === "remove"
            ? t("agents.deepseekHarness.remove")
            : t("agents.deepseekHarness.update")
        }
        cancelText={t("common.cancel")}
        variant={
          pendingMutation?.operation === "remove" ? "destructive" : "default"
        }
        isLoading={isMutating}
      />
    </div>
  );
}
