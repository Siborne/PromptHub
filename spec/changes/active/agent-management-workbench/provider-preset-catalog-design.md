# Provider & Model 预设目录与协议映射设计

## 1. 目标

Provider & Model 页保留左右分栏(左:供应商列表;右:具体配置),但配置体验对齐
CC Switch 的核心能力:**预制供应商数据 + 协议映射**。新增供应商时不再从空表单开始手填
字段,而是从平台化的预设目录中挑选,自动带出名称、端点、协议、环境变量名、默认模型、
图标与分类;密钥仍由 PromptHub 的 main-only secret store 管理。

本设计只借鉴 CC Switch(参考 checkout:
`/Users/lingxiaotian/Programs/public/cc-switch`,**v3.19.2**,MIT)的预设数据组织方式和交互
契约,不在 PromptHub 内复制其组件、数据模型或密钥存储方式。边界遵循
`T-AGENT-100`:选择性参考 + 记录来源 + PromptHub 边界内独立实现。

## 2. 页面布局(左右分栏)

```
┌────────────────────────────────────────────────────────────┐
│  Provider & Model                                           │
├──────────────┬─────────────────────────────────────────────┤
│ [+ 新增] [导入] │  配置表单(选中供应商后直接进入)             │
│ ┌──────────┐ │  ┌─────────────────────────────────────────┐ │
│ │ 供应商 A  ✓ │ │  名称 / 供应商类型(预设选择器)             │ │
│ │ 供应商 B    │ │  协议 / 端点                              │ │
│ │ 供应商 C    │ │  模型映射(主模型 / 上游模型 / 上下文)      │ │
│ └──────────┘ │ │  凭据引用(managed / environment)          │ │
│              │ │  ── 操作 ──                               │ │
│              │ │  [测试连接] [测试模型] [⋯] [取消] [保存]     │ │
│              │ └─────────────────────────────────────────┘ │
└──────────────┴─────────────────────────────────────────────┘
```

- 左侧:供应商列表(名称 + 主模型 + current 文字标记),顶部提供 `[+ 从 PromptHub 导入]`
  与 `[+ 新增自定义供应商]`；列表右键复用这两个入口。当前原生配置只读展示,不提供导入
  或转为可编辑供应商的入口,侧栏底部不再固定新增操作。
  列表行不承载彩色徽章和卡片阴影,保持与设计 token 一致的轻量视觉。
- 右侧:选中供应商即进入配置表单(新增时先出现预设选择,选定后进入同一表单)。
  表单底部是测试与操作区,不再保留独立的只读详情层。
- 激活动作保留 PromptHub 现有管线:无冲突时一键直接切换(备份 → 原子写 → 重读验证 →
  失败回滚);检测到外部修改冲突时进入逐字段冲突确认。

## 3. 预设目录数据定义

**范围决策(2026-08):预设目录不吸纳 CC Switch 的赞助商/推广预设。** 目录只收录各
Agent 平台的**官方配置**与有官方证据的供应商(官方文档/官方端点/官方模型名可核验);
带推广链接、激励码或非官方推断端点的条目一律不收。CC Switch 的 `codexProviderPresets.ts`
含 68 个条目,其中大量为 sponsor/partner(带 `aff=` 推广链接),PromptHub 首批仅从中提取
官方/官方兼容且无推广链接的条目作为证据参考。

预设目录是纯静态的版本化常量,位于 `packages/shared`(跨桌面/CLI/web 可复用),只含
**非敏感**默认值,不写入数据库。密钥、token、OAuth 数据永远不进入预设。

```ts
// packages/shared/constants/provider-presets.ts
export type AgentProviderPresetCategory =
  | "official" // 官方直连
  | "cn" // 国内官方/兼容
  | "third-party" // 第三方兼容
  | "partner"; // 合作方(排序优先)

export interface AgentProviderPreset {
  /** 所属 Agent 平台 id,如 claude / codex / gemini / grok / kimi / qwen / opencode */
  platformId: string;
  /** 显示名;有 nameKey 时用 i18n 本地化 */
  name: string;
  nameKey?: string;
  /** 供应商主页 */
  websiteUrl: string;
  /** 获取 API Key 的引导链接(可空) */
  apiKeyUrl?: string;
  /** 供应商类型,如 anthropic / openai / moonshot / xai / qwen / deepseek */
  providerKind: string;
  /** 协议,见第 4 节协议映射表 */
  protocol:
    | "platform-native"
    | "anthropic-messages"
    | "openai-chat"
    | "openai-responses"
    | "google-generative-ai";
  /** 默认端点;null = 走平台原生默认端点 */
  endpoint: string | null;
  /** 平台特定的非敏感配置(如 providerId、envKey、nativeAuthOwnership) */
  config: Record<string, unknown>;
  /** 默认模型映射(routeKey -> modelId + 参数) */
  modelMappings: Array<{
    routeKey: string; // primary / secondary
    modelId: string;
    parameters?: Record<string, unknown>;
  }>;
  /** 凭据引用方式 */
  credential: {
    source: "managed" | "environment";
    /** 环境变量名(environment 时必填),如 ANTHROPIC_API_KEY / DASHSCOPE_API_KEY */
    envKey?: string;
    /** 平台原生认证字段名,如 claude 的 ANTHROPIC_AUTH_TOKEN 二选一 */
    apiKeyField?: "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN";
  };
  category: AgentProviderPresetCategory;
  /** 展示用图标与主题(中性,不携带第三方商标之外的品牌资产) */
  icon?: string;
  iconColor?: string;
  theme?: { backgroundColor: string; textColor: string };
  /** 端点候选(测速/地址管理用,可空) */
  endpointCandidates?: string[];
  /** 该预设是否依赖平台 OAuth(不提供明文密钥输入) */
  requiresOAuth?: boolean;
}
```

### 3.1 与 CC Switch 预设结构的对应

| CC Switch 字段                                                    | PromptHub 字段                       | 差异说明                                                         |
| :---------------------------------------------------------------- | :----------------------------------- | :--------------------------------------------------------------- |
| `name` / `nameKey`                                                | `name` / `nameKey`                   | 相同                                                             |
| `websiteUrl` / `apiKeyUrl`                                        | 同左                                 | 相同                                                             |
| `settingsConfig`(env/配置 JSON 或 Codex TOML 字符串)              | `config` + `endpoint` + `credential` | PromptHub 拆分为结构化字段,密钥字段只留"引用方式",绝不携带真实值 |
| `apiFormat`(anthropic/openai_chat/openai_responses/gemini_native) | `protocol`                           | 见第 4 节映射                                                    |
| `category`(official/cn_official/third_party/...)                  | `category`                           | 归一为 4 类                                                      |
| `apiKeyField`                                                     | `credential.apiKeyField`             | 相同                                                             |
| `templateValues`(动态模板变量)                                    | 不引入                               | PromptHub 用表单字段直接表达,不引入模板占位符层                  |
| `endpointCandidates`                                              | `endpointCandidates`                 | 相同                                                             |
| `theme` / `icon` / `iconColor`                                    | 同左                                 | 只取中性色与品牌图标                                             |
| `auth`(Codex auth.json)                                           | 不引入                               | 真实凭据永远不进预设                                             |
| `modelCatalog`(模型目录)                                          | `modelMappings`                      | PromptHub 只带默认映射,不复制完整模型目录                        |

## 4. 协议映射表

PromptHub 的协议是既有契约(`packages/shared/utils/agent-deep-link.ts` 允许列表),预设目录
直接复用,不新增协议字符串。

| CC Switch `apiFormat` | PromptHub `protocol`   | 说明                                    |
| :-------------------- | :--------------------- | :-------------------------------------- |
| (官方预设,无)         | `platform-native`      | 走平台自身默认端点/登录态,不写 base_url |
| `anthropic`           | `anthropic-messages`   | Anthropic Messages API                  |
| `openai_chat`         | `openai-chat`          | OpenAI Chat Completions                 |
| `openai_responses`    | `openai-responses`     | OpenAI Responses API                    |
| `gemini_native`       | `google-generative-ai` | Gemini generateContent API              |

### 4.1 平台级默认映射(providerKind → 默认 protocol)

每个平台已有真实 adapter 的 providerKind 选择器(renderer 表单常量)保持为唯一事实源,
预设目录复用同一映射:

| 平台     | providerKind → protocol                                                                                                                                                                           |
| :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| claude   | `anthropic` → `anthropic-messages`(Claude 只支持原生 anthropic 端点;不做格式转换)                                                                                                                 |
| codex    | `openai` → `openai-responses`;第三方兼容 → `openai-chat` / `openai-responses`                                                                                                                     |
| gemini   | `google-gemini` → `google-generative-ai`;`platform-native`(Vertex/ADC/OAuth)                                                                                                                      |
| grok     | `openai-compatible` → `openai-chat`;`openai-responses`;`anthropic` → `anthropic-messages`;`grok` → `platform-native`                                                                              |
| kimi     | `kimi` → `openai-chat`;`openai` → `openai-chat`;`openai_responses` → `openai-responses`;`anthropic` → `anthropic-messages`;`google-genai` → `google-generative-ai`;`vertexai` → `platform-native` |
| qwen     | `openai` → `openai-chat`;`anthropic` → `anthropic-messages`;`gemini` → `google-generative-ai`;`vertex-ai` / `qwen-oauth` → `platform-native`                                                      |
| opencode | `openai-compatible` → `openai-chat`;`openai` → `openai-responses`;`platform-native` → `platform-native`                                                                                           |

**边界**:CC Switch 通过本地代理做协议转换(如 Claude 侧把 openai_chat 转 anthropic)。
PromptHub 第一阶段**不做协议转换**(本地代理是独立高风险变更,见 proposal "Separately
Gated")。因此 Claude 平台的预设只允许 `anthropic-messages` / `platform-native` 两种协议,
`openai-chat` 等协议不进入 Claude 预设;Codex 的第三方兼容预设要求上游真实支持所选
wire protocol,preset 不伪装转换能力。

## 5. 各平台预制清单(首批范围)

**首批范围 = 每个 Agent 的官方配置 + Codex(ChatGPT)添加模式。** 按用户确认的优先级
逐平台推进,第一个平台是 **Codex/ChatGPT**。

| 平台                       | 官方预制(首批)                                                    | 说明                                                        |
| :------------------------- | :---------------------------------------------------------------- | :---------------------------------------------------------- |
| codex(ChatGPT)             | OpenAI Official(platform-native,ChatGPT 登录)                     | 添加模式下官方登录保持可用,可追加第三方 `model_providers.*` |
| claude                     | Anthropic Official(platform-native)                               | 官方直连;第三方 anthropic 兼容端点可手填                    |
| kimi                       | Kimi Official(`kimi` provider)                                    | 官方 `config.toml` 契约                                     |
| opencode                   | 官方 provider 包(`openai-compatible` / `openai`)+ platform-native | 官方 npm 包契约                                             |
| google(gemini/antigravity) | Google Official(platform-native,OAuth)                            | 企业/付费 API 兼容                                          |
| copilot                    | GitHub Copilot(platform-native)                                   | model-only partial 边界                                     |

每个预设的来源记录:上游官方文档链接、端点、模型默认值、凭据字段、获取 API Key 链接。
**只收录有官方证据的供应商**;不确定的端点/模型不猜测,宁可少一个预设也不能写错端点。

**Codex 添加模式(首批核心)**:

- OpenAI Official 预制对应内置 `openai` provider 与 ChatGPT 登录态,切换第三方时
  `auth.json` 与 `openai` 内置 provider **保持零改动**(PromptHub `TEST-AGENT-025` 已钉死)。
- 第三方供应商追加为 `[model_providers.<id>]` 条目,凭据走 `experimental_bearer_token`
  (managed,main-only secret store)或 `env_key`(环境变量),二者互斥。
- 切回官方时如原生存留第三方 key 残渣,按平台契约清理,避免向官方端点发送错误密钥。
- 证据来源:CC Switch v3.19.2 `src-tauri/src/codex_config.rs`(累加 `model_providers`
  表 + 官方切换清理 stale third-party auth)与 `src/config/codexProviderPresets.ts`。

## 6. 配置流程

### Flow A:新增供应商(预设驱动)

1. 左侧顶部 `[+ 新增自定义供应商]`，或在供应商列表右键选择同名操作 → 右侧进入预设选择状态。
2. 预设选择器按 `platformId` 过滤当前平台,展示卡片:图标、名称、分类、端点、协议、
   API Key 引导链接;支持搜索。
3. 选择预设 → 自动填充表单:`name / providerKind / protocol / endpoint / config /
modelMappings / credential`。
4. 用户在表单补齐真实值(主要是密钥或环境变量引用),校验通过后保存。
5. 保存成功后供应商进入列表,可立即执行测试/激活。

### Flow B:从 PromptHub 导入供应商

1. 左侧顶部 `[+ 从 PromptHub 导入]`，或在供应商列表右键选择同名操作 → 选择与当前 Agent 兼容的 PromptHub 供应商。
2. 供应商行复用 Model Services 品牌图标；模型选择器按模型 id 展示模型家族图标与名称。
3. 协议选择器只列出 PromptHub 上游 API 与目标 Agent 原生 writer 的直接交集。官方
   OpenAI 端点优先 Responses，第三方 OpenAI-compatible 端点优先 Chat/Completions；
   CC Switch 的协议转换代理不进入本流程。
4. 确认时提交供应商、模型和协议身份；main 重新计算交集并拒绝过期或篡改的协议，然后
   创建独立供应商。不得读取或复制当前 Agent 原生配置。

### Flow C:编辑

- 选中供应商 → 右侧表单直接可编辑;取消丢弃,保存走 `expectedUpdatedAt` 乐观并发。

### Flow D:切换(激活)

- 无冲突:一键直接激活(备份 → 原子写 → 重读验证 → 失败回滚),结果内联显示。
- 检测到原生配置被外部修改:进入逐字段冲突确认;拒绝则不写原生文件。

## 7. 安全与边界

- 预设目录只含非敏感默认值;真实密钥、token、OAuth 数据永远不进预设、不进 DB、不进
  renderer payload、不进日志与备份。
- 凭据仍是 write-only:`managed` 由 main-only secret store 持有并投影;
  `environment` 只写环境变量名。
- 协议转换/本地代理/故障转移不在本设计范围;预设不声明平台不支持的能力。
- 预设目录是版本化 shared 常量,旧版本 App 忽略未知字段;不产生迁移。

## 8. 实施批次与验证

| 批次 | 内容                                                               | 验证                                                                  |
| :--- | :----------------------------------------------------------------- | :-------------------------------------------------------------------- |
| 1    | shared 预设目录数据结构 + **Codex/ChatGPT 官方预制与添加模式**数据 | shared 单测:结构校验、敏感键拒绝、协议白名单、Codex 官方/添加模式映射 |
| 2    | 右侧预设选择器 UI(列表/搜索/选择即填充)                            | renderer 测试:搜索、分类、空态、选择填充、取消零写入、7 locales       |
| 3    | 其余 Agent 官方预制(Claude/Kimi/OpenCode/Google/Copilot)补齐       | 逐平台:预设 → 表单填充 → 保存 → 激活 → 回滚 回归                      |
| 4    | 左侧列表视觉收敛(去徽章/去卡片阴影)                                | 既有 workbench 测试更新 + 视觉回归                                    |
| 5    | 全量回归、文档同步、converge                                       | `pnpm typecheck`、`pnpm test:run`、affected lint                      |

设计决策记录:

- `[确认]` Provider & Model 保留左右分栏;右侧为唯一配置面,不保留独立只读详情层。
- `[确认]` 借鉴 CC Switch 的预制数据与协议映射,不复制其组件/数据模型/密钥存储。
- `[确认]` 无冲突时一键激活,有冲突时逐字段确认(维持 proposal 的回滚安全边界)。
- `[确认]` 预设目录只收录各 Agent 官方配置与有官方证据的供应商,不吸纳赞助商/推广预设。
- `[确认]` 首批平台顺序:Codex/ChatGPT 优先,逐个推进 Claude / Kimi / OpenCode / Google / Copilot。
- `[确认]` Codex 必须支持添加模式:官方登录保持可用,第三方供应商以 `model_providers.*`
  追加,凭据 managed/env 二选一,切回官方清理残留第三方密钥。
