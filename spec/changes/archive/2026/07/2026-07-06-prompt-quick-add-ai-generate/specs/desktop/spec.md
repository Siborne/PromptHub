# Desktop Spec Delta

## Added Requirements

### Quick Add AI Generation

桌面端 `Quick Add` 必须同时支持两类快速创建路径：

- 用户粘贴已有 Prompt 内容，由 AI 分析标题、描述、system prompt、标签与文件夹归类。
- 用户只描述目标和约束，由 AI 直接生成一份可保存的 Prompt 草稿。

两类路径都必须复用同一套 `quickAdd` 场景模型配置，不新增额外的 AI 场景设置负担。

## Scenarios

### Scenario: User pastes an existing prompt for quick analysis

- GIVEN 用户打开 `Quick Add`
- WHEN 他们选择“分析已有内容”并粘贴一段 Prompt
- THEN 系统应先快速创建该 Prompt
- AND 再由 AI 在后台补齐标题、描述、标签与建议文件夹

### Scenario: User asks AI to generate a new prompt draft

- GIVEN 用户打开 `Quick Add`
- WHEN 他们切换到“AI 生成”并输入目标、受众、语气或约束
- THEN 系统应先请求 AI 返回结构化 Prompt 草稿
- AND 再用生成结果一次性创建完整 Prompt，而不是把需求描述直接保存为最终 Prompt 内容
