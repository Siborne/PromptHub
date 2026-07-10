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
- 当锁没有可验证的租约来源、租约无法安全清理，或锁路径不是普通目录时，
  必须保守保留，避免在新旧版本并行或异常文件状态下放行第二个 writer。

### 3. Orphan Recovery

- 进程初始化数据库前登记 PID 租约，正常关闭或进程正常退出时清理租约。
- 只有发现并成功清理已死亡或无效的既有租约，且没有活跃或未知所有者时，
  初始化才可清理对应 orphan lock。
- 初始化中途失败必须清理本进程刚创建的租约，避免制造新的假所有者。

### 4. Contention And Visibility

- 数据库连接使用有界 `busy_timeout` 吸收短暂写入重叠；超时后 CLI 返回
  `DATABASE_BUSY` 与 conflict exit code，不能把真实损坏错误误标为锁冲突。
- Desktop 在重新获得焦点或从 hidden 恢复时重新读取 Prompt、Relation、
  Output Format 与 Folder，并合并同时发生的重复 refresh。
- Desktop 不通过第二份 renderer 持久状态或持续轮询复制 SQLite 数据。

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
