import type { RegistrySkill, SkillStoreSource } from "@prompthub/shared/types";
import { createSkillRegistryActions } from "./skill-registry-actions";
import type {
  SkillRegistrySlice,
  SkillStoreGet,
  SkillStoreSet,
} from "./skill-store-types";

function createSkillRegistryState(): Pick<
  SkillRegistrySlice,
  | "registrySkills"
  | "isLoadingRegistry"
  | "storeCategory"
  | "storeSearchQuery"
  | "selectedRegistrySlug"
  | "customStoreSources"
  | "selectedStoreSourceId"
  | "remoteStoreEntries"
> {
  return {
    registrySkills: [] as RegistrySkill[],
    isLoadingRegistry: false,
    storeCategory: "all",
    storeSearchQuery: "",
    selectedRegistrySlug: null,
    customStoreSources: [] as SkillStoreSource[],
    selectedStoreSourceId: "official",
    remoteStoreEntries: {},
  };
}

export function createSkillRegistrySlice(
  set: SkillStoreSet,
  get: SkillStoreGet,
): SkillRegistrySlice {
  return {
    ...createSkillRegistryState(),
    ...createSkillRegistryActions(set, get),
  };
}
