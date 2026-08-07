# Proposal

## Phase And Status

- Phase: specify / clarify
- Status: in-progress
- Primary requirement: `FR-PROMPTLIST-001`
- Exit condition: 方案经用户确认，进入 tasks 阶段

## Why

桌面端与 web 端在加载 prompt 列表时，都会把每条 prompt 的**全部字段**（含 `user_prompt` / `system_prompt` / `notes` / `last_ai_response` 等大文本）一次性序列化并跨进程传输：

- 桌面端：`PROMPT_GET_ALL` IPC → 主进程 `SELECT * FROM prompts` → structured clone 全量传渲染进程。
- web 端：`GET /api/prompts` → `SELECT * FROM prompts` → HTTP JSON 全量下发。

实测 `PromptListCard` 等列表渲染只用 `title` / `description` / `isFavorite` 等少量字段，但每次启动 / 刷新都按完整对象传输。成本：

| 数据量 | 当前传输 | 列表实际需要 | 浪费 |
| --- | --- | --- | --- |
| 1,000 条 | ~1.7 MB | ~300 KB | ~5.7× |
| 5,000 条 | ~8.7 MB | ~1.5 MB | ~5.7× |

收益对象是数据量大的用户（启动 / 刷新 / 切换数据源变快），以及 web 端低带宽场景。这是一次有边界的传输层优化，不改变任何用户可见行为与数据模型。

## Scope

- In scope:
  - 桌面端新增轻量列表元数据 IPC 通道（`PROMPT_GET_ALL_META`），返回不含大文本字段的 `PromptSummary[]`。
  - 桌面端 `prompt.store` 双轨化：列表用 summary，完整对象按需加载并缓存（`getPromptDetail(id)`）。
  - 迁移真正需要大字段的组件（详情面板、编辑弹窗、AI 测试、看板、变量弹窗、版本历史等）到按需加载。
  - web 端 `GET /api/prompts` 列表返回字段裁剪（去除大文本），详情走 `GET /api/prompts/:id`。
  - 为 DB 层新增投影查询与测试，为 IPC / HTTP 契约变更补测试。
- Out of scope:
  - 不改数据库 schema、不加新表。
  - 不改备份 / 导出 / 恢复路径（它们继续使用完整 `getAll` / 独立通道）。
  - 不做传输压缩（gzip / msgpack）—— 投影已能解决 5.7× 浪费，压缩是后续独立评估项。
  - 不动 CLI。
  - 不做 store 物理文件拆分（与本次无关）。

## Risks

- store 里 `prompts` 被 30+ 组件当作完整数据源消费；投影化后任何遗漏迁移的 `prompt.userPrompt` 访问会静默变 `undefined`。
- 详情按需加载引入"打开详情面板时的一次 IPC 往返延迟"，需要 loading 态。
- 看板卡片直接渲染 `prompt.userPrompt`，若投影化后看板需要按需加载整列数据。
- 备份 / 恢复路径若误用新通道会丢字段——必须保持旧 `getAll` 完整语义。
- web 端路由与既有测试的契约变化需同步。

## Rollback Thinking

- 新 IPC 通道是**增量添加**：旧 `PROMPT_GET_ALL` 保持不动，回滚只需把 store 的 `fetchPrompts` 切回旧通道，一行改动。
- web 端列表裁剪可回退为 `SELECT *`，API 形状恢复原样。
- 每迁移一个组件是独立 commit，可单独 revert。

## Related Records

- Issue: 无（本项目内部性能工作）
- ADR: 无
- Stable workflow/knowledge docs:
  - `spec/knowledge/structure/desktop-frontend-performance.md`（稳定性能策略）
  - `spec/knowledge/structure/desktop-frontend-performance.md` 第 1 节（长列表虚拟化）不冲突
