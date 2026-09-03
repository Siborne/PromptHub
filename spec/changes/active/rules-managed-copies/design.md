# Design

## Overview

Rules 应改成与当前 `data/` 架构一致的“文件真相源、数据库索引、外部文件同步”的结构：

1. **`userData/data/rules/`** 保存规则正文、项目规则副本和版本文本，是 Rules 的业务真相源。
2. **数据库**保存规则列表、状态和查询缓存，可从 `data/rules/` 重建。
3. **外部目标文件**（如 `~/.claude/CLAUDE.md`、某项目目录下 `AGENTS.md`）只作为部署目标和互操作表面，不再是唯一数据源。

这使 Rules 同时具备：

- 类似 Prompt 的正文与版本管理
- 类似 Skill 的本地 canonical 副本与外部平台同步
- 与当前 `userData/data/` 布局一致的备份、迁移、恢复能力

## Affected Areas

- Data model:
- `data/rules/` 作为业务真相源，按稳定 Rule id 组织 canonical bundle
- 数据库中的 `rules` / `rule_versions`（后续实现）只承担索引和状态缓存，不应成为正文唯一来源
- `ruleProjects` 不再作为项目规则的长期真相源；项目绑定进入对应 canonical bundle
- 现有 `KNOWN_RULE_FILE_TEMPLATES` 继续作为全局规则白名单模板，但只负责“可建档规则目标”，不再直接代表正文存储位置

- IPC / API:
- `rules:list` 改为从数据库规则记录生成列表，而不是每次拼模板 + settings 路径
- `rules:read` 改为读数据库正文、版本和同步状态，并返回目标文件存在情况
- `rules:save` 改为先写数据库和 managed copy，再尝试同步外部目标文件
- 新增显式部署/重新部署/从目标文件导入/解决冲突等 IPC 能力

- Filesystem / sync:
- 新增 managed copy 根目录：`<userData>/data/rules/`
- 每条 Rule 使用 `data/rules/<rule-id>/` bundle：`rule.md`、`rule.json`、
  `versions/` 和 bundle manifest；`cache/rules-workspace/` 仅为可重建兼容工作区
- 外部目标文件继续放在平台原生位置，但角色降级为 mirror target
- 升级备份、手动 ZIP 导出、WebDAV 同步应覆盖 `data/rules/`；数据库只作为加速层附带备份

- UI / UX:
- 删除 `Current Project` 项
- 项目规则列表只显示用户手动添加的项目目录所对应的规则记录
- 规则详情需要显示三层信息：PromptHub 托管状态、managed copy 状态、外部目标文件状态
- 保存按钮语义变为“保存到 PromptHub”，部署按钮语义变为“同步到目标文件”或“重新部署”
- 历史版本恢复默认只恢复到当前草稿/当前记录，不自动覆写外部目标文件

## Proposed Data Model

### `data/rules/`

当前目录：

- `data/rules/<rule-id>/rule.md`
- `data/rules/<rule-id>/rule.json`
- `data/rules/<rule-id>/versions/000001.md`
- `data/rules/<rule-id>/manifest.json`

说明：

- 规则正文和版本正文以纯文本形式存盘，符合规则市场、diff、手工恢复和 Finder 直查需求。
- `rule.json` 保存 Rule 逻辑元数据；项目 Rule 额外保存目标路径和项目根路径。
  内置/custom 全局目标始终由当前设备 agent 配置派生。同步状态由当前 canonical
  正文与外部目标重新计算，不作为业务真相源。

### 数据库索引层

建议字段：

- `rules`: id、scope、platform_id、managed_copy_path、target_file_path、sync_status、updated_at
- `rule_versions`: rule_id、version、version_file_path、source、created_at
- 注意：这些表是索引层，不是正文唯一来源；`prompthub.db` 丢失后应能从 `data/rules/` 重建。

## Managed Copy Layout

遵循现有 `userData/data/` 结构，把 Rules 副本放在：

- `userData/data/rules/<rule-id>/rule.md`
- `userData/data/rules/<rule-id>/rule.json`
- `userData/data/rules/<rule-id>/versions/*.md`

原因：

- 当前数据布局迁移已把内部持久化资源集中到 `userData/data/`，例如 `data/skills`、`data/assets/images`、`data/assets/videos`
- 规则副本放在 `data/rules/` 能自然进入升级快照、目录迁移、未来 ZIP 导出与人工排查
- 使用纯文本 `rule.md`，最适合规则市场分发、手工恢复与 diff

## Source of Truth Contract

主从关系必须明确：

1. **`data/rules/` 中的正文文件和版本文件是主真相源**
2. **数据库是规则列表、状态与查询缓存**
3. **外部目标文件是部署目标，不是主真相源**

保存流程：

1. 通过 canonical publication journal 写 `data/rules/<rule-id>/rule.md`
2. 追加 bundle `versions/NNNNNN.md`
3. 更新 `rule.json` 与 `manifest.json`
4. 尝试同步外部目标文件
5. 更新数据库索引和 `sync_status`

读取流程：

- 默认从 `data/rules/...` 读取
- 若规则尚未建档，首次可从目标文件导入并创建 `data/rules/...`
- 若数据库索引丢失，可从 `data/rules/...` 重建索引
- 若目标文件被外部改动，进入冲突检测而不是静默覆盖

冲突解决流程：

1. 扫描或读取规则时，重新计算 managed copy 与 target file 的内容 hash。
2. 如果两者不同，详情读取返回 managed content、target content 与 `out-of-sync` 状态。
3. UI 展示两边内容，由用户选择要保留哪个版本作为事实来源，并在执行覆盖前二次确认：
   - `use-managed`: 将 PromptHub 托管正文写回外部目标文件。
   - `use-target`: 将外部目标文件导入 PromptHub 托管正文，并追加一条版本快照。
4. 解决完成后重新计算 `sync_status`，更新 cache metadata 与数据库索引；
   canonical 正文或 placement 改变时发布新的 bundle revision。

## `DES-RULESCROLL-001` Single Scroll Owner

冲突比较弹窗采用单一纵向滚动所有者：

- 弹窗标题、比较模式与底部解决操作保持在滚动区之外。
- 差异视图和并排视图共享中间的可聚焦滚动区，避免外层、卡片和代码块同时争抢滚轮。
- 中间 flex 区域必须具有确定高度和 `min-height: 0`，否则只有 `max-height` 时浏览器无法给后代滚动容器分配可滚动高度。
- 长规则仍按现有 diff 结果一次渲染，时间与空间复杂度保持 `O(n)`；本次不增加文件扫描、网络请求或持久化 I/O。若后续出现超大规则性能证据，再单独引入虚拟化，不为当前布局缺陷增加复杂度。

## `DES-RULESCROLL-002` Persistent Source Key

- 比较模式切换与来源标识组合为同一紧凑工具行，宽屏横排、窄屏换行，不使用横跨整行的分散统计。
- PromptHub 托管版本使用红色减号语义，外部文件版本使用绿色加号语义；两侧同时显示完整版本名称、存储角色和变更计数。
- 来源标识位于正文滚动区之外，滚动到底部后仍然可见。
- 底部操作使用“保留 PromptHub 托管版本”和“保留外部文件版本”的完整名称；长差异行增加垂直内边距，避免内容与工具行、页脚贴合。

## `DES-RULESCROLL-003` Bounded Source Blocks

- 来源容器只占内容所需宽度，不参与剩余空间拉伸。
- 两个来源状态块在桌面宽度下各自限制为 `19rem`，窄屏使用整行并自然换行。
- 固定工具栏保留至少 `0.75rem` 的底部内边距，使滚动后的正文不会贴住来源状态块。

## Traceability

<!-- traceability: enforced -->

| Requirement         | Design               | Verification          | Task               |
| ------------------- | -------------------- | --------------------- | ------------------ |
| `FR-RULESCROLL-001` | `DES-RULESCROLL-001` | `TEST-RULESCROLL-001` | `T-RULESCROLL-001` |
| `FR-RULESCROLL-002` | `DES-RULESCROLL-002` | `TEST-RULESCROLL-002` | `T-RULESCROLL-002` |
| `FR-RULESCROLL-003` | `DES-RULESCROLL-003` | `TEST-RULESCROLL-003` | `T-RULESCROLL-003` |

## Backup / Restore Model

### Backup

规则应纳入与 Prompt/Skill 一样的内部备份结构：

- `DatabaseBackup` 新增 `rules?: RuleBackupRecord[]`，作为文件真相源的导出清单与导入载荷

备份时：

- JSON/压缩备份导出 rules 清单和版本内容
- ZIP 导出直接把 `data/rules/` 明文文本副本一起打包，便于人工检查与脱机恢复
- settings snapshot 不再承担规则业务真相源角色

### Restore

恢复时：

- 先恢复 `data/rules/`
- 再恢复或重建数据库索引
- **不自动强制覆写外部目标文件**
- 恢复后如果目标文件存在且匹配，可标记 `synced`
- 如果目标文件缺失或不同，标记为 `target_missing` 或 `conflict`，由用户手动部署

这与当前 Skill 恢复逻辑类似：先把 PromptHub 自己的数据恢复完整，再决定是否重新部署到外部生态。

## Migration Strategy

### From current file-first model

1. 为所有现有全局规则模板和 `ruleProjects` 派生规则记录
2. 删除 `workspace-agents` / `Current Project` 伪规则项，不再生成
3. 对每个现有规则目标：
   - 若目标文件存在，导入正文到数据库
   - 生成初始版本快照，来源使用现有 `create` / `manual-save` / `ai-rewrite` 枚举，不新增 `import-from-disk`
   - 写入 managed copy `RULE.md`
4. 尝试吸收旧版 user data 同级 `rule-history/*.json` 到 `data/rules/.versions/<rule-id>/`
   - 若目标文件存在，当前目标内容作为最新托管正文，legacy history 作为更早版本合并
   - 若目标文件缺失，使用最新 legacy history 恢复托管正文，并保留 `target-missing` 同步状态
   - 旧版来源值只会归一化为现有枚举：`create`、`manual-save`、`ai-rewrite`
5. 迁移完成后，旧 `rule-history` 不再作为主版本来源

## Rule Market Readiness

该方案为未来规则市场预留最关键的能力：

- 市场下载的规则可以直接落为 `data/rules/...` 下的一组文本与元数据文件
- 市场安装包可以只是一份 Markdown 文本或包含 metadata 的轻量包
- “快速替换规则”本质上就是：
  - 写新版本到 DB
  - 写 managed copy
  - 选择性重新部署到目标文件
- 即使外部目标路径暂时不存在，市场下载的规则也已经安全保存在 PromptHub 内部，可稍后绑定和部署

## Tradeoffs

- 选择“data/rules 真相源 + DB 索引 + target file 部署”三层结构，比现在纯文件直写复杂，但这是规则市场、可恢复、跨设备迁移三者同时成立的最低成本方案。
- 文本正文与版本正文落在 `data/rules/` 会增加磁盘文件数量，但这与当前 Prompt/Skill 方向一致，也最符合用户可见、可备份、可手改的产品原则。
- 初期不做实时文件监听，而是用显式加载/保存/部署/冲突检测，能避免复杂度失控，也更符合当前桌面产品的工程节奏。

## `DES-RULES-COPY-020` Rebuildable Rule Placement

- Project canonical `data/rules/<rule-id>/rule.json` 保存外部 `targetPath` 与
  `projectRootPath`；内置/custom 全局路径继续由设备配置派生。`managedPath`、
  同步状态和外部正文不进入 canonical metadata。
- SQLite 重建以 bundle placement 恢复项目绑定；内置全局规则在工作区读取时继续以当前设备平台注册表/override 重新派生目标路径，避免旧设备路径覆盖当前配置。
- 旧 bundle 没有 placement 时保持可读；全局规则会自动重新派生，项目规则优先保留旧 cache `_rule.json` 兼容信息。新写入和后续版本更新会补齐 placement。
- legacy cached-list contract 直接委托给文件权威的有界扫描并回写 SQLite
  投影，不再维护第二套 DB 优先的可见性与路径判定。扫描复杂度为
  `O(R + B)`，`R` 为已声明 Rule 数，`B` 为读取的正文/版本字节数；无网络
  I/O、无无界并发。
- Rule publication 在正文、逻辑 metadata、版本和项目 placement 均未变化时
  必须幂等 no-op，不能仅因扫描提升 bundle revision 并使 catalog hash 失效。
- renderer 将 `exists` 解释为外部部署目标是否存在，而不是 PromptHub 托管 Rule 是否存在；main 已过滤无托管数据且平台目录不存在的空占位项。

## Rules Rebuild Traceability

| Requirement         | Design               | Verification          | Task               |
| ------------------- | -------------------- | --------------------- | ------------------ |
| `FR-RULES-COPY-020` | `DES-RULES-COPY-020` | `TEST-RULES-COPY-020` | `T-RULES-COPY-020` |

## `DES-RULES-COPY-021` Bounded Cold Load

- `scanRuleDescriptors` 在单次调用开始时创建一个 RuleDB adapter，并将它传给
  global materialization 和 project reconciliation；adapter 创建次数从 `O(R)`
  降为 `O(1)`，文件扫描仍为 `O(R + B)`。
- `CanonicalSkillDB.reconcileCanonicalWorkspaces` 按数据库连接去重，连接首次打开
  时执行 `O(S)` hydration，后续 Rule 索引写入不再重复扫描全部 `S` 个 Skill。
  新连接仍会重新执行，兼容数据库关闭、数据目录切换和 catalog 重建。
- Agent Rules inventory 使用不自动选择首项的 store 模式；descriptor 返回后由
  Agent path/platform 唯一选择目标，只产生一次相关 `rules:read`。
- 不新增常驻缓存、网络调用或无界并发；SQLite 仍可由 canonical 文件重建。

## Agent Rule Loading Traceability

| Requirement         | Design               | Verification          | Task               |
| ------------------- | -------------------- | --------------------- | ------------------ |
| `FR-RULES-COPY-021` | `DES-RULES-COPY-021` | `TEST-RULES-COPY-021` | `T-RULES-COPY-021` |

## `DES-RULES-COPY-022` Version Order Normalization

- compatibility `index.json` 读取后按 `savedAt` 从新到旧稳定排序；检测到旧顺序时
  原子回写索引，不修改任何版本正文。
- SQLite `rule_versions.version` 不依赖输入数组位置，按 `savedAt` 从旧到新分配
  `1..N`；CanonicalRuleDB 仍按 version 升序发布，因此 bundle 永远是旧到新。
- canonical bundle hydration 写 compatibility index 时直接生成新到旧顺序，避免
  下次扫描再次修复。处理量为 `O(V log V)`，`V` 受现有 20 版本上限约束。

## Rule Version Repair Traceability

| Requirement         | Design               | Verification          | Task               |
| ------------------- | -------------------- | --------------------- | ------------------ |
| `FR-RULES-COPY-022` | `DES-RULES-COPY-022` | `TEST-RULES-COPY-022` | `T-RULES-COPY-022` |

## `DES-RULES-COPY-023` Managed-First Restore Boundary

- Rule import must preflight the existing managed body, version index, target
  existence/type, and managed/target digest before publishing imported state.
- Import publishes only PromptHub-owned managed data. It derives
  `synced`/`target-missing`/`out-of-sync` after publication but does not call the
  external-target writer; only the existing explicit conflict-resolution or
  deployment action may write that target.
- Managed body, metadata, and versions must be staged and published atomically.
  Failure retains the complete pre-import readable state.
- Successful replace semantics retain a recoverable pre-import state through a
  bounded history merge. Before publishing imported content, the current managed
  body is captured as a recoverable version when it is not already represented;
  existing and imported versions are then merged by content identity with stable
  ordering and reduced to the existing 20-version limit. This reuses the current
  Rule history surface and does not introduce a second snapshot layout or cleanup
  policy.
- A restore handles `R` records and at most the existing bounded `V` versions
  per record in `O(R * V log V + B)` time and `O(V + b)` working space per
  record, where `B` is total imported bytes and `b` is one record's staged
  bytes. Callers remain sequential or use an explicitly bounded queue; no
  network call or long-lived watcher is introduced.

## Rule Restore Traceability

| Requirement         | Design               | Verification          | Task                                     |
| ------------------- | -------------------- | --------------------- | ---------------------------------------- |
| `FR-RULES-COPY-023` | `DES-RULES-COPY-023` | `TEST-RULES-COPY-023` | `T-RULES-COPY-023A`, `T-RULES-COPY-023B` |
