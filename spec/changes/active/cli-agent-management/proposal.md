# CLI Agent Management

## Purpose

让 standalone PromptHub CLI 具备与桌面 Agent 工作台共享的 Agent 身份、可见性、平台路径和能力清单管理入口，补齐当前 CLI 只有 `skill platforms`、没有一级 `agent` 资源的问题。

## Current Boundary

- Agent 身份继续由 built-in/custom platform registry 提供，不新增 Agent Profile 表。
- built-in override、custom Agent、禁用状态和 Codex/ChatGPT 展示偏好继续存放在 SQLite `settings` 表。
- 平台能力继续由 `packages/shared/constants/agent-platform-capabilities.ts` 声明，由 `packages/core/src/agent-management` 组装。
- CLI 使用 `packages/core`，不得导入 Electron main/renderer 模块。

## Scope

- 新增 `prompthub agent list|get`，支持搜索、状态过滤、disabled 查询、JSON/table 输出。
- 新增 `agent enable|disable`，与桌面端共享 `disabledPlatformIds` / custom Agent `enabled` 状态。
- 新增 custom Agent `add|update|delete`。
- 新增 built-in/custom Agent 资产路径配置；built-in 支持 reset，custom Agent 保持 root 必填。
- 新增 Codex/ChatGPT identity preference 的读取和更新。
- 输出安装/配置状态、resolved paths、lifecycle 和 capability inventory，未实现的深度 adapter 必须保持 partial/planned/unsupported。

## Non-goals

- 不在本轮把 Electron-only Provider Profile、secret store、session transcript、usage quota、appearance、GUI launch 或 CLI 自动升级 adapter 迁移到 `packages/core`。
- 不删除 Agent 根目录、Skill、MCP、Plugin、Rules、配置文件或平台运行时数据。
- 不新增数据库 schema 或第二份 Agent 配置文件。

## Risks And Rollback

- 风险：CLI 写入 malformed relative path 会让桌面端读取错误目标；因此所有相对路径必须拒绝绝对路径、`..` 和 NUL。
- 风险：custom Agent id/root 与 built-in 或既有 custom Agent 冲突；写入前必须校验并保持事务原子性。
- 回滚：移除 `agent` router/command 和共享设置 repository 即可；已有 `settings` JSON shape 不变，桌面端仍可直接读取。

## Analyze Gate

- Stable docs and code agree that Agent identity comes from the platform registry.
- `cli-feature-completeness` can stand on its own and is review-pending; this new objective therefore uses a separate active change.
- No schema, sync payload, filesystem layout, or secret-ownership change is required.
- No blocking `[待确认]` remains for the registry-management slice.
