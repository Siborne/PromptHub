import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  AgentAssetAggregate,
  AgentAssetDomainResult,
  AgentAssetTargetState,
} from "@prompthub/core/agent-management/asset-aggregation";
import type { ManagedAgentSummary } from "@prompthub/shared/types";
import {
  agentAssetAggregationService,
  readAgentAssetAggregate,
} from "../../services/agent-asset-domain-adapters";
import { useMcpStore } from "../../stores/mcp.store";
import { usePluginStore } from "../../stores/plugin.store";
import { useRulesStore } from "../../stores/rules.store";
import { useSkillStore } from "../../stores/skill.store";
import { useEnsureSkillLibraryLoaded } from "../skill/use-ensure-skill-library-loaded";

export type AgentAssetDomain = "skills" | "mcp" | "rules" | "plugins";

export interface AgentAssetItem {
  id: string;
  label: string;
  meta?: string;
  state: string;
}

export interface AgentAssetInventory {
  items: AgentAssetItem[];
  isLoading: boolean;
  status: AgentAssetDomainResult["status"];
  errorCode?: AgentAssetDomainResult["errorCode"];
  refresh: () => void;
}

interface AgentAssetInventoryOptions {
  eagerDomains?: readonly AgentAssetDomain[];
  validate?: boolean;
}

const ALL_ASSET_DOMAINS: readonly AgentAssetDomain[] = [
  "skills",
  "mcp",
  "rules",
  "plugins",
];

const DOMAIN_KIND = {
  skills: "skill",
  mcp: "mcp",
  rules: "rule",
  plugins: "plugin",
} as const;

function emptyAggregate(platformId: string): AgentAssetAggregate {
  return {
    platformId,
    total: 0,
    domains: Object.values(DOMAIN_KIND).map((kind) => ({
      kind,
      status: "available",
      items: [],
    })),
  };
}

function failedAggregate(platformId: string): AgentAssetAggregate {
  const aggregate = emptyAggregate(platformId);
  return {
    ...aggregate,
    domains: aggregate.domains.map((domain) => ({
      ...domain,
      errorCode: "asset-domain-list-failed",
      status: "failed",
    })),
  };
}

function itemMeta(
  item: AgentAssetTargetState,
  t: ReturnType<typeof useTranslation>["t"],
): string | undefined {
  if (item.kind === "skill") {
    return item.state === "managed"
      ? t("agents.managed", "Managed")
      : t("agents.external", "External");
  }
  if (item.kind === "mcp") {
    return t("agents.configured", "Configured");
  }
  if (item.kind === "rule") {
    return item.state === "detected"
      ? t("agents.detected", "Detected")
      : t(`rules.syncStatus.${item.state}`, item.state);
  }
  const version = item.metadata?.version;
  return typeof version === "string" && version.trim() ? version : undefined;
}

function mapItems(
  domain: AgentAssetDomainResult | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): AgentAssetItem[] {
  return (domain?.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    meta: itemMeta(item, t),
    state: item.state,
  }));
}

export function useAgentAssetInventoryMap(
  agent: ManagedAgentSummary,
  options: AgentAssetInventoryOptions = {},
): Record<AgentAssetDomain, AgentAssetInventory> {
  const { t } = useTranslation();
  const eagerDomains = options.eagerDomains ?? ALL_ASSET_DOMAINS;
  const validate = options.validate ?? true;
  const eagerSkills = eagerDomains.includes("skills");
  const eagerMcp = eagerDomains.includes("mcp");
  const eagerRules = eagerDomains.includes("rules");
  const eagerPlugins = eagerDomains.includes("plugins");
  const assetsEnabled =
    agent.capabilities.assets.status === "supported" ||
    agent.capabilities.assets.status === "partial";
  const skillLibrary = useSkillStore((state) => state.skills);
  const skillScan = useSkillStore((state) => state.agentScanState[agent.id]);
  const scanSkills = useSkillStore((state) => state.scanAgentPlatformSkills);
  const mcpLibrary = useMcpStore((state) => state.library);
  const mcpPresets = useMcpStore((state) => state.targetPresets);
  const mcpStatus = useMcpStore((state) => state.targetStatus);
  const loadMcp = useMcpStore((state) => state.load);
  const ruleFiles = useRulesStore((state) => state.files);
  const rulesLoaded = useRulesStore((state) => state.hasLoadedFiles);
  const loadRules = useRulesStore((state) => state.loadFiles);
  const pluginLibrary = usePluginStore((state) => state.library);
  const pluginTargets = usePluginStore((state) => state.targetMatrix);
  const loadPlugins = usePluginStore((state) => state.load);
  const [validation, setValidation] = useState<AgentAssetAggregate | null>(
    null,
  );
  useEnsureSkillLibraryLoaded(
    eagerSkills && assetsEnabled && Boolean(agent.paths.skills),
  );

  useEffect(() => {
    if (
      eagerSkills &&
      assetsEnabled &&
      agent.paths.skills &&
      agent.isDetected &&
      !skillScan?.result &&
      !skillScan?.isScanning
    ) {
      void scanSkills(agent.id).catch(() => undefined);
    }
  }, [
    agent.id,
    agent.isDetected,
    agent.paths.skills,
    assetsEnabled,
    eagerSkills,
    scanSkills,
    skillScan?.isScanning,
    skillScan?.result,
  ]);
  useEffect(() => {
    if (eagerMcp && assetsEnabled && agent.paths.mcp && !mcpLibrary)
      void loadMcp();
  }, [agent.paths.mcp, assetsEnabled, eagerMcp, loadMcp, mcpLibrary]);
  useEffect(() => {
    if (eagerRules && assetsEnabled && agent.paths.rules && !rulesLoaded)
      void loadRules();
  }, [agent.paths.rules, assetsEnabled, eagerRules, loadRules, rulesLoaded]);
  useEffect(() => {
    if (
      eagerPlugins &&
      assetsEnabled &&
      agent.paths.plugins &&
      !pluginLibrary
    )
      void loadPlugins();
  }, [
    agent.paths.plugins,
    assetsEnabled,
    eagerPlugins,
    loadPlugins,
    pluginLibrary,
  ]);

  const aggregate = useMemo(
    () => readAgentAssetAggregate(agent.id),
    [
      agent.id,
      mcpPresets,
      mcpStatus,
      pluginTargets,
      ruleFiles,
      skillLibrary,
      skillScan?.result,
    ],
  );

  useEffect(() => {
    if (!assetsEnabled || !validate) {
      setValidation(null);
      return;
    }
    let active = true;
    void agentAssetAggregationService
      .listForTarget(agent.id)
      .then((next) => {
        if (!active) return;
        const hasFailure = next.domains.some(
          (domain) => domain.status !== "available",
        );
        setValidation((current) =>
          hasFailure ? next : current?.platformId === agent.id ? null : current,
        );
      })
      .catch(() => {
        if (active) setValidation(failedAggregate(agent.id));
      });
    return () => {
      active = false;
    };
  }, [
    agent.id,
    assetsEnabled,
    validate,
    mcpPresets,
    mcpStatus,
    pluginTargets,
    ruleFiles,
    skillLibrary,
    skillScan?.result,
  ]);

  const refreshSkills = useCallback(() => {
    if (assetsEnabled && agent.isDetected) void scanSkills(agent.id);
  }, [agent.id, agent.isDetected, assetsEnabled, scanSkills]);
  const refreshMcp = useCallback(() => {
    if (assetsEnabled) void loadMcp();
  }, [assetsEnabled, loadMcp]);
  const refreshRules = useCallback(
    () => {
      if (assetsEnabled) void loadRules({ force: true });
    },
    [assetsEnabled, loadRules],
  );
  const refreshPlugins = useCallback(
    () => {
      if (assetsEnabled) void loadPlugins({ force: true });
    },
    [assetsEnabled, loadPlugins],
  );

  return useMemo(() => {
    const current = aggregate;
    const byKind = new Map(
      current.domains.map((domain) => [domain.kind, domain]),
    );
    const validationByKind =
      validation?.platformId === agent.id
        ? new Map(validation.domains.map((domain) => [domain.kind, domain]))
        : null;
    const build = (
      domain: AgentAssetDomain,
      isLoading: boolean,
      refresh: () => void,
    ): AgentAssetInventory => {
      const result = byKind.get(DOMAIN_KIND[domain]);
      const validated = validationByKind?.get(DOMAIN_KIND[domain]);
      return {
        items: mapItems(result, t),
        isLoading,
        status: validated?.status ?? result?.status ?? "failed",
        errorCode: validated?.errorCode ?? result?.errorCode,
        refresh,
      };
    };
    return {
      skills: build(
        "skills",
        Boolean(agent.isDetected && !skillScan?.result),
        refreshSkills,
      ),
      mcp: build("mcp", !mcpLibrary, refreshMcp),
      rules: build("rules", !rulesLoaded, refreshRules),
      plugins: build("plugins", !pluginLibrary, refreshPlugins),
    };
  }, [
    agent.id,
    agent.isDetected,
    aggregate,
    mcpLibrary,
    pluginLibrary,
    refreshMcp,
    refreshPlugins,
    refreshRules,
    refreshSkills,
    rulesLoaded,
    skillScan?.result,
    t,
    validation,
  ]);
}

export function useAgentAssetDomain(
  agent: ManagedAgentSummary,
  domain: AgentAssetDomain,
): AgentAssetInventory {
  return useAgentAssetInventoryMap(agent, { eagerDomains: [domain] })[domain];
}
