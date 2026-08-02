import type {
  AgentInventoryResponse,
  AgentIdentityPreferences,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import type { SkillPlatformOsKey } from "@prompthub/shared/constants/platforms";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  buildManagedAgents,
  sortManagedAgents,
} from "../services/managed-agents";
import { resolveAgentIdentity } from "../services/agent-identity";
import { isWebRuntime } from "../runtime";
import { useSettingsStore } from "./settings.store";

interface AgentState {
  agents: ManagedAgentSummary[];
  selectedAgentId: string | null;
  searchQuery: string;
  pinnedAgentIds: string[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  selectAgent: (agentId: string) => void;
  setSearchQuery: (query: string) => void;
  togglePinned: (agentId: string) => void;
  applyIdentityPreferences: (preferences: AgentIdentityPreferences) => void;
}

function getOsKey(): SkillPlatformOsKey {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "win32";
  if (platform.includes("mac")) return "darwin";
  return "linux";
}

function getWebAgentApi():
  | { listManaged: () => Promise<AgentInventoryResponse> }
  | undefined {
  const api = window.api as unknown as {
    agent?: { listManaged?: () => Promise<AgentInventoryResponse> };
  };
  return api.agent?.listManaged
    ? { listManaged: api.agent.listManaged }
    : undefined;
}

function applyPinnedAgents(
  agents: ManagedAgentSummary[],
  pinnedAgentIds: string[],
): ManagedAgentSummary[] {
  const pinned = new Set(pinnedAgentIds);
  return sortManagedAgents(
    agents.map((agent) => ({ ...agent, isPinned: pinned.has(agent.id) })),
  );
}

async function loadDesktopAgents(
  pinnedAgentIds: string[],
): Promise<ManagedAgentSummary[]> {
  const [platforms, detectedPlatformIds] = await Promise.all([
    window.api.skill.getSupportedPlatforms(),
    window.api.skill.detectPlatforms(),
  ]);
  const settings = useSettingsStore.getState();
  return buildManagedAgents({
    platforms,
    detectedPlatformIds,
    pinnedPlatformIds: pinnedAgentIds,
    disabledPlatformIds: settings.disabledPlatformIds,
    builtinOverrides: settings.builtinAgentOverrides || {},
    agentIdentityPreferences: settings.agentIdentityPreferences,
    osKey: getOsKey(),
  }).filter((agent) => agent.isDetected);
}

async function loadManagedAgents(
  pinnedAgentIds: string[],
): Promise<ManagedAgentSummary[]> {
  if (!isWebRuntime()) return loadDesktopAgents(pinnedAgentIds);
  const api = getWebAgentApi();
  if (!api) throw new Error("agent-inventory-api-unavailable");
  const inventory = await api.listManaged();
  return applyPinnedAgents(inventory.agents, pinnedAgentIds);
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      selectedAgentId: null,
      searchQuery: "",
      pinnedAgentIds: [],
      isLoading: false,
      hasLoaded: false,
      error: null,
      ensureLoaded: async () => {
        if (!get().hasLoaded && !get().isLoading) await get().refresh();
      },
      refresh: async () => {
        if (!isWebRuntime() && !window.api?.skill) {
          set({ hasLoaded: true, error: "agent-platform-api-unavailable" });
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const agents = await loadManagedAgents(get().pinnedAgentIds);
          const selectedAgentId = agents.some(
            (agent) => agent.id === get().selectedAgentId,
          )
            ? get().selectedAgentId
            : agents[0]?.id || null;
          set({
            agents,
            selectedAgentId,
            isLoading: false,
            hasLoaded: true,
          });
        } catch (error) {
          console.error("Failed to load managed Agents", error);
          set({
            isLoading: false,
            hasLoaded: true,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      selectAgent: (agentId) => set({ selectedAgentId: agentId }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      applyIdentityPreferences: (preferences) =>
        set((state) => ({
          agents: sortManagedAgents(
            state.agents.map((agent) => {
              const identity = resolveAgentIdentity(
                agent.id,
                agent.name,
                preferences,
              );
              return {
                ...agent,
                name: identity.name,
                displayIconId: identity.iconId,
              };
            }),
          ),
        })),
      togglePinned: (agentId) => {
        const pinnedAgentIds = get().pinnedAgentIds.includes(agentId)
          ? get().pinnedAgentIds.filter((id) => id !== agentId)
          : [...get().pinnedAgentIds, agentId];
        const pinned = new Set(pinnedAgentIds);
        set({
          pinnedAgentIds,
          agents: sortManagedAgents(
            get().agents.map((agent) => ({
              ...agent,
              isPinned: pinned.has(agent.id),
            })),
          ),
        });
      },
    }),
    {
      name: "agent-workbench",
      partialize: (state) => ({
        selectedAgentId: state.selectedAgentId,
        pinnedAgentIds: state.pinnedAgentIds,
      }),
    },
  ),
);
