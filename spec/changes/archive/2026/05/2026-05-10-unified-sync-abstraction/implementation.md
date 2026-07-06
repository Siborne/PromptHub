# Implementation

## Shipped

- 新建 active change: `unified-sync-abstraction`。
- 完成 proposal/spec/design/tasks 文档，明确统一同步抽象目标与迁移路线。
- 输出统一接口草案与四阶段迁移计划。
- 新增 Desktop renderer 编排层：`apps/desktop/src/renderer/services/backup-orchestrator.ts`。
- 将 Desktop 手动备份入口切换到编排层：
	- `apps/desktop/src/renderer/components/settings/DataSettings.tsx`
	- `apps/desktop/src/renderer/components/UpdateDialog.tsx`
- 将 Desktop 手动云同步入口切换到编排层（保持原交互文案与行为）：
	- `DataSettings` 中 self-hosted：连接测试 / 上传 / 下载
	- `DataSettings` 中 WebDAV：连接测试 / 上传 / 下载
- 将 Desktop 自动同步执行入口切换到编排层：
	- `App.tsx` 中 WebDAV auto sync 改为调用 `runWebDAVAutoSync`
	- `App.tsx` 中 self-hosted auto sync 改为调用 `runSelfHostedAutoSync`
- 完成 shared 同步 provider 模型对齐：`manual | webdav | self-hosted | s3`，并同步 Web 端 schema/类型兼容（`sync.ts`、`settings.ts`、`import-export.ts`、`client/api/endpoints.ts`）。
- 新增 Web 同步编排服务：`apps/web/src/services/sync-orchestrator.ts`。
- 将 Web `sync` 路由中的 WebDAV `push/pull` 主流程切换到 orchestrator：
	- `apps/web/src/routes/sync.ts`
	- 行为保持兼容（继续支持 legacy 拉取 fallback 路径）。
- 统一 `sync` 路由操作摘要结构：
	- `PUT /sync/data`、`POST /sync/push`、`POST /sync/pull` 均返回 `summary`（prompts/folders/rules/skills），同时保留原字段兼容。
- 统一 `sync` 路由错误映射：
	- 新增统一错误 helper，将 push/pull 路由错误映射到一致的 `VALIDATION_ERROR` 返回。
	- 远端 payload 解析失败明确区分为 JSON 非法与 schema 非法，提升排障可读性。
- 进一步收敛 `sync` 路由重复逻辑：
	- 抽取 `lastSyncAt` 更新 helper，统一 `PUT /sync/data`、`POST /sync/push`、`POST /sync/pull` 三处设置写回路径。
- 对齐 push/pull 返回可读性：
	- `POST /sync/push` 新增显式导出计数字段（`promptsExported/foldersExported/rulesExported/skillsExported`），保留原有字段并继续返回 `summary`。
- 当前行为保持不变：仍然先创建本地升级快照，再执行文件导出，并按版本记录手动备份状态。

## Verification

- 设计依据来自现有代码路径审计：
- Web 同步路由与 provider 限定：`apps/web/src/routes/sync.ts`
- Desktop 自托管同步独立流程：`apps/desktop/src/renderer/services/self-hosted-sync.ts`
- Desktop WebDAV 同步独立流程：`apps/desktop/src/renderer/services/webdav.ts`
- 共享设置 provider 枚举与现实能力不一致：`packages/shared/types/settings.ts`

- 当前环境执行 `pnpm --filter @prompthub/web test -- src/routes/sync.test.ts --run` 失败，原因为 `ipaddr.js` 依赖解析失败（测试环境问题），非本设计文档引入。
- 本次改动后执行文件级错误检查通过：
	- `apps/desktop/src/renderer/services/backup-orchestrator.ts`
	- `apps/desktop/src/renderer/components/settings/DataSettings.tsx`
	- `apps/desktop/src/renderer/components/UpdateDialog.tsx`
- 本轮补充后再次执行文件级错误检查通过：
	- `apps/desktop/src/renderer/services/backup-orchestrator.ts`
	- `apps/desktop/src/renderer/components/settings/DataSettings.tsx`
- 自动同步接线后文件级错误检查通过：
	- `apps/desktop/src/renderer/services/backup-orchestrator.ts`
	- `apps/desktop/src/renderer/App.tsx`
- provider 模型对齐后文件级错误检查通过：
	- `packages/shared/types/settings.ts`
	- `apps/web/src/routes/sync.ts`
	- `apps/web/src/routes/settings.ts`
	- `apps/web/src/routes/import-export.ts`
	- `apps/web/src/client/api/endpoints.ts`
- 新增 desktop orchestrator 单元测试：
	- `apps/desktop/tests/unit/services/backup-orchestrator.test.ts`
	- 覆盖：手动备份委托、升级前备份、WebDAV auto sync 委托、self-hosted auto sync push/pull 分支与错误分支。
- 测试执行通过：
	- `pnpm --filter @prompthub/desktop test -- tests/unit/services/backup-orchestrator.test.ts --run`
	- 结果：`1 passed, 7 tests passed`
- Web 路由回归验证：
	- 执行 `pnpm --filter @prompthub/web test -- src/routes/sync.test.ts --run`
	- 结果仍失败，错误为既有环境依赖解析问题：`Failed to load url ipaddr.js`（发生在 `src/utils/remote-http.ts`），非本次 orchestrator 接线逻辑导致。
- 新增 Web orchestrator 单元测试并通过：
	- `apps/web/src/services/sync-orchestrator.test.ts`
	- 执行 `pnpm --filter @prompthub/web test -- src/services/sync-orchestrator.test.ts --run`
	- 结果：`1 passed, 4 tests passed`
- 本轮改动后再次回归：
	- 执行 `pnpm --filter @prompthub/web test -- src/services/sync-orchestrator.test.ts --run`
	- 结果：`1 passed, 4 tests passed`
- 新增并扩展 Web sync 路由测试覆盖：
	- `apps/web/src/routes/sync.test.ts`
	- 覆盖统一 `summary` 契约、push/pull 计数字段、`self-hosted`/`s3` provider 配置与状态映射。
- 解决 web sync 路由测试环境阻塞：
	- 安装缺失依赖 `ipaddr.js`（`pnpm --filter @prompthub/web add ipaddr.js@^2.2.0`）。
	- 重新执行 `pnpm --filter @prompthub/web test -- src/routes/sync.test.ts --run`。
	- 结果：`1 passed, 5 tests passed`。
- 端到端回归（Web smoke）执行通过：
	- 执行 `pnpm --filter @prompthub/web test:smoke`
	- 结果：`Smoke passed`

## Synced Docs

- 已回写稳定文档：
	- `spec/domains/sync/spec.md`（provider 联合、统一 summary 契约、orchestrator 分层约束）
	- `spec/architecture/code-structure-guidelines.md`（sync orchestration 结构约束）
	- `docs/web-self-hosted.md`（对外同步契约快照）

## Follow-ups

- 先完成 Phase 1（契约与 orchestrator 壳层），不改变用户可见行为。
- 在 Phase 2 引入 feature flag 后，再做路由/入口切换。
- 下一步优先：将 WebDAV / self-hosted 手动入口接入 orchestrator，并补统一结果模型（success/partial/failure + stage details）。
- 下一步优先：Web 侧同步路由接入统一 orchestrator，并补统一错误码与摘要结构在跨端链路的对齐。
