# Design

## Goal

把 desktop main 中的 `rules-workspace` 抽成可复用 shared service，让 desktop IPC 与 standalone CLI 共用一套 rules 文件管理逻辑。

## Approach

### Shared Service In `packages/core`

新增：

- `packages/core/src/rules-workspace.ts`
- `packages/core/src/platform-paths.ts`
- `packages/core/src/ai-client.ts`
- `packages/core/src/rules-rewrite.ts`

其中：

- `rules-workspace.ts` 承载 rules 的文件扫描、读取、保存、版本、项目规则、备份导入导出逻辑
- `ai-client.ts` 承载共享 AI chat 请求逻辑
- `rules-rewrite.ts` 承载 rules rewrite prompt/build 与 AI 调用逻辑
- 通过 `createRulesWorkspaceService(deps)` 工厂注入 `getRulesDir`、`RuleDB`、平台路径解析函数
- 默认导出 `coreRulesWorkspaceService` 供 standalone CLI 使用

### Desktop Bridge Layer

desktop 继续保留：

- `apps/desktop/src/main/services/rules-workspace.ts`

但该文件不再承载 rules 逻辑，只负责把 desktop 自己的：

- runtime paths
- sqlite init
- custom platform root path resolver

注入 shared service，避免 desktop 回退到 CLI 的默认目录协议。

### CLI Integration

在 `packages/core/src/cli/run.ts` 接入：

- `rules list`
- `rules scan`
- `rules read`
- `rules save`
- `rules rewrite`
- `rules add-project`
- `rules remove-project`
- `rules version-delete`
- `rules export`
- `rules import`

导入导出统一使用 JSON bundle：

- `kind: "prompthub-cli-rules"`
- `version: 1`

## Non-Goals

- web rules storage 重构
- platform custom root path 配置模型统一

## Tradeoffs

- 这次把 `rules rewrite` 也一起抽进 `packages/core`，但 CLI 明确要求显式传入 AI 参数，不直接读取 desktop settings
- platform root 路径解析没有立刻完全统一；desktop 仍走自己的带 settings 覆盖逻辑，CLI 先走 core 默认路径实现
