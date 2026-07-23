# Implementation

## Status

- Phase: implement
- Status: in-progress
- Code changes: registry, shared workspace shell, allowlisted native config, non-secret model configuration, bounded read-only session adapters, current Kimi Code and Qwen Code compatibility, and the Codex Appearance adapter implemented

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
- 新增 Managed Agent projection，从启用 built-in/custom 平台、检测结果、路径覆盖与用户置顶派生统一列表；用户禁用的平台在 projection 边界排除。
- 新增一级 Agents 导航、仅搜索列表和统一详情 Shell；移除低价值的状态筛选与备用排序控件，默认排序保持置顶、检测/配置、常用优先级和名称稳定顺序。
- 桌面首页默认顺序调整为 `Prompts -> Agents -> Skills -> MCP -> Plugins -> Rules`；新用户直接使用新顺序，settings v17 一次性迁移旧的完整默认顺序和更早的三模块默认顺序，迁移后的完整自定义顺序保持不变。
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
- 将 Kimi 平台从旧版 `kimi-cli` 假设升级到独立 Kimi Code：保持稳定 `kimi` identity，默认根目录改为 `~/.kimi-code`，并按 PromptHub override、`KIMI_CODE_HOME`、current default、`KIMI_SHARE_DIR`、legacy `~/.kimi` 的优先级兼容已有安装。
- Kimi Config Files 现声明 `config.toml`、`tui.toml`、`mcp.json`，资产根声明 `skills/`、`plugins/` 和 `AGENTS.md`；renderer 使用 main process 返回的已解析根目录，避免检测、资产和配置页面各自推断路径。
- 新增 Kimi TOML model adapter：只读取/更新 `default_model` 及其非敏感 provider 元数据，过滤 key/token，使用备份、原子写入、重新解析和 `kimi doctor config <path>` 验证；验证失败自动恢复原文件。
- 新增独立 Kimi session adapter：从追加式 `session_index.jsonl` 的有界尾部读取最新索引，按上限读取 `sessions/<id>/state.json` 与 `agents/main/wire.jsonl`，识别官方 wire event，隔离畸形行并拒绝路径/realpath/软链接越界。会话正文只读，恢复命令为 `kimi --session <id>`。
- Kimi Electron E2E 使用隔离 HOME 构造 current root、TOML 和 wire fixture，验证 Provider & Model、Sessions、transcript 与现有统一 Agent UI；本批没有新增用户文案，继续复用已覆盖 7 locales 的通用标签。
- 新增稳定的 Appearance 一级页签；Codex 启用原生外观、桌面皮肤和 Pet 三个同页区域，其他 Agent 继续显示同一页签并按 capability 置灰，不引入 Assets 或二级菜单。
- 桌面皮肤固定复用 Codex Dream Skin `1.2.0`、commit `3af1d6d62f3a0388cc640d2f497ac3100998938e` 的 MIT 运行时快照；仅携带运行代码、许可证和中性 Dream Portal 主题，不包含名人、角色、赞助或其他权利不明确的预设。
- Theme service 使用 Dream Skin `theme.json + local image` 目录合同，覆盖严格校验、受限预览、导入/导出、原子 active staging、应用、恢复、删除、advisory last-applied state 和失败回滚；main process 调用上游 macOS/Windows start、verify、restore 入口，通过 loopback CDP 注入，不修改 Codex 应用包、`app.asar` 或签名。
- Pet service 直接管理 resolved Codex root 下的 `pets/<id>`，只接受受控 `pet.json` 与 PNG/WebP spritesheet；扫描、预览、原子导入、导出和确认删除均拒绝路径穿越、软链接、畸形或超限输入，不复制到 SQLite、backup 或 sync。
- Pet 卡片不再把整张 spritesheet 当普通图片显示；renderer 根据清单版本按 v1 `8x9`、v2 `8x11` 合同裁切首行，以 Codex 的六帧 idle 节奏循环播放。系统启用 reduced motion 时固定在首帧，不额外生成或持久化 GIF 副本。
- 内置 `codex` 的默认用户可见名称统一为 `Codex`，移除 `CLI` 后缀；设置页新增 Codex/ChatGPT 名称与图标两组独立选择及实时预览。稳定平台 id、`~/.codex`、provider、session、asset、appearance 与 IPC 合同保持不变。
- ChatGPT 图标不再复用通用 OpenAI provider 标识；改为打包本机 ChatGPT.app `Assets.car` 中完整的 1024x1024 Aqua / Dark Aqua Blossom 资源，并由 PromptHub 当前主题切换，运行时不读取外部应用包。
- Codex/ChatGPT 名称与图标分段控件采用实色主色背景、主色描边、对比文字和显式勾选标记，选中状态不再依赖难以分辨的浅阴影；保留 `aria-pressed` 与键盘焦点状态。
- `agentIdentityPreferences.codex` 作为非敏感展示设置进入 Zustand 持久化和既有 settings snapshot；hydrate 对名称和图标逐字段执行 `codex | chatgpt` 白名单规范化，拒绝任意路径、data URL 或远程图标。Managed Agent 投影在排序、搜索和 list/detail 渲染前统一解析名称和图标，并在设置变更后即时刷新内存投影。
- 为避免继续扩张超长设置文件，将原有 GitHub Token 设置区等价抽到 `GithubTokenSettings.tsx`；`SkillSettings.tsx` 从 1565 行降至 1488 行，既有交互回归保持通过。
- Appearance main IPC、preload API、renderer hook 和 UI section 独立分层；7 locales 已同步，electron-builder 将固定 Dream Skin 运行时作为 unpacked extra resource 携带，并保留 LICENSE、NOTICE、版本和上游 commit 记录。
- 依据 Google 2026-05-19 官方迁移公告修正产品生命周期：Antigravity CLI (`agy`) 与 Antigravity 2.0 是普通用户当前入口；Gemini CLI 自 2026-06-18 起停止服务 Free、Google AI Pro 和 Ultra 用户，仅保留企业、Google Cloud 和付费 API Key 支持。
- 将 `antigravity` 标记为 current 并排在 `gemini` 前；内置显示名统一为 `Antigravity` 与 `Gemini`，不携带 `CLI` 后缀；`gemini` 标记为 enterprise-legacy 并指向 Antigravity，在详情中显示 7 locales 的迁移提示，但不在列表或标题旁重复显示兼容标签；同时保留原 id、路径和 adapter，避免破坏企业用户与既有资产。
- 将 Antigravity 管理根从桌面运行态 `~/.gemini/antigravity` 修正为官方共享定制根 `~/.gemini/config`，声明 `skills/`、`mcp_config.json`、`plugins/` 和共享 `~/.gemini/GEMINI.md`；CLI/桌面会话、缓存、凭据、更新器和 artifact 继续由产品运行时拥有。
- 完成 Qwen Code 第一批实现：以独立 built-in id `qwen` 接入平台 registry 和官方图标；按 `PromptHub override -> QWEN_HOME -> ~/.qwen` 解析配置根，并保持 `QWEN_RUNTIME_DIR` 仅用于会话运行态。Skills 同时发现原生 `<root>/skills` 与只读兼容 `~/.agents/skills`，MCP 支持用户/项目 `settings.json` 的 `mcpServers`，Rules 支持全局 `QWEN.md`，Extensions 按父 bundle 发现，Provider/Model 只投影脱敏字段，Sessions 使用有界原生 CLI 列表和受控 JSONL 读取。原始 `settings.json` 不进入 Config Files 编辑器，Usage 保持 planned；项目 SubAgent/Commands 专用工作区和完整 Electron E2E 仍属于 `TEST-AGENT-036` 后续门禁。
- Agent 详情头部 ⋯ 菜单的“打开 Agent 设置”改为工作台内“编辑 Agent”弹窗，不再切换到应用设置页。弹窗复用 `BuiltinAgentEditor` 与现有 settings actions：内置 Agent 编辑 root/Skills/MCP/Rules/Agents/Config/可用 Plugin 路径及 Codex 身份，自定义 Agent 同时编辑名称和启用状态；Reset 只重置草稿，Save 后沿原同步链路刷新 managed Agent projection。
- 移除 Agent 详情头部重复的“管理 Skills”主按钮；右上角仅保留启动 Agent、刷新和更多操作，Skills 统一从 Overview 卡片或顶部 Skills 页签进入。
- 补齐常用 Agent 的只读历史会话：`codex` 同时索引 active/archived rollout JSONL 并按 session id 去重，ChatGPT 展示身份继续复用同一稳定 id 和 `~/.codex`；Grok Build 读取限定的 summary/chat history；OpenClaw 从每个 Agent 的 `sessions.json` 定位受控 transcript；Qwen Code 使用原生有界 JSON 列表后只读取 runtime root 内的 realpath。四个 adapter 均限制扫描数、metadata/detail bytes 和单条文本长度，隔离畸形记录，不编辑或同步平台 transcript。
- Sessions capability 现在对 Claude、Codex、Gemini、Grok Build、Kimi Code、OpenClaw、OpenCode、Qwen Code 启用；Antigravity、Cursor、Windsurf 等格式未确认的平台继续保持 planned/disabled。OpenCode 原生命令在当前工作区没有会话并返回空 stdout 时按空列表处理，不再误报解析失败。

## Native Config Evidence

- Codex CLI: `~/.codex/config.toml` and project `.codex/config.toml` — <https://learn.chatgpt.com/docs/config-file/config-reference>
- Claude Code: user `~/.claude/settings.json`, project `.claude/settings.json` and local settings — <https://code.claude.com/docs/en/configuration>
- Gemini CLI: user `~/.gemini/settings.json` and workspace `.gemini/settings.json` — <https://geminicli.com/docs/cli/settings/>
- Google Antigravity: shared customizations `~/.gemini/config`, CLI runtime `~/.gemini/antigravity-cli`, desktop runtime `~/.gemini/antigravity` — <https://antigravity.google/docs/skills>, <https://antigravity.google/docs/mcp>, <https://antigravity.google/docs/plugins>, and <https://antigravity.google/docs/cli-using>
- OpenCode: user `~/.config/opencode/opencode.json` and project `opencode.json` — <https://opencode.ai/docs/config/>
- Cline: user settings under `~/.cline/data/settings/`; credential-bearing `providers.json` is excluded from the raw editor — <https://docs.cline.bot/getting-started/config>
- Additional built-in declarations follow the verified platform inventory in `spec/knowledge/reference/agent-platforms.md`; evidence-limited platforms keep Config Files disabled.
- Claude Code model/session behavior — <https://code.claude.com/docs/en/model-config> and <https://code.claude.com/docs/en/sessions>
- Gemini CLI session storage, resume, listing, deletion and retention — <https://geminicli.com/docs/cli/session-management/>
- OpenCode config/model and session CLI — <https://dev.opencode.ai/docs/config/>, <https://dev.opencode.ai/docs/cli/>, and <https://dev.opencode.ai/docs/troubleshooting/>
- Kimi Code data locations, config, providers, sessions and CLI — <https://moonshotai.github.io/kimi-code/en/configuration/data-locations.html>, <https://moonshotai.github.io/kimi-code/en/configuration/config-files.html>, <https://moonshotai.github.io/kimi-code/en/configuration/providers.html>, <https://moonshotai.github.io/kimi-code/en/guides/sessions.html>, and <https://moonshotai.github.io/kimi-code/en/reference/kimi-command.html>
- Qwen Code settings, Skills, SubAgents, MCP, memory, Commands, Extensions, and sessions — <https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md>, <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/skills.md>, <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/sub-agents.md>, <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/mcp.md>, <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/memory.md>, <https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/commands.md>, <https://github.com/QwenLM/qwen-code/blob/main/docs/users/extension/introduction.md>, and <https://github.com/QwenLM/qwen-code/tree/main/packages/cli/src/commands/sessions>
- Qwen Code icon provenance: upstream `QwenLM/qwen-code` commit `760ffd7a4dc4db7834c68fba6533fa15e17accaa`, `packages/desktop/apps/electron/resources/brands/qwen-code/icon.png`; bundled asset SHA-256 `02dac7ae657ddd32793b55cb63c00497807d1b6cf55343cea2b97120d048839a`.

## Product Decisions Recorded

- Confirmed: built-in/custom Agent platforms are the first-class managed objects.
- Confirmed: the product aims to cover most CC Switch core capabilities while preserving PromptHub asset-management strengths.
- Confirmed: every enabled preset Agent is shown; disabled Agents are hidden, while common, detected, configured, and pinned Agents are prioritized and deep adapters expand independently.
- Recommended, pending confirmation: proxy/failover and OAuth capabilities use separate changes.
- Recommended, pending confirmation: Agent Profile/Persona is deferred beyond the first delivery.

## Verification

- Common Agent history batch (2026-07-22, `FR-AGENT-030`, `DES-AGENT-026`, `TEST-AGENT-038`, `T-AGENT-067`):
  - Focused main/renderer regression passed: 4 files / 36 tests; the isolated Sessions workspace interaction passed: 1 test. The full workspace component file has one unrelated i18n-state failure in the built-in Agent edit-dialog title and was not claimed green.
  - Scoped ESLint, desktop typecheck, production build, Prettier, and `git diff --check` passed. The build retained the existing Rollup chunk-size and mixed static/dynamic import warnings.
  - Read-only current-machine smoke returned metadata without transcript contents: Codex 294 sessions, Grok Build 13, OpenClaw 1, Gemini 58, and Kimi Code 7. OpenCode returned an empty native list and Qwen was not installed on this machine; both cases remain covered by fixtures.
  - V8 coverage for the new adapter/service focus was 95.19% statements, 66.15% branches, 97.01% functions, and 95.19% lines. The remaining uncovered paths are defensive filesystem/format fallbacks; changed behavioral paths are covered, but the repository's 100% branch target is not yet met and remains a merge-gate risk.

- Qwen Code first-class Agent batch (2026-07-22, `FR-AGENT-029`, `DES-AGENT-025`, partial `TEST-AGENT-036`, `T-AGENT-063` in progress):
  - Registry/path: distinct `qwen` identity, official 512x512 icon, default ordering, `QWEN_HOME` override including the documented relative-to-CWD behavior, and strict separation from `QWEN_RUNTIME_DIR`.
  - Assets: complete-package native Skill discovery under `<root>/skills`, read-only compatibility discovery under `~/.agents/skills`, user/project MCP presets, global Qwen rule, and extension parent-bundle inventory. Compatibility Skills can be imported into PromptHub but cannot be uninstalled through the native Qwen target action.
  - Provider/session: structured model inspection and updates preserve unrelated JSON while excluding raw secret-bearing settings from renderer file editing; session listing uses `qwen sessions list --json --limit`, bounds output, isolates malformed rows, validates transcript realpaths, and emits the native `qwen --resume <id>` command.
  - Persistence: Qwen runtime sessions, transcripts, logs, memory, todos, tokens, and auth caches remain platform-owned and are not added to PromptHub database backup/sync payloads.
  - Verification so far: affected Qwen registry/path/model/session/Skill/MCP/Rules/Plugin/icon/UI/backup suites passed (15 files / 258 tests); desktop, shared, and core typechecks passed; seven-locale regression passed (5 files / 36 tests); scoped ESLint, Spec governance/index checks, changed-file formatting, and the desktop production build passed. The build retains only existing chunk-size and mixed static/dynamic import warnings. The file-size gate now reports only the unchanged vendored Dream Skin `injector.mjs` at 1,822 lines; `skill-installer.ts` is 1,431 lines and the database-backup test was reduced to exactly 1,500 lines. Full `TEST-AGENT-036` Electron E2E and the full desktop suite remain pending and are not claimed as complete.

- Skill asset cards batch (2026-07-22, `FR-AGENT-028`, `DES-AGENT-024`, `TEST-AGENT-034`, `T-AGENT-060`):
  - Renderer-only change: the direct Skills tab renders `AgentSkillAssetPanel` through `AgentAssetsWorkspace` — a toolbar (domain title, search, all/managed/unmanaged/copy/symlink filter chips, refresh, and an "Install My Skill" primary action) above a responsive card grid; direct MCP, Rules, and Plugins tabs keep the compact row inventory.
  - Badge semantics reuse `agentScanState[agent.id]` plus `getSkillScanStatus` exactly as `SkillAgentsView`: managed skills show an emerald "In My Skills" badge, external installs amber, otherwise the copy/symlink install badge; platform built-ins show a Built-in badge and no uninstall action; the first three tags render as small badges.
  - Actions map one-to-one to existing flows: open folder via `window.electron.openPath`, adopt into My Skills via `useSkillStore.importScannedSkills` with the SKILL.md hydration pattern from `handleImportAgentSkill`, open a managed skill by switching to the Skills module (`setAppModule("skill")` + `setStoreView("my-skills")` + `selectSkill`), install library skills through `SkillLibraryImportModal` with the agent skills dir as the fixed target (export skillmd then `installMd`/`installMdSymlink`), and uninstall through `skillApi.uninstallPlatformSkill` behind a destructive `ConfirmDialog` with a built-in guard. Card clicks drill into `SkillFullDetailPage` with `overrideSkill` (`buildProjectDetailSkill`), `agentContext`, and `agentActions`, replacing the right pane with a back action to the grid; the drill-in state lives in `AgentAssetsWorkspace`.
  - No i18n key changes: every label reuses existing `skill.*` / `agents.*` keys already present in all seven locales.
  - Tests: `agent-assets-workspace.test.tsx` extended to 15 cases covering the five badge states, tag truncation, filter chips, adopt + hydration arguments, uninstall confirmation and built-in block, the library modal fixed target, folder opening, the Skills-module jump, detail drill-in with `agentContext`, and the existing domain/search regressions; `agents-workspace.test.tsx` mocks `useToast` because the workspace now embeds the toast-driven panel. Full components suite passed (173 files / 1305 tests), i18n smoke/hardcode regression passed, scoped ESLint and `tsc --noEmit` passed; full desktop suite green (406 files / 3763 tests).

- Polymorphic multi-agent quota batch (2026-07-21, `FR-AGENT-027`, `DES-AGENT-023`):
  - Contract: `AgentUsageQuota` replaces fixed window fields with `metrics: AgentUsageMetric[]` (`kind: "window" | "quota"`, optional amounts/unit).
  - Main process: `agent-usage-service.ts` now routes six adapters — Claude and Codex re-mapped to metrics, plus Kimi (`api.kimi.com/coding/v1/usages`, weekly + rolling + membership level, verified live), Antigravity and Gemini (Cloud Code Assist `loadCodeAssist` + per-model remaining fractions + tier), and Copilot (`copilot_internal/user`, premium/chat snapshots + plan). Shared DI, 60s cache, timeout/error taxonomy, token isolation; expired local tokens fail guided without refresh.
  - Renderer: `AgentUsageBanner` renders windows as rings and quotas as progress bars (used/total/unit, remaining thresholds), caps model-quota lists with a "+N more" summary, and localizes known metric ids; usage capability flips to supported for `kimi`, `antigravity`, `gemini`, `copilot`.
  - Tests: 45 new adapter tests (`TEST-AGENT-032`), banner/managed-agents suites migrated plus new polymorphic cases (`TEST-AGENT-033`); main suite 110 files/1578 tests green; three pre-existing failures caused by a parallel PlatformIcon change were fixed by making the codex-icon assertions cardinality-tolerant; i18n regression, ESLint, and `tsc --noEmit` green; full desktop suite green (405 files / 3734 tests).
  - Contract migration fix (2026-07-21): `readCachedQuota` now rejects cached entries without a `metrics` array (written by the pre-polymorphic contract) and the banner guards `Array.isArray(quota.metrics)`, fixing a white-screen crash on launch for users with old-format usage caches; regression test seeds an old-format cache entry; full desktop suite green (405 files / 3735 tests).
  - Adapter follow-up fixes (2026-07-21): the Antigravity adapter falls back to the shared `~/.gemini/oauth_creds.json` for Antigravity 2.0 installs (the 1.x token file no longer exists there); guided-state copy (`noCredentials`/`expired`) is agent-aware via `{{agent}}` interpolation across all seven locales instead of hardcoding Claude Code. Known limitation recorded: Gemini CLI and Kimi legacy credential fallbacks use short-lived access tokens, and PromptHub does not refresh those provider tokens itself. Full desktop suite green (405 files / 3739 tests).
  - Antigravity desktop-session correction (2026-07-22, `TEST-AGENT-035`, `T-AGENT-061`): quota discovery now prefers the running Antigravity language server's authenticated loopback `GetUserStatus` response, maps monthly prompt credits and per-model quota buckets, and reports the current tier without exporting or refreshing OAuth credentials. Process discovery requires an Antigravity marker, a bounded CSRF argument, and loopback-only listening ports; requests use fixed time and response-size limits, and secrets never enter IPC, logs, or error payloads. A stale Keychain access token with a refresh token is treated as a renewable desktop session rather than a logout, so a stopped app reports `antigravity-not-running` instead of the misleading `expired` state. Real-machine verification returned `Google AI Pro`, one prompt-credit metric, and eleven model quota metrics; the temporary Antigravity instance used for verification was then stopped. Focused usage regression passed (6 files / 147 tests), together with scoped ESLint, `pnpm typecheck`, `pnpm build`, and the full desktop suite (406 files / 3762 tests).
  - Antigravity grouped-quota and launch follow-up (2026-07-22, `TEST-AGENT-037`, `T-AGENT-065`): the live adapter now combines `GetUserStatus` with the language server's `RetrieveUserQuotaSummary`, producing four window metrics (Gemini weekly/5h and Claude/GPT weekly/5h) plus one monthly prompt-credit total. The renderer shows every reset window as a remaining-quota ring and reserves progress bars for metrics with numeric used/total values. The header and Antigravity guidance can open or focus declared desktop apps through a main-process platform allowlist; no renderer path or shell string crosses IPC. Current-machine read-only verification while the user's Antigravity instance remained running returned `Google AI Pro` and exactly the expected one total plus four windows. Focused regression passed (7 files / 144 tests), the 7-locale regression passed (5 files / 36 tests), and scoped ESLint, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed. The full desktop run completed with 3768/3777 tests passing; its nine failures are confined to the concurrently added but not yet implemented Qwen registry/model/session/icon/MCP expectations tracked by `TEST-AGENT-036`, so they are not masked or reclassified as part of this follow-up.
  - Antigravity background-quota correction (2026-07-22, `TEST-AGENT-041`, `T-AGENT-070`): closing the Antigravity desktop window no longer blocks current quota. On macOS, when no trusted running language service is found, PromptHub starts the installed application's allowlisted native helper with fixed arguments, the sanitized installed app version, telemetry and the built-in Chrome DevTools MCP disabled, a reserved HTTP loopback port and an ephemeral CSRF token; it retries only bounded startup-readiness failures, requests grouped quota before optional account status, and always terminates the helper with a bounded `SIGTERM`/`SIGKILL` sequence. No OAuth client credential is copied or refreshed by PromptHub. A production-function probe with Antigravity 2.3.1 stopped returned `Google AI Pro`, one monthly-credit total and four weekly/five-hour windows in 10.6 seconds; the temporary helper was then confirmed absent from the process list. Focused regression passed (2 files / 67 tests), covering process-discovery fallbacks, path allowlisting, dynamic versioning, HTTP/gRPC port separation, bounded readiness retry, optional status, failure cleanup and force termination.

- Agent sidebar visibility polish (2026-07-21): removed status/sort selectors, filtered disabled built-in platforms at the shared managed-Agent projection, refreshed an already-loaded workspace after Agent settings mutations, aligned the row pin action at the centered right edge, and removed the decorative frame around the selected Agent icon. Test-first regressions cover search-only chrome, disabled projection, selected-Agent fallback, pin placement, frameless identity rendering, and settings-triggered refresh. Targeted suites passed (3 files / 41 tests), `pnpm typecheck`, scoped ESLint, `pnpm build`, browser screenshot inspection at the existing Vite server, and the full desktop suite passed (404 files / 3683 tests). The browser-only preview has no Electron platform API and therefore verified the sidebar structure/empty state; populated rows are covered by component tests.
- Agent row spacing follow-up (2026-07-21): moved the centered pin action from `right-7` to `right-2` and made the 64px detail identity slot frameless while preserving its stable dimensions. The focused Agent workspace suite passed (1 file / 18 tests), scoped ESLint passed, and `pnpm build` passed. `pnpm typecheck` was attempted but is currently blocked by concurrent Agent usage work whose production code references shared `AgentUsageWindow`, `fiveHour`, `sevenDay`, and `sevenDayOpus` fields that are not yet present in the shared contract.
- Codex icon quality follow-up (2026-07-21): replaced the bundled 64x64 Codex artwork with the installed official application's 1024x1024 light and dark assets, switched `PlatformIcon` to theme-aware Codex rendering, and added an asset-dimension/theme regression. The focused PlatformIcon suite passed (1 file / 12 tests), scoped ESLint, Prettier, and `pnpm build` passed. A combined run with the concurrently changing Agent workspace suite exposed an unrelated in-progress usage-contract mismatch (`quota.metrics` absent in the older test fixture); the isolated icon suite remains green. `pnpm typecheck` was attempted and remains blocked by the concurrent usage implementation referencing `AgentUsageWindow` and legacy `fiveHour` fields that are absent from the current shared contract.
- Gemini label simplification (2026-07-22): removed the enterprise-compatibility badge from both the Agent list and detail title while retaining the explicit consumer cutoff, enterprise/paid-key exception, and Antigravity migration guidance in the detail description. A focused renderer regression confirms neither surface repeats the badge text; scoped ESLint, Prettier, `pnpm typecheck`, and `pnpm build` passed.
- Usage banner batch (2026-07-21, DES-AGENT-022 revision):
  - The standalone Usage tab is removed (tab bar 7 -> 6); the overview navigation grid loses its usage cell. `AgentUsagePanel.tsx` is replaced by `AgentUsageBanner.tsx`: a capability-gated banner at the top of the Overview with SVG ring gauges per quota window (threshold-toned strokes, centered percentage, `role="img"` labels), reset countdowns, plan badge, provider-reported label, manual refresh, and compact guided states including the custom-provider state. Single-window responses render without placeholders.
  - Follow-up polish (2026-07-21): the banner uses a white (`bg-card`) surface; it renders immediately with 0% placeholder rings and swaps in real values without a layout shift (stale-while-revalidate in `use-agent-usage`); rings now display remaining quota (100 - used) with thresholds evaluated on the remaining value (<=30% warning, <=10% critical), plus a localized "remaining" caption next to each window label.
  - Follow-up polish 2 (2026-07-21): the overview content area is uniformly white (`bg-card` on the scroll region) so the banner and dashboard read as one surface; usage results are cached per agent in renderer `localStorage` (ok-status only, agentId-matched), so the banner shows the last known quota instantly on startup/agent switch and animates the ring arc (`stroke-dasharray` transition) when fresh data lands.
  - Claude custom-gateway parity (2026-07-21): the Claude usage adapter short-circuits to `custom-provider-active` when `settings.json` configures `ANTHROPIC_BASE_URL` or a cloud-provider flag (mirroring the Codex rule), so gateway users no longer see a misleading "credentials expired" prompt; the Overview Provider & Model cell shows the sanitized gateway endpoint and model for any agent whose model config reports a non-default provider with an endpoint.
  - Tests: 11 banner tests (`TEST-AGENT-031`) plus follow-up placeholder/no-shift/cache suites, workspace/overview suites updated, one stale e2e assertion fixed; components suite green; i18n regression, ESLint, and `tsc --noEmit` green; full desktop suite green (404 files / 3675 tests).

- Codex quota and provider-aware overview batch (2026-07-21, `FR-AGENT-026`, `DES-AGENT-022`):
  - Main process: `agent-usage-service.ts` gains a Codex adapter (`codex-oauth-v1`) — active-`model_provider` short-circuit (`custom-provider-active`, zero network), `auth.json` credential read, `GET chatgpt.com/backend-api/wham/usage` with Bearer + `ChatGPT-Account-Id`, windows classified by `limit_window_seconds` (never slot position, quotio#356), `plan_type` mapping, 401/403 -> expired, same token isolation and 60s cache as the Claude adapter.
  - Renderer: overview capability grid removed; paths list rows gain open-folder actions; Provider & Model cell shows the custom provider's sanitized base URL + model when a third-party provider is active; usage cell and Usage tab render a dedicated custom-provider state; `usage` capability flips to supported for `codex`.
  - Tests: 26 Codex adapter tests (`TEST-AGENT-029`), overview/usage panel and capability tests updated (`TEST-AGENT-030`); main suite 109 files/1530 tests green, components+services 242 files/1778 tests green; i18n regression, ESLint, and `tsc --noEmit` green; full desktop suite green (404 files / 3660 tests).

- Desktop-native workspace layout batch (2026-07-20, `FR-AGENT-025`, `DES-AGENT-021`):
  - Shell: `AgentWorkspacePanel` drops the webpage canvas (outer page margins, `max-w-6xl`, page-level scroll); every tab renders edge-to-edge with a fixed compact toolbar and an internal scroll region. The final tab bar is Overview, Skills, MCP, Rules, Plugins, Provider & Model, Appearance, Config Files, and Sessions; the Maintenance tab is retired into the header overflow menu (refresh, open settings) built on the shared ContextMenu component.
  - Assets: `AgentAssetsWorkspace.tsx` replaces `AgentAssetsPanel.tsx` as the shared domain renderer, while Skills/MCP/Rules/Plugins remain direct top-level tabs. No generic Assets tab or secondary navigation remains; Overview asset cells navigate directly to the owning tab.
  - Per-tab compactification: Config Files (toolbar + full-height editor), Appearance (toolbar + status strip + grids), Usage (side-by-side window cards), Sessions (edge-to-edge two-pane), Overview (self-scrolling dashboard, summary cards kept as the allowed exception).
  - Provider & Model: master-detail (`AgentProviderModelPanel.tsx`, 718 lines) — left provider list (built-in OpenAI subscription + third-party entries + add action), right detail pane (native config + model selection for built-in; baseUrl/wireApi/key state/profile/test/set-default/edit/delete for third-party); `AgentCodexProvidersSection.tsx` removed with no dead code; form dialog reused. Non-Codex agents get the same shell with only the built-in entry.
  - Tests: workspace shell, assets workspace, overview navigation, and provider master-detail suites updated/added (`TEST-AGENT-028`); the pre-existing async flake in the provider panel test was fixed with `findBy*`/`waitFor`; components suite green (173 files / 1263 tests), i18n regression, ESLint, and `tsc --noEmit` green; full desktop suite green (403 files / 3618 tests).

- Codex third-party provider batch (2026-07-20, `FR-AGENT-024`, `DES-AGENT-020`):
  - Contract: `AgentCodexProvider`/`AgentCodexProviderList`/`UpsertAgentCodexProviderInput`/`AgentCodexProviderTestResult` types, `agent:providers:list|upsert|remove|setDefault|test` channels, preload `agent.listProviders/upsertProvider/removeProvider/setDefaultProvider/testProvider`.
  - Main process: `agent-secret-store.ts` (safeStorage-encrypted `agent-secrets.json`, 0600, atomic writes, fail-closed, main-only); `agent-codex-provider-service.ts` + `codex-toml-editor.ts` (text-level TOML edits preserving comments and unrelated keys byte-for-byte; backup/digest/atomic-write/verify/rollback pipeline reused from `agent-model-config.ts`; managed keys projected to `experimental_bearer_token`, `env_key` supported; reserved ids rejected; active-provider removal refused; default `model_provider` switching; connectivity test with SSRF guard and loopback exemption, redacted categorized results). `agent-codex-provider-error.ts` carries categorized codes; IPC sanitizes unknown errors.
  - Renderer: `AgentCodexProvidersSection.tsx` + `AgentCodexProviderFormDialog.tsx` on the Provider & Model tab (Codex only): provider list with key-readiness states, add/edit dialog with write-only key field and env-var alternative, delete guard, set-default/restore-OpenAI, inline test results; `agents.providers.*` keys in all seven locales.
  - Tests: 9 secret-store + 58 provider-service main tests (`TEST-AGENT-025`/`TEST-AGENT-026`), 21 renderer tests (`TEST-AGENT-027`); main suite 108 files/1497 tests green, components 171 files/1245 tests green; i18n regression, ESLint, and `tsc --noEmit` green; full desktop suite green (401 files / 3599 tests).

- Overview navigation hub and Claude quota batch (2026-07-20, `FR-AGENT-022`/`FR-AGENT-023`, `DES-AGENT-019`):
  - Contract: `AgentUsageQuota`/`AgentUsageWindow` types in `packages/shared/types/agent.ts`, `AGENT_USAGE_GET` channel, preload `agent.getUsage`.
  - Main process: `agent-usage-service.ts` resolves the Claude Code OAuth credential (keychain legacy name, hashed-suffix variant, `<root>/.credentials.json`, honoring root overrides via the existing platform registry), queries `api.anthropic.com/api/oauth/usage` with a 10s timeout, maps `five_hour`/`seven_day`/`seven_day_opus`, caches results 60s in memory, and keeps the token inside the main process (no persistence, no IPC, no logs, no refresh). Registered in `agent.ipc.ts` with categorized fallback responses.
  - Renderer: `AgentOverviewPanel.tsx` (649 lines) replaces the static overview with nine live navigation cells (Skills/MCP/Rules/Plugins/Sessions/Provider/Appearance/Usage/Config Files), click-to-tab navigation via `onNavigate`, disabled cells that never invoke IPC, and a collapsed paths region; `AgentsWorkspace.tsx` shrinks 568 -> 289 lines; tab metadata extracted to `agent-workspace-tabs.ts`. `AgentUsagePanel.tsx` + `use-agent-usage.ts` render the 5h/7d/Opus windows with threshold-toned progress bars, reset countdowns, provider-reported label, manual refresh, and guided no-credentials/expired/unavailable states. `buildCapabilities` marks `usage` supported for `claude` only.
  - i18n: `agents.overviewNav.*` and `agents.usageTab.*` keys added to all seven locales.
  - Tests: 25 main-process quota tests (`TEST-AGENT-023`) and 12 renderer tests (`TEST-AGENT-024`) added; targeted suites green (main 106 files/1435 tests, components 170 files/1224 tests); i18n hardcode regression, ESLint, and `tsc --noEmit` green; full desktop suite green (398 files / 3511 tests).

- Workspace visual-tone neutralization (2026-07-20): per-domain decorative accent colors in the Agent workspace were replaced with neutral design tokens so the module matches the rest of the desktop UI. Tab selection now uses `border-primary text-foreground` for every tab; overview summary cells use `bg-muted/15` with muted icons; asset domain panels, config-files header, and provider/model header use `border-border`/`bg-muted`/`text-muted-foreground`; session list icon and user transcript bubbles use muted tones. Semantic status colors (emerald = healthy/saved/active, amber = warning, destructive = error) are unchanged. Files: `AgentsWorkspace.tsx`, `AgentAssetsPanel.tsx`, `AgentConfigFilesPanel.tsx`, `AgentProviderModelPanel.tsx`, `AgentSessionsPanel.tsx`.
  - `pnpm test -- tests/unit/components/agents-workspace.test.tsx --run`: passed, 10 tests.
  - Targeted ESLint on `src/renderer/components/agent/`: passed.
  - `pnpm --dir apps/desktop typecheck`: passed.

- Desktop home order regression: the settings-store suite passed, 32 files /
  240 tests; the targeted navigation service, Appearance settings, and Sidebar
  rendering suite also passed, 3 files / 16 tests. The new default, both
  historical defaults, post-migration customization, and a customized complete
  order are covered.
- Desktop typecheck and targeted ESLint for the changed navigation/settings
  modules passed.
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
  - Result: passed, 1 test. It uses an isolated temporary HOME, updates the Claude model through real IPC, reads isolated Claude and Kimi sessions, inspects Kimi TOML model state, edits `settings.json`, verifies disk content and captures provider, session and narrow-layout screenshots. The screenshots were checked for blank content, clipping and incoherent overlap.
  - Appearance targeted regression: passed, 7 files / 39 tests. Dream Skin schema/image validation, path and symlink rejection, bounded import/export, atomic active staging, platform start/verify/restore orchestration, failed state commit rollback, invalid stored themes, Pet scan/preview/import/export/delete, IPC validation, package resources, capability state and the shared top-level tab are covered.
  - Pet atlas preview regression: passed, 2 files / 13 tests. It covers missing-version v1 normalization, explicit v2 preservation, invalid version rejection, v1/v2 background geometry, six-frame idle advancement, removal of the full-atlas image element and reduced-motion frame pinning.
  - Pet atlas preview checks: `pnpm typecheck`, targeted ESLint, changed-file Prettier, `git diff --check`, and the desktop production build passed. The workspace navigation conflict was subsequently resolved by restoring direct Skills/MCP/Rules/Plugins tabs and removing the generic Assets tab; the focused Agent Electron E2E now passes through Skills, MCP, Provider, Sessions, and Appearance.
  - Codex identity placement correction: removed the standalone settings section and embedded controlled name/icon fields in the built-in Codex Agent editor. The fields now share the existing Save, Cancel, and Reset lifecycle with root and asset paths; the Agent configuration row uses the resolved identity.
  - Codex identity targeted regression: passed, 6 files / 64 tests. `SkillSettings` contributes 18 tests covering the row-local editor, deferred Save, Cancel discard, Reset-to-default, existing root/path editing, collapse behavior and Plugin-path capability filtering.
  - Placement correction gates: desktop typecheck, targeted ESLint, changed-file Prettier, active-change Markdown Prettier, `git diff --check`, and the desktop production build passed. The build retains only the existing Vite chunk-size and mixed static/dynamic import warnings.
  - Placement correction full regression: `pnpm test:run` passed, 404 files / 3,671 tests. Existing intentional failure-path logs and React `act(...)` warnings remain visible but do not fail the suite.
  - In-workspace Agent edit regression: `agents-workspace.test.tsx` passed, 1 file / 21 tests. It covers built-in current values, platform-default Reset, override Save, modal close without navigation, retained refresh action, removal of the duplicated header Skills action, custom Agent name/enabled/path Save, custom Reset, and validation failure remaining in the dialog.
  - In-workspace edit visual E2E: isolated-HOME Electron Playwright passed, 1 test. It opens Claude Code, asserts the header has no duplicated Manage Skills button, invokes Edit Agent from the overflow menu, verifies the effective root in the modal, captures the complete dialog, cancels, and confirms the Claude workspace remains visible. The inspected 1280x820 screenshot had no blank content, clipping, or incoherent overlap.
  - In-workspace edit gates: seven-locale i18n regression passed (5 files / 36 tests); targeted ESLint, root desktop typecheck, active-change spec governance, desktop production build, changed-file Prettier, and `git diff --check` passed. Build output retains only the existing Vite chunk-size and mixed static/dynamic import warnings.
  - File-size gate: extracting `BuiltinAgentEditor` reduced the touched `SkillSettings.tsx` to 1,399 lines, below the 1,500-line preferred limit. The pinned Dream Skin macOS injector remains an audited 1,822-line upstream snapshot below the 2,000-line hard limit; its exact size is recorded in the legacy baseline so future growth still fails the gate.
  - Appearance coverage probe: 88.74% statements and 79.83% branches across the selected main/UI modules; the three Dream Skin main services reach 90.69% statements and 80.85% branches. Changed public actions, compatibility failures and security rejection paths have direct regressions; remaining uncovered branches are primarily low-level parser variants and injected filesystem failures.
  - Appearance Electron E2E: passed, 1 test. An isolated Dream Skin directory and Pet are rendered in the top-level Appearance page; the first run detected an incorrect development resource path, which was fixed before the passing run. No live skin was applied to the developer's Codex installation.
  - Vendored Dream Skin payload checks: macOS and Windows entry scripts passed syntax checks and their default `--check-payload` validation. The macOS payload reported runtime `1.2.0`, theme `dream-portal` and image size `2168x725`.
  - Isolated macOS arm64 `electron-builder --dir` packaging passed. The unpacked resource contains runtime version `1.2.0` and both macOS and Windows start/restore entry points outside `app.asar`.
  - Current-machine read-only inventory probe: 16 valid Codex Pets, 0 invalid Pets; no live skin was applied and no real Codex files were modified.
  - `pnpm test:run`
  - Latest full-workspace result: passed, 393 files / 3466 tests. The first run exposed a stale settings-snapshot integration mock from the concurrent data-safety work; after the mock was aligned with the exported sensitive-field contract, its targeted test and the complete suite passed.
  - Previous Agent batch result: passed, 385 files / 3369 tests.
  - Kimi upgrade batch result: 387 files / 3420 tests passed; one unrelated `data-settings-backup-sync.test.tsx` assertion timed out under the full parallel run. The same file then passed in isolation, 1 file / 11 tests, including the failed import-preview scenario.
  - Kimi targeted regression: passed, 7 files / 123 tests. It covers root precedence, resolved-root IPC projection, current asset declarations, TOML inspect/update/redaction/backup/native-validation rollback, bounded newest-first session indexing, oversized indexes, official wire parsing, malformed records and symlink/path escape rejection.
  - Google platform registry regression: superseded by the 2026-07-21 lifecycle correction below; the earlier assertion incorrectly treated ongoing enterprise releases as general consumer availability.
  - Google lifecycle correction (2026-07-21): tests cover Antigravity-first ordering, suffix-free `Antigravity` / `Gemini` display names, `current` / `enterprise-legacy` projection, replacement metadata, preserved Gemini paths and adapters, the consumer cutoff notice with enterprise/paid API exceptions, and all seven locales.
    - `pnpm exec vitest run tests/unit/services/managed-agents.test.ts tests/unit/renderer/agent-root-paths.test.ts --reporter=dot`: passed, 2 files / 26 tests.
    - `pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/agents-workspace.test.tsx --reporter=dot`: passed, 1 file / 14 tests; existing async overview cells still emit React `act(...)` warnings.
    - `pnpm --filter @prompthub/shared typecheck` and `pnpm --filter @prompthub/desktop typecheck`: passed.
    - Seven-locale JSON parse and i18n hardcode/init regression (2 files / 5 tests): passed.
    - Targeted ESLint, changed-file Prettier, `pnpm spec:test`, `pnpm spec:index:check`, `git diff --check`, and the desktop production build: passed.
  - `pnpm --filter @prompthub/shared typecheck` and `pnpm --dir apps/desktop typecheck`: passed.
  - `pnpm spec:index:check`: passed.
  - `pnpm lint:file-size`
  - Result: the new Kimi session module is 355 lines and all changed production files remain below policy limits. The repository-wide command remains blocked by the pre-existing 1511-line `apps/desktop/tests/unit/services/database-backup.test.ts`; targeted ESLint for this change passed.
  - `git diff --check`
  - Result: passed.

## Analyze

- Scalable session browsing batch (2026-07-22, `FR-AGENT-032`, `DES-AGENT-028`):
  - Main/preload contract: `agent:sessions:list` now accepts a validated non-negative `offset`; all supported filesystem and native adapters return the requested bounded window. Native CLIs without cursors receive only `offset + limit + 1` as the discovery bound.
  - Renderer: History loads 50 metadata records initially, advances source offsets independently of filtered/invalid rows, deduplicates appended pages by stable session id, and isolates off-screen list/transcript layout with `content-visibility: auto`. Transcript reads remain lazy and capped at 2 MiB / 64 KiB per entry; only 80 entries are mounted initially and later batches require explicit expansion.
  - Empty state: a successful empty native source is explained separately from adapter errors and unsupported Agents. OpenCode remains owned by `opencode session list`; plugin caches and sidecars are not treated as conversations.
  - Verification: `TEST-AGENT-040` passed with offset validation, OpenCode native pagination, 50-of-120 metadata paging, deduplicated append, stale-page isolation during Agent changes, 80-of-120 progressive transcript mounting, truncation notice, off-screen rendering isolation, and localized native-empty guidance. The focused service/IPC/component suite passed 23 tests; the major-adapter/overview/workspace regression passed 35 tests. A read-only current-machine probe over 294 Codex sessions loaded 50 metadata rows in 170.5 ms and the second 50-row page in 252 ms. Focused coverage across the session service/adapters/panel reached 93.71% statements, 93.02% functions, and 67.84% branches; new paging/empty/stale-result conditions have direct tests, while remaining gaps are legacy parser and injected filesystem-error variants. Desktop typecheck, targeted lint, formatting, `git diff --check`, and the desktop production build passed. Live Electron inspection confirmed the current OpenCode native source displays `0 / 0` with the explicit empty explanation rather than a parser error.

- Source-of-truth boundary: documented; Agent identity and assets reuse existing owners.
- CC Switch parity boundary: documented; product capabilities are phased and risky OAuth/proxy behavior is not copied implicitly.
- Traceability: provisionally complete for the documented scope.
- Implementation blockers: secure Provider Profile storage, activation/reconciliation fixtures, persistent session indexing, destructive session actions and deep capability inventory remain open; affected platform tabs are explicitly disabled.
- Registry/shell/raw config/model/read-only session gate: implemented for this batch, including the first Qwen Code adapters; the active change remains open because Qwen project SubAgent/Commands management, full Qwen Electron E2E, full provider activation, credential projection, config versioning, session retention/delete, backup and tray activation are intentionally not claimed as delivered.

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
- Run the first live Dream Skin compatibility apply as an explicit manual action before release. The pinned upstream runtime is last verified against Codex desktop `26.707.72221`, while the current development machine runs `26.715.21425`; successful start, landmark verification and restore on that version remain a manual release gate.
