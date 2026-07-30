import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import type { TFunction } from "i18next";

export const SHARED_AGENT_SKILLS_DISTRIBUTION_TARGET: SkillPlatform = {
  id: "agent-skills-global",
  name: "Shared Agent Skills",
  icon: "Share2",
  rootDir: {
    darwin: "~/.agents/skills",
    linux: "~/.agents/skills",
    win32: "%USERPROFILE%/.agents/skills",
  },
  skillsRelativePath: "",
  isConfigured: true,
};

export function appendSharedSkillDistributionTarget(
  platforms: SkillPlatform[],
): SkillPlatform[] {
  return platforms.some(
    (platform) => platform.id === SHARED_AGENT_SKILLS_DISTRIBUTION_TARGET.id,
  )
    ? platforms
    : [...platforms, SHARED_AGENT_SKILLS_DISTRIBUTION_TARGET];
}

export function getSkillDistributionTargetName(
  platform: SkillPlatform,
  t: TFunction,
): string {
  return platform.id === SHARED_AGENT_SKILLS_DISTRIBUTION_TARGET.id
    ? t("skill.sharedTargetLabel", "Shared Agent Skills")
    : platform.name;
}
