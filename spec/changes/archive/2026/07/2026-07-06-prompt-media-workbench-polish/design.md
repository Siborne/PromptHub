# Design

## Approach

本次保持 renderer 内最小改动，不改动主进程或 Prompt 数据结构。

### 1. AI 测试模式边界

- `AiTestModal` 的 `image` 模式只在 `prompt.promptType === "image"` 时显示和可切换。
- 文本 Prompt 继续保留：
  - 单模型 AI 测试
  - 多模型对比
  - 临时图片附件（用于多模态聊天）
- image Prompt 继续保留：
  - 生图测试
  - 已保存参考图选择
  - 临时上传参考图

### 2. Prompt 创建 / 编辑结构

- `CreatePromptModal` 走 create-only 极简流：
  - 标题后首屏只保留 `Prompt Type` 与 `User Prompt`
  - `More Settings` 承载描述、system prompt、双语切换、参考媒体、变量提示、文件夹、标签、来源、备注
- `EditPromptModal` 保留编辑上下文：
  - `Basic Info` 继续展示描述、Prompt 类型
  - image Prompt 的参考媒体保留在 `Basic Info`
  - 文本 Prompt 的参考媒体继续收纳在 `More Settings`
- 这样新建时不会被扩展字段打断，编辑时也不会把已有 image 参考图埋进折叠区。

### 3. 文案策略

- 保持 sidebar / filter 里已有的 “Image Prompts / 绘图提示词” 语义。
- 将表单内 `prompt.typeImage` 从含糊的 “媒体 / Media” 收敛为更贴近实际能力的“生图 / Image”。
- 增加“基础信息 / 更多设置 / 参考图片 / 聊天测试附件”等文案，让用户更容易理解：
  - 什么是持久化到 Prompt 的参考素材
  - 什么是仅在 AI 测试时临时附加的图片

## Affected Modules

- `apps/desktop/src/renderer/components/prompt/AiTestModal.tsx`
- `apps/desktop/src/renderer/components/prompt/CreatePromptModal.tsx`
- `apps/desktop/src/renderer/components/prompt/EditPromptModal.tsx`
- `apps/desktop/src/renderer/i18n/locales/*.json`
- `apps/desktop/tests/unit/components/ai-test-workbench.test.tsx`
- `apps/desktop/tests/unit/components/` 新增 Prompt modal 回归测试

## Tradeoffs

- 不抽新公共组件，优先在现有 Create/Edit 弹窗内做最小改动，降低这轮重构面。
- 不再强求 Create/Edit 完全对称，而是允许它们按“创建新内容”和“编辑已有内容”分化首屏层级；对应差异需要测试和 spec 明确编码，避免后续被误判为回归。
- 暂不改变 Prompt 类型底层枚举，仍沿用 `text | image | video`，只修正当前桌面端实际使用中的展示语义。
