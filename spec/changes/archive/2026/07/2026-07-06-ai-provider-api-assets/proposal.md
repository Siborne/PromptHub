# Proposal

## Why

PromptHub 当前已经维护一组 AI provider 默认 host，并在 renderer / main process 中做多供应商请求适配，但缺少一份稳定、集中、可核对的供应商 API 资产文档。结果是：

- 设置页默认值和真实官方协议之间的差异难以追踪
- 供应商兼容 bug 排查容易重复劳动
- 新增 provider 或修复 transport 逻辑时缺乏统一真相源

## Scope

- In scope:
- 在 `spec/knowledge/reference/` 下新增 AI 供应商 API 资产文档
- 汇总 PromptHub 当前主要供应商的默认 host、官方 base URL、鉴权方式、主要聊天端点与模型发现端点
- 区分官方已核验信息与 PromptHub 当前推断信息
- 对文档整理过程中遇到的新 provider 名称做 taxonomy 归类，区分独立厂商、聚合路由平台、模型族与常见别名
- Out of scope:
- 逐个修复所有 provider 的实现问题
- 为每个 provider 补充完整参数矩阵与模型清单

## Risks

- 如果不区分“官方协议”和“PromptHub 当前使用方式”，容易把内部实现细节误写成官方事实
- 如果把未核验供应商写得过于确定，后续会误导排障与产品决策
- 如果把模型名或常见别名误写成独立 provider，会污染后续设置项与兼容性判断

## Rollback Thinking

- 若本轮整理范围过大，可先保留已核验供应商条目，其余以 PromptHub inferred 简表降级记录
- 对来源不明但又常见的模糊名称，可先保留 alias taxonomy 记录，而不是强行提升为 canonical provider
