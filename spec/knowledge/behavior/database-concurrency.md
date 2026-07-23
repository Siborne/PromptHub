# Database Concurrency

## Purpose

本规范定义 Desktop、CLI 与 self-hosted Web 在同一数据目录使用
`node-sqlite3-wasm` SQLite 文件时的稳定并发与恢复边界。

## Stable Requirements

### 1. Durable Source Of Truth

- SQLite 仍是 Prompt、Folder 及其关系数据的唯一持久化真相源。
- `${dbPath}.clients/` 只保存进程租约，用于判断运行时锁是否可能仍有活跃所有者；
  它不是业务数据，也不能替代 SQLite 状态。

### 2. Live Lock Safety

- 初始化不得无条件删除 `node-sqlite3-wasm` 使用的 `${dbPath}.lock` 目录。
- adapter 的 `run`、`get`、`all` 每次完成后必须 finalize 底层 WASM statement；
  可复用 statement wrapper 在下一次调用时重新 prepare，不能让已完成操作长期持锁。
- 当其它已登记 PromptHub 进程仍存活时，必须保留锁并由 SQLite 等待或返回 busy。
- 当锁没有可验证的租约来源时，共享数据库调用方必须默认保守保留，避免在
  新旧版本并行时放行第二个 writer。只有已经通过外部单实例机制确认进程互斥的
  host，才可显式启用未登记 legacy lock 恢复。
- 当租约无法安全清理，或锁路径不是非符号链接的普通目录时，所有调用方都必须
  保守保留。

### 3. Orphan Recovery

- 进程初始化数据库前登记 PID 租约，正常关闭或进程正常退出时清理租约。
- 默认只有发现并成功清理已死亡或无效的既有租约，且没有活跃或未知所有者时，
  初始化才可清理对应 orphan lock。
- Desktop 在通过 Electron 单实例 gate 后，可恢复升级前版本遗留的未登记普通
  lock；self-hosted Web 在每个 `DATA_ROOT` 只有一个服务进程的部署边界内也可
  显式启用该能力；CLI 与其它共享调用方不得默认启用该能力。
- 初始化中途失败必须清理本进程刚创建的租约，避免制造新的假所有者。
- CLI 必须通过不打开 SQLite 的显式 `doctor database-lock` 命令报告 lock、live
  lease、stale lease 与未知项；普通业务命令不得因发现 ownerless lock 自动删除它。
- 只有用户明确执行 `doctor database-lock --recover` 时，CLI 才能恢复没有 live/unknown
  owner 的非符号链接普通 lock 目录。活跃 PID、未知 lease 项、符号链接、非目录 lock
  或非目录 clients 路径都必须 fail closed 并保留现场。

### 4. Contention And Visibility

- 数据库连接使用有界 `busy_timeout` 吸收短暂写入重叠；超时后 CLI 返回
  `DATABASE_BUSY` 与 conflict exit code，不能把真实损坏错误误标为锁冲突。
- Desktop 在重新获得焦点或从 hidden 恢复时重新读取 Prompt、Relation、
  Output Format 与 Folder，并合并同时发生的重复 refresh。
- Desktop 不通过第二份 renderer 持久状态或持续轮询复制 SQLite 数据。

### 5. Startup Integrity Gate

- 既有数据库在取得进程租约后、执行迁移或业务写入前必须运行
  `PRAGMA quick_check`；新建或空数据库可直接进入初始化。
- 只有诊断全部属于 SQLite freelist 计数不一致，或全部属于可验证的
  `wrong # of entries in index <name>` 时，初始化器才可自动修复。freelist 使用
  `VACUUM`；索引名必须在 `sqlite_master` 中存在，并在单事务内执行 `REINDEX`。
  两类修复都必须先创建带时间戳的原文件备份，并使用新连接再次得到 `ok`。
- 其它完整性错误不得被误判为锁冲突，也不得猜测性修复。初始化必须停止，并保留
  原数据库供备份恢复或人工诊断。

## Stable Scenarios

### Scenario: CLI writes while Desktop is open

When Desktop 已持有一个写事务且 CLI 打开同一数据库：

- CLI 不得删除 Desktop 的 lock
- 短暂冲突应等待现有事务结束
- 超出等待上限时应返回可操作的 busy 冲突
- 用户返回 Desktop 后应看到 CLI 已提交的数据

### Scenario: Previous process crashed while writing

When lock 对应的已登记进程已经死亡：

- 下一次初始化清理死亡租约
- 没有其它活跃或未知所有者时恢复 orphan lock
- 数据库随后按正常初始化和迁移流程打开

### Scenario: User explicitly diagnoses a CLI lock

When CLI 因 ownerless lock 返回 `DATABASE_BUSY`：

- `prompthub doctor database-lock` 只检查租约与路径类型，不打开或迁移数据库
- 可安全恢复时返回结构化 `recoverable` 状态，但不修改 lock
- 用户加 `--recover` 后才删除可证明无主的普通 lock，并返回 `recovered`
- 任一活跃或未知 owner 存在时返回 conflict，原 lock 保持不变

### Scenario: Desktop upgrades from a pre-lease version

When Desktop 已通过 Electron 单实例 gate，且数据目录只剩一个没有租约登记的
普通 `.lock` 目录：

- Desktop 可将其识别为 legacy orphan lock 并恢复
- 如存在活跃租约、未知租约项、符号链接或非目录 lock，仍必须拒绝清理
- CLI 与其它共享调用方面对同一未登记 lock 时仍默认保留

### Scenario: Self-hosted Web restarts after a crash

When a single self-hosted Web process starts with an ownerless legacy lock in
its mounted `DATA_ROOT`:

- Web may recover the ordinary lock through the guarded initializer hook
- a live registered client, unknown lease, symlink, or non-directory lock still
  prevents recovery
- multiple Web processes must not share the same SQLite data root

### Scenario: Existing database has a stale freelist count

When startup quick-check reports only a freelist count mismatch:

- initialization preserves a timestamped byte-for-byte backup
- SQLite rewrites the database through `VACUUM`
- normal startup continues only after a fresh quick-check returns `ok`
- broader corruption still fails closed without automatic salvage

### Scenario: Existing database has index entry-count damage

When startup quick-check reports only entry-count mismatches for existing indexes:

- initialization preserves one timestamped byte-for-byte backup
- every diagnostic index is validated and rebuilt inside one transaction
- the transaction and a fresh connection must both report `ok`
- an unknown index name or any additional diagnostic stops startup without repair
