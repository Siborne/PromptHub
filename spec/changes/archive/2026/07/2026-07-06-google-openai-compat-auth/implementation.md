# Implementation

## Shipped

- 修正 renderer `chatCompletion` 对 Gemini OpenAI 兼容端点的鉴权头，改为 `Authorization: Bearer`
- 修正 main process `ai-client` 的同类逻辑，避免 Rules/安全扫描等主进程 AI 功能继续失败
- 保留 Gemini 原生模型发现接口 `/v1beta/models` 使用 `x-goog-api-key`
- 补充 Gemini chat 与模型发现的回归测试

## Verification

- `pnpm lint`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/services/ai-transport.test.ts`
- `pnpm --filter @prompthub/desktop build`

## Synced Docs

- `spec/knowledge/behavior/rules-workspace.md`

## Follow-ups

- 可补充设置页针对 Google provider 的协议说明，区分“原生 Gemini API”和“OpenAI 兼容 API”
