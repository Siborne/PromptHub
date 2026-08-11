# Data Recovery Spec

## Purpose

本规范定义 PromptHub 数据恢复、预升级备份、目录迁移与恢复安全边界的稳定真相源。

## Stable Requirements

### 1. Recovery Safety

- 高风险的数据恢复、目录迁移和升级路径必须优先保证数据不丢失。
- 用户文件状态会被改变的动作必须以可理解方式提示用户，而不是静默进行。

### 2. Pre-Change Safety Net

- 在高风险布局迁移或升级前，应具备保险快照、预备份或等价的可回滚手段。
- 恢复或迁移失败后，不应把用户留在半恢复或半迁移状态。
- 完整恢复、portable restore、升级恢复和数据库恢复必须先在不可见 stage 中准备
  候选，校验容量、路径、symlink、schema、hash、SQLite quick-check 与领域数量，
  再通过 durable journal 发布。任一 DB、文件、配置或领域步骤失败时必须回滚；
  崩溃后的下一次启动必须在打开业务服务前完成或回滚 journal，不能报告 partial
  success。
- 全量 portable snapshot 只能在一个 storage maintenance intent 内生成：先阻止新
  client，关闭 writer，创建一致 SQLite image，投影 canonical tree，核对 logical
  envelope 与 canonical inventory，再流式写 ZIP。选择性导出不得附带未选择领域的
  完整 canonical checkpoint。
- 恢复候选、安全点、被覆盖根和 pre-restore 状态统一进入有界 recovery registry，
  按数量、年龄和总字节限制清理。正在使用的 operation ID 必须受保护；损坏、未完成
  或越界 artifact 不得被当作可恢复快照。
- 当前目录残留恢复重试时，旧根目录中的空 `prompthub.db` 占位文件不得阻断
  Skill/workspace 残留迁移。若旧根 `prompthub.db` 与统一目录
  `data/prompthub.db` 同时存在且内容冲突，必须先把旧根数据库保留为
  `prompthub.db.legacy-conflict-*.db` 备份，再移除根残留并完成布局迁移；
  符号链接形式的旧根数据库必须继续作为风险残留保留并提示失败。
- 桌面运行时数据库路径选择必须优先使用已存在的 `data/prompthub.db`。只有当
  统一目录数据库不存在时，旧根 `prompthub.db` 才能作为旧布局兼容 fallback，
  避免历史 partial marker 让根残留重新成为当前数据库。
- 预升级快照必须跳过 Electron 在 `userData` 根目录创建的运行时 singleton
  条目（`SingletonCookie`、`SingletonLock`、`SingletonSocket`）。这些条目不是
  用户数据，不得导致布局迁移快照失败；但用户数据 payload 内的其它符号链接
  仍必须拒绝。
- 预升级备份、legacy 预升级备份迁移、以及从预升级备份恢复必须拒绝符号链接；
  不得把 `userData` 外部引用作为快照内容保存、迁移或恢复进当前数据目录。
- 数据库恢复合并附带资产、工作区文件或浏览器存储目录时必须跳过符号链接；
  不得把所选恢复来源之外的文件内容导入当前数据目录。
- 数据库恢复候选中的 `prompthub.db`、`data/prompthub.db`、独立数据库
  备份文件、以及用户直接拖入的数据库恢复源必须是 link-safe 普通文件，并通过
  真实 SQLite 表读取确认含有 PromptHub Prompt、Folder、Version、Rule、Skill、
  Setting 或其它可恢复业务记录；不得仅依赖 `.db` 后缀判断，也不得通过符号链接
  读取或恢复外部数据库内容。损坏或无法识别的文件必须拒绝；暂时被锁定的有效
  SQLite 文件应保留为候选，并在可用时回退展示同目录的持久文件清单。
- 桌面端备份拖拽入口必须区分导出包合并导入与 SQLite 整库恢复。PromptHub 生成的
  `backup-*`、`backup-before-*`、`pre-recovery-*`、`integrity-backup-*` 和
  `legacy-conflict-*` 数据库备份，无论是否带最终 `.db` 后缀，都应进入恢复候选预览，
  并在用户明确确认后才替换当前数据库。
- 恢复候选检测不得把符号链接指向的外部 workspace、renderer storage、
  file storage 或 skill 目录计为可恢复数据。
- 用户明确添加的历史目录只要含有 link-safe 的 `data/` 或 `config/` 持久数据就必须
  进入候选，包括 MCP、Rule、Plugin、Skill、媒体与未来新增的数据子目录；不得因
  Prompt/Skill 行数为零或 SQLite 暂时锁定而丢弃。恢复界面必须展示这些数据类别，
  目录恢复必须无覆盖地合并完整 `data/` 与 `config/` 树。
- 选择性导出中的 Skill、MCP 与 Plugin 是独立范围。全量备份和导入确认必须明确
  展示 Prompt、Folder、Version、媒体、AI 配置、系统设置、Rule、Skill、MCP 与
  Plugin，不能用 Skill 代指其它 Agent 资产。
- 手动数据路径迁移复制当前 `userData` 到新根目录时必须跳过源目录树中的符号链接；
  不得把当前数据根之外的链接目标变成新数据根中的真实文件。
- 数据路径预览/检测不得把符号链接形式的 marker 目录或数据库文件计为真实
  PromptHub 数据，避免把外部链接目标误判为可切换的数据根。
- 数据路径目标根目录本身不得是符号链接；预览或应用数据路径变更时必须在切换
  或复制数据前拒绝该目标。
- 预升级快照创建失败时必须清理半成品快照目录，避免留下没有 manifest
  的恢复候选。
- 从自部署 Web 恢复远程桌面快照只能由用户显式触发。恢复前必须先成功创建
  本地安全快照；本地快照失败、远端校验失败、协议不兼容或版本不兼容时，
  不得清空、合并或替换当前数据，也不得静默回退到旧 live-sync 数据。
- 自部署 Web 返回远程恢复快照前必须校验不可变 envelope 与 payload 的
  SHA-256。最新快照损坏时必须停止并报告错误，不得静默选择更旧快照；每个
  认证用户只能列出和读取自己的快照。
- 数据库启动完整性检查只允许自动修复两类可证明可重建的派生结构：freelist
  计数不一致，以及诊断全部为 `wrong # of entries in index <name>` 的索引条目
  不一致。修复前必须在数据库旁创建带时间戳的原文件备份；索引名必须先在
  `sqlite_master` 中确认，所有 `REINDEX` 必须位于单事务内，并在提交前及新连接
  上重新通过 `PRAGMA quick_check`。其它损坏必须停止初始化，不得用空库、默认值
  或猜测性表级恢复掩盖。
- WebDAV、S3、自部署快照恢复和手动整包导入在改变本地数据前必须创建安全快照。
  任一数据库、文件、媒体、Rule、Skill、MCP 或 Plugin 恢复步骤失败时，必须尝试
  恢复安全快照；空数据目录必须创建仅含清单的空基线，不能因本地无数据而跳过
  回滚保护。回滚失败必须作为独立错误暴露，不能把部分恢复报告为成功。
- 迁移所需的数据库原文件备份或升级安全快照创建失败时必须停止迁移/升级写入，
  不得记录警告后继续打开并修改旧数据库。
- 文件优先 authority 的首次发布必须发生在 renderer 持久状态迁移之后。旧数据树先
  保存为一个有界 UUID safety point，再 stage canonical tree 和重建目录；只有 hash、
  graph、SQLite、fresh reopen 与运行期 context 刷新全部成功才提交。失败继续使用旧
  authority，不得留下 marker 指向半成品。
- 资源 schema 转换必须使用 durable publication journal。转换中断后启动时先完成或
  回滚 journal；未知较新 schema 不得被旧客户端降级写回，用户 revision 不随 schema
  转换递增。

### 3. Stable Internal Sources

- 目录迁移与数据布局事实见 `spec/knowledge/structure/data-layout-v0.5.5-zh.md`。
- 历史恢复/迁移计划和事故收敛记录保存在 `spec/changes/legacy/docs-08-todo/`。

## Stable Scenarios

### Scenario: Contributor changes recovery behavior

When backup, restore, migration, or recovery behavior changes materially:

- they create a delta spec under `spec/changes/active/<change-key>/specs/data-recovery/spec.md`
- they sync durable recovery guarantees back into this stable spec after implementation

### Scenario: User encounters upgrade-risking data operations

When the app is about to perform risky data operations:

- the system should prioritize recoverability and user awareness over silent convenience
