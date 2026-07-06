# Design

## Overview

不改 `Input` / `Textarea` 全局默认视觉，避免影响其他表单。只在 `MainContent.tsx` 的卡片详情 inline edit 场景给标题 `Input` 和用户提示词 `Textarea` 追加白色编辑表面样式。

## Affected Areas

- `apps/desktop/src/renderer/components/layout/MainContent.tsx`
- `apps/desktop/tests/integration/components/main-content-inline-edit.integration.test.tsx`

## Tradeoffs

- 局部覆盖样式比改通用组件更安全，但会在当前文件多一层 class 组合。
