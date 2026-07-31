# Tasks

## Clarify And Analyze

- [x] `T-AGENT-001` 盘点现有预置/custom Agent、路径、AI config、Skill、MCP、Rules、Plugin、backup、tray 和 session 边界。
- [x] `T-AGENT-002` 核对 CC Switch 官方功能，并建立 PromptHub current/target/phase 覆盖矩阵。
- [x] `T-AGENT-003` 确认现有预置 Agent 是一级对象，Agent Profile/Persona 不作为第一阶段主模型。
- [x] `T-AGENT-004` 固化启用中预置/custom Agent 的展示清单、常用优先级、默认排序和用户置顶规则；disabled 平台隐藏，但不以 adapter 完成度过滤启用平台。
- [x] `T-AGENT-005` 完成凭据威胁模型与现有 AI config 密钥存储审计，确认 OS secure storage 投影策略。结论记录于 `platform-capability-research.md`：现有 `ai-models.json` 明文密钥不可复用；抽取 cloud auth 的 `safeStorage` 加密、原子替换和 main-only 访问模式。
- [x] `T-AGENT-006` 建立 31 个内置平台的 capability inventory：installation/path、provider/model、Skills、MCP、Rules、Plugins、config files、sessions、usage/quota、launch、maintenance/CLI、backup/export/import、secret/runtime exclusion 和 appearance。
- [x] `T-AGENT-007` 收集首批 provider/session 原生配置 fixture、格式版本和真实外部修改样本。Claude、Codex、Gemini、Grok、Kimi、OpenCode、Qwen 的 Provider 原生文件和已验证 Session adapter 均有版本化真实结构 fixture；外部修改由真实文件 digest race、部分写入、重读不一致和精确 rollback 样本覆盖。
- [x] `T-AGENT-008` 确认外部会话正文保持平台所有、本地、按需读取且不进入同步；PromptHub 不编辑 transcript。删除优先调用平台原生命令，raw-file adapter 仅在另行通过回收站/回滚测试后提供删除。
- [x] `T-AGENT-009` 确认本地代理、协议转换、故障转移、请求拦截和 OAuth 账户池属于高风险独立范围，当前变更不实现。
- [x] `T-AGENT-010` 完成实现前 Analyze：阶段状态与范围决策已统一；全部 FR/NFR、DES、TEST、T 定义唯一且进入追踪表；无阻塞性待确认。
- [x] `T-AGENT-073` 将 31 平台深度能力声明固化为 machine-readable shared contract；路径能力只从 canonical registry 派生，renderer 不再维护 provider/session/usage 平台 allowlist。

UI screen structure, interaction states, responsive behavior and component boundaries are specified in `ui-design.md`.

## Test-First Verification Contracts

- [x] `TEST-AGENT-001` Agent registry 回归：enabled built-in、enabled custom、configured-but-not-detected 均可见；常用/安装/配置/置顶排序正确；disabled built-in/custom 隐藏；侧栏仅保留搜索；置顶操作垂直居中；不自动创建 Profile。
- [x] `TEST-AGENT-002` capability 决策表：检测与 provider/session/CLI 支持互不混淆，unsupported 不伪装 failed/success。
- [x] `TEST-AGENT-003` DB 黑盒/事务：Provider Profile CRUD、重复名称、归档、模型映射、级联和并发更新。
- [x] `TEST-AGENT-004` secret 安全：DB JSON、IPC、日志、快照、export 和错误均不含 key/token/auth header。覆盖 DB 写入/legacy 读取、main-only secret store、加密 backup、公共 Profile/snapshot/export、IPC 稳定错误和 Provider probe 结果。
- [x] `TEST-AGENT-005` provider import fixture：已知字段、未知字段、畸形内容、Unicode、空值、OAuth-owned 凭据和 import preview。七个完整 adapter 均使用原生格式 fixture；Unicode 未知字段由 Claude JSON fixture 验证精确保留。
- [x] `TEST-AGENT-006` 三方对账决策表：unchanged/backfill/external-modified/conflict/unsupported/blocked。
- [x] `TEST-AGENT-007` 真实文件集成：backup、structured write、comment/unknown field preservation、atomic rename、digest race、verify failure 和 rollback。七个完整 adapter 与共享 activation service 均覆盖 main-owned 加密 backup、结构化写入、并发冲突、重读验证和失败补偿。
- [x] `TEST-AGENT-008` 资产聚合契约：Skill/MCP/Rules/Plugin 列表、计数、状态和动作与 owning domain 一致；当前 Agent 工作台只暴露既有 Skill 域动作，未提供的通用跨域动作明确返回 unsupported。
- [x] `TEST-AGENT-009` config file 安全：首批覆盖 allowlist、仅内容编辑、缺失文件创建、symlink escape、path traversal、null byte 和权限错误；snapshot/restore 随后续版本能力补齐。
- [x] `TEST-AGENT-010` session fixture：增量扫描、search/read/resume、missing、parse-error、超大文件、Unicode 和取消。已由 device-local index、Claude/Gemini/OpenCode/Kimi/Qwen/Codex/Grok/OpenClaw/Kiro/Oh My Pi/Windsurf 真实文件 fixture、IPC 取消和 renderer 搜索回归共同覆盖。
- [x] `TEST-AGENT-011` session 隐私/性能：正文不进入默认 sync/export，10,000 条分页/虚拟化，bounded preview 和 redaction。普通 WebDAV/S3/self-hosted 同步复用同一 portable backup exporter，回归确认只导出有界 opt-in preference；10,000 条 SQLite 元数据使用 200 条有界分页，renderer 使用 50 条列表分页与 80 条 transcript 渐进挂载。
- [x] `TEST-AGENT-012` model test：成功流、stream、timeout、abort、auth/network/model-not-found 分类、redirect/SSRF 边界和 redaction。
- [x] `TEST-AGENT-013` tray/workspace 契约：共享 active-state query 与 activation service，不存在第二状态源。
- [x] `TEST-AGENT-014` backup round-trip：新旧格式、缺失 secret、跨设备 path reconciliation、无 transcript body。（由 `TEST-AGENT-073` / `074` / `075` 完成完整格式、用户可见 ZIP scope、当前设备 session descriptor 重绑定与 runtime/transcript 排除。）
- [x] `TEST-AGENT-015` import/deep-link fuzz：版本、大小、非法 URL、敏感字段、重复 id、未知协议和无确认不落盘。
- [x] `TEST-AGENT-079` Provider Profile 深链回归：严格 `prompthub://import` 解析、敏感值拒绝、主进程有界路由、预览、取消零写入、确认单次创建、无自动激活和 7 locales。
- [x] `TEST-AGENT-080` Qwen Definitions 回归：真实 user/project SubAgent 与嵌套 Command fixture、严格 YAML、命名空间、畸形/超限/Unicode、entry/byte/depth 上限、软链接/越界/空字节、敏感 metadata 脱敏、extension 排除、project id 主进程解析、open 时二次校验、Qwen-only UI、搜索/选择/空态/错误态和 7 locales。
- [ ] `TEST-AGENT-016` CLI detection/lifecycle：custom PATH/prefix、版本、unsupported manager、计划确认、命令参数注入和失败恢复。
- [x] `TEST-AGENT-017` UI 行为：所有 Agent 共用同一 detail shell；Agent 行始终可点击；supported 可操作，partial 按子能力控制，planned/unsupported 置灰且不触发 IPC；覆盖 provider diff、asset actions、sessions、diagnostics、keyboard 和 7 locales。最终聚合 8 files / 106 tests，并补充 Agent 切换导致当前 tab 失效时的 roving focus 恢复与七语言 key/非空值严格对齐。
- [x] `TEST-AGENT-018` 全量回归：Prompt、Skill、MCP、Rules、Plugin、AI Settings、backup/sync、tray 和现有 Agent 分发不回归。（config file 批次已通过 383 files / 3354 tests、desktop build 和隔离 HOME 的 Agent Electron E2E；后续 adapter 批次仍须重复执行）
- [x] `TEST-AGENT-019` Kimi Code 双版本回归：current/env/legacy/override 根目录优先级、缺失根的新目录落点、TOML 模型读写与回滚、secret 脱敏、bounded index、畸形/越界/软链接 session、只读 transcript 和 resume command。
- [x] `TEST-AGENT-020` Codex 外观回归：Dream Skin `theme.json + image` 校验/导入/列表/预览/导出、原子 active staging、平台 start/verify/restore 编排、兼容性失败回滚、loopback CDP、Pet 扫描/预览/原子导入/导出/删除、v1/v2 atlas idle 动画裁切、reduced-motion 静态帧、路径穿越/软链接/超限输入和 UI capability 状态。
- [x] `TEST-AGENT-021` 桌面首页顺序回归：新用户默认 `Prompts -> Agents -> Skills`；settings v17 迁移旧默认顺序时同样把 Agents 放在第二位；迁移后的完整自定义顺序保持不变。
- [x] `TEST-AGENT-022` Google Agent 生命周期回归：Antigravity 排在 Gemini 前并标记为 current；两个内置显示名均不带 `CLI` 后缀；Gemini 仅作为 enterprise-legacy 兼容项保留并指向 Antigravity；界面明确 2026-06-18 普通用户停服边界和企业/付费 API 例外；Antigravity 的 Skill、MCP、Plugin 和 Rules 路径使用官方共享配置合同。
- [x] `TEST-AGENT-023` Claude quota adapter 契约：凭证解析顺序（keychain legacy / hashed 变体 / credentials 文件、root override）、畸形 JSON、缺失 `claudeAiOauth`、`expiresAt` 过期短路、200 映射、401、网络超时、60s 缓存 TTL、非法 agentId 拒绝，且任何输出/错误/日志不含 token。
- [x] `TEST-AGENT-024` Overview 导航 UI 行为：真实计数与 owning store 一致、点击跳转到对应 tab、planned/unsupported 置灰且不发 IPC、用量卡片 ok/no-credentials/expired/unavailable 四态、路径区折叠、7 locales、仅使用中性设计 token。
- [x] `TEST-AGENT-025` Codex provider 写入管线契约：model_providers 增删改、profiles 生成/清理、保留键与注释不受影响、auth.json 与 openai 内置 provider 零改动、reserved id 拒绝、slug/URL 校验、active provider 删除拒绝、digest 冲突回滚、原子写 0600、重读 verify 失败回滚。
- [x] `TEST-AGENT-026` 托管密钥安全契约：secret store 加解密往返、safeStorage 不可用 fail-closed、0600/原子写、同文件并发写入/清除线性化且不丢失无关凭据、先行 mutation 对后续 read 可见、bearer token 投影与 env_key 旁路、密钥不出现在任何 IPC 响应/错误/日志、连通性测试 SSRF 拦截（非 loopback 内网 IP/file 协议/带 userinfo 的 URL；loopback 明确豁免）、测试错误分类与脱敏。
- [x] `TEST-AGENT-044` Codex 身份偏好：默认名称无 CLI 后缀；Codex/ChatGPT 名称与图标可独立选择；列表、搜索、排序和详情共享投影；非法持久化值逐字段回退；设置快照 round-trip 且不接受任意图标路径或 URL。
- [x] `TEST-AGENT-027` Provider UI 行为：列表渲染（managed/env/none 密钥就绪度）、新增/编辑对话框（密钥 write-only；显式保留、替换、移除；只允许显示当前新输入值；替换空值拦截）、删除守卫、设为默认、测试结果展示、非 Codex 平台不渲染该区域、7 locales。
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
- [x] `TEST-AGENT-042` Oh My Pi 回归：`PI_CODING_AGENT_DIR`/默认根解析、Skills/Rules/MCP/项目目标/派生 Plugin 路径、`mcpServers` key、直接项目 JSONL 会话、标题/模型/可见消息映射、畸形行统计、嵌套 subagent/软链接/不安全 id 拒绝和 `omp --resume` 元数据。
- [x] `TEST-AGENT-043` Oh My Pi model 回归：`config.yml`/`config.yaml` 选择、`models.yml` provider/model 列表、endpoint 脱敏、apiKey/header/OAuth 不出 renderer、缺失/畸形/超限 YAML、备份/原子写/重读校验/回滚，以及未知字段保留；并发防护复用既有通用写入管线。
- [x] `TEST-AGENT-045` 全量 capability inventory 回归：31 个平台注册项各声明一次；每项状态只能是 supported/partial/planned/unsupported 且 evidence 非空；provider/session/usage 的已实现集合与真实 adapters 一致；custom Agent 只派生路径能力，不伪造深度协议。
- [x] `TEST-AGENT-046` Provider Profile renderer 回归：非 Codex 已支持平台使用统一 Profile split view；覆盖公共凭据就绪态、增删改/归档/复制/无凭据导出、结构化 config 编辑保留、write-only 凭据替换/清除/保留、显式原生导入、逐字段冲突选择、blocked/verified/rollback 结果、稳定错误脱敏和 7 locales；Codex 旧 provider 投影仍由 `T-AGENT-079` 迁移。
- [x] `TEST-AGENT-047` 工作台 capability 指引与键盘回归：planned/unsupported 页签保持禁用并显示具体说明，不触发 Provider IPC；tablist 使用 roving tabindex，ArrowLeft/ArrowRight/Home/End 仅在可用页签间循环，活动页签与 tabpanel 通过 `aria-labelledby` 关联；7 locales 提供 planned/unsupported 文案。
- [x] `TEST-AGENT-048` Agent renderer 异步测试稳定性：Overview session/provider cell 与 legacy Codex Provider panel 的初始异步加载在 React `act` 生命周期内收敛；工作台切回 Overview 后再次等待加载完成；回归输出不再包含未包裹 `act(...)` 的状态更新警告。
- [x] `TEST-AGENT-049` Codex Provider 凭据迁移：真实 TOML fixture 覆盖 legacy managed/env/native-inline 三类来源；preview 不含 secret/ref；未确认与 stale digest 零写入；确认后 Profile/映射/`agent-provider:<profileId>` 一致；批次中任一步失败恢复旧 ref 并清理新 Profile/ref；迁移不改 `config.toml`；重复执行幂等；7 locales、键盘/读屏和 Electron 同意/稍后流程。
- [x] `TEST-AGENT-050` Gemini Provider adapter：真实 JSONC + `.env` fixture 覆盖 paid API key 与 platform-native OAuth/Vertex/ADC；inspect/import 不泄露 secret；两文件 unknown-field/comment preservation、并发修改、软链接/超限/畸形输入、加密 bundle backup、部分写失败恢复、重读验证与 rollback；原生 Gemini `/v1beta/models` 和 `streamGenerateContent` 覆盖请求、SSE、SSRF/DNS、redirect、timeout、retry、abort、响应上限、错误分类和脱敏；Profile UI 覆盖 Gemini 默认协议、凭据清除和 7 locales。
- [x] `TEST-AGENT-051` Kimi Code Provider adapter：真实 TOML fixture 覆盖 `kimi`、`openai`、`openai_responses`、`anthropic`、`google-genai`、Vertex ADC、managed OAuth、provider `env` 与 `custom_headers`；inspect/import 不泄露 secret；provider/model/default 语义保留、畸形/超限/软链接/越界、加密备份、digest race、原子写、native validation、重读验证和 rollback；各直接协议复用现有 main-only probe 并覆盖 unsupported/no-credentials；Profile UI 覆盖 provider id、model alias、upstream model、context limit、write-only secret 和 7 locales。
- [x] `TEST-AGENT-052` Qwen Code Provider adapter：当前 `$version: 4` bare-array `modelProviders`、built-in/custom `providerProtocol`、`id + baseUrl` identity、user `.env` credential projection、platform-native Vertex/legacy OAuth/Coding Plan ownership、deprecated auth-field redaction、unknown-field/duplicate-model preservation、畸形/超限/软链接/越界、两文件 digest race、加密备份、部分写入恢复、重读验证和 rollback；OpenAI/Anthropic/Gemini probe dispatch、Profile UI、7 locales 与真实 Electron IPC 路径全部回归。
- [x] `TEST-AGENT-053` OpenCode Provider adapter：current v1 `provider`/`model`/`small_model` JSONC、config precedence、custom provider npm/protocol mapping、XDG data-root `auth.json` API credential projection、native API/OAuth/well-known ownership、v2 plural `providers` 拒写、inline secret/header blocking、unknown-field/comment/auth-entry preservation、畸形/超限/软链接/越界、两文件 digest race、加密备份、部分写入恢复、重读验证和 rollback；OpenAI Chat/Responses probe dispatch、Profile UI、7 locales 与真实 Electron IPC 路径全部回归。
- [x] `TEST-AGENT-054` GitHub Copilot CLI native model 回归：`COPILOT_HOME`/默认根、current user-editable asset paths、JSONC `settings.json` model inspect/update、注释与未知字段保留、缺失/畸形/超限/软链接、并发修改、备份/原子写/重读验证/rollback；BYOK endpoint/secret Profile fail-closed，`config.json`/auth/session/permission/Plugin metadata 不进入 renderer 或普通配置编辑。
- [x] `TEST-AGENT-055` GitHub Copilot Plugin 安装语义回归：target matrix 保持可见但禁用、直接 distribute 在 resolver/文件写入前 fail-closed、真实已安装目录仍可只读发现；不得把生成 `plugin.json` 或写入 `installed-plugins/` 宣称为原生安装。
- [x] `TEST-AGENT-056` Cursor current boundary 回归：canonical root/Skills/SubAgents/MCP/Plugin paths 与 planned deep capabilities；Marketplace cache 和 local Plugin 只读发现；target matrix 可见但禁用；直接 distribute 在 resolver/写入前 fail-closed；不得声明全局 Rules、Config、Provider、Sessions、Usage 或 Maintenance 已支持。
- [x] `TEST-AGENT-057` Cherry Studio current boundary 回归：`Data/cherrystudio.sqlite` 优先于兼容旧库、`Data/Skills` 使用跨平台规范路径、macOS 启动入口可用、composite Plugin target 保持禁用；MCP/Rules/Config/Provider/Sessions/Usage/Maintenance 与私有运行时状态不得被误报为已支持。
- [x] `TEST-AGENT-058` Windsurf transcript 回归：真实 `user_input` / `planner_response` / `code_action` JSONL fixture、只读 list/read、`resume: null`、隐藏工具与文件内容、畸形行、未知 step、分页/排序/截断、非法 id、软链接和越界防护；Skills/MCP/global Rules/launch 路径保持真实，Provider/Usage/Config/Maintenance 与 composite Plugin 安装不得误报。
- [x] `TEST-AGENT-059` Kiro current boundary 回归：`KIRO_HOME`/默认根、Skills/MCP/agents/config/launch 路径、JSONC `chat.defaultModel` inspect/update、平台托管凭据、备份/原子写/并发/验证/回滚；CLI metadata + JSONL 会话仅投影视觉 Prompt/Assistant text，隐藏 thinking/tool/result、`resume: null`、畸形/超限/软链接/越界防护；多文件 steering 不伪装为单文件 Rules；Power 直接 distribute 在 resolver/写入前 fail-closed。
- [x] `TEST-AGENT-060` Grok Build Provider adapter：`GROK_HOME`/默认根、当前 `[models].default` + `[model.<alias>]` TOML、三种公开协议、built-in/native session 与 env-owned custom Provider、inline key/header redaction 和只读边界、unknown-field preservation、畸形/超限/软链接/越界/重复/并发输入、加密备份、原子写、重读验证、失败回滚、main-only 环境凭据 probe、Profile UI 无 managed-secret 控件与 7 locales。
- [x] `TEST-AGENT-061` Amp current boundary：跨平台 `~/.config/amp` 根与 Windows 旧路径 fallback、全局/项目 settings preset、literal `amp.mcpServers` 读写与无关 dotted settings preservation、Provider unsupported 及其余深度能力不误报；不得启用 raw Config、hosted thread/usage 或 Plugin 文件系统安装。
- [x] `TEST-AGENT-062` Provider 凭据替换补偿：legacy ref 清理在 DB 更新后失败时恢复 Profile、mapping 和旧 secret；DB 补偿失败时保留当前 DB 所需的新 secret 并返回稳定 rollback error；错误和公共结果不含凭据。
- [x] `TEST-AGENT-063` Session metadata persistence：fresh/migrated schema、source identity、full/incremental scan、missing/parse-error、annotation preservation、失败事务回滚、stable scan error、literal search、bounded pagination、畸形/超限/重复输入和级联删除；不得持久化 transcript body。
- [x] `TEST-AGENT-070` Provider endpoint 凭据隔离：共享 validator 覆盖 HTTP(S)/loopback/空值、userinfo、fragment、协议、控制字符、畸形和超限；SQLite create/update/read fail-closed 且错误不回显凭据；Profile 表单首击即拦截并覆盖 7 locales。
- [x] `TEST-AGENT-071` Provider 公共 JSON 持久化边界：Profile config、model mapping、audit snapshot 在 SQLite write/read 均拒绝敏感键、非 JSON、循环和超限结构；baseline recovery 复用同一 validator；旧 unsafe row fail-closed、错误不回显凭据且失败写入不留部分记录。
- [x] `TEST-AGENT-072` Session index 取消与规模门禁：预取消不调用 adapter；扫描完成至提交之间取消不写 row/cursor/status/failure；真实 SQLite 精确提交 10,000 条并遍历 50 个 200-row page，覆盖 total/hasMore、Unicode literal search、30 秒有界运行和 transcript body schema exclusion。
- [x] `TEST-AGENT-076` Agent workspace UI 韧性：50+ Agent 与 100+ Provider Profile 使用真实生产 virtualizer 配置并保持稳定 key、固定估算、overscan 和有界 DOM；长名称/路径不撑开 header/master-detail，launch 保留完整 accessible name；搜索、选择、current badge 和键盘按钮语义保持可用。
- [x] `TEST-AGENT-077` Agent asset 规模门禁：1,000 个 Skill 卡片和 1,000 个 MCP/Rules/Plugin 紧凑项只渲染有界 page，前后页可达且边界禁用；search/filter/source/domain 改变重置或 clamp page，不出现假空状态；动作仍接收 owning-domain 原对象。
- [x] `TEST-AGENT-078` OpenCode CLI 更新生命周期：官方固定 update/精确版本 rollback 合同、main-owned detached plan、sender 绑定、TTL/容量、一次性与并发防重放、precondition 重检、成功/no-change、失败恢复、rollback 失败、输出脱敏、IPC/preload、显式确认 UI 和 7 locales；不执行用户机器上的真实全局更新。

## Master Delivery Task

- [ ] `T-AGENT-081` 完成 Agent 管理模块当前规划范围内的全部平台适配、核心开发和收敛验证。

  **目标**
  - 以 `packages/shared/constants/platforms.ts` 的 31 个内置 Agent 和用户已启用的 custom Agent 为唯一展示清单。
  - 以 `packages/shared/constants/agent-platform-capabilities.ts` 为能力状态的 machine-readable 投影，不建立第二份平台、路径或 adapter allowlist。
  - 对每个平台逐项完成 installation/path、Provider & Model、Skills、MCP、Rules、Plugins、Config Files、Sessions、Usage、Launch、Maintenance/CLI、backup/export/import、secret/runtime exclusion 和 Appearance 的证据审计。
  - 有稳定协议、真实 fixture 和可回滚实现的能力标记为 `supported` 或 `partial`；缺少证据的能力必须保留为 `planned` 或有依据地标记 `unsupported`，不得用路径存在或 UI 可见冒充已适配。

  **当前基线**
  - 统一 Agent registry、工作台 shell、资产聚合、allowlisted Config Files、Provider Profile DB/CRUD、三方对账和基础激活管线已经存在。
  - Provider & Model 当前有 Claude Code、Codex、Gemini CLI、Grok Build、Kimi Code、OpenCode、Qwen Code 7 个完整 Profile adapter，以及 GitHub Copilot CLI、Kiro、Oh My Pi、OpenClaw 4 个仅 model/config 的 `partial` 投影。Codex 已完成统一 Provider Profile DB、`agent-provider:<profileId>` secret ref、旧配置迁移提示和统一 activation service；旧 `codex-provider:*` secret 仍按显式迁移边界保留，不静默复制或删除。
  - Sessions 当前有 9 个 verified read-only adapters，Windsurf/Kiro 为有界只读 `partial`，Claude/Gemini 已有显式 opt-in 的持久化 metadata index；Usage 有 6 个 adapters，Appearance 只有 Codex。
  - Agent portable backup/restore、选择性/完整桌面备份、跨设备 session preference 重绑定和 tray Provider 切换已经完成。Maintenance/CLI 目前只在 7 个有证据的平台提供只读诊断；detect/install/update 的 plan/confirm/apply 生命周期仍未完成。
  - custom Agent 只能获得自身声明路径和 owning-domain 资产能力，不得按目录名继承内置平台的 Provider、Session、Usage 或 Appearance adapter。

  **执行批次**
  1. **统一 Provider 边界**：先完成 Codex 从旧 provider 投影到 Provider Profile DB、`agent-provider:<profileId>` secure secret 和统一 activation service 的迁移；原生配置仍是 Agent 运行态投影，旧 `codex-provider:*` 凭据不得静默复制或删除。
  2. **优先平台 adapters**：按 Claude Code、Codex、Antigravity、Kimi Code、Qwen Code、OpenCode、Oh My Pi 的顺序完成有证据的 inspect/import/plan/apply/verify/rollback/test；Gemini 只保留企业/付费 API 兼容边界。
  3. **其余平台注册项**：按 canonical registry 顺序处理 Copilot、Cursor、Cherry Studio、Windsurf、Kiro、TRAE 系列、Cline、Reasonix、Augment、ZCode、Grok Build、Kilo Code、Amp、OpenClaw、QClaw、Qoder、QoderWorker、Hermes Agent、CodeBuddy 和 WorkBuddy。每个平台必须先补证据与 fixture，再决定实现或 `unsupported`。
  4. **资产与配置**：Skills、MCP、Rules、Plugins 继续实时调用 owning domain；补齐平台特有 scope、父 bundle、项目级路径、外部修改检测和受控写入，不复制 durable state。
  5. **Sessions 与 Usage**：完成 session source/index 持久化、分页、bounded transcript、恢复命令、隐私排除和大数据量测试；仅为有官方或真实本地证据的平台启用 Usage/Quota。
  6. **运维与恢复**：完成 tray provider 切换、Agent backup/export/import、跨设备 reconciliation、CLI detect/install/update/diagnose 的 plan/confirm/apply，以及失败后的幂等恢复。
  7. **产品门禁**：补齐无 adapter 指引、7 locales、键盘/读屏、窄窗口、长文本、大数据量、Electron E2E、全量 desktop 回归、typecheck、affected lint 和 `pnpm verify:release:quick`。
  8. **文档收敛**：更新 capability inventory、稳定 knowledge/rules、测试矩阵、coverage map、implementation 和 issue 状态；完成 Converge 后再归档当前 change。

  **每个平台的完成定义**
  - 平台身份、根目录、环境变量、scope 和运行态排除项均有证据代码及可复现 fixture。
  - 每项能力的状态与真实 adapter 一致；`supported` 必须有正常、缺失、畸形、超限、权限、软链接/越界、并发外部修改和兼容性测试。
  - 任何写入均具备受控 backup、原子替换、重新读取验证和失败回滚；不得覆盖未知字段或静默接管外部配置。
  - secret/token/auth header 不进入 renderer、SQLite 公共 JSON、日志、错误、portable export、普通 backup 或 transcript index。
  - Sessions 只读且按需加载；PromptHub 不编辑、删除、同步或默认备份外部 transcript 和认证缓存。
  - UI 的列表、详情、计数、badge 和动作共享同一 capability/query source；planned/unsupported 能力保持可解释且不触发 IPC。

  **关闭条件**
  - `T-AGENT-007`、`T-AGENT-011`、`T-AGENT-012`、`T-AGENT-015` 至 `T-AGENT-019`、`T-AGENT-022` 至 `T-AGENT-031`、`T-AGENT-035` 至 `T-AGENT-039`、`T-AGENT-063`、`T-AGENT-064` 和 `T-AGENT-079` 均已完成，或以证据充分的 `unsupported` 结论收敛。
  - `TEST-AGENT-004`、`TEST-AGENT-005`、`TEST-AGENT-007`、`TEST-AGENT-010` 至 `TEST-AGENT-017` 和 `TEST-AGENT-036` 全部通过。
  - 31 个内置 Agent 均有完整且真实的 capability inventory；不存在重复 Provider、资产、会话、额度、配置、备份或维护事实源。
  - `FR -> DES -> TEST -> T` 审计无重复、孤立或虚假完成项；`implementation.md` 与代码和验证结果一致。
  - 本任务是总交付门禁，不能因为某个 UI、单个平台或单组 targeted tests 完成而提前勾选。

  **明确不包含**
  - 本地代理、协议转换、故障转移、请求拦截、请求日志、OAuth 账户池和敏感数据远程同步；这些能力仍需独立安全审查和 active change。

## Phase 0: Foundations

- [x] `T-AGENT-011` 在 `packages/shared` 增加 Managed Agent、capability、Provider Profile、activation plan/result、session 和 IPC contracts。Managed Agent、capability inventory、Provider Profile、import preview、字段冲突选择、activation plan/result、非敏感 model config、只读 session、Provider CRUD/activation 以及 connection/model/cancel test contracts 均已由固定 IPC channel、main validation、preload bridge 和 renderer store 回归覆盖。
- [x] `T-AGENT-012` 在 `packages/db` 增加 Provider Profile、model mapping、redacted snapshot、session source/index schema、迁移、索引和事务。
- [x] `T-AGENT-074` 完成 Provider Profile 持久化基础批次：shared typed records/inputs、三张 SQLite 表、既有数据库幂等迁移与预迁移备份、active-name 唯一约束、乐观并发、mapping upsert、snapshot history、级联/SET NULL 和事务回滚。
- [x] `T-AGENT-013` 在 `packages/core` 增加 adapter registry、Agent query、provider reconciliation 和 asset aggregation 服务，并将四个 owning-domain 只读 adapters 接入工作台；不复制资产事实源，未实现的通用跨域写操作明确返回 unsupported。
- [x] `T-AGENT-014` 将完整 platform registry/path resolution 接入 Managed Agent query，不复制平台记录，也不按深度 adapter 完成度过滤。
- [x] `T-AGENT-015` 实现 desktop secure secret abstraction、provider apply transaction 和 config allowlist boundary。证据充分的完整 adapter 使用 main-only secure secret、同文件 mutation 队列、allowlisted native targets、加密 backup、原子写入、digest 并发保护、重读验证、审计快照和失败 rollback；其余平台保持 partial/planned/unsupported，不伪造 endpoint/credential 写入。
- [x] `T-AGENT-016` 建立首批 provider/session fixture 与故障注入 harness，并完成 `TEST-AGENT-001` 至 `007`。故障注入覆盖 secret/DB 双写补偿、部分文件写入、并发修改、验证失败、审计失败和 rollback 失败。
- [x] `T-AGENT-075` 完成 Provider adapter registry 与纯三方对账基础批次：可选能力注册不伪造 adapter，平台/版本校验，字段级 preserve/apply/backfill/external-modified/conflict/unsupported/blocked 决策和不可变输入。
- [x] `T-AGENT-076` 将 Managed Agent query/identity/path/order/filter 业务规则下沉到 `packages/core`，renderer 仅保留兼容导出；增加无状态 Agent asset aggregation orchestrator，实时委托 owning domains、隔离单域失败并拒绝跨域 plan/result。
- [x] `T-AGENT-077` 完成 Provider Profile main-only 安全 CRUD 批次：公共 JSON/映射敏感键拒绝、批量密钥存在性查询、write-only secret、稳定 main-owned secret ref、DB/密钥双写补偿、原子 profile+mapping 更新、duplicate 不复制凭据、无凭据 export、受控 IPC/preload 和数据库恢复后的 handler rebind。
- [x] `T-AGENT-078` 完成 Provider 激活应用链路基础批次：原生 import preview 验证、字段级冲突选择、main-owned Agent 路径解析、受控 import/preview/activate IPC 与 preload、八个平台的 model-only adapter 注册、renderer query/action store、stale-load 隔离以及 verified/rollback 结果投影；endpoint/credential profile 在对应平台完整 adapter 落地前 fail-closed。
- [x] `T-AGENT-079` 将 Provider Profile 列表、结构化编辑、原生导入确认、字段级 activation preview、verified/rollback 结果和无 adapter 指引接入 Provider & Model split view；迁移 Codex 旧 provider 管理投影，避免形成第二 Provider 事实源，并完成 7 locales、键盘/读屏和 UI 回归。Codex legacy 凭据同意迁移、统一 Profile 创建/激活、write-only secret 和真实 `config.toml` 投影已通过 Electron E2E。
- [x] `T-AGENT-080` 完成非 Codex Provider Profile renderer 批次：统一列表/详情、公共凭据态、CRUD/归档/复制/无凭据导出、write-only 凭据动作、显式原生导入、逐字段 activation preview、verified/rollback 结果和稳定错误边界；编辑保留 adapter-owned `config`，不把 durable 状态复制进 renderer store。
- [x] `T-AGENT-082` 完成 capability 指引与工作台 tab 可访问性批次：planned/unsupported 页签及概览入口显示状态对应说明；禁用页签不触发 Provider IPC；可用页签实现 roving tabindex、ArrowLeft/ArrowRight/Home/End 导航和 tab/tabpanel 关联；新增文案覆盖 7 locales。
- [x] `T-AGENT-083` 完成 Agent renderer 异步测试 harness 收敛：`renderWithI18n` 提供显式、默认关闭的 effect settlement 选项；工作台和 legacy Codex Provider 测试仅在需要时启用，覆盖初始加载与重新进入 Overview，不改变生产组件或持久化边界。
- [x] `T-AGENT-084` 以 CC Switch v3.18.0 公开协议和交互流程为参考，在 PromptHub 边界内独立实现 Codex legacy -> unified Profile 显式迁移、main-only 凭据复制与批次补偿、完整 Codex Provider activation adapter，并在回归通过后移除 legacy renderer 事实源。完成 `FR-AGENT-024`、`DES-AGENT-020`、`TEST-AGENT-049` 和 `T-AGENT-079`；推进但不替代仍需全平台验证的 `TEST-AGENT-004`、`TEST-AGENT-005`、`TEST-AGENT-007` 与 tray 尚未完成的 `TEST-AGENT-013`。

## Phase 1: Core Workbench

- [x] `T-AGENT-017` 实现 Claude Code provider adapter：`settings.json` 的 inspect/import/plan/apply/verify/rollback、Anthropic API Key/Auth Token 凭据投影、平台原生认证保留，以及隔离的 `/v1/models` 连通性和 Messages SSE 模型测试；不读取或改写 Claude-owned `.credentials.json`。
- [x] `T-AGENT-018` 实现 Codex CLI provider adapter：inspect/import/plan/apply/verify/rollback 与隔离连通性检查。统一 Profile adapter 已完成完整激活链路；连通性检查使用 main-only 凭据、受限 `/models` 请求、SSRF/DNS 防护、8 秒总超时、1 MiB 上限、零重试和稳定脱敏分类。
- [x] `T-AGENT-085` 完成 `TEST-AGENT-012` 的显式流式模型测试：最小推理、首 token 延迟、用户 abort、connect/first-token/total timeout、一次有限重试、quota 确认和安全响应预览；该结果与 `/models` 连通性检查分别展示。
- [x] `T-AGENT-019` 为仍受支持的企业/付费 API 场景实现 Gemini CLI provider adapter：inspect/import/plan/apply/verify/rollback/test；普通用户入口保持 Antigravity。
- [x] `T-AGENT-086` 实现 Kimi Code 完整 Provider adapter：基于官方 `config.toml` provider/model 协议完成 inspect/import/plan/apply/verify/rollback/test，平台 OAuth/ADC/custom headers 保持外部所有，PromptHub-owned key 使用 secure secret 与加密备份；不复制或 vendoring 上游源码。
- [x] `T-AGENT-087` 实现 Qwen Code 完整 Provider adapter：基于官方 current `settings.json`/`.env` provider-model 合同完成 inspect/import/plan/apply/verify/rollback/test；自定义 provider 通过 `providerProtocol` 映射，平台所有的 OAuth/ADC/Coding Plan 和非 Profile credential source 保持只读；不复制或 vendoring 上游源码。
- [x] `T-AGENT-088` 实现 OpenCode 完整 Provider adapter：基于官方 current v1 `opencode.json(c)` 与 XDG data-root `auth.json` 合同完成 inspect/import/plan/apply/verify/rollback/test；仅支持官方文档明确的 OpenAI-compatible custom provider 包，原生 API/OAuth/well-known/environment/file/cloud credential 保持只读，v2 plural provider 合同保持拒写；不复制或 vendoring 上游源码。
- [x] `T-AGENT-089` 按 `FR-AGENT-036` / `DES-AGENT-036` 实现 GitHub Copilot CLI current root/asset inventory 与 `partial` model-only adapter，完成 `TEST-AGENT-054`；环境型 BYOK、原生 auth、session store、permission 和 Plugin metadata 保持平台所有。
- [x] `T-AGENT-090` 按 `FR-AGENT-037` / `DES-AGENT-037` 禁止 Copilot 的伪文件系统安装语义，保留已安装 Plugin 只读发现，并完成 `TEST-AGENT-055`。
- [x] `T-AGENT-091` 按 `FR-AGENT-038` / `DES-AGENT-038` 校正 Cursor current asset inventory，保留 Marketplace/local Plugin 只读发现，禁止未验证的文件系统分发，并完成 `TEST-AGENT-056`。
- [x] `T-AGENT-092` 按 `FR-AGENT-039` / `DES-AGENT-039` 校正 Cherry Studio current v2 database precedence、Skill/launch projection 和 composite Plugin 门禁，并完成 `TEST-AGENT-057`。
- [x] `T-AGENT-093` 按 `FR-AGENT-040` / `DES-AGENT-040` 实现 Windsurf opt-in public transcript 只读 adapter，翻转 Sessions 为 partial，并完成 `TEST-AGENT-058`；不得解析 proprietary Cascade protobuf runtime。
- [x] `T-AGENT-094` 按 `FR-AGENT-041` / `DES-AGENT-041` 实现 Kiro model-only 配置与 partial 只读 session adapter，校正 Power 原生安装边界，并完成 `TEST-AGENT-059`。
- [x] `T-AGENT-095` 按 `FR-AGENT-042` / `DES-AGENT-042` 实现 Grok Build Provider & Model adapter，先完成 `TEST-AGENT-060` 红测，再接入 capability、IPC、Profile UI、7 locales、稳定文档与 targeted gates。
- [x] `T-AGENT-096` 按 `FR-AGENT-043` / `DES-AGENT-043` 校正 Amp current path/asset boundary，接入 owning MCP domain 的全局/项目 `amp.mcpServers` target，先完成 `TEST-AGENT-061` 红测，再同步 capability 与稳定文档。
- [x] `T-AGENT-097` 按 `FR-AGENT-044` / `DES-AGENT-044` 修复 Provider Profile secret replacement 在 legacy cleanup 失败后的跨存储补偿顺序，先完成 `TEST-AGENT-062` 红测，再运行 Profile/DB/IPC 安全回归。
- [x] `T-AGENT-098` 按 `FR-AGENT-010` / `DES-AGENT-045` 实现 device-local session source/index schema、幂等迁移、事务型 full/incremental scan primitives、annotation preservation 和 bounded query，先完成 `TEST-AGENT-063` 红测；本批不接入 transcript 扫描器或 renderer。
- [x] `TEST-AGENT-064` 用真实 SQLite 与 Claude/Gemini fixture 覆盖显式 opt-in、增量复用、同一事务 full scan、per-file parse-error、取消不提交、source missing、bounded search/pagination，以及 transcript 始终 live-read。
- [x] `T-AGENT-099` 按 `DES-AGENT-046` 将 Claude/Gemini verified readers 接入 device-local session metadata index orchestration；本批完成 main-process service，renderer progress/cancel IPC 在同一设计的后续 UI wiring 中完成。
- [x] `TEST-AGENT-065` 覆盖 session index IPC 输入验证、renderer-scoped refresh/cancel/destroy cleanup、redacted state/progress，以及 UI 显式启用、刷新、取消、后端搜索和 late-result invalidation。
- [x] `T-AGENT-101` 按 `DES-AGENT-047` 完成 session index shared/preload/IPC/renderer wiring 和 7 locales，不向 renderer 暴露 root、cursor、digest 或 transcript body。
- [x] `TEST-AGENT-066` 覆盖托盘 Provider Profile 分组、真实 verified-current 重校验、stale/error 降级、确认/取消/review/failure、同一 activation runtime、异步菜单刷新、late-result 销毁隔离、7 locales 和零内部错误泄漏。
- [x] `T-AGENT-102` 按 `DES-AGENT-048` 抽取并共享 Provider runtime，将 verified Provider Profile 投影与 quick switch 接入托盘；冲突进入 Agent 工作区，成功后从 SQLite 与原生 preview 重新加载，不建立第二 active-provider 状态源。
- [x] `TEST-AGENT-067` Agent CLI 只读诊断：canonical registry 派生、PATH/prefix-like 路径、版本归一化、candidate fallback、unsupported/missing/timeout/non-zero/超限、redaction、IPC 输入校验、诊断弹窗和 7 locales。
- [x] `T-AGENT-103` 实现 `DES-AGENT-049` 的 Agent CLI 只读检测、版本诊断和维护弹窗；不提前开放 install/update 写操作。
- [x] `TEST-AGENT-068` OpenClaw CLI 证据回归：canonical registry 仅声明 `openclaw --version` 和官方 evidence，维护能力保持 `partial`，不得把官方 install/update 命令误报为已实现生命周期。
- [x] `TEST-AGENT-069` Provider 工作台当前状态回归：workspace 与 tray 复用同一 verified-current projection；verified 显示当前标记并禁用重复激活，none/stale/unavailable 不误报当前；成功激活后重新读取原生状态；IPC 仅返回 platform/status/profile id/timestamp，7 locales 完整。
- [x] `T-AGENT-104` 将 OpenClaw 官方只读版本合同接入 `DES-AGENT-049`；复用既有诊断服务、IPC 和 UI，不增加第二 CLI inventory，也不执行安装、更新或 Gateway 命令。
- [x] `T-AGENT-114` 按 `DES-AGENT-059` 为 OpenCode 接入显式 review/confirm/apply/verify/rollback 更新流程；命令只来自 canonical registry，计划由 main 持有并绑定 renderer，失败仅返回稳定脱敏结果。安装与其他 CLI 更新仍留在 `T-AGENT-029`。
- [x] `TEST-AGENT-081` Codex npm 更新回归：canonical registry、npm/Node version-manager 来源允许列表、Homebrew/standalone/system/unknown 拒绝、npm 缺失、不可变 review plan、固定参数、同 executable/version 前置条件、same-path verify、精确版本 rollback、部分失败、重放/renderer ownership 和脱敏。
- [x] `T-AGENT-118` 按 `DES-AGENT-063` 为 npm-managed Codex 接入显式 review/confirm/apply/verify/rollback；不得把 Homebrew、standalone 或模糊来源误报为可更新，不增加第二 CLI inventory。
- [x] `TEST-AGENT-082` Qwen 深分页详情回归：300+ native JSONL 元数据、200 条后会话可读、256 条元数据上限、cache miss fallback、路径重新校验、软链接逃逸和 transcript 零持久化。
- [x] `T-AGENT-119` 按 `DES-AGENT-064` 为 Qwen live session adapter 增加有界进程内 metadata continuity；不得扩大 transcript 所有权、跳过 runtime realpath 校验或建立第二 session store。
- [x] `TEST-AGENT-083` Qwen npm 更新回归：canonical registry、npm/Node version-manager 来源允许列表、standalone/Homebrew/source/system/unknown 拒绝、npm 缺失、不可变计划、固定参数、同 executable/version 前置条件、精确版本回滚、部分失败和脱敏。
- [x] `T-AGENT-120` 按 `DES-AGENT-065` 为 npm-managed Qwen Code 接入 review/confirm/apply/verify/rollback；不得宣称 standalone、Homebrew、source build 或安装流程已受支持。
- [x] `TEST-AGENT-084` Agent Rules 快速编辑回归：按解析路径优先选择 built-in/custom/shared-root 规则，Agent 切换不闪现旧内容，缓存缺失最多强制扫描一次，缺失/失败可重试，并通过复用的 Rules 编辑器完成草稿、保存、快照和冲突工作流。
- [x] `T-AGENT-121` 按 `FR-AGENT-051` / `DES-AGENT-066` 将 Agent Rules 页从通用只读资产清单切换为现有 Rules 工作台的薄选择适配；不得创建第二 rule store、IPC、持久化或复制编辑器实现。
- [x] `TEST-AGENT-085` Rules 紧凑编辑回归：AI 改写和版本快照通过弹窗进入，成功/失败、空历史、来源标签、展开收起、选择预览、恢复和删除路径均可观察；新增弹窗组件达到 100% statement/branch/function/line coverage。
- [x] `T-AGENT-122` 按 `FR-AGENT-052` / `DES-AGENT-067` 将 Rules 编辑器收敛为单画布和紧凑头部动作，复用共享 Modal/Button/ConfirmDialog/Toast；不得增加第二编辑器、持久化、IPC 或独立历史状态源。
- [x] `TEST-AGENT-086` Agent 详情头部密度回归：身份/动作行不得包含固定最小高度，内容垂直居中，tab strip 不得再添加独立顶部空隙。
- [x] `T-AGENT-123` 按 `FR-AGENT-053` / `DES-AGENT-068` 移除 Agent 详情头部的固定空白带，同时保留动作换行、生命周期提示自然增高和现有 tab 可访问性。
- [x] `TEST-AGENT-087` Rules 编辑画布密度回归：主编辑面不得使用外层 `p-6` inset，draft wrapper 不得带圆角或阴影，现有可编辑 textarea 和状态行保持可用。
- [x] `T-AGENT-124` 按 `FR-AGENT-054` / `DES-AGENT-069` 将 draft 和版本 diff 改为内容区直铺表面，移除重复卡片边缘而不改变 Rules 状态、持久化或交互合同。
- [x] `TEST-AGENT-088` Rules Markdown 编辑回归：复用 CodeMirror Markdown 语言和 keymap，覆盖语法表面、列表续行、父值同步不重复发射、只读切换、编辑/预览/分栏、源行语义双向滚动、应用内目录跳转、回到顶部、折叠箭头居中、book 预览图标与七语言可访问标签。
- [x] `T-AGENT-125` 按 `FR-AGENT-055` / `DES-AGENT-070` 用已有共享 CodeMirror 能力替换 Rules textarea，并以同一 draft 在工具栏最右侧、统计信息之后增加编辑/预览/分栏选择器；不得使用 eye 预览图标、增加编辑器依赖、第二 draft 状态或独立持久化。
- [x] `TEST-AGENT-089` AI 优化选择回归：覆盖多供应商 chat 模型过滤、默认模型、切换后的精确请求配置、legacy fallback、缺失凭据/空模型与失败不关闭弹窗。
- [x] `T-AGENT-126` 按 `FR-AGENT-056` / `DES-AGENT-071` 扩展 AI 优化弹窗并把选定模型传给现有 rewrite store/IPC 请求；不得修改全局默认或显示凭据。
- [x] `TEST-AGENT-090` 版本历史对比回归：覆盖空历史、有界展开、弹窗内切换快照、完整行 diff/无差异、中性图标来源元数据、恢复到 draft、删除确认和 editor 不被预览替换。
- [x] `T-AGENT-127` 按 `FR-AGENT-057` / `DES-AGENT-072` 将历史弹窗改为 master-detail 对比并删除 RulesManager 的临时版本预览状态；不得建立第二历史事实源。
- [x] `TEST-AGENT-091` 规则文件定位回归：覆盖 exact file path、bridge 缺失、Promise rejection 和 shell failure 均可观察，且不修改 draft。
- [x] `T-AGENT-128` 按 `FR-AGENT-058` / `DES-AGENT-073` 通过已有 shell boundary 精确 reveal 当前规则文件并补齐错误反馈；不得增加 IPC。
- [x] `TEST-AGENT-092` Agent 资产视觉与顺序回归：覆盖 Skills/MCP/Plugins 连续排列、Qwen Definitions 不拆散资产组、MCP/Plugin 共用有界双列卡片网格，以及 Plugin 使用 `PlugIcon`。
- [x] `T-AGENT-129` 按 `FR-AGENT-059` / `DES-AGENT-074` 统一 MCP/Plugin 与 Skill 的卡片语言并调整 tab 顺序；继续复用 owning-domain inventory，不增加 store、IPC、持久化或伪动作。
- [x] `TEST-AGENT-094` Agent family 分组回归：验证 Hermes 与 OpenClaw/QClaw 同属 Claw 分组，Code / Work 平台仍保持独立，规则排序与设置页复用同一分类策略。
- [x] `T-AGENT-131` 按 `FR-AGENT-061` / `DES-AGENT-076` 将 Hermes 加入显式 Claw family registry；保持独立 platform id、根目录、能力声明和规则文件路径，不引入产品别名或兼容性推断。
- [x] `TEST-AGENT-095` 按 `FR-AGENT-062` 覆盖五个本地 Claw 平台的独立 registry id、Claw 分组、能力 planned/partial 状态、兼容根目录候选和真实品牌图标资产；先完成红测再接入实现。
- [x] `T-AGENT-132` 按 `FR-AGENT-062` / `DES-AGENT-077` 接入 CoPaw、AutoClaw、NanoClaw registry、路径候选、Claw family 分类、能力声明、官方图标与稳定资产文档；不伪造 Provider/Session/Usage/CLI/MCP/Rules 适配器。
- [x] `T-AGENT-105` 按 `DES-AGENT-050` 将 Provider 工作台接入与托盘共用的 verified-current query；先完成 `TEST-AGENT-069` 红测，再补 shared/IPC/preload/store/UI 与 7 locales，不建立第二 active-provider 状态源。
- [x] `T-AGENT-106` 按 `FR-AGENT-045` / `DES-AGENT-051` 将 Provider endpoint 固化为无凭据公共元数据；先完成 `TEST-AGENT-070` 红测，再接入 shared validator、SQLite create/update/read、Profile 表单和 7 locales；不静默迁移旧行，不引入第二 credential store。
- [x] `T-AGENT-107` 按 `FR-AGENT-046` / `DES-AGENT-052` 将 Provider public JSON validator 接入 Profile config、model mapping、audit snapshot 的 SQLite write/read 与 baseline recovery；先完成 `TEST-AGENT-071` 红测，不迁移旧 unsafe row，不扩展凭据权限。
- [x] `T-AGENT-108` 按 `FR-AGENT-047` / `DES-AGENT-053` 为 Session metadata refresh 增加 pre-scan、分页和 commit 前取消屏障，并完成精确 10,000 条真实 SQLite 压力回归；不扩展 transcript 所有权、同步或备份范围。
- [x] `TEST-AGENT-073` 覆盖 Provider Profile 可移植备份的严格格式校验、容量限制、凭据与设备本地引用排除、真实 SQLite 导出/事务恢复/故障回滚、同设备与跨设备 secret readiness、IPC/preload、完整桌面备份接线、旧备份兼容和 transcript/runtime 排除。
- [x] `T-AGENT-109` 按 `FR-AGENT-048` / `DES-AGENT-054` 将 Provider Profile、model mapping 和 redacted snapshot 接入完整桌面备份；main process 保持 secret 与本机 backup ref 所有权，旧备份不清空 Agent 数据。本批不包含 Agent 选择性导出、session source preference 或跨设备路径修复。
- [x] `TEST-AGENT-074` 覆盖选择性导出的 Agent scope 开关、关闭时不查询 main、Full Backup/升级前备份始终启用、7 locales 文案与键盘可操作 selector。
- [x] `T-AGENT-110` 按 `FR-AGENT-049` / `DES-AGENT-055` 将 Agent scope 接入选择性 ZIP、Full Backup 和升级前备份，修复用户可见完整备份遗漏 Provider Profile 的差异；不复制 Settings 或 owning-domain 资产。
- [x] `TEST-AGENT-075` 覆盖 session source preference 的旧格式兼容、严格格式/容量/重复校验、绝对路径与 runtime 数据排除、当前设备根目录重绑定、unsupported 报告和 session 写入失败时的整段事务回滚。
- [x] `T-AGENT-111` 按 `FR-AGENT-050` / `DES-AGENT-056` 将有界 session enabled preference 接入唯一 Agent 备份格式，复用现有 session descriptor 和 SQLite owner 完成跨设备路径重绑定，不备份 index/transcript/runtime。
- [x] `T-AGENT-100` 固化 CC Switch 复用边界：以 MIT `v3.18.0` 为已审计证据，允许按组件复用公开工作流、协议和小型独立实现；每次源码级复用必须记录上游路径、tag/commit、许可证、PromptHub ownership 与安全/回归验证，禁止把外部 checkout 或整套 Tauri/Rust/SQLite/UI 子系统复制进应用 `public/` 或发行包。本批未引入 CC Switch 运行时代码。
- [x] `T-AGENT-020` 接入 desktop main IPC、preload `agent` domain API 和 renderer query/action store。（config/model/session、Provider Profile CRUD、import/preview/activation main IPC/preload 与 Provider Profile renderer query/action store 已完成；具体 UI 由 `T-AGENT-021`/各平台 adapter 任务按 capability 接入）
- [x] `T-AGENT-021` 按 `ui-design.md` 和 `assets/agent-workbench-overview.png` 实现所有 Agent 共用的一级工作区和 detail shell：Overview、Provider & Model、Skills、MCP、Rules、Plugins、Config Files、Sessions、Usage、Maintenance；仅由 capability state 和已解析路径控制可用性，不引入 Assets 二级入口。
- [x] `T-AGENT-021A` 启用 allowlisted Config Files 页：补齐首批已验证平台配置路径、复用受限文件编辑器、打开 Agent 根目录、禁止结构性文件变更且不创建版本历史。
- [x] `T-AGENT-021B` 将 Agents 的桌面首页默认位置设为第二位，并兼容旧默认配置而不覆盖用户自定义排序。
- [x] `T-AGENT-022` 实现两个 verified session adapters、增量索引、搜索、只读 viewer 和 resume command。（Claude、Gemini 已完成显式 opt-in 的持久化 metadata index、增量复用、后端搜索、live-read viewer 与 resume；精确 10,000 条 SQLite 压力和取消竞态由 `TEST-AGENT-072` 覆盖。外部 transcript 删除不在本任务范围。）
- [x] `T-AGENT-023` 扩展 backup/export/import 格式、验证、恢复顺序和旧格式兼容。（`T-AGENT-109` / `110` / `111` 已完成 Provider Profile、model mapping、redacted snapshot、secret readiness、Agent 选择性/完整 ZIP scope、有界 session enabled preference、当前设备路径重绑定和旧格式兼容；`TEST-AGENT-014` 已闭合。）
- [x] `T-AGENT-024` 扩展托盘 Agent/provider 快速切换并复用统一 activation service。
- [x] `T-AGENT-025` 补齐 7 locales、可访问性、窄窗口、长文本和大数据量回归。（7 locales、tab/row 语义、响应式基础、60 Agent、120 Provider Profile、10,000 session metadata 和 1,000 Agent 资产有界渲染均已完成）
- [x] `T-AGENT-112` 按 `DES-AGENT-057` 为 Agent sidebar 和 Provider Profile master list 接入已有 `@tanstack/react-virtual`，收敛 header 长文本/窄窗口布局并完成 `TEST-AGENT-076`；不得新增 Agent/Profile 事实源或持久化状态。
- [x] `T-AGENT-113` 按 `DES-AGENT-058` 为 Agent Skill 卡片与 MCP/Rules/Plugin inventory 增加共享有界分页，完成 1,000 资产 `TEST-AGENT-077`；不得复制 owning-domain 状态或改变资产操作对象。
- [x] `T-AGENT-115` 按 `DES-AGENT-060` 修复 Agent 切换后焦点滞留在 disabled tab 的键盘陷阱，并建立 Agent workspace 七语言 leaf-key 对齐回归；不新增 UI 状态、事实源或持久化。

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
- [x] `T-AGENT-026D` 将内置 `codex` 默认展示名统一为 Codex，并在 Codex 内置 Agent 编辑器中增加 Codex/ChatGPT 名称与图标独立偏好；ChatGPT 使用随应用打包的官方明暗 Blossom 资源，覆盖统一身份投影、主题切换、保存/取消/重置、7 locales 和 `TEST-AGENT-044` 持久化回归。
- [x] `T-AGENT-062` 完成 Qwen Code 官方能力、路径、scope、secret/runtime 排除项和 Qoder 分离边界调研；同步 proposal、delta spec、design、task、implementation 与稳定平台资产文档。
- [x] `T-AGENT-063` 实现内置 `qwen` registry、官方图标、`QWEN_HOME`/`QWEN_RUNTIME_DIR` 路径解析、Skills/SubAgents/MCP/Rules/Extensions/config/session capability adapters 与 7 locales；复用 owning domains，不建立重复资产事实源。Definitions 只读工作台已补齐 user/project SubAgents 与 Commands，不复制正文或建立第二事实源。
- [x] `T-AGENT-064` 先落地 `TEST-AGENT-036` 失败用例，再实现 Qwen Code adapters；完成 targeted unit/integration/E2E、backup/sync exclusion、`pnpm typecheck`、affected lint、全量 desktop 回归和稳定文档 converge。Qwen Provider、Session 与 Definitions 已进入真实 Agent workspace Electron E2E；Definitions targeted gate 通过 31 tests 且 changed modules 100% coverage；当前全量 desktop 通过 491 files / 4,432 tests。
- [x] `T-AGENT-071` 适配 Oh My Pi：接入 `oh-my-pi` registry、平台路径/图标 fallback、Skills/Rules/MCP/Plugin 资产派生、全局/项目 MCP presets、allowlisted config files 和有界只读 JSONL Sessions；完成 `TEST-AGENT-042` 与 desktop/shared/core 类型检查。Provider、Usage、凭据和插件安装保持 planned。
- [x] `T-AGENT-072` 按 `DES-AGENT-030` 实现 Oh My Pi `models.yml`/`config.yml` 非敏感 model adapter，接入 `partial` Provider & Model capability，完成 `TEST-AGENT-043`、依赖检查、类型检查与相关回归；已基于上游 `cc00ab161b2721e50d8a96a0dc9552abfd258b8b` 复核 `<root>/agent.db`、OAuth、多账户、broker 与 runtime/environment 凭据所有权，因此不实现完整 Profile endpoint/credential 投影、凭据写入、Quota 或插件包安装。
- [ ] `T-AGENT-027` 实现 Universal Provider 与显式 per-platform projections。
- [x] `T-AGENT-028` 实现 provider model refresh、quota/balance adapters 和 freshness semantics。Provider 连接探针实时读取受支持端点的模型清单并报告数量/目标模型可用性，不持久化第二份模型目录；Claude、Codex、Kimi、Antigravity、Gemini、Copilot 的 quota/balance adapters 使用 60 秒有界内存缓存、`fetchedAt` 与显式 `forceRefresh`，自定义 Provider 和无证据平台不发起伪造查询。
- [ ] `T-AGENT-029` 实现 Agent CLI detect/install/update/diagnose 的 plan/confirm/apply 流程。（只读 detect/diagnose 已完成；OpenCode update 已由 `T-AGENT-114` 完成。Install 与其他 CLI update 仍需逐平台官方安装来源、精确恢复合同和独立回归。）
- [x] `T-AGENT-030` 收口 session-derived usage summaries 与 evidence 分类。当前已验证 session adapters 只提供消息元数据/正文，没有可信 token 计数或价格字段，因此 session-derived usage 明确为 unsupported，不从消息数或文本长度估算；已交付用量只允许 `source: "provider"`，proxy evidence 属于范围锁定的独立高风险变更。
- [x] `T-AGENT-031` 实现 versioned `prompthub://` import preview/confirm，并完成 fuzz/security gate。首个允许对象为 Provider Profile；其他域在拥有独立 portable preview contract 前明确拒绝。
- [x] `T-AGENT-116` 按 `DES-AGENT-061` 交付 Provider Profile 深链切片：复用现有 Profile export/create 服务，不复制 CC Switch 子系统；完成 `TEST-AGENT-079`、targeted tests、typecheck、affected lint 与文档证据。
- [x] `T-AGENT-117` 按 `DES-AGENT-062` 交付 Qwen-only Definitions：主进程有界发现 user/project SubAgents 与 Commands、renderer-safe metadata、project id 路径解析、open 二次校验、专用 master-detail UI、7 locales 和 `TEST-AGENT-080`；不得建立定义 DB、复制 extension 子资产或同步定义正文。

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
- [x] `T-AGENT-048` 实现 Provider & Model tab 第三方 provider 区（列表/新增编辑对话框/删除守卫/设默认/测试）并完成 `TEST-AGENT-027`，补齐 7 locales；凭据编辑借鉴 CC Switch v3.18.0 的可用交互，但继续使用 PromptHub Profile + main-only safeStorage 边界，不复制上游组件或存储模型。
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

Registry、shell、allowlisted raw config、非敏感 model config 和只读 session 批次已进入实现。Kiro 已完成 `chat.defaultModel`、平台托管凭据、可见 Prompt/Assistant session 文本、macOS launch 和禁用 Power 直接分发的当前边界；多文件 steering 未伪装为单文件 Rules。Grok Build 已完成基于 `$GROK_HOME`/`~/.grok/config.toml` 公开合同的完整 Provider & Model adapter：支持三种直接协议、env-owned custom Provider、native session/inline auth 只读保留、main-only probe、加密备份、原子写、语义重读验证和失败回滚，不向 renderer 或 TOML 投影凭据。Amp 已校正为当前 `~/.config/amp` user root 和 Windows legacy fallback，并通过 owning MCP domain 管理 user/project settings 中的 literal `amp.mcpServers`；Provider、hosted threads/usage、raw Config 和 Plugin 文件系统安装没有被误报为 supported。Provider Profile 的 legacy secret 替换已按 DB-first compensation 顺序修复：清理旧 ref 失败时先恢复 Profile/mapping，再恢复 secret；若 DB 补偿失败则保留当前 Profile 仍引用的新 secret 并返回稳定 rollback error。Device-local session source/index schema、幂等迁移、full/incremental scan transaction、missing/parse-error 状态、annotation preservation、bounded query、取消 commit barrier 和 10,000 条规模回归已完成；它只保存 redacted metadata，不保存 transcript body。Claude/Gemini 已接入显式 opt-in 持久化索引，其余 verified adapter 继续使用有界 live reader，未被伪装为已持久化。Model config 仅更新平台原生默认模型字段，保留平台认证所有权；Claude、Codex、Gemini、Grok Build、Kimi Code、Kiro、OpenClaw、OpenCode、Qwen Code、Oh My Pi 的已验证 session 适配器只做有界读取、搜索和可用时的恢复命令。Windsurf 仅对 opt-in `~/.windsurf/transcripts/*.jsonl` 公开导出提供 partial、只读会话浏览，隐藏 code/tool/file payload，`resume` 保持为空，proprietary Cascade protobuf runtime 不解析。ChatGPT 仅是 `codex` 的展示身份，不改变会话根或 adapter。Kimi 已采用 `~/.kimi-code` current root，并对 `KIMI_CODE_HOME`、`KIMI_SHARE_DIR` 和 `~/.kimi` 提供兼容解析。Qwen Code 的 registry、官方图标、root、Skills、MCP、全局 Rules、Extensions、脱敏 model config 和 Sessions 已实现；Oh My Pi 使用 `~/.omp/agent`/`PI_CODING_AGENT_DIR`、`skills/`、`RULES.md`、`mcp.json`、项目 `.omp/mcp.json` 和有界 JSONL Sessions，`models.yml`/`config.yml` 的脱敏 model projection 也已实现。项目 SubAgent/Commands 专用管理、Kiro directory Rules/native Power import、Oh My Pi Usage/凭据/plugin installation、其余 adapter 的持久化索引资格和完整 Electron E2E 仍受各自后续门禁约束。Antigravity、Cursor 等未确认稳定本地 transcript 合同的平台继续保持 Sessions planned/disabled。其余平台的完整 Provider Profile 切换、凭据投影、删除/清理与同步仍受后续安全、fixture、回滚和性能 gate 约束。
