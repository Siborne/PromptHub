import type {
  ManagedAgentFilter,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import type { SkillPlatformOsKey } from "@prompthub/shared/constants/platforms";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  buildManagedAgents,
  sortManagedAgents,
} from "../services/managed-agents";
import { useSettingsStore } from "./settings.store";

interface AgentState {
  agents: ManagedAgentSummary[];
  selectedAgentId: string | null;
  searchQuery: string;
  filter: ManagedAgentFilter;
  pinnedAgentIds: string[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  selectAgent: (agentId: string) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: ManagedAgentFilter) => void;
  togglePinned: (agentId: string) => void;
}

function getOsKey(): SkillPlatformOsKey {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) return "win32";
  if (platform.includes("mac")) return "darwin";
  return "linux";
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agents: [],
      selectedAgentId: null,
      searchQuery: "",
      filter: "all",
      pinnedAgentIds: [],
      isLoading: false,
      hasLoaded: false,
      error: null,
      ensureLoaded: async () => {
        if (!get().hasLoaded && !get().isLoading) await get().refresh();
      },
      refresh: async () => {
        if (!window.api?.skill) {
          set({ hasLoaded: true, error: "agent-platform-api-unavailable" });
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const [platforms, detectedPlatformIds] = await Promise.all([
            window.api.skill.getSupportedPlatforms(),
            window.api.skill.detectPlatforms(),
          ]);
          const agents = buildManagedAgents({
            platforms,
            detectedPlatformIds,
            pinnedPlatformIds: get().pinnedAgentIds,
            builtinOverrides:
              useSettingsStore.getState().builtinAgentOverrides || {},
            osKey: getOsKey(),
          });
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
      setFilter: (filter) => set({ filter }),
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
