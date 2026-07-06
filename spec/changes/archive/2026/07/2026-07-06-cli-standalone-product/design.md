# Design

## Target Shape

```text
apps/
  desktop/
  web/
  cli/

packages/
  shared/
  db/
  core/
```

## Phase 1 Architecture

### `packages/core`

先承载最小共享核心：

- `runtime-paths.ts`
- `database.ts`
- `cli/run.ts`

其中：

- `runtime-paths.ts` 负责 PromptHub 工作区目录协议。
- `database.ts` 负责基于 runtime paths 初始化 `@prompthub/db`。
- `cli/run.ts` 承载当前 CLI 命令实现。

在 standalone CLI 继续扩能力时，优先补齐与 Prompt 基础资产管理直接相关、且底层 DB 已经支持的命令，而不是重复实现 desktop 独有工作流。

第一批 prompt 扩展以“基本提示词管理”闭环为目标：

- 基础读写：`list / get / create / update / delete / search / duplicate`
- 版本管理：`versions / create-version / delete-version / diff / rollback`
- 使用统计：`use`
- 标签管理：`list-tags / rename-tag / delete-tag`
- 更完整的字段输入：`systemPromptEn`、`userPromptEn`、`variables`、`images`、`videos`、`usageCount`、`lastAiResponse`

这些能力都直接复用 `PromptDB` 现有的 `getVersions()`、`createVersion()`、`deleteVersion()`、`rollback()`、`incrementUsage()`、`getAllTags()`、`renameTag()`、`deleteTag()`，避免额外引入新的持久化模型。

在 prompt 基础管理闭环之外，CLI 还需要覆盖最小可用的 folder 管理面，确保 prompt 的组织结构可以直接在 CLI 里维护：

- `folder list|get|create|update|delete|reorder`
- 直接复用 `FolderDB` 的 `create()`、`getById()`、`getAll()`、`update()`、`delete()`、`reorder()`
- 不额外引入树视图或复杂权限模型，先聚焦本地工作区的基本组织能力

接下来优先补一条真正可迁移的 CLI 数据流：`
workspace export/import`

- 先聚焦 prompt/folder/version 三类核心数据的 JSON 导出导入
- 复用现有 shared 类型与 `insert*Direct()` 能力
- 不把 desktop 特有的媒体、settings、rules、skills 打包恢复流程硬搬到 standalone CLI Phase 1
- 导入默认要求目标数据库为空，避免无提示覆盖；明确使用 `--force-clear` 时才允许清空现有 prompt/folder/version 数据后导入

在完成 prompt/folder/version 的 workspace 导出导入后，下一步是把 rules 读写能力带入 CLI。但 rules 当前仍主要驻留在 `apps/desktop/src/main/services/rules-workspace.ts`，依赖 desktop main 的 runtime-paths 与平台路径解析。

因此 rules CLI 的正确路径不是在 `run.ts` 里直接复写逻辑，而是先抽出 shared rules workspace service：

- 把规则文件扫描、读取、保存、项目规则创建/删除、版本删除、备份导入导出迁到 `packages/core` 或等价 shared 层
- desktop IPC 与 standalone CLI 共同复用该 service
- 先覆盖非 AI 的基础命令：`list / scan / read / save / add-project / remove-project / version-delete / export / import`
- AI rewrite 仍留在 desktop/main 或后续再抽，因为它依赖更重的 AI transport/config 组合

### `apps/cli`

只负责产品包装：

- `src/index.ts` 启动 CLI
- `bin/prompthub.cjs` npm bin 入口
- `vite.config.ts` 构建 CLI bundle
- `package.json` 脚本与发布元数据

### `apps/desktop`

不再承载 CLI 入口或打包物：

- desktop 主进程不再响应 `--cli`
- desktop 包不再导出 `bin/prompthub.cjs` 或 `out/cli`
- desktop 设置页只保留 standalone CLI 安装说明

## Shared Runtime Contract

抽离后 `packages/core/runtime-paths.ts` 需要成为工作区协议的单一来源，定义：

- appData
- userData
- data dir
- skills dir
- rules dir
- prompts dir
- assets dir

desktop 与 cli 必须调用同一实现。

## Migration Outcome

1. CLI 共享入口与安装编排已沉淀到 `packages/core`。
2. `apps/cli` 现在直接依赖 `packages/core`，作为唯一 CLI 产品入口。
3. `apps/desktop/src/cli/*` 与 `apps/desktop/src/main/desktop-cli.ts` 已删除，desktop main 不再承载 `--cli` 模式。
4. desktop 仍保留自己的恢复/升级逻辑，但不再承担 CLI 启动、打包或分发职责。

## Remaining CLI v1 Gaps

在 standalone CLI 完成产品拆分后，`prompt` / `rules` / `skill` 三组资源仍有一批“底层能力已存在、CLI 还未暴露”的缺口。

### Root

- 增加根级 `--version`
- 目的：
  - 让 desktop 设置页的 `prompthub --version` 检测链路真正成立
  - 让 standalone CLI 符合常见命令行产品约定

### Prompt

- 增加 `prompt copy <id> --var name=value [--var other=value]`
- 语义：
  - 按桌面端 `PROMPT_COPY` 语义对 `userPrompt` 做变量替换
  - 同时增加 usage count

- 增加 `visibility/scope` 参数支持
- 具体包括：
  - `prompt create --visibility private|shared`
  - `prompt update --visibility private|shared`
  - `prompt search --scope private|shared|all`
- 这部分不能只改 CLI 参数解析，必须同步补齐 `PromptDB.create/update/search` 的实际持久化和过滤。

### Rules

- 补齐版本快照可读性命令：
  - `rules versions <rule-id>`
  - `rules version-read <rule-id> <version-id>`
  - `rules version-restore <rule-id> <version-id>`
- 设计原则：
  - 不新增独立的 rules DB 写模型
  - 直接复用 `RulesWorkspaceService.readRuleContent()` 的 `versions`
  - `restore` 语义对齐桌面端：把快照内容恢复为当前 managed/target rule，并生成新快照

### Skill

- 补齐版本管理命令：
  - `skill versions <id|name>`
  - `skill create-version <id|name> [--note <text>]`
  - `skill rollback <id|name> --version <n>`
  - `skill delete-version <id|name> <version-id>`

- 补齐导出命令：
  - `skill export <id|name> --format skillmd|json`

- 补齐平台与安装状态命令：
  - `skill platforms`
  - `skill platform-status <id|name>`
  - `skill install-md <id|name> --platform <platform-id>`
  - `skill uninstall-md <id|name> --platform <platform-id>`

- 补齐本地 repo 同步与检查命令：
  - `skill repo-files <id|name>`
  - `skill repo-read <id|name> --path <relative-path>`
  - `skill repo-write <id|name> --path <relative-path> --content <text> | --content-file <file>`
  - `skill repo-delete <id|name> --path <relative-path>`
  - `skill repo-mkdir <id|name> --path <relative-path>`
  - `skill repo-rename <id|name> --from <old> --to <new>`
  - `skill sync-from-repo <id|name>`

- 补齐安全扫描命令：
  - `skill scan-safety <id|name>`
  - 首轮只支持扫描已安装 skill 的本地 repo / 内容
  - AI sidecar 配置作为可选参数，保持与 desktop safety scan 的输入契约一致

### AI

- 补齐桌面 AI 模型工作台的最小 CLI 管理面：
  - `ai providers`
  - `ai provider-add --provider <id> --api-key <key> --api-url <url> [--protocol openai|gemini|anthropic]`
  - `ai provider-delete <provider-id>`
  - `ai models`
  - `ai model-add --provider <provider-id> --model <model> [--type chat|image] [--vision] [--image-generation] [--reasoning]`
  - `ai model-delete <model-id>`
  - `ai routes`
  - `ai route-set <mainText|fastText|visionText|imageGeneration> <model-id>`
  - `ai route-clear <mainText|fastText|visionText|imageGeneration>`

- 数据边界：
  - standalone CLI 先落 `config/ai-models.json`，由 `packages/core/src/ai-config.ts` 管理。
  - 文件结构按桌面当前模型工作台语义组织：providers / models / modelRouteDefaults。
  - desktop `settings:get` 会合并这份 shared AI 配置，应用启动后 renderer settings store 会同步 providers / models / routes。
  - CLI 输出默认会遮蔽 `apiKey`，磁盘配置保留真实 key。

- 能力校验：
  - `visionText` 只能绑定 `chat + vision` 模型。
  - `imageGeneration` 只能绑定 image generation 模型。
  - 删除模型时只清理引用该模型的路由，不删除 provider。
  - 桌面读取 shared AI 配置时只做合并，不会因为没有 CLI 配置而覆盖已有 renderer 本地设置。

## Verification Strategy

- 以 `apps/cli/tests/run.test.ts` 为主，优先新增端到端命令级回归，而不是只补内部 helper 单测。
- 每增加一组命令，至少覆盖：
  - 成功路径
  - 缺失必填参数
  - `NOT_FOUND` / `USAGE_ERROR` 路径
- 对 `prompt visibility/scope` 这类跨命令 + DB 行为的补丁，需要额外加实际搜索/更新断言，避免只测 parser。
