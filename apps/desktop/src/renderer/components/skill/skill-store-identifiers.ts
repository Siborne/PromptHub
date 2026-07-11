import type { RegistrySkill } from "@prompthub/shared/types";

export function getRegistrySkillSelectionId(skill: RegistrySkill): string {
  return skill.source_id || skill.slug || skill.source_url;
}

export function getRegistrySkillPendingKey(skill: RegistrySkill): string {
  return skill.source_id || skill.source_url || skill.slug;
}
