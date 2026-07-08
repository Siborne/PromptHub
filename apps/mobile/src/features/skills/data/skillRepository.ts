import type { Skill, SkillCategory } from "@prompthub/shared/types";

import type { Repository } from "@/storage/repository";

export interface MobileSkillSummary extends Pick<
  Skill,
  "id" | "name" | "description" | "is_favorite" | "author"
> {
  category: SkillCategory;
  contentPath: string;
  packagePath: string;
  tags: string[];
}

const skillPreviewData: MobileSkillSummary[] = [
  {
    id: "mobile-skill-prompt-curator",
    name: "prompt-curator",
    description: "Organize, tag, and refine reusable prompt collections.",
    is_favorite: true,
    author: "PromptHub",
    category: "general",
    packagePath: "skills/prompt-curator",
    contentPath: "skills/prompt-curator/SKILL.md",
    tags: ["prompt", "review"],
  },
  {
    id: "mobile-skill-skill-auditor",
    name: "skill-auditor",
    description:
      "Review Skill package metadata, instructions, and file boundaries.",
    is_favorite: false,
    author: "PromptHub",
    category: "dev",
    packagePath: "skills/skill-auditor",
    contentPath: "skills/skill-auditor/SKILL.md",
    tags: ["skill", "audit"],
  },
];

class PreviewSkillRepository implements Repository<MobileSkillSummary> {
  async list() {
    return skillPreviewData;
  }
}

export const skillRepository = new PreviewSkillRepository();
