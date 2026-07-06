# Design

## Overview

本次修复分四层推进：

1. 工程接入层：让 `apps/web-cloudflare` 被 workspace 和 lockfile 正式纳入，恢复可安装与可验证状态。
2. 类型与构建层：修复 Cloudflare package 的 tsconfig / 依赖解析 / runtime declaration，使 worker 代码能稳定 typecheck。
3. 运行时安全层：修复脚本断链、500 错误消息直出、过时脚本协议等高风险问题。
4. 回归保护层：补充最小单元测试，覆盖 auth / sync / media 的关键路径。

## Affected Areas

- Data model:
  - `sync_snapshots` 和 auth challenge / devices 表不改 schema，只校验与现有逻辑一致
- IPC / API:
  - Cloudflare worker 的 `/api/auth/*`、`/api/sync/*`、`/api/media/*` 错误行为和返回结构
- Filesystem / sync:
  - workspace package / lockfile / 构建脚本 / PowerShell 辅助脚本
- UI / UX:
  - 无新增 UI，仅影响 Cloudflare worker API 的稳定性与错误返回

## Tradeoffs

- 优先做最小修复闭环，不在这一轮重做 Cloudflare 版完整架构
- 优先补能阻止回归的轻量测试，而不是一次性追求高覆盖率
- 对 Cloudflare API 类型优先保证当前仓库内一致性；若 `wrangler types` 接入成本过高，可先使用更完整的本地声明
