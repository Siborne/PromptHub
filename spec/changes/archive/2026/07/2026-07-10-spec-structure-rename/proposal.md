# Proposal

> Superseded: this proposal documents an intermediate topology. Current paths
> are defined by `spec/README.md` and `spec-init.topology.yml`.

## Why

当前 `spec/specs/` 命名虽然在方法论上可解释，但在实际使用中存在明显可读性问题：

- `spec/specs/` 在路径层面有重复感，新成员第一眼很难分辨两层职责
- 当前稳定层更偏向“变更后的行为规格”，缺少对固定资产与稳定逻辑的清晰落盘位置
- 一些不会频繁变化、但对产品和工程都重要的长期知识，例如平台支持矩阵、canonical 文件约定、规则工作台语义、路径派生逻辑，并没有稳定承载层

## Goals

- 将 `spec/specs/` 重命名为更直观的稳定层命名
- 为稳定的“固定资产”和“稳定逻辑”增加明确落盘目录
- 保持 `spec/changes/active/<change-key>/specs/<domain>/spec.md` 作为 delta spec 结构不变
- 同步仓库内对旧路径的引用，避免 SSD 入口信息失真

## Non-Goals

- 本轮不重写整个 SSD 工作流
- 本轮不归档现有 active changes
- 本轮不把所有历史内部文档重新分类到新目录

## Proposed Direction

- `spec/specs/` -> `spec/domains/`
- 新增 `spec/assets/`：承载平台矩阵、canonical 文件约定、稳定资源清单等固定资产
- 新增 `spec/logic/`：承载稳定业务逻辑、路径派生语义、规则工作台模型等长期逻辑真相

## Initial Scope

- 迁移现有 `system/desktop/web/skills/sync/data-recovery/release/prompt-workspace` 稳定规格到 `spec/domains/`
- 新增：
  - `spec/assets/agent-platforms.md`
  - `spec/logic/rules-workspace.md`
- 更新 `spec/README.md`、`AGENTS.md`、`README.md`、`docs/README.md`、`docs/contributing.md` 以及相关 active/archive/legacy 文档中的旧引用
