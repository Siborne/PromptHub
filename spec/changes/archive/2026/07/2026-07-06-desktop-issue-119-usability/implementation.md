# Implementation

## Shipped

- 确认 issue `#119` 的第一条“文件夹栏和提示词列表栏拖拽调宽”已在当前桌面端代码中落地，不需要重复实现：`Sidebar.tsx` 与 `MainContent.tsx` 已接入 `ColumnResizer`，`ui.store.ts` 已持久化列宽，且已有 `column-resizer` / `ui-columns` 测试覆盖。
- Desktop 卡片详情面板中的用户提示词展示区域现在也能像标题一样通过双击进入现有 inline edit 流程，不再要求用户只能从标题进入编辑。
- Desktop 画廊视图现在按 `galleryImageSize` 区分标题展示策略：`small` / `medium` 模式下标题自然换行，`large` 模式保持当前两行 clamp，避免在更紧凑的卡片布局里过早截断。
- 新增回归测试覆盖了 `#119` 本轮补齐的两个行为：用户提示词双击进入 inline edit，以及画廊标题在 `small` / `medium` 与 `large` 模式下的不同展示策略。

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/integration/components/main-content-inline-edit.integration.test.tsx --run`
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/prompt-gallery-view.test.tsx --run`
- `pnpm --filter @prompthub/desktop exec tsc --noEmit`

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-desktop-issue-119-usability/tasks.md`

## Follow-ups

- 如果后续用户希望 `large` 模式下标题也完全放开换行，可以再根据真实视觉反馈决定是否统一所有 gallery size 的标题策略。
- issue `#119` 里的“卡片模式直接双击用户提示词进入编辑”目前落在右侧详情面板，不是直接在 gallery card 卡片面内部联编辑；若用户强调的是“卡片网格本体内联编辑”，那会是下一轮更大的交互改动。
