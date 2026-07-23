# Tasks

## Clarify And Analyze

- [x] `T-AGENT-001` 盘点现有预置/custom Agent、路径、AI config、Skill、MCP、Rules、Plugin、backup、tray 和 session 边界。
- [x] `T-AGENT-002` 核对 CC Switch 官方功能，并建立 PromptHub current/target/phase 覆盖矩阵。
- [x] `T-AGENT-003` 确认现有预置 Agent 是一级对象，Agent Profile/Persona 不作为第一阶段主模型。
- [x] `T-AGENT-004` 固化启用中预置/custom Agent 的展示清单、常用优先级、默认排序和用户置顶规则；disabled 平台隐藏，但不以 adapter 完成度过滤启用平台。
- [x] `T-AGENT-005` 完成凭据威胁模型与现有 AI config 密钥存储审计，确认 OS secure storage 投影策略。结论记录于 `platform-capability-research.md`：现有 `ai-models.json` 明文密钥不可复用；抽取 cloud auth 的 `safeStorage` 加密、原子替换和 main-only 访问模式。
- [ ] `T-AGENT-006` 建立每个预置平台的 capability inventory：installation/provider/session/CLI/quota/proxy。
- [ ] `T-AGENT-007` 收集首批 provider/session 原生配置 fixture、格式版本和真实外部修改样本。
- [x] `T-AGENT-008` 确认外部会话正文保持平台所有、本地、按需读取且不进入同步；PromptHub 不编辑 transcript。删除优先调用平台原生命令，raw-file adapter 仅在另行通过回收站/回滚测试后提供删除。
- [ ] `T-AGENT-009` 确认本地代理、协议转换、故障转移和 OAuth 能力拆为独立 change。
- [ ] `T-AGENT-010` 完成实现前 Analyze：无冲突、孤立 ID、缺失 TEST/TASK 或阻塞性待确认。

UI screen structure, interaction states, responsive behavior and component boundaries are specified in `ui-design.md`.

## Test-First Verification Contracts

- [x] `TEST-AGENT-001` Agent registry 回归：enabled built-in、enabled custom、configured-but-not-detected 均可见；常用/安装/配置/置顶排序正确；disabled built-in/custom 隐藏；侧栏仅保留搜索；置顶操作垂直居中；不自动创建 Profile。
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
- [x] `TEST-AGENT-019` Kimi Code 双版本回归：current/env/legacy/override 根目录优先级、缺失根的新目录落点、TOML 模型读写与回滚、secret 脱敏、bounded index、畸形/越界/软链接 session、只读 transcript 和 resume command。
- [x] `TEST-AGENT-020` Codex 外观回归：Dream Skin `theme.json + image` 校验/导入/列表/预览/导出、原子 active staging、平台 start/verify/restore 编排、兼容性失败回滚、loopback CDP、Pet 扫描/预览/原子导入/导出/删除、v1/v2 atlas idle 动画裁切、reduced-motion 静态帧、路径穿越/软链接/超限输入和 UI capability 状态。
- [x] `TEST-AGENT-021` 桌面首页顺序回归：新用户默认 `Prompts -> Agents -> Skills`；settings v17 迁移旧默认顺序时同样把 Agents 放在第二位；迁移后的完整自定义顺序保持不变。
- [x] `TEST-AGENT-022` Google Agent 生命周期回归：Antigravity 排在 Gemini 前并标记为 current；两个内置显示名均不带 `CLI` 后缀；Gemini 仅作为 enterprise-legacy 兼容项保留并指向 Antigravity；界面明确 2026-06-18 普通用户停服边界和企业/付费 API 例外；Antigravity 的 Skill、MCP、Plugin 和 Rules 路径使用官方共享配置合同。
- [x] `TEST-AGENT-023` Claude quota adapter 契约：凭证解析顺序（keychain legacy / hashed 变体 / credentials 文件、root override）、畸形 JSON、缺失 `claudeAiOauth`、`expiresAt` 过期短路、200 映射、401、网络超时、60s 缓存 TTL、非法 agentId 拒绝，且任何输出/错误/日志不含 token。
- [x] `TEST-AGENT-024` Overview 导航 UI 行为：真实计数与 owning store 一致、点击跳转到对应 tab、planned/unsupported 置灰且不发 IPC、用量卡片 ok/no-credentials/expired/unavailable 四态、路径区折叠、7 locales、仅使用中性设计 token。
- [x] `TEST-AGENT-025` Codex provider 写入管线契约：model_providers 增删改、profiles 生成/清理、保留键与注释不受影响、auth.json 与 openai 内置 provider 零改动、reserved id 拒绝、slug/URL 校验、active provider 删除拒绝、digest 冲突回滚、原子写 0600、重读 verify 失败回滚。
- [x] `TEST-AGENT-026` 托管密钥安全契约：secret store 加解密往返、safeStorage 不可用 fail-closed、0600/原子写、bearer token 投影与 env_key 旁路、密钥不出现在任何 IPC 响应/错误/日志、连通性测试 SSRF 拦截（非 loopback 内网 IP/file 协议/带 userinfo 的 URL；loopback 明确豁免）、测试错误分类与脱敏。
- [x] `TEST-AGENT-027` Codex 身份偏好：默认名称无 CLI 后缀；Codex/ChatGPT 名称与图标可独立选择；列表、搜索、排序和详情共享投影；非法持久化值逐字段回退；设置快照 round-trip 且不接受任意图标路径或 URL。
- [x] `TEST-AGENT-027` Provider UI 行为：列表渲染（managed/env/none 密钥就绪度）、新增/编辑对话框（密钥 write-only、保留原 key 占位）、删除守卫、设为默认、测试结果展示、非 Codex 平台不渲染该区域、7 locales。
- [x] `TEST-AGENT-028` 桌面形态布局契约：tab 内容顶格（无外层页边距/max-width 画布类名）、工具栏固定且仅内容区滚动、Skills/MCP/Rules/Plugins 顶部直达且无 Assets 二级导航、概览资产格直达所属页签、维护动作在头部 ⋯ 菜单、provider master-detail 选中切换、7 locales。
- [x] `TEST-AGENT-029` Codex quota adapter 契约：auth.json 解析（缺文件/缺 tokens/畸形 JSON）、wham/usage 请求头（Bearer + ChatGPT-Account-Id）、窗口按 limit_window_seconds 分类（5h 在 secondary 槽位也正确归类）、reset_at 秒→毫秒、plan_type 映射、401/403→expired、自定义 provider 活跃时零网络调用、token 不出现在任何输出。
- [x] `TEST-AGENT-030` 概览 provider-aware UI：官方活跃时模型+凭据展示与用量配额、自定义活跃时 baseUrl+模型展示与 custom-provider 用量态、能力网格移除、路径行打开文件夹动作、7 locales。
- [x] `TEST-AGENT-031` 用量横幅契约：概览顶部圆环仪表（各窗口利用率/重置倒计时/plan 徽标/刷新）、单窗口响应渲染、四种引导态横幅、tab 栏无用量 tab（6 个）、概览网格无用量格、7 locales。
- [x] `TEST-AGENT-032` 多态配额适配器契约：Kimi（credentials 解析、usages 映射 weekly/rolling、membership→plan、401/过期）、Antigravity（token 文件、loadCodeAssist+fetchAvailableModels、per-model remaining 映射、tier）、Gemini（oauth_creds、retrieveUserQuota buckets）、Copilot（gh/hosts token 解析、copilot_internal/user premium/chat 映射、reset date）；全部遵守 token 隔离与错误分类。
- [x] `TEST-AGENT-033` 多态横幅 UI：window→圆环、quota→进度条（含 used/total/unit）、模型配额截取与 +N 汇总、已知 id 的 i18n 标签、capability 翻转后各 agent 渲染、既有 Claude/Codex 回归、7 locales。
- [x] `TEST-AGENT-034` 资产卡片契约：徽标语义（managed/symlink/copy/未托管/built-in）、筛选 chips、加入托管流程、卸载确认与 built-in 拦截、安装我的 Skill、点击卡片打开详情页并携带 agent 上下文、7 locales。
- [x] `TEST-AGENT-035` Antigravity 当前会话额度：可信语言服务进程与回环端口解析、月度提示额度和模型额度映射、本地会话优先、过期可续期钥匙串语义、token/CSRF 隔离、未运行专用 UI 引导和 7 locales。
- [x] `TEST-AGENT-037` Agent 启动与 Antigravity 分组额度：应用路径允许列表、IPC 路由、当前 2.x 进程识别、weekly/5h 双组圆环、总 credits 单进度条和未运行态直接打开。
- [ ] `TEST-AGENT-036` Qwen Code 集成回归：`QWEN_HOME`/默认根/PromptHub override 与 `QWEN_RUNTIME_DIR` 分离；用户/项目 Skills 完整包与 `.agents/skills` 兼容发现；SubAgent frontmatter；`QWEN.md`/`QWEN.local.md` scope；MCP `mcpServers` 结构化合并、未知字段保留、secret redaction、原子回滚；Extension 父资产所有权；`qwen sessions list --json` 畸形/超时/超限输出；session/memory/token 文件不进入普通 backup/sync；7 locales 与平台唯一性。
- [x] `TEST-AGENT-038` 常用 Agent 历史会话回归：Codex active/archive 去重、ChatGPT 展示身份不改变 `codex` adapter、Grok summary/chat history、OpenClaw 越界 transcript 拒绝、Qwen native JSONL 与 runtime realpath、畸形记录隔离、2 MiB 截断、列表上限、resume 参数和 capability 白名单。
- [x] `TEST-AGENT-040` 会话规模回归：offset/limit 校验、分页去重、原生 total/hasMore、50 条首屏、追加页、off-screen content visibility、80 条 transcript 首批、渐进展开、2 MiB 截断提示和 Agent 原生空状态。
- [x] `TEST-AGENT-039` 工作台就地编辑回归：内置 Agent 从 ⋯ 菜单打开弹窗、当前值、平台默认重置、保存 override、关闭后仍留在工作台、刷新菜单不回归，头部不重复展示管理 Skills；custom Agent 复用同一弹窗并保存名称、启用状态与路径。
- [x] `TEST-AGENT-041` Antigravity 后台额度回归：桌面进程不存在或进程发现不可用时，仅从 macOS 安装路径允许列表启动临时 native helper；固定参数、随机 CSRF、回环端口、启动/输出/请求上限、分组额度优先、可选账户状态、无 shell/secret 泄漏，以及成功、启动失败、请求失败、优雅退出和强制回收分支。

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
- [ ] `T-AGENT-019` 为仍受支持的企业/付费 API 场景实现 Gemini CLI provider adapter：inspect/import/plan/apply/verify/rollback/test；普通用户入口保持 Antigravity。
- [ ] `T-AGENT-020` 接入 desktop main IPC、preload `agent` domain API 和 renderer query/action store。（config/model/session IPC 与 preload 已完成；Provider Profile query/action store 待后续批次）
- [x] `T-AGENT-021` 按 `ui-design.md` 和 `assets/agent-workbench-overview.png` 实现所有 Agent 共用的一级工作区和 detail shell：Overview、Provider & Model、Skills、MCP、Rules、Plugins、Config Files、Sessions、Usage、Maintenance；仅由 capability state 和已解析路径控制可用性，不引入 Assets 二级入口。
- [x] `T-AGENT-021A` 启用 allowlisted Config Files 页：补齐首批已验证平台配置路径、复用受限文件编辑器、打开 Agent 根目录、禁止结构性文件变更且不创建版本历史。
- [x] `T-AGENT-021B` 将 Agents 的桌面首页默认位置设为第二位，并兼容旧默认配置而不覆盖用户自定义排序。
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
- [x] `T-AGENT-026A` 升级 Kimi 到独立 Kimi Code：保留 `kimi` identity，增加 current/legacy root resolution、current config inventory、非敏感 model adapter、index-first read-only session adapter、7 locales 与稳定文档同步。
- [x] `T-AGENT-026B` 增加 Appearance 一级能力和 Codex adapter：原生外观、固定上游提交的 Codex Dream Skin 注入/切换/恢复运行时及本地 Pet 管理；其他 Agent 按 capability 统一置灰。
- [x] `T-AGENT-026C` 按 Google 官方迁移公告更新 Antigravity CLI / Antigravity 2.0 平台元数据、排序、生命周期提示和稳定文档；保留 Gemini CLI 企业/付费 API 兼容身份，不再把它描述为普通用户当前入口。
- [x] `T-AGENT-026D` 将内置 `codex` 默认展示名统一为 Codex，并在 Codex 内置 Agent 编辑器中增加 Codex/ChatGPT 名称与图标独立偏好；ChatGPT 使用随应用打包的官方明暗 Blossom 资源，覆盖统一身份投影、主题切换、保存/取消/重置、7 locales 和持久化回归。
- [x] `T-AGENT-062` 完成 Qwen Code 官方能力、路径、scope、secret/runtime 排除项和 Qoder 分离边界调研；同步 proposal、delta spec、design、task、implementation 与稳定平台资产文档。
- [ ] `T-AGENT-063` 实现内置 `qwen` registry、官方图标、`QWEN_HOME`/`QWEN_RUNTIME_DIR` 路径解析、Skills/SubAgents/MCP/Rules/Extensions/config/session capability adapters 与 7 locales；复用 owning domains，不建立重复资产事实源。Registry、图标、root、Skills、MCP、全局 Rules、Extensions、脱敏 model config 和 Sessions 已实现；项目 SubAgent/Commands 专用管理界面仍待完成。
- [ ] `T-AGENT-064` 先落地 `TEST-AGENT-036` 失败用例，再实现 Qwen Code adapters；完成 targeted unit/integration/E2E、backup/sync exclusion、`pnpm typecheck`、affected lint、全量 desktop 回归和稳定文档 converge。首批失败用例与 targeted unit 已落地；完整 Electron E2E 和全量 desktop 回归仍待最终门禁。
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
- [x] `T-AGENT-040` 定义 `AgentUsageQuota` shared contract、`agent:usage:get` IPC channel 和 preload `agent.getUsage`。
- [x] `T-AGENT-041` 实现 main 进程 Claude Code quota adapter（keychain/hashed/file 凭证解析、usage 查询、60s 缓存、错误分类、token 不出主进程）并完成 `TEST-AGENT-023`。
- [x] `T-AGENT-042` 将 Overview 重构为导航枢纽：真实域计数、点击跳 tab、planned/unsupported 置灰、路径区折叠，拆出 `AgentOverviewPanel.tsx` 并完成 `TEST-AGENT-024`。
- [x] `T-AGENT-043` 实现 Usage tab 面板与概览用量卡片：5h/7d 利用率与重置时间、provider-reported 标签、手动刷新、no-credentials/expired/unavailable 引导态。
- [x] `T-AGENT-044` 将 claude 的 usage capability 翻转为 supported（其余平台保持 planned），补齐 7 locales 并跑全量回归。
- [x] `T-AGENT-045` 实现 main 进程 `agent-secret-store.ts`：复用 cloud-auth safeStorage 模式、secret_ref 键控、0600/原子写、fail-closed，并完成 `TEST-AGENT-026` 的存储部分。
- [x] `T-AGENT-046` 定义 Codex provider shared contract、`agent:providers:*` IPC channels 与 preload 方法。
- [x] `T-AGENT-047` 实现 `agent-codex-provider-service.ts`：model_providers/profiles 增删改、默认 provider 切换、bearer token 投影、连通性测试（SSRF+脱敏），复用备份/原子写/verify/回滚管线并完成 `TEST-AGENT-025` 与 `TEST-AGENT-026`。
- [x] `T-AGENT-048` 实现 Provider & Model tab 第三方 provider 区（列表/新增编辑对话框/删除守卫/设默认/测试）并完成 `TEST-AGENT-027`，补齐 7 locales。
- [x] `T-AGENT-049` 全量回归与文档同步（implementation.md、追溯表勾选）。
- [x] `T-AGENT-050` 重构 workspace 壳层：顶格布局（去页边距/max-width）、固定工具栏 + 内容区滚动、维护并入头部 ⋯ 菜单、概览资产格直达所属页签。
- [x] `T-AGENT-051` 实现 Skills/MCP/Rules/Plugins 顶部直达页签（无通用 Assets 入口和二级导航）、配置文件/外观/用量/会话 tab 的顶格紧凑化，并完成 `TEST-AGENT-028` 对应部分。
- [x] `T-AGENT-052` 将供应商与模型 tab 重构为 master-detail（左 provider 列表 + 右详情），复用现有 provider 表单与测试，7 locales 与全量回归。
- [x] `T-AGENT-053` 在 `agent-usage-service.ts` 增加 Codex quota adapter（auth.json 凭证、wham/usage、窗口按时长分类、自定义 provider 短路）并完成 `TEST-AGENT-029`。
- [x] `T-AGENT-054` 概览 provider-aware 改造：移除能力网格、路径行打开文件夹、供应商与模型格按官方/自定义分流展示，并完成 `TEST-AGENT-030`。
- [x] `T-AGENT-055` usage capability 对 codex 翻转 supported；用量 UI 增加 custom-provider 状态；7 locales 与全量回归。
- [x] `T-AGENT-056` 用量迁入概览：移除 usage tab 与用量格，概览顶部圆环仪表横幅（窗口/倒计时/plan/刷新/引导态），复用 `use-agent-usage`，完成 `TEST-AGENT-031` 与全量回归。
- [x] `T-AGENT-057` 将 `AgentUsageQuota` 契约改为多态 `metrics[]`，迁移 Claude/Codex 适配器与横幅渲染。
- [x] `T-AGENT-058` 实现 Kimi / Antigravity / Gemini / Copilot 配额适配器并完成 `TEST-AGENT-032`。
- [x] `T-AGENT-059` 实现多态横幅（圆环 + 进度条、模型配额截取、i18n 标签），翻转四个平台的 usage capability，完成 `TEST-AGENT-033` 与全量回归。
- [x] `T-AGENT-060` 实现顶部 Skills 页签卡片化（徽标/操作/详情钻取/安装我的 Skill），全部复用 Skills 域现有服务与组件，完成 `TEST-AGENT-034` 与全量回归。
- [x] `T-AGENT-061` 修复 Antigravity 已登录误报：优先读取运行中桌面语言服务的月度提示额度与模型额度，钥匙串/旧文件仅作回退；增加 `antigravity-not-running` 引导态、7 locales 和本机真实会话验证，完成 `TEST-AGENT-035`。
- [x] `T-AGENT-065` 接入 `RetrieveUserQuotaSummary` 的两组 weekly/5h 额度池，限制进度条只显示真实总额度，并增加基于 platform allowlist 的 Agent 一键打开/聚焦能力，完成 `TEST-AGENT-037`。
- [x] `T-AGENT-067` 将 Codex、Grok Build、OpenClaw、Qwen Code 的已验证只读会话适配器接入统一 session service，翻转对应 capability，并完成 `TEST-AGENT-038`、类型检查和桌面构建。
- [x] `T-AGENT-068` 将头部 ⋯ 菜单的设置跳转替换为 Agent 就地编辑弹窗，移除重复的头部 Skills 入口，复用现有编辑器与 settings actions，补齐 7 locales、`TEST-AGENT-039` 和构建门禁。
- [x] `T-AGENT-069` 为 Sessions 增加 offset 分页、列表渲染隔离、长 transcript 渐进展开和原生空状态诊断，完成 `TEST-AGENT-040`、性能验证与桌面构建。
- [x] `T-AGENT-070` 在 Antigravity 桌面未运行时短暂启动安装包内的 allowlisted native helper 查询额度，并在所有结果路径中有界回收进程，完成 `TEST-AGENT-041`。

## Current Gate

Registry、shell、allowlisted raw config、非敏感 model config 和只读 session 批次已进入实现。Model config 仅更新平台原生默认模型字段，保留平台认证所有权；Claude、Codex、Gemini、Grok Build、Kimi Code、OpenClaw、OpenCode、Qwen Code 的已验证适配器只做有界读取、搜索和可用时的恢复命令。ChatGPT 仅是 `codex` 的展示身份，不改变会话根或 adapter。Kimi 已采用 `~/.kimi-code` current root，并对 `KIMI_CODE_HOME`、`KIMI_SHARE_DIR` 和 `~/.kimi` 提供兼容解析。Qwen Code 的 registry、官方图标、root、Skills、MCP、全局 Rules、Extensions、脱敏 model config 和 Sessions 已实现；项目 SubAgent/Commands 专用管理和完整 Electron E2E 仍受 `TEST-AGENT-036` 门禁约束。Antigravity、Cursor、Windsurf 等未确认稳定本地 transcript 合同的平台继续保持 Sessions planned/disabled。完整 Provider Profile 切换、凭据投影、删除/清理、持久化会话索引与同步仍受后续安全、fixture、回滚和性能 gate 约束。
