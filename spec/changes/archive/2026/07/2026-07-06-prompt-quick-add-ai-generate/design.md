# Design

## Approach

本次在 renderer 侧做最小增强，直接扩展现有 `QuickAddModal`，不新增独立页面或新的 AI 场景配置。

### 1. 复用现有 quickAdd 模型配置

- 继续使用 `resolveQuickAddAnalysisConfig()` 解析 `quickAdd` 场景对应的 chat 模型。
- `AI Generate` 与现有“粘贴分析”共用同一套模型入口，避免设置面新增复杂度。

### 2. Quick Add 改为双模式

- 在 `QuickAddModal` 顶部新增模式切换：
  - `Analyze Existing`：粘贴已有 Prompt 内容，沿用现有“先创建、后分析回填”的路径。
  - `AI Generate`：输入需求描述，先请求 AI 生成结构化 Prompt 草稿，再一次性创建 Prompt。
- 保留同一个文件夹选择区与同一个 Prompt 类型选择区，减少认知切换。
- 在实现后进一步收窄弹窗密度：
  - 模式切换从双大卡片改为 segmented control
  - 文件夹选择从大网格改为紧凑下拉
  - 整个 modal 增加最大高度和内部滚动，避免内容过长时挤满屏幕
  - `Select` 下拉改为 portal + fixed 定位，避免被 modal 的滚动容器裁切

### 3. 结构化生成协议

- 在 `quick-add-utils.ts` 中新增生成模板函数与 JSON 解析函数。
- 生成模式要求 AI 只返回 JSON，字段包含：
  - `title`
  - `promptType`
  - `systemPrompt`
  - `userPrompt`
  - `description`
  - `suggestedFolder`
  - `tags`
- 如果用户已手动指定文件夹，优先使用手动选择；否则尝试把 `suggestedFolder` 匹配到现有文件夹。

### 4. 创建时机差异

- `Analyze Existing`：保持当前行为，先创建占位 Prompt，再后台回填分析结果。
- `AI Generate`：先拿到 AI 返回的结构化结果，再调用 `onCreate()` 一次性创建完整 Prompt，避免生成需求文本被误存为最终 `userPrompt`。

## Affected Modules

- `apps/desktop/src/renderer/components/prompt/QuickAddModal.tsx`
- `apps/desktop/src/renderer/components/prompt/quick-add-utils.ts`
- `apps/desktop/src/renderer/i18n/locales/*.json`
- `apps/desktop/tests/unit/components/quick-add-utils.test.ts`
- `apps/desktop/tests/unit/components/top-bar.test.tsx`

## Tradeoffs

- 不新增独立 modal，而是在现有 `Quick Add` 内切模式，减少状态和入口复杂度。
- 继续用纯文本 JSON 输出约束，而不是依赖 provider-specific JSON schema 能力，兼容 Anthropic / Gemini / OpenAI-compatible 多协议。
