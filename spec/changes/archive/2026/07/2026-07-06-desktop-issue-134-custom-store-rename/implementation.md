# Implementation

## Shipped

- `apps/desktop/src/renderer/stores/skill.store.ts` 已新增 `renameCustomStoreSource()`，直接更新持久化的 `customStoreSources` 名称。
- `apps/desktop/src/renderer/components/skill/SkillStoreCustomSources.tsx` 已增加 inline rename 流程，支持从详情面板和列表项进入编辑并保存/取消。
- `apps/desktop/src/renderer/components/skill/SkillStore.tsx` 已把 rename action 接入自定义商店视图。
- `apps/desktop/tests/unit/components/skill-store-remote.test.tsx` 已补自定义商店重命名回归测试。

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/unit/components/skill-store-remote.test.tsx --run`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/desktop lint`

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-desktop-issue-134-custom-store-rename/tasks.md`

## Follow-ups

- 如果后续用户还希望修改自定义商店 URL / type，可以在同一个 inline 编辑框架上继续扩展，但那会超出本轮 issue 范围。
