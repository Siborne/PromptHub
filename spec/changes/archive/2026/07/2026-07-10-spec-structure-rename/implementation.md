# Implementation

## Status

Superseded and converged on 2026-07-10.

## Supersession

The `domains / architecture / logic / assets` layout recorded by this change
was an intermediate topology. It was later replaced by the current
`workflow / knowledge / changes / records` model defined in `spec/README.md`
and `spec-init.topology.yml`.

The durable content survived under its current semantic paths:

- former architecture material -> `spec/knowledge/structure/`
- former stable logic -> `spec/knowledge/behavior/`
- former stable assets -> `spec/knowledge/reference/`

No active implementation remains. This record is archived as historical
context and MUST NOT be used as the current directory contract.

## Goal

优化 PromptHub 内部 SSD 目录命名，并为固定资产与稳定逻辑提供长期落盘位置。

## Current Plan

- 将稳定层从 `spec/specs/` 迁移为 `spec/domains/`
- 增加 `spec/assets/` 和 `spec/logic/`
- 同步所有仓库内的旧路径引用
- 为当前平台支持矩阵与 Rules 逻辑补长期文档

## Shipped

- 将稳定层目录从 `spec/specs/` 迁移为 `spec/domains/`
- 新增 `spec/assets/` 与 `spec/logic/`
- 新增 `spec/assets/agent-platforms.md`，作为当前 Agent/Skill 平台支持矩阵与 canonical 文件约定的固定资产文档
- 将 `spec/assets/agent-platforms.md` 从简表扩充为带默认目录、目录结构、关键文件、证据级别与官方链接的资产文档
- 将 `spec/assets/agent-platforms.md` 从“rules / skills 横向矩阵”进一步重构为“特殊文件名总表 + 平台总览矩阵 + 平台档案卡 + PromptHub inferred 清单”的长期资产档案
- 扩大 `spec/assets/agent-platforms.md` 覆盖面，不再只记录 `rules / skills`，而是同时记录 `memory / history / transcript / checkpoint / commands / workflows / steering / config / compatibility filenames`
- 基于最新公开文档补充并校正 Claude Code、Codex CLI、Gemini CLI、OpenCode、Cursor、Windsurf、Kiro、Roo Code、GitHub Copilot 的本地资产路径与证据状态
- 将特殊文件名证据状态显式落盘，区分已确认的 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` / `copilot-instructions.md` 与证据不足的 `SOUL.MD` / `.cursorrules` / `.windsurfrules`
- 基于最新公开文档补强 `Cursor` 与 `Windsurf` 证据：将 Windsurf 提升为官方文档充分平台，并记录其 global rules / workspace rules / AGENTS.md / skills 路径
- 基于 OpenClaw 官方文档补充 `SOUL.md`、workspace bootstrap files、memory files、session transcripts、logs、managed skills 与 profile workspace 证据，并将 `OpenClaw` 从 PromptHub inferred 清单提升为正式平台档案
- 在 `spec/logic/rules-workspace.md` 与 `spec/assets/agent-platforms.md` 中补充边界说明：`OpenClaw` 已完成资产级建模，但由于当前 `Rules` 仅支持单一 canonical 全局规则文件，因此暂不进入运行时全局规则白名单
- 进一步补齐 `Cursor`、`Kiro`、`Roo Code`、`GitHub Copilot` 的边界说明，明确“资产文档已建模”与“运行时全局规则白名单已接入”之间的准入差异
- 新增 `spec/logic/rules-workspace.md`，作为 Rules 模块稳定逻辑语义文档
- 更新 `spec/README.md`、`AGENTS.md`、`README.md`、`docs/README.md`、`docs/contributing.md`，让 SSD 入口统一使用 `domains / logic / assets` 分层
- 更新 active / archive / legacy 文档中的旧稳定层路径引用

## Verification

- `spec/` 根目录当前为：`domains/`、`architecture/`、`logic/`、`assets/`、`issues/`、`changes/`
- 仓库搜索确认 `spec/specs/` 仅残留在本变更自身的历史迁移说明中，不再作为实际入口路径
- `spec/assets/agent-platforms.md` 当前已按“特殊文件名 / 平台总览 / 平台档案卡”结构重排，并与 `packages/shared/constants/platforms.ts`、`packages/shared/constants/rules.ts` 当前平台支持集合保持一致
- `spec/assets/agent-platforms.md` 已将 `SOUL.md` 标记为 OpenClaw 官方确认文件名，不再把 `OpenClaw` 作为纯 `PromptHub inferred` 平台处理
- `spec/logic/rules-workspace.md` 已明确记录：资产文档中的“官方证据充分”不自动等于 `Rules` 运行时支持；`OpenClaw` 目前仍属于文档已建模、运行时未接入的状态
- `spec/assets/agent-platforms.md` 与 `spec/logic/rules-workspace.md` 现在都明确区分了 `Cursor`、`Kiro`、`Roo Code`、`GitHub Copilot` 的资产级建模状态与未进入 `Rules` 全局白名单的具体原因

## Converge

- Current source of truth: `spec/README.md` and `spec-init.topology.yml`.
- Superseding change:
  `spec/changes/archive/2026/07/2026-07-10-spec-init-upstream-alignment/`.
- Final destination:
  `spec/changes/archive/2026/07/2026-07-10-spec-structure-rename/`.
