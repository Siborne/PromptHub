# Proposal

## Why

当前桌面端 AI 设置仍把 `provider` 或 host 当作协议来源，导致：

- 自定义代理域名无法显式声明应走 `Gemini` 或 `Anthropic` 协议。
- `Anthropic` 仅切换了 header，但聊天请求仍错误地走 `/v1/chat/completions`。
- 预制 provider 同时承担了“品牌名称”和“协议能力”两个职责，配置模型时表达不清。

本次变更把协议变成显式持久化字段 `apiProtocol`，让“预制 provider 只提供默认值和文案，实际请求协议由用户明确选择”。

## Scope

- In scope:
- 为桌面端 AI 模型配置、legacy root AI 配置和 Safety Scan 配置新增显式 `apiProtocol` 字段。
- 更新 AI workbench，让聊天模型和端点可显式选择 `OpenAI` / `Gemini` / `Anthropic` 协议。
- 按 `apiProtocol` 重构 renderer/main transport 的聊天与模型发现逻辑。
- 为 `Anthropic` 原生消息接口提供非流式支持，并在本次范围内禁用其流式聊天配置。
- 更新 snapshot / backup / migration / tests / implementation 记录。

- Out of scope:
- `Anthropic` 原生 SSE 流式事件解析。
- 新增更多协议类型（如 Azure OpenAI、Vertex AI 原生、Bedrock）。
- 重构未接入设置页的旧版 `AISettings.tsx`。

## Risks

- 持久化 schema 升级需要兼容旧配置，迁移遗漏会导致默认模型链路退回旧逻辑。
- `Gemini` 和 `Anthropic` 的模型发现/测试逻辑覆盖面较大，若 URL 归一化处理不一致，可能影响现有 provider。
- UI 新增协议选择后，需要避免把图片模型误配到不支持的协议上。

## Rollback Thinking

- `apiProtocol` 是向前兼容字段；若需回滚，可继续按 `provider`/host 推断，但应保留迁移后的持久化数据不删除。
- 若 `Anthropic` 原生聊天出现兼容性问题，可临时仅保留配置字段和模型发现，聊天路径回退为不可测试并给出明确提示。
