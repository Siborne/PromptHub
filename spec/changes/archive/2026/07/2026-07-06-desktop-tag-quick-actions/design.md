# Design

## Overview

- 在 `MainContent` 的详情头部标签区加入轻量级的 inline tag actions。
- 已有标签默认仍支持点击筛选，但每个 tag chip 额外提供删除按钮。
- 详情区不提供 inline 文本输入，也不展示所有候选标签，避免挤占正文空间。
- 新增标签改为通过左侧 sidebar 的标签 chip 拖拽到当前 prompt 详情标签区完成。

## Affected Areas

- `apps/desktop/src/renderer/components/layout/MainContent.tsx`
- `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/tests/integration/components/main-content-inline-edit.integration.test.tsx`
- `apps/desktop/tests/unit/components/sidebar.test.tsx`

## Tradeoffs

- 不在详情区内放置输入框或全量标签列表，避免把标签管理 UI 变成正文上方的大块面板。
- 拖拽添加依赖桌面端 pointer 交互，键盘无障碍补充可在后续迭代中单独增强。
