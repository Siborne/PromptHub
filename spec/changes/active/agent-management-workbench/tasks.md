# Tasks

## Clarify And Analyze

- [x] `T-AGENT-001` 盘点现有预置/custom Agent、路径、AI config、Skill、MCP、Rules、Plugin、backup、tray 和 session 边界。
- [x] `T-AGENT-002` 核对 CC Switch 官方功能，并建立 PromptHub current/target/phase 覆盖矩阵。
- [x] `T-AGENT-003` 确认现有预置 Agent 是一级对象，Agent Profile/Persona 不作为第一阶段主模型。
- [x] `T-AGENT-004` 固化全部预置 Agent 的展示清单、常用优先级、默认排序和用户置顶规则，不以 adapter 完成度过滤平台。
- [x] `T-AGENT-005` 完成凭据威胁模型与现有 AI config 密钥存储审计，确认 OS secure storage 投影策略。结论记录于 `platform-capability-research.md`：现有 `ai-models.json` 明文密钥不可复用；抽取 cloud auth 的 `safeStorage` 加密、原子替换和 main-only 访问模式。
- [ ] `T-AGENT-006` 建立每个预置平台的 capability inventory：installation/provider/session/CLI/quota/proxy。
- [ ] `T-AGENT-007` 收集首批 provider/session 原生配置 fixture、格式版本和真实外部修改样本。
- [x] `T-AGENT-008` 确认外部会话正文保持平台所有、本地、按需读取且不进入同步；PromptHub 不编辑 transcript。删除优先调用平台原生命令，raw-file adapter 仅在另行通过回收站/回滚测试后提供删除。
- [ ] `T-AGENT-009` 确认本地代理、协议转换、故障转移和 OAuth 能力拆为独立 change。
- [ ] `T-AGENT-010` 完成实现前 Analyze：无冲突、孤立 ID、缺失 TEST/TASK 或阻塞性待确认。

UI screen structure, interaction states, responsive behavior and component boundaries are specified in `ui-design.md`.

## Test-First Verification Contracts

- [x] `TEST-AGENT-001` Agent registry 回归：全部 built-in、enabled custom、configured-but-not-detected 均可见；常用/安装/配置/置顶排序正确；disabled custom 按策略隐藏；不自动创建 Profile。
- [x] `TEST-AGENT-002` capability 决策表：检测与 provider/session/CLI 支持互不混淆，unsupported 不伪装 failed/success。
- [ ] `TEST-AGENT-003` DB 黑盒/事务：Provider Profile CRUD、重复名称、归档、模型映射、级联和并发更新。
- [ ] `TEST-AGENT-004` secret 安全：DB JSON、IPC、日志、快照、export 和错误均不含 key/token/auth header。
- [ ] `TEST-AGENT-005` provider import fixture：已知字段、未知字段、畸形内容、Unicode、空值、OAuth-owned 凭据和 import preview。
- [ ] `TEST-AGENT-006` 三方对账决策表：unchanged/backfill/external-modified/conflict/unsupported/blocked。
- [ ] `TEST-AGENT-007` 真实文件集成：backup、structured write、comment/unknown field preservation、atomic rename、digest race、verify failure 和 rollback。
- [ ] `TEST-AGENT-008` 资产聚合契约：Skill/MCP/Rules/Plugin 列表、计数、状态和动作与 owning domain 一致。
- [x] `TEST-AGENT-009` config file 安全：首批覆盖 allowlist、仅内容编辑、缺失文件创建、symlink escape、path traversal、null byte 和权限错误；snapshot/restore 随后续版本能力补齐。
- [ ] `TEST-AGENT-010` session fixture：增量扫描、search/read/resume、missing、parse-error、超大文件、Unicode 和取消。
- [ ] `TEST-AGENT-011` session 隐私/性能：正文不进入默认 sync/export，10,000 条分页/虚拟化，bounded preview 和 redaction。
- [ ] `TEST-AGENT-012` model test：成功流、stream、timeout、abort、auth/network/model-not-found 分类、redirect/SSRF 边界和 redaction。
- [ ] `TEST-AGENT-013` tray/workspace 契约：共享 active-state query 与 activation service，不存在第二状态源。
- [ ] `TEST-AGENT-014` backup round-trip：新旧格式、缺失 secret、跨设备 path reconciliation、无 transcript body。
- [ ] `TEST-AGENT-015` import/deep-link fuzz：版本、大小、非法 URL、敏感字段、重复 id、未知协议和无确认不落盘。
- [ ] `TEST-AGENT-016` CLI detection/lifecycle：custom PATH/prefix、版本、unsupported manager、计划确认、命令参数注入和失败恢复。
- [ ] `TEST-AGENT-017` UI 行为：所有 Agent 共用同一 detail shell；Agent 行始终可点击；supported 可操作，partial 按子能力控制，planned/unsupported 置灰且不触发 IPC；覆盖 provider diff、asset actions、sessions、diagnostics、keyboard 和 7 locales。
- [x] `TEST-AGENT-018` 全量回归：Prompt、Skill、MCP、Rules、Plugin、AI Settings、backup/sync、tray 和现有 Agent 分发不回归。（config file 批次已通过 383 files / 3354 tests、desktop build 和隔离 HOME 的 Agent Electron E2E；后续 adapter 批次仍须重复执行）

## Phase 0: Foundations

- [ ] `T-AGENT-011` 在 `packages/shared` 增加 Managed Agent、capability、Provider Profile、activation plan/result、session 和 IPC contracts。（Managed Agent、capability、非敏感 model config 与只读 session contracts 已完成；Provider Profile 与 activation contracts 待后续安全存储批次）
- [ ] `T-AGENT-012` 在 `packages/db` 增加 Provider Profile、model mapping、redacted snapshot、session source/index schema、迁移、索引和事务。
- [ ] `T-AGENT-013` 在 `packages/core` 增加 adapter registry、Agent query、provider reconciliation 和 asset aggregation 服务。
- [x] `T-AGENT-014` 将完整 platform registry/path resolution 接入 Managed Agent query，不复制平台记录，也不按深度 adapter 完成度过滤。
- [ ] `T-AGENT-015` 实现 desktop secure secret abstraction、provider apply transaction 和 config allowlist boundary。
- [ ] `T-AGENT-016` 建立首批 provider/session fixture 与故障注入 harness，并先完成 `TEST-AGENT-001` 至 `007`。

## Phase 1: Core Workbench

- [ ] `T-AGENT-017` 实现 Claude Code provider adapter：inspect/import/plan/apply/verify/rollback/test。
- [ ] `T-AGENT-018` 实现 Codex CLI provider adapter：inspect/import/plan/apply/verify/rollback/test。
- [ ] `T-AGENT-019` 实现 Gemini CLI provider adapter：inspect/import/plan/apply/verify/rollback/test。
- [ ] `T-AGENT-020` 接入 desktop main IPC、preload `agent` domain API 和 renderer query/action store。（config/model/session IPC 与 preload 已完成；Provider Profile query/action store 待后续批次）
- [x] `T-AGENT-021` 按 `ui-design.md` 和 `assets/agent-workbench-overview.png` 实现所有 Agent 共用的一级工作区和 detail shell：Overview、Provider & Model、Skills、MCP、Rules、Plugins、Config Files、Sessions、Usage、Maintenance；仅由 capability state 和已解析路径控制可用性，不引入 Assets 二级入口。
- [x] `T-AGENT-021A` 启用 allowlisted Config Files 页：补齐首批已验证平台配置路径、复用受限文件编辑器、打开 Agent 根目录、禁止结构性文件变更且不创建版本历史。
- [ ] `T-AGENT-022` 实现两个 verified session adapters、增量索引、搜索、只读 viewer 和 resume command。（Claude、Gemini、OpenCode 已完成有界即时索引、页面内搜索、只读 viewer 与 resume command；持久化增量索引及大目录压力测试待补）
- [ ] `T-AGENT-023` 扩展 backup/export/import 格式、验证、恢复顺序和旧格式兼容。
- [ ] `T-AGENT-024` 扩展托盘 Agent/provider 快速切换并复用统一 activation service。
- [ ] `T-AGENT-025` 补齐 7 locales、可访问性、窄窗口、长文本和大数据量回归。（7 locales、tab/row 语义和响应式基础已完成；大数据量回归待补）

## Delivery Batches And Regression Gates

1. **Registry and shell:** complete Agent query, ordering, capability states and the shared UI shell first. All preset Agents must appear before any deep adapter is treated as complete.
2. **Provider foundation:** land secure secret, reconciliation, backup/write/verify/rollback, then add provider adapters one platform at a time behind capability declarations.
3. **Assets and config:** connect owning Skill/MCP/Rules/Plugin services and allowlisted config inventory without introducing duplicate state.
4. **Sessions and tray:** add verified session adapters and tray actions only after shared query/action services are stable.
5. **Backup and breadth:** finish backup/restore, locales, accessibility, E2E and additional platform adapters.

Every batch must run its targeted failing tests first, then `pnpm typecheck`, affected unit/integration tests, and `pnpm test:run` before the batch is considered complete. High-risk filesystem, secret, backup, IPC and adapter changes require failure/rollback tests in the same batch.

## Phase 2: Coverage Breadth

- [ ] `T-AGENT-026` 按常用度、安装量证据、格式稳定性和安全风险持续补齐全部预置平台 adapters；每个平台独立声明 provider/session/config/CLI 能力。
- [ ] `T-AGENT-027` 实现 Universal Provider 与显式 per-platform projections。
- [ ] `T-AGENT-028` 实现 provider model refresh、quota/balance adapters 和 freshness semantics。
- [ ] `T-AGENT-029` 实现 Agent CLI detect/install/update/diagnose 的 plan/confirm/apply 流程。
- [ ] `T-AGENT-030` 实现 session-derived usage summaries，区分 provider/proxy evidence。
- [ ] `T-AGENT-031` 实现 versioned `prompthub://` import preview/confirm，并完成 fuzz/security gate。

## Separate Changes

- [ ] `T-AGENT-032` 为 local proxy、protocol conversion、failover、request logs 和 cost accounting 单独创建 active change。
- [ ] `T-AGENT-033` 如需 OAuth reverse proxy/account management，先完成 legal/security review 再创建 active change。
- [ ] `T-AGENT-034` 如需 Agent Profile/Persona 组合能力，基于已交付 Managed Agent 模型单独设计，不回退到重复平台记录。

## Converge

- [ ] `T-AGENT-035` 执行 affected unit/integration/E2E、`pnpm typecheck`、`pnpm test:run` 和 release regression。
- [ ] `T-AGENT-036` 更新 `implementation.md`，记录真实 schema、adapters、命令、结果和残余风险。
- [ ] `T-AGENT-037` 将稳定术语、能力矩阵和行为同步到 `spec/knowledge/context`、`structure`、`behavior` 和 `agent-platforms.md`。
- [ ] `T-AGENT-038` 更新长期测试矩阵、coverage map、回归套件、README/用户文档和 release notes。
- [ ] `T-AGENT-039` 完成 Converge 并将 change 移至 dated archive。

## Current Gate

Registry、shell、allowlisted raw config、非敏感 model config 和首批只读 session 批次已进入实现。Model config 仅更新平台原生默认模型字段，保留平台认证所有权；Claude、Gemini、OpenCode 会话只做有界读取、搜索和恢复命令。完整 Provider Profile 切换、凭据投影、Codex/OpenClaw/Cline 会话、删除/清理、持久化会话索引与同步仍受后续安全、fixture、回滚和性能 gate 约束，未完成能力继续保持 planned/disabled。
