import type { TFunction } from "i18next";
import { SKILL_CATEGORIES } from "@prompthub/shared/constants/skill-categories";
import type { SkillCategory, SkillStoreSource } from "@prompthub/shared/types";

import { formatStoreSourceHint } from "./skill-store-presentation";

interface SourceCopy {
  titleKey: string;
  title: string;
  hintKey: string;
  hint: string;
}

const REMOTE_SOURCE_COPY: Record<string, SourceCopy> = {
  community: {
    titleKey: "skill.communityStore",
    title: "Community Store",
    hintKey: "skill.communityStoreHint",
    hint: "This area will aggregate third-party community skill sources. The entry is ready for connecting a community registry next.",
  },
  "claude-code": {
    titleKey: "skill.claudeCodeStore",
    title: "Claude Code Store",
    hintKey: "skill.claudeCodeStoreHint",
    hint: "Built-in Claude Code source with first-class support for the official skills repo and common marketplace.json indexes.",
  },
  "openai-codex": {
    titleKey: "skill.openaiCodexStore",
    title: "OpenAI Codex Store",
    hintKey: "skill.openaiCodexStoreHint",
    hint: "Built-in OpenAI Codex source with first-class support for the curated openai/skills catalog.",
  },
  clawhub: {
    titleKey: "skill.clawHubStore",
    title: "ClawHub Store",
    hintKey: "skill.clawHubStoreHint",
    hint: "Built-in ClawHub source for browsing public community skills from clawhub.ai.",
  },
  "prompthub-cloud": {
    titleKey: "skill.promptHubCloudStore",
    title: "PromptHub Cloud",
    hintKey: "skill.promptHubCloudStoreHint",
    hint: "Published PromptHub Cloud releases with package fingerprints, safety checks, and confirmation before installation.",
  },
};

export interface SkillStoreSourceMeta {
  title: string;
  hint: string;
  count: number;
  countLabel: string;
  showCatalog: boolean;
  canRefresh: boolean;
}

interface ResolveSourceMetaOptions {
  customStoreSourcesCount: number;
  displayedStoreCount: number;
  displayedStoreCountLabel: string;
  selectedCustomSource: SkillStoreSource | null;
  selectedStoreSourceId: string;
  t: TFunction;
}

export function buildSkillStoreCategories(isZh: boolean, t: TFunction) {
  return [
    { key: "all" as const, label: t("common.showAll", "All") },
    ...Object.entries(SKILL_CATEGORIES).map(([key, value]) => ({
      key: key as SkillCategory,
      label: isZh ? value.label : value.labelEn,
    })),
  ];
}

function buildRemoteSourceMeta(
  copy: SourceCopy,
  options: ResolveSourceMetaOptions,
): SkillStoreSourceMeta {
  return {
    title: options.t(copy.titleKey, copy.title),
    hint: options.t(copy.hintKey, copy.hint),
    count: options.displayedStoreCount,
    countLabel: options.displayedStoreCountLabel,
    showCatalog: true,
    canRefresh: true,
  };
}

export function resolveSkillStoreSourceMeta(
  options: ResolveSourceMetaOptions,
): SkillStoreSourceMeta {
  const remoteCopy = REMOTE_SOURCE_COPY[options.selectedStoreSourceId];
  if (remoteCopy) return buildRemoteSourceMeta(remoteCopy, options);
  if (options.selectedStoreSourceId === "new-custom") {
    return {
      title: options.t("skill.addStoreSource", "Add Store"),
      hint: options.t(
        "skill.customStoresHint",
        "Add your own store endpoints here. A later step can connect remote manifests or registries.",
      ),
      count: options.customStoreSourcesCount,
      countLabel: `${options.customStoreSourcesCount} ${options.t("skill.skillsCount", "skills")}`,
      showCatalog: false,
      canRefresh: false,
    };
  }
  if (options.selectedCustomSource) {
    return {
      title: options.selectedCustomSource.name,
      hint: formatStoreSourceHint(options.selectedCustomSource),
      count: options.displayedStoreCount,
      countLabel: options.displayedStoreCountLabel,
      showCatalog: true,
      canRefresh: true,
    };
  }
  return {
    title: options.t("skill.officialStore", "Official Store"),
    hint: options.t(
      "skill.officialStoreComingSoonHint",
      "The official store is not open yet. You can import skills from Claude Code, OpenAI Codex, or a custom store for now.",
    ),
    count: 0,
    countLabel: `0 ${options.t("skill.skillsCount", "skills")}`,
    showCatalog: false,
    canRefresh: false,
  };
}
