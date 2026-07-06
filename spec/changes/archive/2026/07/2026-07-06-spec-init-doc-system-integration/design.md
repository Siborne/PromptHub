# Design

## Summary

采用“先建边界，再做定向迁移”的方式完成收口。PromptHub 保留现有 OpenSpec-style change workflow，但把长期稳定真相源从旧根目录迁移到 `spec/workflow/*`、`spec/knowledge/*`、`spec/releases/`、`spec/rules/`、`spec/adr/` 等最新 `spec-init` 语义目录。

## Key Decisions

- `spec-init` 负责定义 PromptHub 当前稳定文档边界
- `spec/workflow/*` 与 `spec/knowledge/*` 既是最新项目级入口层，也是当前稳定真相源所在地
- 旧的 `spec/domains/`、`spec/architecture/`、`spec/logic/`、`spec/assets/` 完成迁移后直接删除，不保留并行兼容层
- 非 trivial 变更仍然必须进入 `spec/changes/active/<change-key>/`
- `AGENTS.md` 需要同步修改，让执行规范和仓库内文档入口一致

## Affected Files

- `README.md`
- `AGENTS.md`
- `spec/README.md`
- `.agents/skills/spec-init/`
- `spec/workflow/00-intake/README.md`
- `spec/workflow/01-requirements/README.md`
- `spec/workflow/02-design/README.md`
- `spec/workflow/03-implementation/README.md`
- `spec/workflow/04-verification/README.md`
- `spec/workflow/05-tasks/README.md`
- `spec/workflow/`
- `spec/knowledge/`
- `spec/knowledge/context/system.md`
- `spec/knowledge/behavior/*.md`
- `spec/knowledge/structure/*.md`
- `spec/knowledge/reference/*.md`
- `spec/rules/README.md`
- `spec/releases/README.md`
- `spec/archive/README.md`
- `spec/adr/README.md`

## Follow-Up Direction

- 下一阶段可以继续把部分长期需求从 `spec/knowledge/behavior/*.md` 精炼回 `spec/workflow/01-requirements/README.md`
- 若后续 ADR 规模增长，再从 `spec/knowledge/structure/` 中拆出独立 ADR 文档
