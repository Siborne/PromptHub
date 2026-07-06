# Implementation

## Shipped

- 在 `apps/desktop/src/renderer/components/layout/MainContent.tsx` 的 prompt 详情头部标签区保留已有标签展示，并为每个标签 chip 增加直接删除动作。
- 移除了详情区内联“输入标签/推荐标签”面板，避免标签操作区域挤占正文空间。
- `apps/desktop/src/renderer/components/layout/Sidebar.tsx` 中的左侧标签 chip 现在支持原生拖拽。
- 当前 prompt 详情标签区支持接收来自 sidebar 的标签拖拽，拖放后会立即把该标签附加到当前 prompt。

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/integration/components/main-content-inline-edit.integration.test.tsx`
- `pnpm --filter @prompthub/desktop exec vitest run tests/integration/components/main-content-inline-edit.integration.test.tsx tests/integration/components/main-content-selection-restore.integration.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/stores/prompt-save-sync.test.ts`
  - 结果：通过
- `pnpm --filter @prompthub/desktop lint`
  - 结果：通过

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-desktop-tag-quick-actions/specs/desktop/spec.md`
- `spec/changes/archive/2026/07/2026-07-06-desktop-tag-quick-actions/design.md`
- `spec/changes/archive/2026/07/2026-07-06-desktop-tag-quick-actions/tasks.md`

## Follow-ups

- 如果后续仍希望支持“拖拽 prompt 到 sidebar 标签上添加标签”，可继续扩展为双向标签拖拽；这部分不属于本次最小闭环。
