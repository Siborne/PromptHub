# Skill Source Update Reconciliation

## Why

Skill 更新现在被用户理解为“从来源更新当前 Skill”，但真实状态至少涉及三份内容：

- `B` baseline: 上次从来源安装或更新后记录下来的来源基线。
- `L` local: 当前 My Skills 中真实可读取的本地 package。
- `R` remote/source: 当前来源上最新可解析的 package。

如果只比较 `L` 和 `R`，会混淆以下情况：

- 用户直接修改了当前 Skill，本地内容和上次来源基线不一致。
- 远程来源更新了，本地仍是上次安装内容。
- 用户本地和远程来源都改了，需要冲突处理。
- 只有 `SKILL.md` 之外的资源文件变了，当前 `installed_content_hash` 无法完整表达 package 变化。
- `.env`、缓存、日志、虚拟环境等本地运行产物改变了目录，但不应触发“Skill 有更新”。

这次变更先补完整需求和设计，定义 Skill 来源身份、package 指纹、三方对账状态、冲突处理和验证范围，为后续实现提供可执行边界。

## Purpose

- 明确“同一个 Skill 来源”的识别规则，避免按名称误判。
- 明确本地修改、来源更新、双向冲突、来源不可达、baseline 缺失等状态。
- 明确 package fingerprint 如何计算，哪些文件必须忽略，哪些模板文件必须保留。
- 明确更新应用时的原子性、版本快照、回滚和下游分发影响。
- 让后续实现可以按 `FR -> DES -> TEST -> T` 追踪，而不是继续散落在 UI 判断和 store helper 中。

## Scope

### In Scope

- Skill 来源身份模型，包括 store, remote Git, local linked folder, managed copy, project/agent scan, backup/restore。
- 三方对账模型：`baseline`, `local`, `remote/source`。
- Hash/fingerprint 设计，包括 `SKILL.md` 内容 hash、完整 package fingerprint、算法版本和忽略规则。
- 本地环境变量、缓存、日志、依赖目录、PromptHub 内部目录等干扰项过滤规则。
- 状态和动作矩阵：up-to-date, update-available, local-modified, conflict, source-unavailable, baseline-missing。
- 下游 copied target 过期提示作为分发扫描辅助信号，不进入 My Skills 源更新主状态机。
- DB/类型/IPC/renderer store 的设计边界。
- 更新应用的版本快照、临时 materialize、原子替换、失败回滚和 UI 提示策略。
- 自动化验证矩阵和后续实现任务拆解。

### Out Of Scope

- 本轮不实现代码。
- 本轮不改变现有 Skill Store 源 CRUD。
- 本轮不设计远端协作、多用户合并或云同步协议。
- 本轮不把 project/agent scanned Skill 自动变成 My Skills。
- 本轮不实现三方内容 merge；冲突只定义阻止覆盖和显式操作。
- 本轮不实现 `source-moved` 自动 lineage 匹配；来源变更需要手动解绑/重绑或进入无法确认历史状态。

## Impact Scope

- Data model: 后续实现需要扩展 `skills` 表以保存完整 package baseline 和算法版本。
- Shared types: 后续实现需要把来源对账状态和结果类型放入 `packages/shared`。
- Filesystem: 后续实现会复用并收敛 Skill package fingerprint 和 ignore 规则。
- IPC/API: 后续实现需要增加或收敛 source check/update IPC，返回结构化状态。
- Renderer UI: 后续实现会调整详情页和 Store 卡片的更新按钮、badge、冲突提示和强制覆盖动作。
- Tests: 后续实现必须覆盖 DB migration, fingerprint, source resolution, update status, rollback, UI actions。

## Risks

- 如果没有 baseline package fingerprint，只能判断 `SKILL.md`，会漏掉资源文件更新。
- 如果 fingerprint 忽略规则过宽，会把真实可分发文件漏掉；如果过窄，会被 `.env`、cache、log 误触发。
- 如果更新先改 DB 再写文件，远程下载或写盘失败会留下半更新状态。
- 如果按名称或 slug 匹配来源，会把同名不同源 Skill 合并错。
- 如果 linked local folder 和 remote Git 来源混成一个层级，会误把用户外部源目录覆盖掉。

## Rollback Thinking

后续实现需要可回滚：

- 数据迁移新增字段必须向后兼容，旧记录字段为空时进入 `baseline-missing` 或可自动初始化状态。
- 更新应用前必须创建版本快照，并在临时目录验证 remote package 后再替换本地 repo。
- 更新失败时必须保留原 DB row、原 package 路径和原版本快照。
- UI 上强制覆盖本地修改必须是显式用户动作，不允许自动执行。

## Existing Context Read

- `spec/knowledge/behavior/skills.md`
- `spec/knowledge/reference/skill-regression-test-matrix.md`
- `spec/knowledge/structure/skill-system-design.md`
- `spec/knowledge/structure/skill-store-requirements.md`
- `spec/rules/tdd-design-gate.md`
- `spec/rules/testing-standards.md`
- `packages/shared/utils/skill-identity.ts`
- `apps/desktop/src/renderer/services/skill-store-update.ts`
- `apps/desktop/src/renderer/stores/skill.store.ts`
- `apps/desktop/src/main/ipc/skill/local-repo-handlers.ts`

## Open Questions

- remote package 中 symlink 的最终策略仍需在实现前确认：可选方案包括拒绝远程 symlink、记录 symlink 元数据进入 fingerprint、或仅在安全扫描通过时允许。

## Review Decisions Applied

- v1 durable package fingerprint uses `skill-package-sha256-v1`.
- Database uses one `fingerprint_algorithm` field for current and installed package fingerprints.
- Legacy installs are silently upgraded only when old entry hashes prove local and remote still match; otherwise users see the unable-to-reconcile-history flow.
- `downstream-stale` is removed from the source status enum and exposed only as distribution/topology auxiliary data.
- `source-moved` is deferred from v1.
- `local-linked` external folders cannot be overwritten directly by remote updates in v1; users must convert to managed copy or update the external folder manually.
- Raw `content-url` sources are treated as single-file packages whose package fingerprint equals normalized entry content hash.
- Safety scan runs after staging materialization and before atomic replace; high-risk findings abort and cleanup staging.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-SU-001` | `DES-SU-001` | `TEST-SU-001` | `T-SU-001` |
| `FR-SU-002` | `DES-SU-002` | `TEST-SU-002` | `T-SU-002` |
| `FR-SU-003` | `DES-SU-003` | `TEST-SU-003` | `T-SU-003` |
| `FR-SU-004` | `DES-SU-004` | `TEST-SU-004` | `T-SU-004` |
| `FR-SU-005` | `DES-SU-005` | `TEST-SU-005` | `T-SU-005` |
| `FR-SU-006` | `DES-SU-006` | `TEST-SU-006` | `T-SU-006` |
| `FR-SU-007` | `DES-SU-007` | `TEST-SU-007` | `T-SU-007` |
| `FR-SU-008` | `DES-SU-008` | `TEST-SU-008` | `T-SU-008` |
| `FR-SU-009` | `DES-SU-009` | `TEST-SU-009` | `T-SU-009` |
| `FR-SU-010` | `DES-SU-010` | `TEST-SU-010` | `T-SU-010` |
| `FR-SU-011` | `DES-SU-003`, `DES-SU-004` | `TEST-SU-011` | `T-SU-021` |
| `FR-SU-012` | `DES-SU-005`, `DES-SU-006` | `TEST-SU-012` | `T-SU-022` |
