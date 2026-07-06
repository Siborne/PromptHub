# Design

## Overview

将 Google/Gemini 的判断从“按域名决定鉴权头”改成“按最终请求协议决定鉴权头”。

- 原生 Gemini API：`/v1beta/models`、`models/...:generateContent` 等路径继续使用 `x-goog-api-key`
- OpenAI 兼容 Gemini API：`/v1beta/openai/chat/completions` 使用 `Authorization: Bearer <key>`

## Affected Areas

- Data model:
- 无新增数据结构
- IPC / API:
- 无新增 IPC；只修正请求构造逻辑
- Filesystem / sync:
- 无影响
- UI / UX:
- 设置页预览路径保持不变，但实际请求与官方兼容协议对齐

## Tradeoffs

- 继续允许 Google provider 只填 host，由系统自动补全兼容端点，保留易用性
- 协议判断依赖最终 endpoint，而非 provider/host 单一维度，逻辑稍复杂但更准确
