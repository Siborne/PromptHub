import type { RegistrySkill, SkillStoreSource } from "@prompthub/shared/types";
import { buildSkillSourceId } from "@prompthub/shared/utils/skill-identity";
import { normalizeGitStoreSourceInput } from "../../services/skill-store-source";
import { isLocalRegistrySkill } from "../../services/skill-source-resolver";
import { normalizeSkillStoreSourceIdForRuntime } from "../../services/cloud-store";
import {
  sanitizePersistedAgentScanState,
  sanitizePersistedProjectScanState,
  type AgentSkillScanState,
  type ProjectSkillScanState,
} from "../../services/skill-scan-persistence";
import {
  pruneSkillTranslationCache,
  type SkillTranslationCacheEntry,
} from "../../services/skill-translation-cache";
import { ensureRegistrySkillSourceId } from "./skill-source-update-workflow";
import type { SkillState } from "./skill-store-types";

type RemoteStoreEntry = SkillState["remoteStoreEntries"][string];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRegistrySkillLike(value: unknown): value is RegistrySkill {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    typeof value.author === "string" &&
    typeof value.source_url === "string" &&
    typeof value.version === "string" &&
    typeof value.content === "string" &&
    Array.isArray(value.tags)
  );
}

function getRegistrySkillPath(skill: RegistrySkill): string {
  return skill.canonical_skill_path || skill.content_url || skill.slug;
}

function normalizeGitRemoteRegistrySkill(
  skill: RegistrySkill,
  source: SkillStoreSource,
  skillPath: string,
): RegistrySkill {
  const normalizedSource = normalizeGitStoreSourceInput(
    source.url,
    source.branch,
    source.directory,
  );
  return {
    ...skill,
    source_id: buildSkillSourceId({
      sourceType: "git-repo",
      sourceUrl: normalizedSource.url,
      branch: normalizedSource.branch,
      directory: normalizedSource.directory,
      skillPath,
    }),
    source_branch: normalizedSource.branch,
    source_directory: normalizedSource.directory,
    canonical_skill_path: skillPath,
  };
}

function normalizeLocalRemoteRegistrySkill(
  skill: RegistrySkill,
  source: SkillStoreSource | undefined,
  skillPath: string,
): RegistrySkill {
  return {
    ...skill,
    source_id: buildSkillSourceId({
      sourceType: "local-dir",
      sourceUrl: skill.source_url || source?.url,
      skillPath,
    }),
    source_branch: undefined,
    source_directory: undefined,
    canonical_skill_path: skillPath,
  };
}

function normalizeMarketplaceRemoteRegistrySkill(
  skill: RegistrySkill,
  source: SkillStoreSource,
  skillPath: string,
): RegistrySkill {
  return {
    ...skill,
    source_id: buildSkillSourceId({
      sourceType: "marketplace-json",
      sourceUrl: skill.source_url || source.url,
      skillPath,
    }),
    canonical_skill_path: skillPath,
  };
}

function normalizeRemoteRegistrySkill(
  sourceId: string,
  skill: RegistrySkill,
  customStoreSources: SkillStoreSource[],
): RegistrySkill {
  const source = customStoreSources.find((item) => item.id === sourceId);
  const skillPath = getRegistrySkillPath(skill);
  if (source?.type === "git-repo") {
    try {
      return normalizeGitRemoteRegistrySkill(skill, source, skillPath);
    } catch {
      return skill;
    }
  }
  if (source?.type === "local-dir" || isLocalRegistrySkill(skill)) {
    return normalizeLocalRemoteRegistrySkill(skill, source, skillPath);
  }
  if (source?.type === "marketplace-json") {
    return normalizeMarketplaceRemoteRegistrySkill(skill, source, skillPath);
  }
  return ensureRegistrySkillSourceId(skill);
}

export function normalizeRemoteStoreEntries(
  entries: unknown,
  customStoreSources: SkillStoreSource[],
): SkillState["remoteStoreEntries"] {
  if (!isObjectRecord(entries)) {
    return {};
  }

  const normalizedEntries: SkillState["remoteStoreEntries"] = {};
  for (const [sourceId, entry] of Object.entries(entries)) {
    if (!isObjectRecord(entry) || !Array.isArray(entry.skills)) {
      continue;
    }

    const skills = entry.skills
      .filter(isRegistrySkillLike)
      .map((skill) =>
        normalizeRemoteRegistrySkill(sourceId, skill, customStoreSources),
      );
    if (skills.length === 0) {
      continue;
    }

    normalizedEntries[sourceId] = {
      ...(entry as Partial<RemoteStoreEntry>),
      loadedAt: typeof entry.loadedAt === "number" ? entry.loadedAt : 0,
      error: null,
      skills,
    };
  }

  return normalizedEntries;
}

export function partializeSkillState(state: SkillState) {
  const filteredEntries = normalizeRemoteStoreEntries(
    state.remoteStoreEntries,
    state.customStoreSources,
  );
  return {
    viewMode: state.viewMode,
    galleryColumns: state.galleryColumns,
    filterType: state.filterType,
    storeView: state.storeView,
    selectedProjectId: state.selectedProjectId,
    projectScanState: sanitizePersistedProjectScanState(state.projectScanState),
    agentScanState: sanitizePersistedAgentScanState(state.agentScanState),
    customStoreSources: state.customStoreSources,
    selectedStoreSourceId: state.selectedStoreSourceId,
    remoteStoreEntries: filteredEntries,
    translationCache: pruneSkillTranslationCache(state.translationCache),
  };
}

export function mergePersistedSkillState(
  persistedState: unknown,
  currentState: SkillState,
): SkillState {
  if (!isObjectRecord(persistedState)) {
    return currentState;
  }

  const persistedCustomStoreSources = Array.isArray(
    persistedState.customStoreSources,
  )
    ? (persistedState.customStoreSources as SkillStoreSource[])
    : currentState.customStoreSources;
  const persistedProjectScanState = isObjectRecord(
    persistedState.projectScanState,
  )
    ? (persistedState.projectScanState as Record<string, ProjectSkillScanState>)
    : currentState.projectScanState;
  const persistedAgentScanState = isObjectRecord(persistedState.agentScanState)
    ? (persistedState.agentScanState as Record<string, AgentSkillScanState>)
    : currentState.agentScanState;
  const persistedTranslationCache = isObjectRecord(
    persistedState.translationCache,
  )
    ? (persistedState.translationCache as Record<
        string,
        SkillTranslationCacheEntry
      >)
    : currentState.translationCache;

  return {
    ...currentState,
    ...persistedState,
    customStoreSources: persistedCustomStoreSources,
    selectedStoreSourceId: normalizeSkillStoreSourceIdForRuntime(
      typeof persistedState.selectedStoreSourceId === "string"
        ? persistedState.selectedStoreSourceId
        : currentState.selectedStoreSourceId,
    ),
    projectScanState: sanitizePersistedProjectScanState(
      persistedProjectScanState,
    ),
    agentScanState: sanitizePersistedAgentScanState(persistedAgentScanState),
    remoteStoreEntries: normalizeRemoteStoreEntries(
      persistedState.remoteStoreEntries,
      persistedCustomStoreSources,
    ),
    translationCache: pruneSkillTranslationCache(persistedTranslationCache),
  };
}
