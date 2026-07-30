import { useState } from "react";
import type { TFunction } from "i18next";
import { TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SkillStoreSource } from "@prompthub/shared/types";
import { useSettingsStore } from "../../stores/settings.store";
import { useSkillStore } from "../../stores/skill.store";
import { getSafetyScanAIConfig } from "../skill/detail-utils";
import { useToast } from "../ui/Toast";
import { SettingSection } from "./shared";
import {
  BUILTIN_SKILL_SAFETY_STORES,
  SKILL_SAFETY_CHANNELS,
  type SkillSafetyChannel,
  type SkillSafetyPolicySelection,
} from "../../services/skill-safety-policy";

interface TrustedSourceSkill {
  content_url?: string;
  name?: string;
  slug?: string;
  source_id?: string;
  source_label?: string;
  source_url?: string;
}

interface TrustedUpdateSourceEntry {
  key: string;
  label?: string;
  location?: string;
  skillNames: string[];
}

interface SafetyToggleProps {
  pressed: boolean;
  title: string;
  description: string;
  onToggle: () => void;
}

function SafetyToggle({
  pressed,
  title,
  description,
  onToggle,
}: SafetyToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
        pressed
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

function TrustedUpdateSources() {
  const { t } = useTranslation();
  const trustedSourceValue = useSettingsStore(
    (state) => state.trustedSkillUpdateSourceKeys,
  );
  const revoke = useSettingsStore(
    (state) => state.revokeSkillUpdateSourceTrust,
  );
  const installedSkills = useSkillStore((state) => state.skills);
  const sources = getTrustedUpdateSourceEntries(
    trustedSourceValue,
    installedSkills,
  );
  if (sources.length === 0) return null;
  return (
    <div className="border border-border/70 bg-muted/20 p-3">
      <div className="text-sm font-semibold">
        {t("settings.trustedSkillUpdateSources", "Trusted Update Sources")}
      </div>
      <div className="mt-2 divide-y divide-border/60">
        {sources.map((source) => (
          <div
            key={source.key}
            className="flex min-w-0 items-center gap-2 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {source.label ||
                  t(
                    "settings.trustedSkillUpdateSourceLegacy",
                    "Legacy trusted source",
                  )}
              </div>
              {source.skillNames.length > 0 ? (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {source.skillNames.join(", ")}
                </div>
              ) : null}
              <code className="mt-0.5 block truncate text-xs text-muted-foreground">
                {source.location || abbreviateSourceKey(source.key)}
              </code>
            </div>
            <button
              type="button"
              title={t("common.remove", "Remove")}
              aria-label={t("common.remove", "Remove")}
              onClick={() => revoke(source.key)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-border text-muted-foreground hover:text-destructive"
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function getTrustedUpdateSources(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((source): source is string => typeof source === "string")
    : [];
}

function sanitizeTrustedSourceLocation(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return `${url.host}${url.pathname}`.replace(/\/$/u, "");
  } catch {
    return undefined;
  }
}

function abbreviateSourceKey(key: string): string {
  return key.length > 20 ? `${key.slice(0, 10)}…${key.slice(-6)}` : key;
}

function getLegacySourceLocation(key: string): string | undefined {
  const sanitized = sanitizeTrustedSourceLocation(key);
  if (sanitized) return sanitized;
  return /^[a-f\d]{32,}$/iu.test(key) ? undefined : key;
}

function matchesTrustedSourceKey(
  sourceKey: string,
  skill: TrustedSourceSkill,
): boolean {
  const identities = [
    skill.source_id,
    skill.source_url,
    skill.content_url,
    skill.slug,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (identities.includes(sourceKey)) return true;
  const location = sanitizeTrustedSourceLocation(
    skill.source_url || skill.content_url,
  );
  return Boolean(location && sourceKey.includes(location));
}

export function getTrustedUpdateSourceEntries(
  value: unknown,
  skills: readonly TrustedSourceSkill[] = [],
): TrustedUpdateSourceEntry[] {
  return getTrustedUpdateSources(value).map((key) => {
    const matches = skills.filter((skill) =>
      matchesTrustedSourceKey(key, skill),
    );
    const sourceSkill = matches[0];
    return {
      key,
      label:
        sourceSkill?.source_label?.trim() ||
        sanitizeTrustedSourceLocation(
          sourceSkill?.source_url || sourceSkill?.content_url,
        ),
      location:
        sanitizeTrustedSourceLocation(
          sourceSkill?.source_url || sourceSkill?.content_url,
        ) || getLegacySourceLocation(key),
      skillNames: Array.from(
        new Set(
          matches
            .map((skill) => skill.name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    };
  });
}

function BatchSafetyScan() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const aiModels = useSettingsStore((state) => state.aiModels);
  const scan = useSkillStore((state) => state.scanInstalledSkillSafety);
  const [isScanning, setIsScanning] = useState(false);
  const runScan = async () => {
    setIsScanning(true);
    try {
      const summary = await scan(undefined, getSafetyScanAIConfig(aiModels));
      const type =
        summary.blocked > 0 || summary.highRisk > 0
          ? "error"
          : summary.warn > 0
            ? "warning"
            : "success";
      showToast(
        t("settings.batchScanInstalledSkillsResult", {
          ...summary,
          defaultValue: `Checked ${summary.total} skills · blocked ${summary.blocked} · high risk ${summary.highRisk} · warn ${summary.warn}`,
        }),
        type,
      );
    } catch (error) {
      showToast(String(error), "error");
    } finally {
      setIsScanning(false);
    }
  };
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {t(
              "settings.batchScanInstalledSkills",
              "Scan All Installed Skills Now",
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "settings.batchScanInstalledSkillsDesc",
              "Manually run a safety scan on all Skills in your library to quickly find high-risk content.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={isScanning}
          className="h-9 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isScanning
            ? t("skill.safetyScanning", "Scanning...")
            : t("skill.runSafetyAssessment", "Run Scan")}
        </button>
      </div>
    </div>
  );
}

function SafetyPolicySelect({
  id,
  label,
  value,
  inheritLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: SkillSafetyPolicySelection;
  inheritLabel: string;
  onChange: (value: SkillSafetyPolicySelection) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex min-w-0 items-center gap-3 py-2" htmlFor={id}>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {label}
      </span>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as SkillSafetyPolicySelection)
        }
        className="h-9 min-w-36 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      >
        <option value="inherit">{inheritLabel}</option>
        <option value="enabled">
          {t("settings.skillSafetyPolicyEnabled", "Enabled")}
        </option>
        <option value="disabled">
          {t("settings.skillSafetyPolicyDisabled", "Disabled")}
        </option>
      </select>
    </label>
  );
}

function getChannelLabel(channel: SkillSafetyChannel, t: TFunction): string {
  const labels: Record<SkillSafetyChannel, [string, string]> = {
    official: ["settings.skillSafetyChannelOfficial", "Official sources"],
    community: ["settings.skillSafetyChannelCommunity", "Community stores"],
    "git-repo": ["settings.skillSafetyChannelGitRepo", "Git repositories"],
    "marketplace-json": [
      "settings.skillSafetyChannelMarketplace",
      "Marketplace JSON",
    ],
    "local-dir": [
      "settings.skillSafetyChannelLocalDirectory",
      "Local directories",
    ],
  };
  return t(labels[channel][0], labels[channel][1]);
}

function ChannelSafetyPolicies() {
  const { t } = useTranslation();
  const channelPolicies = useSettingsStore(
    (state) => state.skillSafetyChannelPolicies,
  );
  const setChannelPolicy = useSettingsStore(
    (state) => state.setSkillSafetyChannelPolicy,
  );
  return (
    <div className="divide-y divide-border/60 px-3">
      {SKILL_SAFETY_CHANNELS.map((channel) => (
        <SafetyPolicySelect
          key={channel}
          id={`skill-safety-channel-${channel}`}
          label={getChannelLabel(channel, t)}
          value={channelPolicies[channel] ?? "inherit"}
          inheritLabel={t(
            "settings.skillSafetyPolicyInheritGlobal",
            "Inherit global",
          )}
          onChange={(policy) => setChannelPolicy(channel, policy)}
        />
      ))}
    </div>
  );
}

function getStorePolicyRows(
  customStores: readonly SkillStoreSource[],
  t: TFunction,
) {
  return [
    ...BUILTIN_SKILL_SAFETY_STORES.map((store) => ({
      id: store.storeId,
      label: t(store.labelKey, store.defaultLabel),
    })),
    ...customStores.map((store) => ({
      id: store.id,
      label: store.name,
    })),
  ];
}

function StoreSafetyPolicies() {
  const { t } = useTranslation();
  const storePolicies = useSettingsStore(
    (state) => state.skillSafetyStorePolicies,
  );
  const setStorePolicy = useSettingsStore(
    (state) => state.setSkillSafetyStorePolicy,
  );
  const customStores = useSkillStore((state) => state.customStoreSources);
  const stores = getStorePolicyRows(customStores, t);
  return (
    <>
      <div className="border-y border-border/70 px-3 py-2.5 text-sm font-semibold">
        {t("settings.skillSafetyStorePolicies", "Store policies")}
      </div>
      <div className="max-h-64 divide-y divide-border/60 overflow-y-auto px-3">
        {stores.map((store) => (
          <SafetyPolicySelect
            key={store.id}
            id={`skill-safety-store-${store.id}`}
            label={store.label}
            value={storePolicies[store.id] ?? "inherit"}
            inheritLabel={t(
              "settings.skillSafetyPolicyInheritChannel",
              "Inherit channel",
            )}
            onChange={(policy) => setStorePolicy(store.id, policy)}
          />
        ))}
      </div>
    </>
  );
}

function AutomaticScanPolicies() {
  const { t } = useTranslation();
  return (
    <div className="border border-border/70">
      <div className="border-b border-border/70 px-3 py-2.5">
        <div className="text-sm font-semibold">
          {t("settings.skillSafetyChannelPolicies", "Channel policies")}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "settings.skillSafetyPolicyPrecedence",
            "An exact store policy overrides its channel, and a channel policy overrides the global setting.",
          )}
        </p>
      </div>
      <ChannelSafetyPolicies />
      <StoreSafetyPolicies />
    </div>
  );
}

export function SkillSafetySettingsSection() {
  const { t } = useTranslation();
  const autoInstalled = useSettingsStore(
    (state) => state.autoScanInstalledSkills,
  );
  const autoStore = useSettingsStore(
    (state) => state.autoScanStoreSkillsBeforeInstall,
  );
  const setAutoInstalled = useSettingsStore(
    (state) => state.setAutoScanInstalledSkills,
  );
  const setAutoStore = useSettingsStore(
    (state) => state.setAutoScanStoreSkillsBeforeInstall,
  );
  return (
    <SettingSection
      title={t("settings.skillSafetyChecks", "Skill Safety Checks")}
    >
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          {t(
            "settings.skillSafetyChecksDesc",
            "Control automatic safety scans for installed Skills and pre-install checks from the store.",
          )}
        </p>
        <SafetyToggle
          pressed={autoInstalled}
          title={t(
            "settings.autoScanInstalledSkills",
            "Auto-scan Installed Skills",
          )}
          description={t(
            "settings.autoScanInstalledSkillsDesc",
            "Automatically run a safety scan when opening a Skill detail page to detect high-risk changes.",
          )}
          onToggle={() => setAutoInstalled(!autoInstalled)}
        />
        <SafetyToggle
          pressed={autoStore}
          title={t(
            "settings.autoScanStoreSkillsBeforeInstall",
            "Pre-install Safety Scan",
          )}
          description={t(
            "settings.autoScanStoreSkillsBeforeInstallDesc",
            "Run content preflight and optional AI review before installing or updating a Skill.",
          )}
          onToggle={() => setAutoStore(!autoStore)}
        />
        <p className="border-l-2 border-amber-500/60 pl-3 text-xs leading-5 text-muted-foreground">
          {t(
            "settings.skillSafetyImmutableChecks",
            "Disabling a scan skips content and AI review. Package path, archive, symlink, size, required-file, and fingerprint validation remain mandatory.",
          )}
        </p>
        <AutomaticScanPolicies />
        <TrustedUpdateSources />
        <BatchSafetyScan />
      </div>
    </SettingSection>
  );
}
