import type { RegistrySkill, Skill } from "@prompthub/shared/types";
import { SKILL_PACKAGE_FINGERPRINT_ALGORITHM } from "@prompthub/shared/utils/skill-source-update";
import { hasRegistrySkillVersionChanged } from "./skill-store-update";

function normalizeIdentity(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function getExactIdentityRank(
  installedSkill: Skill,
  registrySkill: RegistrySkill,
): number {
  const sourceId = normalizeIdentity(installedSkill.source_id);
  if (sourceId && sourceId === normalizeIdentity(registrySkill.source_id)) {
    return 4;
  }
  const contentUrl = normalizeIdentity(installedSkill.content_url);
  return contentUrl &&
    contentUrl === normalizeIdentity(registrySkill.content_url)
    ? 3
    : 0;
}

function hasMatchingSourceUrl(
  installedSkill: Skill,
  registrySkill: RegistrySkill,
): boolean {
  const sourceUrl = normalizeIdentity(installedSkill.source_url);
  if (!sourceUrl || sourceUrl !== normalizeIdentity(registrySkill.source_url)) {
    return false;
  }
  const installedName = normalizeIdentity(installedSkill.name);
  return [
    registrySkill.install_name,
    registrySkill.name,
    registrySkill.slug,
  ].some((value) => normalizeIdentity(value) === installedName);
}

function getMatchRank(
  installedSkill: Skill,
  registrySkill: RegistrySkill,
): number {
  const exactRank = getExactIdentityRank(installedSkill, registrySkill);
  if (exactRank) return exactRank;
  if (hasMatchingSourceUrl(installedSkill, registrySkill)) return 2;
  const hasSourceIdentity = Boolean(
    normalizeIdentity(installedSkill.source_id) ||
    normalizeIdentity(installedSkill.content_url) ||
    normalizeIdentity(installedSkill.source_url),
  );
  return !hasSourceIdentity &&
    normalizeIdentity(installedSkill.registry_slug) ===
      normalizeIdentity(registrySkill.slug)
    ? 1
    : 0;
}

function hasCatalogUpdate(
  installedSkill: Skill,
  registrySkill: RegistrySkill,
): boolean {
  const installedFingerprint = normalizeIdentity(
    installedSkill.installed_directory_fingerprint,
  );
  const remoteFingerprint = normalizeIdentity(
    registrySkill.directory_fingerprint,
  );
  if (
    installedSkill.fingerprint_algorithm ===
      SKILL_PACKAGE_FINGERPRINT_ALGORITHM &&
    installedFingerprint &&
    remoteFingerprint
  ) {
    return installedFingerprint !== remoteFingerprint;
  }
  return hasRegistrySkillVersionChanged(installedSkill, registrySkill);
}

function hasUnambiguousUpdate(
  installedSkill: Skill,
  registrySkills: RegistrySkill[],
): boolean {
  const ranked = registrySkills
    .map((registrySkill) => ({
      rank: getMatchRank(installedSkill, registrySkill),
      registrySkill,
    }))
    .filter((candidate) => candidate.rank > 0);
  const highestRank = Math.max(0, ...ranked.map((candidate) => candidate.rank));
  const matches = ranked.filter((candidate) => candidate.rank === highestRank);
  if (highestRank === 1 && matches.length !== 1) return false;
  return (
    matches.length > 0 &&
    matches.every((candidate) =>
      hasCatalogUpdate(installedSkill, candidate.registrySkill),
    )
  );
}

/** Resolve library update badges by exact source identity, never by slug alone. */
export function getSkillsWithStoreUpdates(
  skills: Skill[],
  registrySkills: RegistrySkill[],
): Set<string> {
  return new Set(
    skills
      .filter((skill) => hasUnambiguousUpdate(skill, registrySkills))
      .map((skill) => skill.id),
  );
}
