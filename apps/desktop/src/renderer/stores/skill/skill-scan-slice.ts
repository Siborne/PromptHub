import { filterVisibleScannedSkills } from "../../services/skill-filter";
import { getErrorMessage, getProjectScanPaths } from "./skill-store-domain";
import type {
  AgentSkillScanState,
  ProjectSkillScanState,
  SkillScanSlice,
  SkillStoreGet,
  SkillStoreSet,
} from "./skill-store-types";

function setProjectScanState(
  set: SkillStoreSet,
  projectId: string,
  projectState: ProjectSkillScanState,
): void {
  set((current) => ({
    projectScanState: {
      ...current.projectScanState,
      [projectId]: projectState,
    },
  }));
}

function setAgentScanState(
  set: SkillStoreSet,
  platformId: string,
  platformState: AgentSkillScanState,
): void {
  set((current) => ({
    agentScanState: {
      ...current.agentScanState,
      [platformId]: platformState,
    },
  }));
}

function markProjectScanStarted(
  set: SkillStoreSet,
  get: SkillStoreGet,
  projectId: string,
): void {
  const previous = get().projectScanState[projectId];
  setProjectScanState(set, projectId, {
    ...(previous || { scannedSkills: [] }),
    isScanning: true,
    error: null,
  });
}

async function scanProjectSkills(
  set: SkillStoreSet,
  get: SkillStoreGet,
  project: Parameters<SkillScanSlice["scanProjectSkills"]>[0],
) {
  const paths = getProjectScanPaths(project);
  markProjectScanStarted(set, get, project.id);
  try {
    const scannedSkills = await window.api.skill.scanLocalPreview(paths);
    setProjectScanState(set, project.id, {
      scannedSkills,
      isScanning: false,
      scannedAt: Date.now(),
      error: null,
    });
    return scannedSkills;
  } catch (error) {
    const previous = get().projectScanState[project.id];
    const errorMessage = getErrorMessage(error);
    setProjectScanState(set, project.id, {
      scannedSkills: previous?.scannedSkills || [],
      isScanning: false,
      scannedAt: previous?.scannedAt,
      error: errorMessage,
    });
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}

function markAgentScanStarted(
  set: SkillStoreSet,
  get: SkillStoreGet,
  platformId: string,
): void {
  const previous = get().agentScanState[platformId];
  setAgentScanState(set, platformId, {
    ...(previous || { result: null }),
    isScanning: true,
    error: null,
  });
}

async function scanAgentPlatformSkills(
  set: SkillStoreSet,
  get: SkillStoreGet,
  platformId: string,
) {
  markAgentScanStarted(set, get, platformId);
  try {
    const result = await window.api.skill.scanPlatformSkills(platformId);
    setAgentScanState(set, platformId, {
      result,
      isScanning: false,
      scannedAt: Date.now(),
      error: null,
    });
    return result;
  } catch (error) {
    const previous = get().agentScanState[platformId];
    const errorMessage = getErrorMessage(error);
    setAgentScanState(set, platformId, {
      result: previous?.result ?? null,
      isScanning: false,
      scannedAt: previous?.scannedAt,
      error: errorMessage,
    });
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}

function createScanNavigationActions(set: SkillStoreSet) {
  return {
    setStoreView: (storeView) =>
      set({
        storeView,
        selectedRegistrySlug: null,
        selectedSkillId: null,
      }),
    selectProject: (selectedProjectId) => set({ selectedProjectId }),
  } satisfies Pick<SkillScanSlice, "setStoreView" | "selectProject">;
}

function createProjectScanActions(set: SkillStoreSet, get: SkillStoreGet) {
  return {
    scanProjectSkills: (project) => scanProjectSkills(set, get, project),
    setProjectScanState: (projectId, projectState) =>
      setProjectScanState(set, projectId, projectState),
    getVisibleProjectScannedSkills: (projectId, options) =>
      filterVisibleScannedSkills(
        get().projectScanState[projectId]?.scannedSkills || [],
        options?.searchQuery || "",
      ),
  } satisfies Pick<
    SkillScanSlice,
    | "scanProjectSkills"
    | "setProjectScanState"
    | "getVisibleProjectScannedSkills"
  >;
}

function createAgentScanActions(set: SkillStoreSet, get: SkillStoreGet) {
  return {
    scanAgentPlatformSkills: (platformId) =>
      scanAgentPlatformSkills(set, get, platformId),
    setAgentScanState: (platformId, platformState) =>
      setAgentScanState(set, platformId, platformState),
  } satisfies Pick<
    SkillScanSlice,
    "scanAgentPlatformSkills" | "setAgentScanState"
  >;
}

export function createSkillScanSlice(
  set: SkillStoreSet,
  get: SkillStoreGet,
): SkillScanSlice {
  return {
    storeView: "my-skills",
    selectedProjectId: null,
    projectScanState: {},
    agentScanState: {},
    ...createScanNavigationActions(set),
    ...createProjectScanActions(set, get),
    ...createAgentScanActions(set, get),
  };
}
