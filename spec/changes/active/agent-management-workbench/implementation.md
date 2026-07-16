# Implementation

## Status

- Phase: implement
- Status: in-progress
- Code changes: registry, shared workspace shell, allowlisted native config, non-secret model configuration, and first read-only session adapters implemented

## Completed Documentation

- 建立以现有预置 Agent 为一级对象的 Agent Management Workbench active change。
- 将 Agent Profile/Persona 降为后续组合能力，不再作为第一阶段主数据模型。
- 核对 CC Switch 官方能力并记录 current/target/phase 覆盖矩阵。
- 明确 Provider Profile、模型映射、原生配置导入、三方对账、安全切换、验证和回滚边界。
- 明确 Skill、MCP、Rules、Plugin 继续由原资产域拥有，Agent 页面只聚合状态并调用 owning service。
- 记录会话索引、模型测试、tray、backup、CLI lifecycle、deep link、proxy 分期。
- 记录 secure secret、filesystem、IPC、process、network 和 privacy 边界。
- 完成统一 Agent list/detail shell、十个稳定一级 tabs、capability 置灰规则、各页面状态、响应式布局和 renderer 组件拆分设计。
- 生成并纳入 `assets/agent-workbench-overview.png` 作为第一版获批视觉基线，同时在 `ui-design.md` 区分规范性结构与示例数据。
- 建立 `FR -> DES -> TEST -> T` 追踪关系和 test-first 实施顺序。
- 新增 Managed Agent projection，从完整 built-in/启用 custom 平台、检测结果、路径覆盖与用户置顶派生统一列表。
- 新增一级 Agents 导航、搜索/筛选列表和统一详情 Shell；所有 Agent 行可点击，十个一级 tab 始终可见。
- Overview、Skills、MCP、Rules、Plugins、Maintenance 使用现有真实路径和 owning module；Provider、Sessions 按平台 adapter 独立启用，Usage 在 adapter 完成前保持 planned/disabled。
- 更新桌面模块持久化迁移、托盘 `agent:manage` 命令和 7 locales。
- 根据首轮视觉验收重做 Agent 工作区层级：列表改为带边框、图标、状态、路径和明确选中态的操作卡片；详情头部补齐上下文主操作、图标操作和更接近获批稿的摘要/路径结构。
- 删除通用 Assets tab；Skill、MCP、Rules、Plugin 直接提升为顶部一级页签，每个页面独立显示真实清单、数量、路径、语义色和空状态，不增加二级菜单。
- 重做详情区域视觉层级：不透明 header/card surface、彩色 summary band、资产域语义色、明确的 active tab 和独立内容面板，避免浅色主题下整片灰化。
- 启用 capability-aware `Config Files` 一级页签：仅已声明并验证配置路径的平台可操作，其余平台继续置灰，不因路径未知而猜测文件名。
- 为 Claude Code、Codex CLI、Gemini CLI、OpenCode、Cline、Kimi、Reasonix、Augment、ZCode、Grok Build、CodeBuddy 和 WorkBuddy 接入已验证的用户级配置文件声明。
- 新增 `agent:*` main/preload IPC 域；main process 解析 Agent root，拒绝绝对路径、盘符、空字节、`..` 和未声明文件，并复用现有 realpath/symlink 受控文件 IO。
- 复用 `SkillFileEditor` 的受限模式：支持读取、编辑和保存允许的文本配置，允许保存缺失的声明文件；隐藏任意新建、重命名、删除和目录操作，不触发 Skill WebDAV 保存同步。
- Config Files 页提供已有 shell path action 的“打开 Agent 文件夹”入口；本批不创建 PromptHub 配置快照、版本或恢复记录。
- Electron E2E 使用隔离临时 HOME 和无敏感信息 fixture，避免测试或截图读取开发机真实 Agent 配置。
- 新增 Claude、Codex、Gemini、OpenCode、OpenClaw 非敏感模型配置 adapter：结构化读取平台原生配置，只更新模型相关字段，保存前建立本地备份，写后重新解析验证；Codex 明示 TOML 注释/排版可能变化。
- Provider 状态只返回供应商、脱敏 endpoint、模型和凭据 readiness；endpoint 会移除 user info、query 和 fragment，API key/token 不进入 renderer、日志或普通配置快照。
- 新增 Claude、Gemini、OpenCode 只读 session adapter：Claude/Gemini 使用限定根目录、文件数、metadata/detail bytes 和 entry bytes 的容错文件读取；OpenCode 使用 `session list --format json` 与 `export --sanitize`，不递归扫描其数据目录。
- Sessions 页支持本地列表、搜索、按需 transcript、截断提示和恢复命令复制；不编辑 transcript，不提供通用 raw-file 删除。
- Provider & Model 和 Sessions 按 capability 启用，其他平台继续显示但对应 tab 置灰，不把“平台可见”与“深度管理已实现”混为一谈。

## Native Config Evidence

- Codex CLI: `~/.codex/config.toml` and project `.codex/config.toml` — <https://learn.chatgpt.com/docs/config-file/config-reference>
- Claude Code: user `~/.claude/settings.json`, project `.claude/settings.json` and local settings — <https://code.claude.com/docs/en/configuration>
- Gemini CLI: user `~/.gemini/settings.json` and workspace `.gemini/settings.json` — <https://geminicli.com/docs/cli/settings/>
- OpenCode: user `~/.config/opencode/opencode.json` and project `opencode.json` — <https://opencode.ai/docs/config/>
- Cline: user settings under `~/.cline/data/settings/`; credential-bearing `providers.json` is excluded from the raw editor — <https://docs.cline.bot/getting-started/config>
- Additional built-in declarations follow the verified platform inventory in `spec/knowledge/reference/agent-platforms.md`; evidence-limited platforms keep Config Files disabled.
- Claude Code model/session behavior — <https://code.claude.com/docs/en/model-config> and <https://code.claude.com/docs/en/sessions>
- Gemini CLI session storage, resume, listing, deletion and retention — <https://geminicli.com/docs/cli/session-management/>
- OpenCode config/model and session CLI — <https://dev.opencode.ai/docs/config/>, <https://dev.opencode.ai/docs/cli/>, and <https://dev.opencode.ai/docs/troubleshooting/>

## Product Decisions Recorded

- Confirmed: built-in/custom Agent platforms are the first-class managed objects.
- Confirmed: the product aims to cover most CC Switch core capabilities while preserving PromptHub asset-management strengths.
- Confirmed: every preset Agent is shown; common, detected, configured, and pinned Agents are prioritized, while deep adapters expand independently.
- Recommended, pending confirmation: proxy/failover and OAuth capabilities use separate changes.
- Recommended, pending confirmation: Agent Profile/Persona is deferred beyond the first delivery.

## Verification

- Documentation structure:
  - Command: `find spec/changes/active/agent-management-workbench -type f -maxdepth 4 -print`
  - Result: passed; proposal, delta spec, architecture design, screen-level UI design, coverage matrix, tasks and implementation records are present.
- Traceability:
  - Command: `rg -n 'FR-AGENT|NFR-AGENT|DES-AGENT|TEST-AGENT|T-AGENT' spec/changes/active/agent-management-workbench`
  - Result: passed; requirements, designs, verification contracts and tasks have explicit ids and a coverage table.
- Formatting:
  - Command: `pnpm exec prettier --check "spec/changes/active/agent-management-workbench/**/*.md"`
  - Result: passed.
- Code/test execution:
  - Agent model/session/IPC/workspace regression: passed, 5 files / 30 tests.
  - The regression covers JSON, JSONC and TOML model updates; secret and endpoint redaction; atomic writes, backup and rollback behavior; Claude/Gemini/OpenCode session discovery; malformed session isolation; IPC validation; and renderer loading/saving behavior.
  - `pnpm --dir apps/desktop typecheck`
  - Result: passed.
  - Targeted ESLint for changed Agent modules: passed.
  - Locale JSON parse for all 7 locales: passed.
  - `pnpm --dir apps/desktop build`
  - Result: passed; only the existing Vite chunk-size warnings remain.
  - `pnpm --dir apps/desktop exec playwright test tests/e2e/agent-workspace.spec.ts`
  - Result: passed, 1 test. It uses an isolated temporary HOME, updates the Claude model through real IPC, reads an isolated Claude session, edits `settings.json`, verifies disk content and captures provider, session and narrow-layout screenshots. The screenshots were checked for blank content, clipping and incoherent overlap.
  - `pnpm test:run`
  - Result: passed, 385 files / 3369 tests.
  - `pnpm lint:file-size`
  - Result: passed; new files stay within the configured limit and no legacy file grew beyond policy.
  - `git diff --check`
  - Result: passed.

## Analyze

- Source-of-truth boundary: documented; Agent identity and assets reuse existing owners.
- CC Switch parity boundary: documented; product capabilities are phased and risky OAuth/proxy behavior is not copied implicitly.
- Traceability: provisionally complete for the documented scope.
- Implementation blockers: secure Provider Profile storage, activation/reconciliation fixtures, persistent session indexing, destructive session actions and deep capability inventory remain open; affected platform tabs are explicitly disabled.
- Registry/shell/raw config/model/read-only session gate: implemented for this batch; the active change remains open because full provider activation, credential projection, config versioning, session retention/delete, backup and tray activation are intentionally not claimed as delivered.

## Converge

- Stable workflow/knowledge/rules synced: not yet; behavior has not shipped.
- Issues/releases/ADRs/indexes synced: not yet.
- Final change destination: remain active until implementation, verification and convergence complete.

## Follow-Ups

- Confirm the remaining security and phase-boundary decisions in `proposal.md`.
- Audit current AI credential storage before defining reusable provider connections.
- Build a capability inventory for every preset platform and collect representative native configs without secrets in priority order.
- Write failing provider import/reconciliation/rollback tests before production adapters.
- Keep proxy, failover and OAuth work outside the Phase 1 implementation branch.
