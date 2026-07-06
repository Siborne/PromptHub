# Design

## Overview

把 AI 请求协议从“隐式推断”改成“显式声明”。

- 数据模型新增 `apiProtocol`，统一在 renderer/main/shared 中使用同一套类型。
- 预制 provider 只负责默认 `apiUrl` 与推荐协议，不再决定最终 transport。
- renderer/main transport 按协议构造 endpoint、headers、body 与模型发现路径。
- `Anthropic` 本次只支持非流式消息接口，UI 会禁用流式开关并在保存/测试时强制关闭。

## Affected Areas

- Data model:
- `AIModelConfig`、legacy root AI config、`AIConfig`、`SafetyScanAIConfig` 新增 `apiProtocol`。
- `settings.store` persist version 从 `7` 升到 `8`，为历史模型和 root 配置推断默认协议。
- snapshot / backup / rules / skill / quick-add 等回退链路都要透传 `apiProtocol`。

- IPC / API:
- 无新增 IPC。
- renderer `services/ai.ts` 和 main `services/ai-client.ts` 改为按协议分支构造聊天请求与模型列表请求。

- Filesystem / sync:
- 无文件系统路径变化。
- localStorage snapshot / restore 和数据库备份结构更新为包含 `apiProtocol`。

- UI / UX:
- AI workbench 模型表单与端点编辑弹窗新增协议选择器。
- `custom` provider 文案改为“自定义”，不再暗示仅支持 OpenAI 兼容。
- 对 `Anthropic` 协议的聊天模型禁用流式输出，并提供说明。

## Tradeoffs

- 显式协议比按 host 猜测更可靠，但表单多了一个字段，需要通过推荐默认值降低配置成本。
- 本次不实现 `Anthropic` 流式 SSE，可避免继续暴露错误行为，但会暂时限制 Claude 原生协议的流式体验。
- 图片模型仍以 provider / API URL 能力判断为主，不强制所有协议都支持图片生成，避免错误承诺。
