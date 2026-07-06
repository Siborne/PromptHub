# Delta Spec

## Added

- `spec/knowledge/reference/` 下必须维护一份 AI 供应商 API 资产文档，记录 PromptHub 当前主要供应商的默认 host、官方 base URL、认证方式和关键端点。
- 该资产文档必须区分“官方已核验协议”和“PromptHub 当前推断/默认建模”，避免将内部实现误写为官方事实。
- 当文档整理过程中出现新的 provider 名称时，资产文档还必须给出名称归类：独立 provider、聚合路由平台、模型族/常见别名，或证据不足标签。

## Modified

- PromptHub 的稳定资产范围从“Agent 平台本地文件资产”扩展到“外部 AI 供应商 API 资产”。
- AI 供应商资产文档的职责从“记录内建 provider 基线”扩展到“同时吸收常见别名标签的 taxonomy 映射”，以避免把模型别名误当厂商。

## Removed

- 无。

## Scenarios

- 当后续修复某个 provider 的 API 兼容问题时：
- 工程师应先查 `spec/knowledge/reference/ai-provider-apis.md`
- 若文档中没有该 provider 的稳定协议信息，应先补文档或明确标注证据不足
- 当用户给出某个常见 provider 标签并要求“更新到最新”时：
- 工程师应先判断该名称是官方 provider、router、模型族还是常见别名
- 只有在拿到稳定公开协议证据后，才能把它提升为 canonical provider 条目
