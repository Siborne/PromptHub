# Implementation

## Shipped

- 在 `apps/desktop/src/renderer/stores/prompt.store.ts` 中新增 `lastSelectedId`，用于记录最近一次显式选中的 prompt，并通过 zustand persist 持久化。
- `selectPrompt(null)` 不会清空 `lastSelectedId`，这样窗口恢复或列表重挂载时仍可使用最近一次显式选中项做恢复。
- 在 `apps/desktop/src/renderer/components/layout/MainContent.tsx` 中新增恢复逻辑：当当前 `selectedId` 为空、但 `lastSelectedId` 仍存在于当前文件夹/筛选后的可见 prompt 列表里时，自动恢复该选中项。
- 恢复逻辑仅对当前可见列表生效，不会跨文件夹或恢复到当前看不到的 prompt。
- 新增 `apps/desktop/tests/integration/components/main-content-selection-restore.integration.test.tsx`，覆盖“可恢复”和“不可见时不恢复”两个场景。
- 扩充 `apps/desktop/tests/unit/stores/prompt-save-sync.test.ts`，覆盖 `lastSelectedId` 在清空当前选择和多选切换时的边界行为。

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/integration/components/main-content-selection-restore.integration.test.tsx`
- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/stores/prompt-save-sync.test.ts tests/integration/components/main-content-selection-restore.integration.test.tsx tests/integration/components/main-content-inline-edit.integration.test.tsx`
  - 结果：通过（11/11）
- `pnpm --filter @prompthub/desktop lint`
  - 结果：通过

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-desktop-window-selection-restore/specs/desktop/spec.md`
- `spec/changes/archive/2026/07/2026-07-06-desktop-window-selection-restore/design.md`
- `spec/changes/archive/2026/07/2026-07-06-desktop-window-selection-restore/tasks.md`

## Follow-ups

- 如后续用户还反馈“滚动位置也跳回顶部”，可在此基础上继续补滚动位置恢复，而不是重新设计选中态恢复。
