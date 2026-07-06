# Desktop Spec Delta

## Added Requirements

### Prompt AI Workbench Mode Gating

桌面端 Prompt AI 测试抽屉必须只在 image Prompt 上暴露生图测试模式；文本 Prompt 仍应支持单模型测试、多模型对比，以及面向多模态聊天模型的临时图片附件。

### Prompt Modal Information Hierarchy

桌面端 Prompt 弹窗允许按创建 / 编辑场景分化信息层级：

- `CreatePromptModal` 首屏必须优先展示标题、Prompt 类型与用户提示词；描述、system prompt、参考媒体以及文件夹、标签、来源、备注等扩展信息默认收纳在 `More Settings`。
- `CreatePromptModal` 首屏不再显示 `Basic Info` 标题和类型解释文案；变量说明应贴近 `User Prompt` 字段，以轻量提示形式出现。
- `EditPromptModal` 必须继续在 `Basic Info` 中展示描述、Prompt 类型，以及 image Prompt 的参考媒体；文本 Prompt 的参考媒体保留在 `More Settings`。

## Scenarios

### Scenario: User tests a text prompt with a multimodal chat model

- GIVEN 用户打开一个文本 Prompt 的 AI 测试抽屉
- WHEN 他们准备对多模态聊天模型做测试
- THEN 抽屉中不应出现“测试生图”模式
- AND 仍应可以附加临时图片作为聊天输入附件

### Scenario: User creates a prompt from scratch

- GIVEN 用户打开新建 Prompt 弹窗准备快速记录一个新想法
- WHEN 他们还没有进入元信息整理阶段
- THEN 首屏应先看到标题、Prompt 类型与用户提示词
- AND 不应再看到 `Basic Info` 或类型说明性描述文案
- AND 描述、参考媒体与其他扩展字段应在展开 `More Settings` 后才出现

### Scenario: User edits an image prompt with reference images

- GIVEN 用户在编辑一个已有 image Prompt
- WHEN 他们需要检查或调整保存过的参考图
- THEN `Reference Media` 应继续出现在 `Basic Info` 中，而不是被收进折叠区

### Scenario: User edits a text prompt with saved reference media

- GIVEN 用户在编辑一个文本 Prompt
- WHEN 他们需要管理保存过的参考媒体
- THEN `Reference Media` 应保留在 `More Settings` 中，不挤占基础编辑区
