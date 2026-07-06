# Implementation

## Shipped

- `apps/desktop/src/main/services/skill-installer-export.ts` 现在会先通过 `parseSkillMd()` 提取 `instructions` 里的正文，再重新组装单份 frontmatter，避免完整 `SKILL.md` 被二次包裹成双 YAML。
- 新增 `apps/desktop/tests/unit/main/skill-installer-export.test.ts`，覆盖“已有 frontmatter 的完整 `SKILL.md` 导出后仍只保留一段 frontmatter”的回归场景。

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/unit/main/skill-installer-export.test.ts --run`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop lint`

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-desktop-issue-131-skill-frontmatter-dedupe/tasks.md`

## Follow-ups

- 如果后续要彻底防止历史坏数据继续被安装到平台，还可以再增加一次平台写入前的 frontmatter 去重兜底；当前修复先收口在根因更明确的导出层。
