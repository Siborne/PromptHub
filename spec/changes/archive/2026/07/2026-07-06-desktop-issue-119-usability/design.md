# Design

## Overview

复用已有实现，不新造第二套编辑链路：

- 卡片详情内联编辑继续沿用 `MainContent.tsx` 现有的 `detailInlineDraft` / `saveDetailInlineEdit()` 流程，只是在用户提示词展示区域增加双击入口。
- 画廊标题继续使用现有 `PromptGalleryView.tsx` 组件，但按 `galleryImageSize` 区分：`small` / `medium` 模式不再做两行 `line-clamp`，让标题自然换行；`large` 保持当前紧凑展示。

## Affected Areas

- Data model:
- 无。

- IPC / API:
- 无。

- Filesystem / sync:
- 无。

- UI / UX:
- `apps/desktop/src/renderer/components/layout/MainContent.tsx`
- `apps/desktop/src/renderer/components/prompt/PromptGalleryView.tsx`
- `apps/desktop/tests/integration/components/main-content-inline-edit.integration.test.tsx`
- `apps/desktop/tests/unit/components/prompt-gallery-view.test.tsx`（新增）

## Tradeoffs

- 在 `small` / `medium` 模式下放开标题换行，比继续 clamp 更符合 issue 诉求，但会让部分卡片行高增加。
- 复用现有 inline edit 逻辑能保持行为一致，也避免引入“卡片内部临时编辑器”这种重复实现。
