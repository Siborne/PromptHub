# Implementation

## Shipped So Far

- 新增 `packages/core/src/rules-workspace.ts`，把 rules 的文件系统 + SQLite 索引逻辑抽到 shared 层。
- 新增 `packages/core/src/platform-paths.ts`，提供 CLI 可用的默认 platform root/global rule 路径解析。
- 新增 `packages/core/src/ai-client.ts` 与 `packages/core/src/rules-rewrite.ts`，把共享 AI chat 与 rules rewrite 逻辑抽到 core。
- `packages/core/src/index.ts` 已导出新的 shared rules service。
- `apps/desktop/src/main/services/rules-workspace.ts` 已改成 shared service 薄封装，继续复用 desktop 自己的 runtime/db/path resolver。
- `apps/desktop/src/main/ipc/rules.ipc.ts` 已改为复用 shared `rewriteRuleWithAi()`。
- `packages/core/src/cli/run.ts` 已接入 `rules` 资源、基础命令入口与 `rules rewrite`。

## Verified

- `pnpm --filter @prompthub/cli typecheck`
- `pnpm --filter @prompthub/desktop typecheck`
- `pnpm --filter @prompthub/cli test -- tests/run.test.ts --run`
- `pnpm --filter @prompthub/desktop test -- tests/unit/main/rules-ipc.test.ts tests/unit/stores/rules.store.test.ts --run`
- `pnpm --filter @prompthub/cli lint`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/cli build`
- `pnpm --filter @prompthub/desktop build`

## Notes

- CLI `rules rewrite` 目前要求显式传入 `--api-key --api-url --model`，不直接读取 desktop settings。
- desktop 与 CLI 目前仍分别使用自己的 runtime path 入口，但 rules 核心行为与 rewrite 行为都已经共享。
