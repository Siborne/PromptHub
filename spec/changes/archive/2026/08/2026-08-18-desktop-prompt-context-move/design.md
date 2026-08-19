# Design

## Root Cause

- Prompt 的右键菜单已有查看、编辑、复制、收藏、置顶、AI 测试、历史、删除等操作，但缺少移动入口。
- 项目中已有 `updatePrompt(id, { folderId })` 和表格视图批量移动下拉，说明数据层和文件夹列表都已具备，只是单条 Prompt 的上下文操作缺失。

## Approach

- 在 `MainContent` 的 Prompt 右键菜单中新增“移动到...”菜单项。
- 菜单项点击后关闭右键菜单，并打开一个轻量的文件夹选择弹层。
- 文件夹弹层列出“移出文件夹”以及全部文件夹，使用缩进表示层级。
- 选中目标后调用 `updatePrompt(prompt.id, { folderId })`，并展示成功 toast。

## Tradeoffs

- 采用单独轻量弹层比给 `ContextMenu` 增加二级菜单更简单稳定，但会多一次点击。
