# Implementation

## Shipped

- 新增 `spec/knowledge/reference/ai-provider-apis.md`
- 汇总 PromptHub 主要 AI 供应商的默认 host、官方协议基线、认证方式与主要端点
- 区分已核验供应商和仅有 PromptHub 默认值的供应商，避免把猜测写成事实
- 扩充文档以覆盖常见 provider / router / alias 名称
- 新增“additional mainstream platforms”与“common provider alias mapping”结构，避免把模型别名误写成独立厂商
- 记录一组已发现但尚未在本轮直接修复的协议错位风险：Anthropic、DeepSeek、智谱、MiniMax
- 将整理重点收敛到御三家与国内主流厂商，并补入腾讯混元、讯飞星火的官方基线
- 将豆包 / Ark、StepFun、零一万物 Yi 从“证据有限”提升为已核验条目，并补入各自的官方 base URL、auth、chat / models 端点
- 为豆包 / Ark 补入数据面 / 管控面拆分说明，明确其与 PromptHub 当前默认 host 的版本段差异
- 将文心一言 / Qianfan 从“证据有限”提升为已核验条目，并补入 `/v2` base URL、`Authorization: Bearer`、`POST /chat/completions`、`GET /models`
- 按当前产品范围移除百川智能内建 preset、分类映射、品牌图标引用，以及稳定资产文档中的对应条目，避免保留一个既未核验也不再内建的 provider 记录

## Verification

- 已确认文档位于 `spec/knowledge/reference/ai-provider-apis.md`
- 已通过官方公开文档补核以下条目：Moonshot、智谱、MiniMax、OpenRouter、SiliconFlow、DeepSeek、腾讯混元、讯飞星火、豆包 / Ark、StepFun、零一万物 Yi、文心一言 / Qianfan
- 已删除代码与文档中的百川智能引用，并清理未使用的 provider 图标资源
- 仍需运行 lint / build 以完成本轮代码级验证

## Synced Docs

- `spec/knowledge/reference/ai-provider-apis.md`
- `spec/changes/archive/2026/07/2026-07-06-ai-provider-api-assets/specs/system/spec.md`

## Follow-ups

- 为豆包 / Ark 补充模型发现端点的官方证据
- 评估是否要修正 PromptHub 对 Anthropic、DeepSeek、智谱、MiniMax 的默认 endpoint 归一化逻辑
- 评估是否要修正 PromptHub 对豆包 / Ark 的默认 endpoint 归一化逻辑
- 评估是否要新增腾讯混元作为 PromptHub 内建 provider preset
- 在 `spec/README.md` 中补充新的稳定入口（若后续认为需要）
