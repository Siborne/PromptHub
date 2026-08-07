# Design

<!-- traceability: enforced -->

## `DES-PROMPTLIST-001`: 列表元数据投影 + 按需详情

核心思路：**列表主路径只传 `PromptSummary`（不含大文本），完整对象按需单条加载并缓存**。旧 `PROMPT_GET_ALL` 保持完整语义不动，作为备份/导出的数据源；新增 `PROMPT_GET_ALL_META` 作为列表主路径。

### 数据流（桌面端）

```
启动/刷新:
  prompt.store.fetchPrompts()
    → window.api.prompt.getAllMeta()          [新: prompt:getAllMeta]
      → 主进程 PromptDB.getAllMeta()          [投影 SQL, 不 parse 大 JSON]
      → PromptSummary[]                       [不含 userPrompt/systemPrompt/notes/lastAiResponse/variables]
    → set({ prompts: summaries })

打开详情/编辑/看板需要完整内容:
  usePromptDetail(id)
    → cache 命中? 直接返回
    → 未命中: window.api.prompt.get(id)       [旧: prompt:get, 单条全字段]
      → PromptDB.getById(id)
    → 写入 promptDetailCache + 返回
```

### 改动清单

**`packages/shared`**
- `types/prompt.ts`：新增 `PromptSummary` 接口（字段见 delta spec）。
- `constants/ipc-channels.ts`：新增 `PROMPT_GET_ALL_META: "prompt:getAllMeta"`。

**`packages/db`**
- `prompt.ts`：新增 `getAllMeta(): PromptSummary[]`。SQL 只 SELECT 投影列；不 `JSON.parse` variables/images/videos 之外的大字段（tags/images/videos 仍需 parse 供列表展示；userPrompt 等列不取）。
- 补充真实 SQLite 测试：投影字段集、无大字段泄漏、与 `getAll` 数量一致。

**`apps/desktop/src/main`**
- `ipc/prompt.ipc.ts`：`ipcMain.handle(PROMPT_GET_ALL_META, () => db.getAllMeta())`。

**`apps/desktop/src/preload`**
- `api/prompt.ts`：暴露 `getAllMeta: () => ipcRenderer.invoke(IPC_CHANNELS.PROMPT_GET_ALL_META)`。

**`apps/desktop/src/renderer`**
- `stores/prompt.store.ts`：
  - `prompts: PromptSummary[]`。
  - 新增 `promptDetailCache: Record<string, Prompt>`。
  - `fetchPrompts` 改调 `getAllMeta`。
  - 新增 `getPromptDetail(id): Promise<Prompt>`（命中缓存直接返回，否则 `prompt:get` + 写缓存）。
  - `updatePrompt` / `createPrompt` 返回值是完整 `Prompt`，写入 `prompts`（summary）与 `promptDetailCache` 两侧。
- 新增 `hooks/usePromptDetail.ts`：`useState` + `useEffect` 订阅缓存，暴露 `{ prompt, isLoading }`。
- 组件迁移（每个独立 commit + 测试）：
  1. 详情面板：`PromptDetailFields` / `PromptDetailSupplement` / `PromptDetailHeader` / `PromptDetailMarkdown` / `PromptDetailMetadataPanels`（改为 `usePromptDetail`）。
  2. 编辑弹窗：`EditPromptModal`（打开时按需加载）。
  3. AI 测试：`AiTestModal` / `prompt-ai-workbench-runner`。
  4. 看板：`PromptKanbanView`（卡片内容按需加载，或用 `usePromptDetail` 逐卡片）。
  5. 变量弹窗 / 版本历史 / 复制流 / 内联编辑。
  6. 画廊 / 表格：只读 summary 已有字段（images/videos 在 summary 中）。

**`apps/web`**
- `services/prompt.service.ts`：list 查询改为投影列（`SELECT` 显式列），`rowToPrompt` 拆分出 `rowToPromptSummary`。
- `routes/prompts.ts`：list 响应用 `PromptSummary[]`；详情路由保持全字段。
- 测试：list 响应不含大文本字段。

### 关键决策

- **旧 `getAll` 不动**：备份 / 导出 / `database-backup.ts` / `sync-backup-core.ts` 继续用完整通道，保证字段零丢失。
- **`images`/`videos` 保留在 summary**：它们是文件名（非 base64），体积小，且画廊/看板缩略图必需。
- **`getPromptDetail` 缓存**：session 内按需加载一次；`updatePrompt` 后刷新缓存，避免脏读。
- **搜索仍走内存过滤**：TopBar 搜索用 `title/description/tags`（summary 已有），不改变搜索行为。

## Affected Areas

- Data model: 无 schema 变更；新增 `PromptSummary` 共享类型。
- IPC / API:
  - 桌面端新增 `prompt:getAllMeta` 通道；`prompt:get` 复用为详情按需加载源。
  - web 端 `/api/prompts` list 响应裁剪；详情路由不变。
- Filesystem / sync: 无变更（备份/导出继续用完整数据）。
- UI / UX: 详情面板/编辑弹窗首次打开多一次 IPC 往返（毫秒级），需 loading 态；列表渲染行为不变。

## Tradeoffs

- **按需加载延迟**：详情首次打开多一次 `prompt:get` IPC（本地毫秒级）。换取启动/刷新 5.7× 传输减少，净收益为正。
- **迁移成本**：30+ 组件中有大字段访问的约 15 个需要迁移到 `usePromptDetail`；逐组件独立 commit 控制风险。
- **缓存一致性**：`promptDetailCache` 需在 `updatePrompt` / `deletePrompt` 时同步失效，否则详情展示脏数据。这是新增的维护点。
- **看板**：卡片直接渲染 `userPrompt`，按需加载会让滚动时卡片内容后到；可选方案是把看板卡片改为"摘要先行 + 内容按需填充"。

## Failure And Rollback

- External boundary: IPC `prompt:getAllMeta` 与 `prompt:get`；web `/api/prompts`。
- Partial failure behavior:
  - `getAllMeta` 失败 → `fetchPrompts` catch 后 `isLoading=false`，列表为空（与现状一致）。
  - `getPromptDetail` 失败 → `usePromptDetail` 暴露 error，详情面板显示重试/降级提示。
- Recovery/rollback: 回滚 store 的 `fetchPrompts` 一行切回 `getAll` 即恢复全字段传输；新通道与类型可保留（增量）。

## Analyze Result

- Requirement links: `FR-PROMPTLIST-001`（见 proposal primary requirement）
- Verification links: `TEST-PROMPTLIST-001`（见 tasks）
- Blocking conflicts: 无。与 `desktop-frontend-perf-tuneup`（已归档部分）不重叠；与虚拟化策略兼容（summary 数据仍全量在内存，虚拟化只管 DOM 渲染）。
- Unresolved `[待确认]`:
  - `[待确认-1]` 看板卡片是"整列按需加载"还是"逐卡片 usePromptDetail"——实现阶段按滚动性能实测决定。
  - `[待确认-2]` 是否把 `PromptGalleryView` / `PromptTableView` 的字段需求全部包含在 summary（当前设计已包含 images/videos，预期满足）。

## Traceability

| Requirement       | Design             | Verification        | Task             |
| ----------------- | ------------------ | ------------------- | ---------------- |
| `FR-PROMPTLIST-001` | `DES-PROMPTLIST-001` | `TEST-PROMPTLIST-001` | `T-PROMPTLIST-001` |
