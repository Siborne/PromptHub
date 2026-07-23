import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { getSkillScanStatus } from "../../services/skill-scan-status";
import { useMcpStore } from "../../stores/mcp.store";
import { usePluginStore } from "../../stores/plugin.store";
import { useRulesStore } from "../../stores/rules.store";
import { useSkillStore } from "../../stores/skill.store";

export type AgentAssetDomain = "skills" | "mcp" | "rules" | "plugins";

export interface AgentAssetItem {
  id: string;
  label: string;
  meta?: string;
}

export interface AgentAssetInventory {
  items: AgentAssetItem[];
  refresh: () => void;
}

function useSkillInventory(
  agent: ManagedAgentSummary,
  enabled: boolean,
): AgentAssetInventory {
  const { t } = useTranslation();
  const skills = useSkillStore((state) => state.skills);
  const scan = useSkillStore((state) => state.agentScanState[agent.id]);
  const scanSkills = useSkillStore((state) => state.scanAgentPlatformSkills);
  useEffect(() => {
    if (enabled && agent.isDetected && !scan?.result && !scan?.isScanning) {
      void scanSkills(agent.id).catch(() => undefined);
    }
  }, [agent.id, agent.isDetected, enabled, scan, scanSkills]);
  const items = useMemo(
    () =>
      (scan?.result?.scannedSkills ?? []).map((skill) => ({
        id: skill.platformSkillPath,
        label: skill.name,
        meta: getSkillScanStatus(skill, skills).managedSkill
          ? t("agents.managed", "Managed")
          : t("agents.external", "External"),
      })),
    [scan?.result?.scannedSkills, skills, t],
  );
  const refresh = useCallback(() => {
    if (agent.isDetected) void scanSkills(agent.id);
  }, [agent.id, agent.isDetected, scanSkills]);
  return { items, refresh };
}

function useMcpInventory(
  agent: ManagedAgentSummary,
  enabled: boolean,
): AgentAssetInventory {
  const { t } = useTranslation();
  const library = useMcpStore((state) => state.library);
  const presets = useMcpStore((state) => state.targetPresets);
  const status = useMcpStore((state) => state.targetStatus);
  const load = useMcpStore((state) => state.load);
  useEffect(() => {
    if (enabled && !library) void load();
  }, [enabled, library, load]);
  const items = useMemo(() => {
    const presetIds = new Set(
      presets
        .filter((item) => item.platformId === agent.id)
        .map((item) => item.id),
    );
    return Array.from(
      new Set(
        status
          .filter((item) => presetIds.has(item.presetId))
          .flatMap((item) => item.serverNames),
      ),
    ).map((name) => ({
      id: name,
      label: name,
      meta: t("agents.configured", "Configured"),
    }));
  }, [agent.id, presets, status, t]);
  const refresh = useCallback(() => void load(), [load]);
  return { items, refresh };
}

function useRulesInventory(
  agent: ManagedAgentSummary,
  enabled: boolean,
): AgentAssetInventory {
  const { t } = useTranslation();
  const files = useRulesStore((state) => state.files);
  const hasLoaded = useRulesStore((state) => state.hasLoadedFiles);
  const load = useRulesStore((state) => state.loadFiles);
  useEffect(() => {
    if (enabled && !hasLoaded) void load();
  }, [enabled, hasLoaded, load]);
  const items = useMemo(
    () =>
      files
        .filter((file) => file.platformId === agent.id)
        .map((file) => ({
          id: file.id,
          label: file.name,
          meta: file.syncStatus
            ? t(`rules.syncStatus.${file.syncStatus}`, file.syncStatus)
            : t("agents.detected", "Detected"),
        })),
    [agent.id, files, t],
  );
  const refresh = useCallback(() => void load({ force: true }), [load]);
  return { items, refresh };
}

function usePluginInventory(
  agent: ManagedAgentSummary,
  enabled: boolean,
): AgentAssetInventory {
  const library = usePluginStore((state) => state.library);
  const targets = usePluginStore((state) => state.targetMatrix);
  const load = usePluginStore((state) => state.load);
  useEffect(() => {
    if (enabled && !library) void load();
  }, [enabled, library, load]);
  const items = useMemo(() => {
    const target = targets.find((item) => item.id === agent.id);
    return (target?.installedPlugins ?? []).map((plugin) => ({
      id: plugin.id,
      label: plugin.displayName || plugin.name,
      meta: plugin.version,
    }));
  }, [agent.id, targets]);
  const refresh = useCallback(() => void load({ force: true }), [load]);
  return { items, refresh };
}

export function useAgentAssetDomain(
  agent: ManagedAgentSummary,
  domain: AgentAssetDomain,
): AgentAssetInventory {
  const inventory = {
    skills: useSkillInventory(agent, domain === "skills"),
    mcp: useMcpInventory(agent, domain === "mcp"),
    rules: useRulesInventory(agent, domain === "rules"),
    plugins: usePluginInventory(agent, domain === "plugins"),
  };
  return inventory[domain];
}

export function useAgentAssetInventoryMap(
  agent: ManagedAgentSummary,
): Record<AgentAssetDomain, AgentAssetInventory> {
  return {
    skills: useSkillInventory(agent, true),
    mcp: useMcpInventory(agent, true),
    rules: useRulesInventory(agent, true),
    plugins: usePluginInventory(agent, true),
  };
}
