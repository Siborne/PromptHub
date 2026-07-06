# Proposal

## Why

用户在 AI 模型设置中选择 Google 提供商并填写 Gemini API Key 后，模型测试和实际调用会失败。当前实现把 `generativelanguage.googleapis.com` 同时当成“OpenAI 兼容路径”和“原生 Gemini 鉴权”处理，导致 chat/completions 请求发到了兼容端点，却仍然使用了原生 `x-goog-api-key` 头。

## Scope

- In scope:
- 修正 Google/Gemini OpenAI 兼容 chat 请求的鉴权头逻辑
- 保持 Gemini 原生模型列表发现仍使用原生 `/v1beta/models` 与 `x-goog-api-key`
- 补充 renderer 与 main process 相关回归测试
- Out of scope:
- 修改 Google provider 默认 Base URL 文案
- 重做整个 provider 配置 UI

## Risks

- 如果只按 provider 或只按 host 判断鉴权，可能破坏原生 Gemini 模型发现
- renderer 和 main process 若处理规则不一致，会出现“前端测试能过、主进程 AI 失败”的分裂

## Rollback Thinking

- 若兼容模式策略仍不稳定，可临时回退为要求用户显式填入 `.../v1beta/openai#`，但这会降低易用性
