# Design

## Overview

新增 `spec/knowledge/reference/ai-provider-apis.md`，作为 PromptHub 的稳定 API 资产文档。文档结构分为：

- purpose / evidence rules
- built-in provider matrix
- additional mainstream platforms
- common provider alias mapping
- protocol mismatch watchlist
- provider notes
- PromptHub source-of-truth mapping
- evidence links

这样既能用于工程排障，也能约束后续 provider 扩展时的文档同步行为。

## Affected Areas

- Stable assets:
- `spec/knowledge/reference/ai-provider-apis.md`
- Stable logic / references:
- `spec/README.md` 未来可补入口（本轮如不必要可暂不改）

## Tradeoffs

- 不追求一次性把所有 provider 做到完全官方核验，优先保证高频 provider 的质量与文档可信度
- 对证据不足的 provider 使用 `Evidence limited`，牺牲文档“整齐感”换取事实准确性
- 对常见别名不强行“落 canonical provider”，而是允许它们以 alias taxonomy 的形式稳定存在，减少误导
