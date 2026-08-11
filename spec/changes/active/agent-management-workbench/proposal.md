# Proposal

## Phase And Status

- Phase: implement
- Status: in-progress
- Primary requirement: `FR-AGENT-001`
- Exit condition: 31 个内置平台的能力声明、第一/第二阶段实现、验证矩阵和稳定文档完成收敛，且 `FR -> DES -> TEST -> T` 无重复、孤立或虚假完成项。

## Why

PromptHub 已经预置 Claude Code、Codex CLI、Gemini CLI、OpenCode、OpenClaw、Cursor、Windsurf 等 Agent 平台，并能围绕这些平台分发 Skill、MCP、Rules 和 Plugin。当前缺口不是“没有 Agent”，而是这些 Agent 仍主要被当作资产分发目标和路径配置：

- 用户无法从 Claude Code 或 Codex 自身的视角查看当前供应商、模型、配置、资产、会话和健康状态。
- PromptHub 自身的 AI Provider/Model 配置与各 Agent 的原生配置没有受控映射，也没有安全的导入、切换、差异预览和回滚流程。
- Skill、MCP、Rules、Plugin 已有各自事实来源，但缺少按 Agent 聚合的统一运营视图。
- 平台历史会话、CLI 版本、配置文件和认证状态散落在文件系统中，没有统一的只读索引和诊断入口。
- 切换供应商或修改 Agent 配置时，缺少保留外部修改、备份、原子写入和失败恢复边界。

因此需要新增一个以现有预置 Agent 平台为核心的一级工作台，覆盖 CC Switch 的主要能力，并复用 PromptHub 已有的资产管理、版本、备份和分发基础。

## Product Positioning

本变更采用以下产品边界：

1. **Managed Agent**：Claude Code、Codex CLI、Google Antigravity 等真实客户端或运行时，是本变更的一级产品对象。其稳定身份来自现有 built-in/custom platform registry；Gemini CLI 仅作为企业/付费 API 兼容对象保留。
2. **Agent Installation**：某个 Managed Agent 在当前设备上的安装、路径、版本、原生配置、会话和健康状态。
3. **Provider Profile**：可投影到某个 Agent 的供应商、协议、端点、模型映射和非敏感参数集合。凭据通过安全引用关联，不复制到普通配置和导出。
4. **Agent Asset State**：Skill、MCP、Rules、Plugin 在该 Agent 上的已安装、可用、漂移或不兼容状态；事实来源仍由原资产域拥有。
5. **Agent Profile / Persona**：以后用于组合角色、指令和资产的一套可复用方案。它不是第一阶段主对象，也不为每个预置 Agent 自动创建一份重复记录。

“覆盖 CC Switch 大部分功能”指覆盖用户能力和核心工作流，不要求复制其界面、数据库结构或高风险实现。PromptHub 应优先利用自己的多平台注册表、资产库、版本和同步能力形成差异化。

Google 已把普通用户的终端入口从 Gemini CLI 迁移到 Antigravity CLI。
自 2026-06-18 起，Gemini CLI 不再为 Free、Google AI Pro 和 Ultra 用户
提供请求服务；企业许可证、Google Cloud 和付费 Gemini API Key 场景仍受
支持。PromptHub 因此把 Antigravity 作为当前 Google Agent 入口，同时保留
`gemini` 身份作为企业/旧版兼容目标，避免破坏既有配置和资产路径。

## Scope Addendum 2026-07-25: Oh My Pi (#187)

Issue #187 is accepted as a platform-adaptation request, not an advertising or
provider-preset request. The first delivery adds Oh My Pi as the built-in
`oh-my-pi` Agent identity without a `CLI` suffix and reuses the existing Agent
asset and capability surfaces:

- default root `~/.omp/agent`, overridden by `PI_CODING_AGENT_DIR`;
- Skills under `skills/`, global `RULES.md`, user `mcp.json`, and project
  `.omp/mcp.json` with the native `mcpServers` JSON key;
- the sibling user plugin directory `~/.omp/plugins` is exposed as a derived
  path, but PromptHub does not claim package installation or marketplace
  ownership yet;
- read-only, bounded JSONL session browsing with `omp --resume <id>` metadata.

Provider switching, usage/quota, credential handling, profile management and
plugin package installation remain planned capabilities. Oh My Pi session files
remain platform-owned local state: PromptHub never edits, syncs, exports, or
persists transcript bodies. Removing this batch is safe because it only removes
the registry projection, derived target presets, and read-only adapter.

Follow-up implementation now narrows the first Provider & Model increment to a
non-secret projection: read `config.yml`/`config.yaml` and optional `models.yml`,
show concrete provider/model selectors plus sanitized endpoint/readiness, and
update only `modelRoles.default` through the existing backup and rollback
pipeline. It does not write credentials, query usage, or install plugin
packages.

## Scope Addendum 2026-08-10: Complete Session Lifecycle

Native conversation footprint and confirmed permanent deletion are now a
complete-adapter requirement rather than a Codex-only capability. File,
directory, native-CLI and shared-database sources must each use their own
main-process-owned identity and mutation boundary. Whole-database size and
renderer-provided deletion paths remain out of scope.

## Scope Addendum 2026-08-10: Unified Quota Presentation

The delivered quota adapters already normalize six providers into one
`metrics[]` collection, but the remaining `window`/`quota` split still encodes
renderer choices. Overview consequently mixes large rings and progress bars,
uses inconsistent used/remaining directions, reconstructs Antigravity groups
from metric ids, and cannot bound a large model inventory reliably.

This follow-up retains all current provider endpoints, credential ownership,
cache and concurrency limits while replacing that presentation-bound contract
with typed scope, period and value semantics. Every Agent adapter will only map
provider data. A shared presentation model will group and order those metrics,
and Overview plus the menu-bar popover will use the same semantic visualization
selector and state components. Resettable percentage windows use compact rings;
absolute, monthly, lifetime and provider-defined totals use horizontal remaining
bars. Detailed inventory, composition, capacity and verification rules live in
`quota-presentation-design.md`.

## Goals

- 将本机已检测安装的预置 Agent 和已检测的自定义 Agent 提升为桌面端一级工作区；未安装平台保留在 registry 中，但不进入管理列表。
- 为每个 Agent 提供 Overview、Provider & Model、Skills、MCP、Rules、Plugins、Config、Sessions、Usage、Maintenance 一级视图。
- 支持导入当前原生供应商配置、创建多个 Provider Profile、预览差异并一键切换。
- 支持按 Agent 管理模型映射、端点、环境参数和安全凭据引用。
- 聚合 Skill、MCP、Rules、Plugin 的分发状态和管理入口，不复制其源数据。
- 对已确认格式的平台提供会话搜索、只读查看、项目关联和恢复命令。
- 提供安装检测、版本、路径、配置完整性、供应商连通性和模型流式测试。
- 在系统托盘提供当前供应商状态和按 Agent 快速切换。
- 将 Agent 配置、Provider Profile 和安全快照纳入备份恢复边界；默认排除密钥和完整会话正文。
- 为后续统一供应商、额度查询、CLI 生命周期、深链导入、使用统计和本地代理建立明确阶段。

## CC Switch Coverage Strategy

### First Delivery

- 本机已检测安装的预置 Agent 和自定义 Agent 的统一列表、路径和健康状态。
- 常用和用户置顶的已安装 Agent 优先展示；未检测平台不进入列表、搜索结果或可操作详情。
- Provider Profile 的原生配置导入、模型映射、激活切换、差异预览、备份和回滚。
- 原生配置、Provider、Session、CLI 等深度能力按平台 adapter 逐步扩展；未完成的能力显示 planned/partial/unsupported，不影响平台进入工作台。
- 按 Agent 聚合 Skill、MCP、Rules、Plugin 状态和分发操作。
- 已验证平台的会话浏览、搜索、只读 transcript 和 resume command。
- 基础供应商连通性与真实模型流式测试。
- 托盘当前供应商状态和快速切换。
- 配置文件查看、受控编辑、外部变更检测和快照恢复。

### Follow-Up

- 在兼容平台间同步 Universal Provider Profile。
- Agent CLI 安装、升级、版本诊断和修复建议。
- 额度、余额和供应商模型列表刷新。
- 从 CLI 会话日志生成本地使用统计。
- `prompthub://` 深链导入 Provider、MCP、Skill 等对象，并强制预览确认。
- 按 capability inventory 持续补齐所有预置平台的 provider/session/config/CLI adapters，而不是只维护固定的少数平台。

### Separately Gated

- 本地代理、协议转换、故障转移、请求日志和成本统计。
- OAuth 反向代理、第三方账户池或任何依赖非公开协议的认证能力。
- 将敏感供应商配置或会话正文同步到远端。

这些能力具有更高的安全、兼容性和运维风险，必须单独建立 active change，不与第一阶段混合交付。

## In Scope

- 复用现有 built-in/custom platform registry 作为 Agent 身份和路径来源。
- Agent 安装检测、版本、配置路径、能力和健康状态。
- Provider Profile、模型映射、当前激活状态、配置快照和切换历史。
- 平台原生 provider adapter：读取、规范化、预览、写入、验证和回滚。
- Skill、MCP、Rules、Plugin 的 Agent 聚合视图与跨域动作编排。
- 外部配置变更检测和 smart backfill，避免 PromptHub 状态覆盖用户手工修改。
- 受支持平台的会话元数据索引、全文按需读取、搜索和 resume command。
- 托盘快速切换、基础模型测试、备份恢复和 7 locales。
- 自定义 Agent 在具备声明式 adapter 能力时接入；缺少 adapter 时仍展示路径与资产状态。

## Out Of Scope For The First Delivery

- 新建通用 Agent 执行引擎、多 Agent 编排器或 PromptHub 内置聊天运行时。
- 为每个预置平台自动创建 `AgentProfile` 或复制一份 Skill/MCP/Rules/Plugin 绑定表。
- 默认修改、删除或同步外部平台会话、认证缓存和账号数据。
- 静默接管用户已有原生配置；所有切换必须可预览、可验证、可回滚。
- 一次性支持所有预置平台的完整 Provider、Session 和 CLI adapter。
- 第一阶段实现本地代理、协议转换、故障转移或 OAuth 逆向认证。
- 把 API Key、token、认证文件、完整 transcript 或本地绝对路径写入普通导出。

## Primary User Flows

### Flow A: Inspect A Preset Agent

1. 用户打开 Agents 工作区，只看到本机已检测安装的预置和自定义 Agent。
2. 每个可管理 Agent 显示 installed、degraded 或 unsupported 状态。
3. 用户进入 Claude Code 详情，查看当前供应商、模型、资产、配置文件、会话和版本诊断。
4. 未安装或尚未创建目录的 Agent 不进入列表；旧选中状态只能落到只读概览，其他能力保持禁用且不读取配置。

### Flow B: Import And Switch A Provider

1. 用户从 Agent 的实时原生配置导入当前供应商。
2. adapter 解析配置并生成 Provider Profile 预览，敏感值转为安全凭据引用。
3. 用户新增或编辑另一个供应商，并运行连接/模型测试。
4. 用户点击激活，系统显示将变更的字段、保留字段、外部修改和备份位置。
5. 系统原子写入并重新读取验证；失败则恢复原配置并保留诊断。

### Flow C: Manage Agent Assets

1. 用户直接打开某个 Agent 的 Skills、MCP、Rules 或 Plugins 一级页签。
2. 页面展示当前资产域的已分发、可分发、漂移和不兼容状态，不再经过通用 Assets 页或二级菜单。
3. 用户执行安装、同步、卸载或跳转到规范资产编辑器。
4. 动作由各资产域服务完成，Agent 页面刷新聚合状态，不创建重复事实来源。

### Flow D: Browse Sessions

1. 用户为支持的平台启用会话索引。
2. 系统扫描本地会话元数据并支持按项目、时间、关键词和 Agent 搜索。
3. 用户按需读取 transcript，查看 resume command 或在终端中继续会话。
4. 会话源消失时保留本地标签和索引状态，不伪造正文。

### Flow E: Diagnose And Maintain An Agent

1. 用户查看 Agent 的 CLI 版本、目录权限、配置完整性和当前供应商健康度。
2. 用户执行模型流式测试并查看连接、首 token 延迟和结构化错误。
3. 后续阶段可以从同一页面安装、升级或修复受支持的 CLI。

### Flow F: Backup And Restore

1. 用户导出完整工作区或 Agent 配置备份。
2. 备份包含 Agent Provider Profile、模型映射、非敏感参数和配置快照元数据。
3. 密钥仅导出引用/缺失提示，不导出明文；完整会话正文默认排除。
4. 恢复后系统重新检测本机 Agent、对账路径和凭据，并要求用户修复缺失项。

## Success Criteria

- 用户能从单个 Agent 页面回答：是否安装、当前使用哪个供应商和模型、拥有哪些资产、配置是否健康、最近有哪些会话。
- 当前 registry 中本机已检测安装的 Agent 能在工作台找到；未安装平台不会形成无内容的管理对象。
- 已安装 Agent 使用同一套详情 UI；旧状态意外指向未安装 Agent 时，仅概览可进入，其他能力置灰且不触发底层读取。
- 已有预置 Agent 不需要重新创建 Profile 才能管理。
- 供应商切换不覆盖无关配置，外部修改可被检测，失败可以恢复。
- Agent 页面显示的资产状态与 Skill/MCP/Rules/Plugin 页面使用同一事实来源。
- API Key 不出现在普通 SQLite JSON、renderer payload、日志、配置快照和备份中。
- 每个声明支持原生配置管理的平台都必须使用真实 fixture 完成 import -> preview -> activate -> verify -> rollback 回归。
- 已安装但未实现深度 adapter 的平台仍能作为 Agent 显示，不伪装支持供应商切换或会话管理。

## Risks

- 各 Agent 的供应商协议和配置格式并不一致，过早抽象成通用 JSON 会丢失平台语义。
- PromptHub 自身 AI Provider 配置与 Agent 原生 Provider Profile 相似但不等价，错误复用会导致密钥和模型字段混乱。
- 原生配置可能被 Agent 或用户并发修改，需要 digest、三方对账、文件锁和回滚。
- 部分 Agent 使用 OAuth 或系统 keychain，不能假设所有凭据都可导入、导出或切换。
- 会话和日志可能包含密钥、个人信息和大体积内容，必须默认本地、只读、按需加载。
- 追求 CC Switch 功能数量可能让第一阶段膨胀；必须按 adapter 能力和风险分期。

## Rollback Thinking

- 现有 platform registry、Skill、MCP、Rules、Plugin 和 AI config 事实来源保持不变。
- 新增 Provider Profile 和快照采用独立表，关闭 Agents 工作区不会删除数据。
- 每次原生配置写入前生成受控备份和 digest；失败恢复原文件。
- 新备份字段保持可选，旧版本忽略；新版本导入旧备份时 Provider Profile 集合为空。
- 会话索引可删除并重建，不影响平台源文件。
- tray 快速切换只是主服务入口，不维护第二份激活状态。

## Related Records

- Stable platform assets: `spec/knowledge/reference/agent-platforms.md`
- Stable Skill behavior: `spec/knowledge/behavior/skills.md`
- Stable Rules behavior: `spec/knowledge/behavior/rules-workspace.md`
- Platform preview: `spec/changes/active/platform-workbench-prototype/`
- Existing platform configuration: `spec/changes/active/project-skill-management/`
- Agent asset tray actions: `spec/changes/archive/2026/07/2026-07-28-desktop-agent-asset-tray-actions/`
- CC Switch capability comparison: `cc-switch-coverage.md`
- Screen-level UI design: `ui-design.md`

## Decisions Requiring Confirmation

1. `[已确认]` 现有预置 Agent 是一级管理对象，不以 Agent Profile 取代或复制它们。
2. `[已确认]` 产品方向是覆盖 CC Switch 大部分核心能力，同时复用 PromptHub 的资产管理优势。
3. `[已确认，2026-08-01 更新]` registry 保留全部预置平台，但 Agents 工作台只展示本机已检测安装的 Agent；未安装 Agent 不因置顶、配置模板或搜索进入列表，旧选中状态下也只有概览可用。
4. `[已确认]` Kimi 平台升级到当前独立 Kimi Code 契约：优先使用 `KIMI_CODE_HOME` / `~/.kimi-code`，仅在新根不存在时兼容 `KIMI_SHARE_DIR` / `~/.kimi`；两代会话和凭据不得混合。
5. `[已确认]` PromptHub 自有 Provider Profile 凭据使用主进程安全存储引用；Agent 原生 OAuth、Keychain、认证缓存和 SecretRef 保持平台所有，不统一迁移。只有平台存在稳定明文配置契约且适配器通过安全验证时，才允许按需投影 PromptHub 托管密钥。
6. `[已确认]` 外部会话默认只读、本地、按需读取正文且不进入同步、备份、遥测或普通搜索索引。
7. `[已确认]` 当前范围只做受支持平台的基础连接/模型测试；本地代理、协议转换、故障转移、请求拦截和 OAuth 账户池属于高风险独立范围，本变更不得实现。
8. `[已确认]` Agent Profile/Persona 延期为后续组合能力，不进入当前数据模型。

## Scope Addendum 2026-07-20: Overview Navigation And Claude Quota

Confirmed with the maintainer on 2026-07-20:

1. The Overview tab is rebuilt as a navigation hub: live per-domain counts (Skills/MCP/Rules/Plugins/Sessions/Provider/Appearance/Usage), click-to-jump into the owning tab, capability-aware disabled states. The flat "Paths & capabilities" panel is collapsed into a secondary region.
2. Usage route A is confirmed: Claude Code official subscription quota (five-hour and seven-day windows) via the platform's own OAuth credential and the Anthropic usage endpoint. Session-log estimation is not built in this batch.
3. Verified integration facts (third-party evidence: cclimits, CodexBar, openusage, anthropics/claude-code issues): credential lives in macOS Keychain service `Claude Code-credentials` (newer builds may suffix an 8-char config-dir hash) or `<root>/.credentials.json` under `claudeAiOauth.accessToken`; quota endpoint is `GET https://api.anthropic.com/api/oauth/usage` with `Authorization: Bearer` and `anthropic-beta: oauth-2025-04-20`, returning `five_hour` / `seven_day` / `seven_day_opus` utilization and `resets_at`.
4. Security boundary: the OAuth token never leaves the main process, is never persisted by PromptHub, never crosses IPC, never appears in logs or error payloads. PromptHub does not refresh tokens in this phase; expired credentials produce a guided re-authentication state. PromptHub never writes to the platform credential store.

## Scope Addendum 2026-07-20: Codex Third-Party Providers With Managed Keys

Confirmed with the maintainer on 2026-07-20:

1. Goal: add third-party models to Codex without touching the ChatGPT subscription (`auth.json` and the built-in `openai` provider stay byte-identical), while keeping one-command switching.
2. Platform scope: Codex only in this batch. Claude Code's `ANTHROPIC_BASE_URL` variant is deferred.
3. Credential strategy confirmed: PromptHub-managed keys. The master copy lives in a new main-process secret store that reuses the audited Electron `safeStorage` encrypted-file pattern (`cloud-auth-storage.ts`: userData file, 0600, atomic rename, injectable encryption, main-only access). Codex has no env-free secure field contract, so at write time the key is projected into the provider's native `experimental_bearer_token` in `config.toml` (the platform's own field, file kept 0600); `env_key` entries remain supported for users who prefer environment variables. Keys are write-only over IPC: the renderer never receives a key back, backups and exports stay device-local and are excluded from sync.
4. opencodex-style local proxy, protocol translation, account pooling, and failover remain gated as a separate Phase 3 subsystem and are explicitly out of scope.
5. Reserved provider ids (`openai`, `ollama`, `lmstudio`) are never written; `model_provider` default switches go through the same backup/atomic-write/verify/rollback pipeline as existing model writes.

### CC Switch-aligned credential convergence (confirmed 2026-07-28)

The user approved CC Switch as the Provider and credential workflow reference
and explicitly approved a consent-gated migration from the existing Codex-only
Provider implementation.

- The unified Provider Profile database becomes PromptHub's management source
  of truth. Agent-native files remain the runtime projection read by each
  Agent.
- Existing `codex-provider:<providerId>` credentials and native inline tokens
  are discovered only in the main process. The renderer receives provider
  names, source type and credential readiness, never a secret or secret
  reference.
- PromptHub shows a migration review before changing ownership. Declining or
  closing the review makes no database, secret-store or native-file change.
- Confirmed migration copies credentials to stable
  `agent-provider:<profileId>` ownership, creates Profile records, verifies the
  result and removes legacy secret ownership only after the entire selected
  batch succeeds. Any failure restores legacy credentials and removes partial
  Profile records.
- Native config is not overwritten merely because migration was accepted.
  Provider activation remains a separate preview, backup, atomic write,
  verification and rollback operation.
- The legacy Codex renderer becomes a temporary compatibility reader only
  during migration and is removed after the unified Profile workflow can
  activate Codex endpoint, protocol, model and credential projections.

## Scope Addendum 2026-07-20: Desktop-Native Workspace Layout

Confirmed with the maintainer on 2026-07-20:

1. All Agent workspace tabs abandon the webpage canvas metaphor: no outer page margin, no centered max-width column, no floating rounded cards for primary surfaces. Tab content renders edge-to-edge against the workspace dividers, uses hairline separators, fixes a compact toolbar row at the top, and scrolls only inside content regions.
2. Skills, MCP, Rules, and Plugins remain direct top-level tabs. Each domain owns its compact searchable surface without a generic Assets parent or secondary navigation.
3. The Provider & Model tab becomes master-detail: left provider list (built-in OpenAI subscription plus third-party entries plus add action), right detail pane for the selection.
4. The Maintenance tab is retired; its refresh and settings actions move into the workspace header overflow menu.
5. Overview navigation cells for asset domains navigate directly into Skills, MCP, Rules, or Plugins.

## Scope Addendum 2026-07-21: Codex Quota And Provider-Aware Overview

Confirmed with the maintainer on 2026-07-21:

1. The Overview "Paths & capabilities" capability grid is removed (no user value); the collapsed paths list stays and each row gains an open-folder action.
2. The Overview Provider & Model cell becomes provider-aware: when the built-in `openai` provider is active it shows the current model and credential state; when a third-party `model_providers.*` entry is active it shows that provider's sanitized base URL and configured model.
3. Codex quota uses the platform's own OAuth credential from `~/.codex/auth.json` (`tokens.access_token` + `tokens.account_id`) against `GET https://chatgpt.com/backend-api/wham/usage`, returning `plan_type` and `rate_limit.primary_window`/`secondary_window` (`used_percent`, `reset_at`, `limit_window_seconds`). Windows MUST be classified by `limit_window_seconds` (≤24h = session window, >24h = weekly window), never by slot position. Verified against CodexBar (`CodexOAuthUsageFetcher.swift`) and cclimits (quotio#356).
4. Usage display is provider-aware for Codex: quota is only queried when the built-in `openai` provider is active; when a third-party provider is active, usage surfaces report "custom provider, no quota data" instead of querying. The usage capability flips to `supported` for `codex`.

## Scope Addendum 2026-07-21: Polymorphic Multi-Agent Quota

Confirmed with the maintainer on 2026-07-21:

1. The usage contract becomes polymorphic: `AgentUsageQuota.metrics: AgentUsageMetric[]` replaces the hardcoded `fiveHour`/`sevenDay`/`sevenDayOpus` fields. A metric carries `kind: "window" | "quota"` — windows render as ring gauges, credit/balance quotas render as progress bars with amounts.
2. New adapters, all evidence-backed: Kimi (`~/.kimi-code/credentials/kimi-code.json` OAuth token -> `api.kimi.com/coding/v1/usages`, verified live 2026-07-21: weekly `usage` + rolling `limits[]` + `membership.level`), Antigravity (`~/.gemini/antigravity-cli/antigravity-oauth-token` -> cloudcode-pa `loadCodeAssist` + `fetchAvailableModels`, per-model remainingFraction + tier), Gemini CLI (`~/.gemini/oauth_creds.json` -> `loadCodeAssist` + `retrieveUserQuota` buckets), Copilot (GitHub OAuth token -> `api.github.com/copilot_internal/user`, premium/chat quota snapshots; verified against CodexBar).
3. Cursor has no public quota API; its usage capability stays `planned` and this is recorded as a deliberate exclusion.
4. Usage capability flips to `supported` for `kimi`, `antigravity`, `gemini`, `copilot` alongside existing `claude`/`codex`. Token isolation rules from `FR-AGENT-023` apply to every new adapter; expired tokens produce guided states without refresh in this phase.

## Scope Addendum 2026-07-21: Rich Skill Asset Management In The Agent Workspace

Confirmed with the maintainer on 2026-07-21:

1. The direct Skills tab is upgraded from plain rows to the same card paradigm used by the Skills module's Agent Skill view: badge semantics (In My Skills / symlink / copy / unmanaged / built-in), inline actions (open folder, adopt into My Skills, open managed skill, uninstall with confirmation), and click-through to the full skill detail page with the agent context action bar.
2. "Install My Skill" into the current Agent directory reuses the existing library-import modal and install pipeline (copy/symlink).
3. All behavior is a renderer-side composition of the existing owning-domain
   services and components; no new main-process surface is required. Rules keep
   their editor workspace, while MCP and Plugins use the same bounded card-grid
   presentation as Skills and keep deep actions in their owning modules.

## Scope Addendum 2026-07-31: Agent Asset Management Workbench

The Agent detail Skills, MCP and Plugins tabs are management surfaces rather
than read-only summaries. Each domain reuses its owning workspace's existing
master-detail view, stores and mutation actions while scoping targets to the
selected Agent. Asset cards are selectable and expose only canonical
domain-owned quick actions (open detail, import/distribute, open location and
remove with confirmation where supported). No Agent-owned asset store or
duplicate IPC contract is introduced.

## Scope Addendum 2026-08-01: Unified Asset Card Presentation

The direct Agent Skills, MCP and Plugins inventories use the Plugins card as
the accepted visual baseline. All three domains share one icon-led content
anatomy and aligned icon-action footer while retaining their owning stores,
detail routes and supported actions. `Plugins` is a stable English product term
in the Agent tab bar, matching `Skills` and `MCP`; explanatory copy remains
localized.

## Scope Addendum 2026-07-31: Hermes Claw Family Taxonomy

The Agent display-order settings now classify Hermes with OpenClaw and QClaw
under PromptHub's Claw family. This is a presentation and ordering taxonomy for
the Agent workbench, not a claim that Hermes is an OpenClaw fork or that the
three platforms share native files. Hermes keeps its independent `hermes` id,
root path, capability declarations and adapters.

## Scope Addendum 2026-07-31: Local Claw Platform Coverage

The Agent registry now covers the requested local Claw products as independent
identities: OpenClaw, CoPaw, AutoClaw, NanoClaw and QClaw. CoPaw, AutoClaw and
NanoClaw receive bounded compatibility root candidates and official brand
assets, while unsupported native protocols remain explicitly planned. NanoClaw
is modeled as an arbitrary project checkout rather than a fabricated global
home directory. No session/history, provider, credential, MCP or Rules adapter
is claimed for these three new identities in this slice.

## Scope Addendum 2026-07-21: Usage Moves Into The Overview Dashboard

Confirmed with the maintainer on 2026-07-21:

1. Usage is dashboard information, not a functional page. The standalone Usage tab is removed from the workspace tab bar (7 -> 6 tabs); the overview navigation grid loses its usage cell.
2. The Overview tab gains a dedicated usage banner at the top, above the navigation grid: ring gauges for each quota window (session/weekly/Opus where present) with utilization, reset countdown, plan badge, provider-reported label, and a manual refresh action.
3. The banner renders only when the usage capability is supported/partial, and carries the existing guided states (no-credentials / expired / unavailable / custom-provider-active) in the same compact form.

## Scope Addendum 2026-07-22: Qwen Code As A Distinct Agent

Confirmed with the maintainer on 2026-07-22:

1. PromptHub adds **Qwen Code** as a separate built-in Agent with stable id `qwen`. It does not replace or alias Qoder: Qwen Code is the open-source terminal Agent maintained in `QwenLM/qwen-code`, while Qoder remains its own IDE/CLI product target.
2. The default user root is `~/.qwen`, with `QWEN_HOME` taking precedence. `QWEN_RUNTIME_DIR` is a separate runtime-output override and must not be treated as the configuration or asset root.
3. First delivery covers the platform registry plus documented global/project Skills, SubAgents, MCP, Rules, Extensions, config inventory, and native session discovery. Each capability is enabled independently only after its adapter and regression contract pass.
4. PromptHub manages canonical user/project assets, not Qwen-owned runtime state. Sessions, logs, todos, auto-memory, team memory, OAuth token files, credentials, extension caches, and extension-owned child assets remain local and are excluded from ordinary backup/sync unless a later explicit policy says otherwise.
5. Qwen Code settings may contain provider keys, `env` values, MCP headers, MCP environment variables, OAuth client secrets, or token references. Renderer payloads, logs, snapshots, exports, and sync results must therefore be structural and redacted; PromptHub must never expose or silently rewrite secret-bearing fields.

## Scope Addendum 2026-07-28: Cursor Evidence And Native Plugin Boundary

1. Cursor remains rooted at `~/.cursor`. PromptHub may expose only verified user-owned paths: `skills/`, `agents/`, `mcp.json`, and read-only Plugin discovery below `plugins/`. Project `.cursor/skills/`, `.cursor/agents/`, `.cursor/rules/`, `.cursor/mcp.json`, and `AGENTS.md` remain project-owned assets.
2. Cursor user rules are settings-owned. PromptHub must not invent a global rule file or expose private settings databases, authentication state, checkpoints, snapshots, caches, or logs as editable Agent configuration. A later read-only History surface may consume the documented/local `agent-transcripts` export without treating it as editable configuration.
3. A generated `.cursor-plugin/plugin.json` package is not an installed or loaded Cursor Plugin. Cursor remains visible as a Plugin adapter target but distribution stays disabled until a bounded Marketplace or local-plugin workflow can preview, confirm, verify activation, and roll back.
4. Cursor Provider, Usage, and Maintenance remain `planned`. Sessions are `partial` after the evidence-backed local transcript adapter: PromptHub reads bounded `agent-transcripts` JSONL and exposes native resume metadata, but does not claim ownership of Cursor's private history index, retention, checkpoints, or remote Background Agent chats.

## Scope Addendum 2026-07-28: Cherry Studio Current Data Boundary

1. Cherry Studio's default Electron user-data root remains platform-specific, with installed Skills under `Data/Skills`. A user-relocated Cherry data directory continues to require the existing explicit Agent root override; PromptHub does not infer it from private runtime stores.
2. Current upstream v2 stores the primary database at `Data/cherrystudio.sqlite`. PromptHub must prefer that path before compatible `Data/agent.db`, `Data/agents.db`, or root-level legacy databases so a Skill operation cannot update an obsolete database while the current application reads another.
3. PromptHub reuses the public schema contract and existing database-backed Skill adapter; it does not copy Cherry Studio source. Provider, MCP, agent/session, credential, memory, cache, and runtime tables remain Cherry-owned and are not exposed through Agent management in this batch.
4. Cherry Studio has no single native Plugin bundle contract. Its composite Plugin target remains visible but disabled; the Skills owner remains the only supported package surface.

## Scope Addendum 2026-07-28: Windsurf Public Transcript Boundary

1. Windsurf keeps its evidence-backed global Skills, MCP, global Rules, and macOS launch paths. Project Workflows, Rules, AGENTS.md, Hooks, and Skills remain project-owned and are not collapsed into a synthetic Plugin bundle.
2. Current official Cascade Hooks documentation defines opt-in transcript files at `~/.windsurf/transcripts/<trajectory_id>.jsonl`, with `0600` permissions and an automatic 100-file retention limit. PromptHub may provide a bounded read-only adapter for these explicit transcript exports; it must not parse proprietary `~/.codeium/windsurf/cascade/*.pb` runtime files.
3. The transcript adapter exposes only visible user input and planner response text. File contents, command output, tool arguments, code actions, and other sensitive tool payloads remain hidden even when present in the JSONL source.
4. Public transcript JSONL does not provide a stable native resume command. PromptHub must show read-only history with `resume: null`, describe the capability as partial, and leave Provider, Usage, generic Config editing, Maintenance, and native Plugin installation unclaimed.

## Scope Addendum 2026-07-28: Kiro Current CLI And Power Boundary

1. PromptHub reuses Kiro's documented settings, asset, session-command, and Power import contracts; it does not copy, vendor, or execute upstream source.
2. The default root remains `~/.kiro`, with `KIRO_HOME` as the supported override. Global Skills, MCP, agents, and `settings/cli.json` stay Kiro-owned files that PromptHub only projects through bounded adapters. The multi-file `steering/` directory is not misrepresented through the current single-file Rules contract.
3. Kiro CLI model selection is limited to `chat.defaultModel`. Authentication, endpoints, credentials, account state, and provider selection remain platform-managed.
4. Kiro CLI sessions may be browsed read-only from the locally verified `sessions/cli` runtime shape. Only visible prompt and assistant text is projected; thinking, tool calls, tool results, and unknown records remain hidden, and no resume command is synthesized.
5. Writing a directory below `~/.kiro/powers` is not equivalent to Kiro's native Power import and registration workflow. Direct Plugin distribution remains disabled until PromptHub can invoke, preview, confirm, verify, and roll back an official import path.

## Scope Addendum 2026-07-31: Copilot Read-Only History

The Agent workspace now treats GitHub Copilot's local `session-store.db` as a
verified, platform-owned history source. This slice covers bounded browsing,
search, visible user/assistant detail, and the native resume command; it does
not make the database editable or portable. Missing, malformed, symlinked, or
unreadable stores remain explicit empty/unavailable states. The rollback path
is removal of the adapter/capability declaration, with no migration because
PromptHub never writes or persists Copilot session rows.

## Scope Addendum 2026-07-31: Cline Read-Only History

Cline now has an evidence-backed partial History adapter. PromptHub reads
platform-owned JSON snapshots from `~/.cline/data/sessions/`, optionally uses
the adjacent `sessions.db` only for bounded metadata enrichment, and falls
back to the documented `data/tasks/<taskId>/api_conversation_history.json`
format for older tasks. The adapter searches visible user/assistant text,
hides tool payloads, preserves `cline --id <session-id>`, rejects unsafe paths,
and never starts the Cline hub or writes native state. The capability remains
partial because Cline owns its schema, retention, and runtime lifecycle.

## Scope Addendum 2026-08-01: Project Conversation Continuation

Agent History becomes a project-centered conversation catalog rather than a
log attached only to the currently selected Agent. The same catalog remains
available from an Agent detail page as a source-Agent filter. Every
conversation must be associated with a registered project before it can be
continued; unresolved native paths enter an explicit association queue.

The product defines two separate continuation modes. **Resume in original
Agent** executes the source platform's freshly resolved native resume contract.
**Continue in another Agent** creates a new target-Agent conversation in the
same project using a user-reviewed portable handoff context and records the
lineage between source and target. Cross-Agent continuation never claims to
migrate native ids, hidden reasoning, tool state or checkpoints.

Conversation management covers bounded discovery/read, existing PromptHub-owned
metadata projection, optional verified native deletion, and single/batch JSON or
Markdown export. Conversation History does not expose a generic metadata editor
or reversible soft-delete state. Native transcripts remain platform-owned and
read-only. Export and handoff payloads exclude secrets, hidden tool data and
absolute local paths by default.

## Scope Addendum 2026-08-01: Agent Asset Detail Navigation

Within Agent management, Skills, MCP and Plugins are collectively called
Agent assets. Their card details should reuse the owning domain's normal full
detail pages and replace the complete workspace to the right of the Agent
list. They must not remain nested below the Agent identity header and tabs.
Rules remains its own editor workflow. This is a presentation/navigation
change only; asset ownership, storage and actions remain unchanged.

## Scope Addendum 2026-08-03: Config Editor Isolation

Agent config file reads and writes must share the bounded discovered/declaration
inventory, file editor state must be source-bound, and user-initiated Agent
switches must protect unsaved changes. Provider credential reveal controls are
unchanged.

Config creation for an undetected Agent remains pending. `FR-AGENT-075`
deliberately hides undetected Agents and forbids config reads or writes, while
the proposed bootstrap behavior would make such an Agent manageable. The
installed-only boundary remains authoritative until that product contract is
explicitly changed.

## Scope Addendum 2026-08-03: Pet Management And Official Catalog

The Appearance Pet workspace becomes a complete filesystem-backed management
surface rather than a preview-only gallery. Installed Pets remain owned by the
selected Codex root and are never copied into PromptHub storage. Users can
import, inspect, rename, describe, export, open and remove a Pet while seeing
its sprite contract version.

An optional catalog reads metadata and packages only from the allowlisted
`legeling/awesome-codex-pet` repository. Catalog requests are paged, bounded,
timed out and cached with a fixed capacity. Installation stages validated
`pet.json` and sprite bytes before reusing the existing atomic Pet import path;
upstream scripts and telemetry are never executed. The rollback path removes
the catalog UI and service without migrating or deleting installed Pets.

## Scope Addendum 2026-08-06: Provider 预设目录(Codex/ChatGPT 优先,官方配置聚焦)

Confirmed with the maintainer on 2026-08-06:

1. The Provider & Model page keeps the left/right split (provider list / config), and the
   configuration experience borrows CC Switch's preset data and protocol mapping, not its
   components, data model, or secret storage.
2. The preset catalog does NOT absorb CC Switch sponsor/promotional presets. It only covers
   each Agent's official configuration (Codex/ChatGPT, Claude, Kimi, OpenCode, Google,
   Copilot) plus suppliers with verifiable official evidence (official docs, endpoints,
   model names). Entries with affiliate links, promo codes, or inferred endpoints are
   excluded.
3. First platform: **Codex/ChatGPT**, then one platform at a time.
4. Codex must support **additive mode**: the official ChatGPT login and built-in `openai`
   provider stay intact while third-party providers are appended as `[model_providers.*]`
   entries (managed `experimental_bearer_token` or `env_key`, mutually exclusive);
   switching back to official cleans stale third-party auth residue.
5. Reference checkout updated to CC Switch v3.19.2 at
   `/Users/lingxiaotian/Programs/public/cc-switch` (`43eaf073`); evidence from
   `src-tauri/src/codex_config.rs` and `src/config/codexProviderPresets.ts` is recorded in
   `provider-preset-catalog-design.md`. Selective reference only, no runtime code copied.
6. Detailed design: `provider-preset-catalog-design.md`.

## Scope Addendum 2026-08-04: Menu Bar Agent Quotas

The macOS PromptHub menu bar should surface the same provider-owned Agent quota
snapshots already used by the Agent Overview, without introducing a second
credential reader. The first delivery covers the six evidence-backed adapters:
Claude Code, ChatGPT/Codex, Kimi Code, Antigravity, Gemini and GitHub Copilot.

On macOS, a primary click on the PromptHub menu-bar icon opens the
tray-anchored rendered popover directly, without an intermediate quota menu
item. A secondary click preserves the native action menu; Windows and Linux
retain the existing native-menu interaction. The popover reads the last renderer cache immediately,
refreshes through the process-wide usage service and its 60-second cache, and
bounds explicit refreshes to two provider operations. It retains the last
successful presentation on refresh failure and never places credentials or raw
provider errors in rendered copy or logs. PromptHub adapts CodexBar's actual
usage-card hierarchy -- product identity and plan first, followed by a named
metric, compact remaining value, slim progress and reset time -- to the existing
React/Electron boundary without vendoring its SwiftUI implementation or branded
assets.

## Scope Addendum 2026-08-06: Conversation History Density And Cursor Safety

The Agent conversation workspace keeps its actions as a lightweight header row
instead of a nested card surface. Selected sessions use a neutral accent surface
with explicit foreground tokens so titles remain readable in both themes.
Transcript pagination must never expose an empty page when a native cursor
returns duplicate or empty records. The renderer follows advancing cursors with
a bounded hop count, clamps stale page state to the last loaded page, and keeps
native transcript ownership and on-demand reading unchanged.

## Scope Addendum 2026-08-09: Unified Provider Workbench And Pi Import

The Provider & Model tab must present one visual system across Agent adapters.
Platform-specific storage and editing semantics remain separate, but sidebar
dimensions, action placement, provider-row anatomy, detail headers, metadata
rows and section surfaces must not fork by Agent.

Pi keeps `models.json`, `settings.json` and `auth.json` as its native sources of
truth. Its shared workbench toolbar adds an explicit PromptHub-provider import
action. The import runs in the main process, selects one compatible chat model,
writes the Pi provider and credential as one recoverable operation, and never
returns a literal credential to the renderer. Unsupported protocols remain
visible but disabled in the import review.

The toolbar also keeps the shared current-configuration import action. For Pi,
this creates a same-id provider override in `models.json` for the currently
configured built-in provider, preserving Pi's built-in models and existing
`auth.json` credential ownership. The action is unavailable when Pi has no
current built-in provider or the provider is already custom.

## Scope Addendum 2026-08-10: Expanded Native Model Configuration

Provider & Model must expose the same Profile workbench for every platform with
an evidence-backed native model setting. The already supported Claude Code,
Codex, Grok, Pi, OpenCode and OpenClaw adapters remain unchanged. This delivery
adds model-only native adapters for Antigravity, Qoder, CoPaw, AutoClaw, QClaw
and Hermes, using each platform's own file layout rather than aliasing the Claw
family to OpenClaw.

The renderer receives only model, provider, sanitized endpoint and credential
status metadata. Native API keys remain in their owning files and are never
returned over IPC. Writes update only the model selector fields, preserve
unrelated configuration and credentials, use bounded reads, backup, atomic
replacement, semantic re-read verification and rollback.

NanoClaw is deliberately excluded from the platform-level adapter in this
delivery. Its current model is owned per Agent Group in `container_configs`, so
there is no truthful global model target for the existing platform-only Profile
contract. Supporting it requires the target-binding work already tracked by
`T-AGENT-178`; writing a generated container file or choosing an arbitrary group
would violate native ownership and single-source-of-truth rules.

## Scope Addendum 2026-08-10: Provider Toolbar Discoverability And Overflow

The shared Provider toolbar must show the names of its two import commands, not
only unfamiliar icons. The sidebar must remain vertically scrollable while
never creating a horizontal scrollbar from list-item margin and width
composition. The fix applies to both the generic Profile workbench and Pi's
native catalog through shared layout primitives; no platform-specific visual
branch is introduced.

## Scope Addendum 2026-08-10: Native Conversation Storage Actions

Conversation History must describe the native session inventory rather than only
PromptHub's registered projects. The project filter merges exact project paths
reported by loaded sessions with registered projects, and each session row shows
the adapter-reported native storage size when that size has a truthful per-session
meaning.

The visible delete command is no longer a metadata-only removal. It is offered
only when the selected adapter owns a verified, session-scoped delete operation.
The renderer requires a destructive confirmation, while the main process
re-resolves the current native session before deletion. Codex rollout JSONL is
the first verified target. Shared database files and unverified multi-file
stores must never be deleted through a generic `sourcePath` unlink fallback.

## Scope Addendum 2026-08-10: Submitted Conversation Search

Conversation History search is an explicit user submission, not a live filter.
Typing changes only the input draft; PromptHub performs the search when the user
presses Enter, and an empty submitted value restores the unfiltered inventory.

Search results are limited to the displayed conversation title and project
identity (project label or exact project path). Transcript text, PromptHub notes
and tags, model names, native redacted previews and session ids are outside this
search surface. This keeps the result set predictable and avoids repeated native
filesystem or SQLite work while the user is still composing a query.

## Scope Addendum 2026-08-10: Conversation Ordering And Native Titles

The second Conversation History selector is an ordering control, not a status
filter. It orders the loaded inventory by newest update, oldest update, largest
session or smallest session; unknown timestamps and sizes stay after known
values. Loading another page merges those rows into the same selected order.

Conversation names follow one explicit priority: a PromptHub metadata override,
then the Agent's native renamed title, then the adapter's first-user-message
fallback, then the session id. Codex stores native thread names in its bounded
`session_index.jsonl`; PromptHub reads that index without modifying it. Archived
PromptHub metadata remains visible and marked after the status selector is
removed. The conversation domain does not retain soft-delete or Restore state;
permanent native deletion remains the only destructive action and removes its
PromptHub metadata row after the native file is deleted.

## Scope Addendum 2026-08-10: Latest Transcript And Row Context Actions

Conversation History adds one explicit latest-messages control so a reader can
move from early pages to the newest currently reachable transcript page without
stepping through every page. Native cursor reads remain user-triggered and
bounded; no eager full-history load is introduced.

Each history row also gains a native right-click menu that reuses verified
continuation, cross-Agent handoff, Markdown/JSON export and permanent-delete
flows. Delete remains adapter-gated and requires the existing second
confirmation. The generic conversation metadata editor is removed from both the
toolbar and context menu; Agent-native titles remain read-only projections.

## Scope Addendum 2026-08-10: Transcript Table Containment And Tool Messages

Conversation Markdown must not allow wide GFM tables or long cell content to
expand a message bubble beyond the transcript pane. Tables stay readable through
a bubble-local horizontal scroll region while the surrounding conversation
layout remains fixed.

Tool calls and results are part of the Agent side of the conversation. They use
the same left-aligned Agent avatar and bounded bubble as assistant messages,
with a compact Tool label inside the bubble. Only system and unknown events keep
the centered informational treatment.

## Scope Addendum 2026-08-10: Native Session And Project Locations

Conversation History exposes two separate location commands in both the More
and row context menus: locate the exact Agent-owned session file in the platform
file manager, and open the conversation's effective project directory. The
commands use adapter-provided paths only; missing paths are disabled instead of
guessed. This is a renderer integration with the existing safe shell path
handler and does not change transcript ownership, persistence or IPC contracts.

## Scope Addendum 2026-08-10: Claude Transcript And Project Projection

Claude Code History must project user-visible conversation semantics rather
than every native JSONL control record. PromptHub excludes Claude metadata,
local-command wrappers and internal lifecycle records from the transcript and
title fallback, while preserving visible user, assistant and tool-result
entries. Ignored valid records are not parse failures.

Claude's `projects/<encoded-path>/` directory name is a storage key rather than
a user-facing project name. When a transcript supplies a safe absolute `cwd`,
Conversation History uses that exact path as project identity and its basename
as the label. The encoded directory remains only a compatibility fallback when
the native record has no valid project path. The same projection applies to
live browsing and the optional local metadata index.

## Scope Addendum 2026-08-10: Gemini And Cursor Session Projection

Gemini History must use each project cache's bounded `.project_root` marker as
the native project identity rather than displaying the temporary cache key.
Gemini `info` records are internal metadata, not conversation events, and
function-response rows are Agent-owned Tool results rather than user messages.
The live reader and optional metadata index must agree on project, title, role
and parse-error semantics.

Cursor's `projects/<encoded-path>/` key is likewise not a user-facing project
name. PromptHub may resolve it only when it uniquely matches an existing,
non-symlink directory below the configured user home through a bounded
component walk. Ambiguous, external, oversized or missing mappings remain
unresolved and keep a compact unresolved-tail label with no project path;
PromptHub must not invent an absolute path by replacing hyphens with separators.

## Scope Addendum 2026-08-11: System History Acceleration And Symmetric Paging

Local session metadata indexing is an application preference rather than a
per-Agent History control. It is enabled by default, lives in App Settings and
is applied automatically when a supported Agent history is opened. History
keeps the native transcript as source of truth and does not expose an indexing
toggle, refresh button or implementation-oriented explanation inside the
conversation browser.

Transcript pagination uses symmetric boundary navigation. The existing latest
messages command keeps its bounded native-cursor behavior, and a matching
leftmost command returns directly to the first loaded message page without
re-reading or eagerly loading the transcript.

## Scope Addendum 2026-08-11: Stale-While-Revalidate History Cache

Opening a supported Agent History must reuse a completed local metadata index
instead of starting another full scan on every tab mount. A missing or stale
index may refresh in the background only after the first bounded list has
settled, so native directory enumeration does not compete with the initial
screen. Background refresh survives History tab and Agent navigation, is
deduplicated per Agent, and remains cancellable when the renderer itself exits.

Cached rows remain visible while a background refresh completes. A completed
refresh replaces the bounded list without returning the entire History panel
to its blocking loading screen. No transcript body cache, watcher, timer,
network request or unbounded background worker is added.
