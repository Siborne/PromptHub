# Pi Model Catalog 适配设计

## 1. 目标

为内置 `pi` 平台(pi-coding-agent,本机 v0.83.0)的 Provider & Model 页补齐两个能力:

1. **展示当前有哪些模型**:合并内置模型目录与用户自定义模型,按 provider 展示完整清单、
   当前默认选择与凭据就绪状态。
2. **添加自定义模型**:向官方用户配置文件写入自定义 provider/model,无需重启即可在
   `/model` 中使用。

## 2. 官方文件契约(证据:`pi-coding-agent` 包 docs/models.md,本机 0.83.0)

| 文件 | 角色 | PromptHub 权限 |
| :--- | :--- | :--- |
| `~/.pi/agent/settings.json` | 用户选择:`defaultProvider` / `defaultModel` / `defaultThinkingLevel` | 读 + 受控写(既有管线) |
| `~/.pi/agent/models-store.json` | 内置模型目录缓存(带 `etag` / `checkedAt` / `lastModified`,上游刷新) | **只读**,永不写入 |
| `~/.pi/agent/models.json` | 用户自定义 provider/model,官方明确 "reloads each time you open /model" | **唯一写入目标** |
| `~/.pi/agent/auth.json` | 按 provider 的凭据(`{ "<id>": { "type": "api_key", "key": "..." } }`,0600) | 只读就绪状态,永不读值、永不写 |

`models.json` 官方结构:

```json
{
  "providers": {
    "<provider-id>": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "literal or $ENV_REF",
      "compat": { "supportsDeveloperRole": false, "supportsReasoningEffort": false },
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text", "image"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

- 自定义 provider 的 `baseUrl` + `api`(provider 或 model 级)必填;`apiKey` 可省略
  (由 `/login`/`auth.json`/CLI `--api-key` 提供),也可以是 `$ENV` 引用。
- 无凭据的模型会加载但在 `/model` 中不可用 — UI 必须区分"已就绪/缺凭据"。
- 用户 `models.json` 的同名 provider 会**覆盖/合并**内置目录中的该 provider。

## 3. 与 OpenCode 的异同

| | OpenCode | Pi |
| :--- | :--- | :--- |
| 主配置 | `opencode.jsonc`(provider 定义 + npm 包 + 模型字符串) | `settings.json` 只存选择 |
| 模型目录 | 模型内嵌在 provider 定义 | `models-store.json`(内置缓存)+ `models.json`(自定义)双层 |
| 凭据 | XDG `auth.json` | `~/.pi/agent/auth.json`,同构按 provider 存储 |

结构同构(JSON 配置 + 独立 auth.json),模型层不同:Pi 是 provider → 完整模型目录
(cost / contextWindow / compat / input 等元数据),OpenCode 是 provider → 模型字符串。

## 4. 读取(inspect)扩展

`inspectAgentModelConfig` 增加 pi 专用分支,依次读取 4 个文件:

1. `settings.json` → 当前 `defaultProvider` / `defaultModel` / `defaultThinkingLevel`。
2. `models-store.json` → 内置 provider 目录;过滤缓存元数据(`etag` / `checkedAt` /
   `lastModified` 不进入返回)。
3. `models.json` → 用户自定义 provider 目录。
4. `auth.json` → 每个 provider 的凭据就绪布尔值(只统计 key 存在性,永不读值)。

合并规则:内置 ∪ 自定义;自定义 provider 与内置同 id 时合并 models 并标记 override;
返回中区分 `source: "built-in" | "custom"`。

返回契约扩展(`packages/shared/types/agent.ts`,`AgentModelConfiguration` 增加可选字段,
其他平台不受影响):

```ts
export interface AgentModelCatalogEntry {
  id: string;
  name?: string;
  api?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  source: "built-in" | "custom";
}

export interface AgentModelCatalogProvider {
  id: string;
  models: AgentModelCatalogEntry[];
  credentialReady: boolean;
  source: "built-in" | "custom";
  /** 脱敏端点(去 userinfo/query/fragment);平台默认端点为 null */
  endpoint?: string | null;
}

// AgentModelConfiguration 新增:
modelCatalog?: AgentModelCatalogProvider[];
```

`availableModels` 保持既有语义(当前默认模型),目录走 `modelCatalog`,避免破坏既有消费方。

## 5. 写入

| 操作 | 目标文件 | 管线 |
| :--- | :--- | :--- |
| 切换默认模型 | `settings.json` 的 `defaultProvider` / `defaultModel` | 既有 backup → 原子写 → 重读验证 → 回滚 |
| 添加自定义模型 | `models.json` 的 `providers.<id>.models[]` 追加 | 同一管线;新 provider 需 baseUrl/api 校验 |
| 添加自定义供应商 | `models.json` 新增 `providers.<id>`(baseUrl/api/models) | 同一管线;缺失文件时创建 |
| 移除自定义模型/供应商 | `models.json` 移除条目;空 provider 一并移除 | 同一管线 |
| 配置凭据(可选) | `auth.json` 投影 `{ "<id>": { "type": "api_key", "key": "..." } }` | Codex 托管密钥同构管线:0600、原子写、备份、回滚 |

- 只允许写 `models.json` 与 `auth.json`;`models-store.json` 只读。
- 写入只触达目标条目,保留其他 provider、未知字段与注释(在 JSONC 解析能力范围内)。
- 凭据三种来源(官方契约):PromptHub 托管密钥投影到 `auth.json`(默认可选用)、
  `models.json` 的 `apiKey: "$ENV"` 环境变量引用、或留给用户自行 `/login`。PromptHub
  不把明文密钥写进 `models.json`,也不写进 PromptHub 自己的 SQLite/备份/导出。
- **“确保 pi 能调用”**:模型可用的官方条件是凭据就绪(auth.json 条目 / apiKey /
  $ENV)。添加供应商流程完成后,重读 models.json + auth.json 验证条目与凭据就绪,
  才返回成功;缺凭据时返回明确的 guided 状态。

## 6. 安全边界

- `auth.json` 永不读值、永不写;仅返回 `credentialReady` 布尔值。
- 返回给 renderer 的目录脱敏:provider `apiKey` 内联值不出现在任何 payload。
- `models.json` 读写遵循路径校验(realpath、拒绝软链接越界、空字节、超大文件上限)。
- 自定义模型 id 校验:非空、长度上限、无控制字符;provider id 同 registry 规则。

## 7. UI

Pi 的 Provider & Model 页按 pi 原生模型目录组织(与 `/model` 列表一致):

- **左栏:每个供应商一行**。内置供应商(deepseek / kimi-coding / openai-codex /
  opencode-go 等,来自 models-store.json)与自定义供应商(来自 models.json)各占一行,
  显示名称、模型数、凭据就绪态、当前默认标记;顶部 `[+ 添加供应商]`。
- **右栏:所选供应商的模型列表**。每个模型显示 id/name/reasoning/contextWindow,
  可“设为默认”(写 settings.json 的 defaultProvider/defaultModel);自定义供应商的
  模型可移除;`[+ 添加模型]` 向所选 provider 追加模型。
- **添加供应商表单**:provider id、baseUrl、api(四种官方类型)、模型清单、凭据方式
  (托管密钥 → auth.json / $ENV 引用 / 稍后自行登录),提交走备份/回滚管线并重读验证,
  确保 pi 立即可调用。
- 当前默认选择始终展示;切换/添加结果内联反馈。

## 8. 实施批次

| 批次 | 内容 | 验证 |
| :--- | :--- | :--- |
| P1 | shared 契约扩展(`modelCatalog` 可选字段)+ pi inspect 读取 4 文件 + 脱敏合并 | 真实 fixture:settings/models-store/models.json/auth 的合并、缺失、畸形、超限、软链接、Unicode |
| P2 | 写入:添加/移除自定义模型与 provider(backup/atomic/verify/rollback) | 失败注入、并发修改、重读验证、未知字段保留、凭据不外泄 |
| P3 | UI:provider 列表 + 模型目录 + 添加自定义模型表单 + 设为默认 | renderer 测试 + 7 locales |
| P4 | 全量回归 + capability 从 partial 提升评估 + 文档 converge | `pnpm typecheck`、`pnpm test:run`、affected lint |

## 9. 决策记录

- `[确认]` 左栏为每个供应商一行(内置 + 自定义),与 pi `/model` 列表一致。
- `[确认]` 自定义模型/provider 只写 `models.json`;`models-store.json` 是缓存,只读。
- `[确认]` 凭据三选:托管密钥投影 `auth.json`(Codex 同构)、`$ENV` 引用、用户自行 `/login`;
  明文密钥不进 PromptHub SQLite/备份/导出,也不写进 `models.json`。
- `[确认]` 添加完成后重读验证条目与凭据就绪,确保 pi 可调用;缺凭据返回 guided 状态。
- `[确认]` 目录合并遵循官方“用户 models.json 覆盖内置同名 provider”语义。
- `[确认]` 契约扩展走可选字段,不影响其他平台的既有消费方。
