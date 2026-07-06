# Design

## Overview

- 把桌面端“完整用户数据根目录”的语义收敛到一个真实目录结构中，避免当前 `userData/prompthub.db + userData/data/*` 的双层语义。
- 新布局目标是让主数据库也进入统一数据根中，例如 `userData/data/prompthub.db`，并以 `userData/data/` 作为用户可理解、可迁移、可备份的完整数据目录。
- 启动时增加布局解析层：先探测新布局，再探测旧布局；若命中新布局则直接使用，若仅命中旧布局则执行一次安全迁移。

## Current Problem

- 当前数据库路径由 `apps/desktop/src/main/database/index.ts` 中的 `getDbPath()` 固定到 `getUserDataPath()/prompthub.db`。
- 当前工作区路径由 `apps/desktop/src/main/runtime-paths.ts` 指向 `getUserDataPath()/data/*` 或更早期的 legacy root-level 目录。
- `bootstrapPromptWorkspace()` 只根据“DB 是否有数据”“workspace 是否有数据”做四象限判断；如果用户只复制 `data/`，系统会把它视为 `workspace-only`，导致只能从工作区文件恢复，不保证覆盖全部历史数据。
- skills 当前没有等价的启动自愈链路；UI 直接从 `skills` 表读取，一旦 DB 元数据缺失，即使 `data/skills/` 托管 repo 仍在，也会表现为“我的技能 = 0”。
- Electron 用户目录中还天然存在 Chromium 运行时存储（`IndexedDB/`、`Local Storage/`、`Session Storage/`、`WebStorage/`、`Cookies`、`SharedStorage`、`blob_storage/` 等）。这些并不是 PromptHub 的业务主库，但会让用户误以为“到处都是数据库”。PromptHub 真正的业务主库仍只有 `prompthub.db` 一份，其余大多是浏览器运行时存储和历史遗留 renderer 状态。

## Target Layout

- 统一后的完整数据目录：`<userData>/data/`
- 主数据库：`<userData>/data/prompthub.db`
- 工作区与资源：保持在 `data/prompts`、`data/skills`、`data/assets/*`、`data/rules`
- `config/`、`logs/`、`backups/` 继续保留在 `userData/` 根目录，避免把运行配置与用户内容混进同一层

## Migration Strategy

### 1. Startup path resolution

- 数据库路径切换必须由“迁移状态”驱动，而不是“哪个文件存在就优先读哪个”。
- 启动解析逻辑改为：
  - 若 marker 明确标记 `dbLayoutVersion = 0.5.7`，且 `userData/data/prompthub.db` 存在，则读新路径
  - 否则若旧路径 `userData/prompthub.db` 仍存在，则继续读旧路径
  - 只有旧路径不存在时，才回退读 `userData/data/prompthub.db`
- 这样可以避免在用户目录里同时存在“正确的根目录 DB”和“历史残留的 `data/prompthub.db`”时误选后者。

### 2. One-time layout migration

- 当满足以下条件时，判定需要迁移：
  - `userData/prompthub.db` 存在
  - 且 marker 尚未声明 `dbLayoutVersion = 0.5.7`
- 启动时先创建升级快照
- 执行迁移：
  - 将旧根数据库迁移到 `userData/data/prompthub.db`
  - 保留现有 `data/*` 内容
  - 仅当 DB 迁移步骤确认完成时，才在 marker 中写入 `dbLayoutVersion = 0.5.7`
- 若迁移失败：
  - 保留旧数据库文件
  - 本次启动继续回退使用旧数据库路径

### 2.1. DB conflict policy

- 若用户目录中同时存在：
  - `userData/prompthub.db`
  - `userData/data/prompthub.db`
- 则不能直接按“新路径优先”处理。
- 规则应为：
  - 在 `dbLayoutVersion` 未完成前，根目录 DB 仍是权威源
  - 迁移阶段需要把根目录 DB 安全搬运到 `data/prompthub.db`
  - 若目标 `data/prompthub.db` 已存在但内容不同，则视为冲突，不得静默继续切换到该文件
  - 冲突时必须保留旧根 DB，并保持应用继续从旧根 DB 启动

### 3. Runtime path updates

- `database/index.ts` 的数据库路径解析改为通过统一 runtime-paths 或专门的 `getDatabasePath()` 提供
- `data-path.ts` 的数据 marker 规则需要把新数据库位置纳入 `data/` 目录语义判断
- Recovery / backup / data path change 逻辑在复制或检查“完整数据目录”时，应把数据库文件视为 `data/` 内部资产，而非额外的根级文件

### 4. Phased migration UX

- 迁移过程必须做到对老用户和新用户都无感：
  - 老用户：升级后自动完成 DB 迁移，无需手工拷文件、无需手工导入导出
  - 新用户：首次启动直接创建 `data/prompthub.db`，不会经历旧路径阶段
- UI 层不应暴露“请用户先迁移数据库”的显式步骤
- 仅在检测到 DB 冲突或迁移失败时，才在恢复/诊断 UI 中显示可操作告警

## Affected Areas

- Startup / runtime path:
  - `apps/desktop/src/main/runtime-paths.ts`
  - `apps/desktop/src/main/database/index.ts`
  - `apps/desktop/src/main/data-path.ts`
- Startup bootstrap / migration:
  - `apps/desktop/src/main/index.ts`
  - `apps/desktop/src/main/services/data-layout-migration.ts`
- Recovery / backup:
  - `apps/desktop/src/main/services/recovery-candidates.ts`
  - `apps/desktop/src/main/services/upgrade-backup.ts`
  - `apps/desktop/src/main/services/upgrade-backup-restore.ts`
  - `apps/desktop/src/main/ipc/backup.ipc.ts`

## Tradeoffs

- 优点：
  - 用户对“复制 data 目录就是复制完整数据”的直觉终于成立
  - 启动恢复链路更一致，减少 `workspace-only` 假恢复
  - 长期维护上，数据库与工作区属于同一数据语义层
  - 通过 marker 驱动路径切换，老用户/新用户都可无感过渡，不会因目录里恰好存在旧文件而误读错误 DB
- 代价：
  - 需要一次真实数据布局迁移
  - 需要同时兼容旧布局和新布局一段时间
  - 需要维护一段时间“旧根 DB 仍可读、但未迁移完成前不切换新路径”的双路径逻辑

## Verification Notes

- 需要覆盖以下升级场景：
  - 旧布局完整用户目录 -> 新版本
  - 仅旧 `data/` 目录存在 -> 新版本
  - 同时存在根目录 DB 与残留 `data/prompthub.db` -> 新版本
  - 新布局目录 -> 新版本重复启动
  - 恢复/备份后重新启动
- 需要显式验证迁移失败回退不会损坏原始数据库文件
- 需要显式验证：旧 marker 但无 `dbLayoutVersion` 时，应用仍继续读取根目录 DB，并补跑 DB 迁移。
