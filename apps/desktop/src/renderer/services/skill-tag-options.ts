import type { Skill } from "@prompthub/shared/types";

/**
 * Tag-option helpers for the "My Skills" tag filter control.
 *
 * These keep the searchable multi-select widget in the My Skills header
 * driven by plain strings derived from skill tags, so the same filtering
 * semantics stay testable without rendering the component tree.
 *
 * 用于“我的 Skill”标签过滤控件的标签候选工具。控件头部搜索多选下拉由
 * 从 skill tags 派生的纯字符串数组驱动，从而无需渲染组件树即可测试过滤语义。
 */

/**
 * Normalize a single candidate tag.
 * Returns null when the value is not a non-empty string after trimming so it
 * is excluded from candidates (mirrors the sidebar tag collections).
 */
function normalizeTag(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build the unique, sorted, non-empty list of tags across the given skills.
 * Only the id/tag shape is required so callers can pass store secrets or
 * plain rows alike.
 */
export function collectSkillTagOptions(
  skills: Array<Pick<Skill, "tags">>,
): string[] {
  const seen = new Set<string>();
  for (const item of skills) {
    if (!Array.isArray(item.tags)) {
      continue;
    }
    for (const raw of item.tags) {
      const tag = normalizeTag(raw);
      if (tag !== null) {
        seen.add(tag);
      }
    }
  }
  return Array.from(seen).sort((left, right) => left.localeCompare(right));
}

/**
 * Filter the candidate tag list by a user query. Blank/whitespace queries
 * return the full list; otherwise a case-insensitive substring match (same
 * semantics as `filterVisibleSkills` uses for text search on tags).
 */
export function filterSkillTagOptions(
  options: string[],
  query: string,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return options;
  }
  return options.filter((option) => option.toLowerCase().includes(q));
}
