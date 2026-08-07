# Tasks

## Stage 1 — 契约与数据层（可独立合并，零组件迁移）

- [x] `T-PROMPTLIST-001` 在 `packages/shared/types/prompt.ts` 新增 `PromptSummary` 接口（字段见 design delta）
- [x] `T-PROMPTLIST-002` 在 `packages/shared/constants/ipc-channels.ts` 新增 `PROMPT_GET_ALL_META`
- [x] `T-PROMPTLIST-003` 在 `packages/db/src/prompt.ts` 实现 `getAllMeta()`：投影 SQL，不取大文本列
- [x] `T-PROMPTLIST-004` 先补失败测试 `TEST-PROMPTLIST-001`：真实 SQLite 断言投影字段集、无大字段泄漏、与 `getAll` 数量一致、`\x00` 处理
- [x] `T-PROMPTLIST-005` 主进程 `ipc/prompt.ipc.ts` 注册 `PROMPT_GET_ALL_META` handler
- [x] `T-PROMPTLIST-006` preload `api/prompt.ts` 暴露 `getAllMeta`
- [x] `T-PROMPTLIST-007` 跑 `pnpm test -- packages/db --run` + `pnpm --filter @prompthub/desktop lint && typecheck`

## Stage 2 — store 双轨 + 按需 hook

- [ ] `T-PROMPTLIST-008` `prompt.store.ts`：`prompts` 改 `PromptSummary[]`，新增 `promptDetailCache` 与 `getPromptDetail(id)`
- [ ] `T-PROMPTLIST-009` `fetchPrompts` 切到 `getAllMeta`；`updatePrompt`/`createPrompt`/`deletePrompt` 同步维护缓存
- [ ] `T-PROMPTLIST-010` 新增 `hooks/usePromptDetail.ts`（缓存 + 按需加载 + loading/error 态）
- [ ] `T-PROMPTLIST-011` 先补失败测试 `TEST-PROMPTLIST-002`：store 双轨行为、缓存命中/失效、按需加载

## Stage 3 — 组件迁移（每个独立 commit + 测试）

- [ ] `T-PROMPTLIST-012` 详情面板组件迁移到 `usePromptDetail`
- [ ] `T-PROMPTLIST-013` `EditPromptModal` 打开时按需加载完整 prompt
- [ ] `T-PROMPTLIST-014` `AiTestModal` / AI workbench 迁移
- [ ] `T-PROMPTLIST-015` `PromptKanbanView` 卡片内容按需加载（按 `[待确认-1]` 方案）
- [ ] `T-PROMPTLIST-016` 变量弹窗 / 版本历史 / 复制流 / 内联编辑迁移
- [ ] `T-PROMPTLIST-017` 全局 grep 确认无组件再从 `prompts` summary 访问大字段

## Stage 4 — web 端

- [ ] `T-PROMPTLIST-018` `apps/web/src/services/prompt.service.ts` list 查询列裁剪 + `rowToPromptSummary`
- [ ] `T-PROMPTLIST-019` `routes/prompts.ts` list 响应 `PromptSummary[]`
- [ ] `T-PROMPTLIST-020` 先补失败测试 `TEST-PROMPTLIST-003`：web list 响应不含大文本字段

## Stage 5 — 收尾验证

- [ ] `T-PROMPTLIST-021` 备份/导出/恢复回归（`database-backup` / `sync-backup-core` 完整字段不丢）
- [ ] `T-PROMPTLIST-022` 跑全套 `pnpm test:run` / `lint` / `typecheck` / `build` / `bundle:budget`
- [ ] `T-PROMPTLIST-023` 记录传输量对比（IPC 载荷或 Network）到 `implementation.md`
- [ ] `T-PROMPTLIST-024` 更新 `implementation.md` + 稳定 knowledge 文档
- [ ] `T-PROMPTLIST-025` Converge 后归档变更文件夹
