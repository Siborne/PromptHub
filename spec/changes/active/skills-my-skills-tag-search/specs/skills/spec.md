# Skills Spec — My-Skills 标签搜索（OR）

## Requirements

- `FR-TAGSEARCH-001`（added）在 my-skills 主内容头部提供可搜索、可多选的标签过滤控件；选中任一标签即可命中（OR 语义由 `filterVisibleSkills` 复用保证）。
- `FR-TAGSEARCH-002`（added）标签选中结果仅在 UI 视图层影响列表可见性，不改任何持久化字段与 IPC/shared 契约。
- `FR-TAGSEARCH-003`（added）该控件与侧栏标签面板共用 store `filterTags`：任一入口增删选中标签，另一入口状态同步可见（单一数据源）。
- `FR-TAGSEARCH-000`（unchanged）既有 filterType / searchQuery / source filter 行为保持不变。

## Acceptance scenarios

- 候选为 0：主内容不渲染标签控件。
- 候选非空：点击 trigger 展开列出全部 tags；键入只把候选收窄为匹配项；无匹配时给空提示。
- 勾选某 tag：store `filterTags` 增加该 tag 且列表随之过滤；再次点选则移除（toggle），UI aria/计数同步。
- 已选非空：提供逐个“移除”chip 与“清除全部标签筛选”；点击后 OR 过滤清空回到全量。
- 点击控件任一操作都会停留/切到 my-skills 视图（不进入详情页打断选择）。
