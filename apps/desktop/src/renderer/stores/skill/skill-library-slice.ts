import type {
  SkillLibrarySlice,
  SkillStoreGet,
  SkillStoreSet,
} from "./skill-store-types";
import { createSkillLibraryActions } from "./skill-library-actions";

function createSkillLibraryState(): Pick<
  SkillLibrarySlice,
  | "skills"
  | "selectedSkillId"
  | "isLoading"
  | "error"
  | "viewMode"
  | "galleryColumns"
  | "searchQuery"
  | "filterType"
  | "filterTags"
  | "deployedSkillNames"
  | "pendingPluginChildDeploySkillIds"
> {
  return {
    skills: [],
    selectedSkillId: null,
    isLoading: false,
    error: null,
    viewMode: "gallery",
    galleryColumns: "auto",
    searchQuery: "",
    filterType: "all",
    filterTags: [],
    deployedSkillNames: new Set<string>(),
    pendingPluginChildDeploySkillIds: [],
  };
}

export function createSkillLibrarySlice(
  set: SkillStoreSet,
  get: SkillStoreGet,
): SkillLibrarySlice {
  return {
    ...createSkillLibraryState(),
    ...createSkillLibraryActions(set, get),
  };
}
