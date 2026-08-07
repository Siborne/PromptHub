# Delta Spec

本 delta 描述 prompt 列表加载从"全字段传输"改为"列表元数据 + 按需详情"后的可观察行为，作为 `spec/knowledge/behavior/desktop.md` 与 web API 契约的增量。

## Added

- 桌面端应新增轻量列表元数据 IPC 通道 `prompt:getAllMeta`（`PROMPT_GET_ALL_META`），返回 `PromptSummary[]`。
- `PromptSummary` 只含列表 / 搜索 / 看板 / 画廊需要的字段：`id`、`title`、`description`、`promptType`、`tags`、`folderId`、`parentId`、`order`、`isFavorite`、`isPinned`、`images`、`videos`、`usageCount`、`source`、`visibility`、`createdAt`、`updatedAt`、`currentVersion`。
- `PromptSummary` **不含**大文本字段：`userPrompt`、`userPromptEn`、`systemPrompt`、`systemPromptEn`、`notes`、`lastAiResponse`、`variables`。
- `prompt.store` 应新增 `getPromptDetail(id)` action：按需调用现有 `prompt:get`，并在 `promptDetailCache` 中缓存完整对象。
- 桌面端渲染进程应新增 `usePromptDetail(id)` hook：返回缓存中的完整 prompt，未加载时触发按需加载并暴露 loading 态。
- web 端 `GET /api/prompts` 列表响应应只包含 `PromptSummary` 字段；完整内容通过 `GET /api/prompts/:id` 获取（沿用现有详情路由）。

## Modified

- 桌面端 `prompt.store` 的 `fetchPrompts` 应改调 `prompt:getAllMeta`（而非 `prompt:getAll`）；`prompts` 数组元素类型从 `Prompt` 变为 `PromptSummary`。
- 需要完整 prompt 内容的组件（详情面板、编辑弹窗、AI 测试、看板卡片、变量输入、版本历史、复制流）应改为通过 `usePromptDetail(id)` 获取，不再依赖 `prompts` 数组中的大字段。
- 备份 / 导出 / 恢复 / 工作区同步路径**保持**使用完整 `getAll` / `insertDirect` 等旧通道，不得切换到元数据通道。
- web 端 prompt 列表服务端查询应做列裁剪（不再 `SELECT *` 并把大文本序列化进列表响应）。

## Removed

- 桌面端渲染进程列表主路径不再通过 IPC 传输每条 prompt 的大文本字段（详情按需传输）。

## Scenarios

- 用户启动应用，`fetchPrompts` 返回的列表数据量应显著小于旧全量传输（1000 条时约 1.7 MB → 数百 KB）；通过 IPC 载荷测试或开发工具 Network/Performance 可量化。
- 用户点击一条 prompt 打开详情面板，应用应通过 `prompt:get` 加载该条完整内容，期间详情面板显示 loading 态；同一 session 内再次打开应命中缓存，无二次 IPC。
- 用户编辑一条 prompt（`EditPromptModal`），应先通过 `usePromptDetail` 取到完整对象再进入编辑态；编辑保存后的 `updatePrompt` 行为不变。
- 用户在 Prompt 看板视图滚动，看板卡片渲染所需的 `userPrompt` 内容应按需加载，滚动过程不触发整列全量请求。
- 用户执行备份 / 导出，导出的 JSON 仍包含每条 prompt 的完整 `userPrompt` / `systemPrompt` / `notes` / `lastAiResponse`，字段不因列表投影而丢失。
- web 端用户在列表页浏览 prompts，`/api/prompts` 响应不包含大文本字段；打开详情页时按需加载完整内容。
