import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";

export interface SharedSkillDistributionTarget {
  id: "agent-skills-global";
  kind: "shared";
  name: string;
  maturity: "experimental";
  relativePath: ".agents/skills";
}

export interface PlatformSkillDistributionTarget {
  id: string;
  kind: "platform";
  name: string;
  platformId: string;
}

export type SkillDistributionTarget =
  | SharedSkillDistributionTarget
  | PlatformSkillDistributionTarget;

export const SHARED_SKILL_DISTRIBUTION_TARGETS: readonly SharedSkillDistributionTarget[] =
  [
    {
      id: "agent-skills-global",
      kind: "shared",
      name: "Shared Agent Skills",
      maturity: "experimental",
      relativePath: ".agents/skills",
    },
  ];

export function getSkillDistributionTargets(): SkillDistributionTarget[] {
  return [
    ...SKILL_PLATFORMS.map((platform) => ({
      id: platform.id,
      kind: "platform" as const,
      name: platform.name,
      platformId: platform.id,
    })),
    ...SHARED_SKILL_DISTRIBUTION_TARGETS,
  ];
}
