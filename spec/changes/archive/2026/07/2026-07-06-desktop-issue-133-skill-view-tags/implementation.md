# Implementation

## Shipped

- `apps/desktop/src/renderer/components/skill/SkillListView.tsx` 现在会在每个 skill row 的描述下直接展示最多 3 个 tags。
- `apps/desktop/src/renderer/components/skill/SkillGalleryCard.tsx` 现在会在卡片描述下直接展示最多 4 个 tags。
- 新增 `apps/desktop/tests/unit/components/skill-view-tags.test.tsx`，覆盖 list/gallery 主视图标签可见性。

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/unit/components/skill-view-tags.test.tsx --run`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop lint`

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-desktop-issue-133-skill-view-tags/tasks.md`

## Follow-ups

- 如果后续用户希望在标签过多时支持 `+N` 聚合展示，可在不增加卡片高度太多的前提下再补这一层摘要交互。
