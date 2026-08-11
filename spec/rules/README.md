# PromptHub Rules

`spec/rules/` 对齐 `spec-init` 的 rules 边界，用来放项目默认工程规则。

当前 PromptHub 的主要工程规则来源：

- `AGENTS.md`
- `spec/knowledge/behavior/`
- `spec/knowledge/reference/`

当前已补充的规则入口：

- `spec/rules/bug-fix-rules.md`
- `spec/rules/clarification-rules.md`
- `spec/rules/coding-standards.md`
- `spec/rules/document-routing-rules.md`
- `spec/rules/document-archive-rules.md`
- `spec/rules/issue-management-rules.md`
- `spec/rules/testing-standards.md`
- `spec/rules/doc-sync-rules.md`
- `spec/rules/change-management-rules.md`
- `spec/rules/definition-of-done.md`
- `spec/rules/agent-boundary-guardrails.md`
- `spec/rules/tdd-design-gate.md`
- `spec/rules/code-quality-architecture.md`
- `spec/rules/storage-evolution-rules.md`
- `spec/rules/submission-traceability-rules.md`

Phase and lifecycle rules:

- non-trivial work follows `specify -> clarify -> plan -> tasks -> analyze -> implement -> converge`
- `analyze` prevents implementation with conflicting documents, orphan IDs, or blocking decisions
- `converge` synchronizes actual behavior and moves completed changes out of `active/`
- new standalone records use the compatible typed-ID policy in `document-archive-rules.md`; existing history is not renamed
- reusable `.agents/skills/*` procedures defer to this hierarchy; parallel `.agents/rules/`, `.agents/workflows/`, generic `docs/rules/`, and tool-specific project constraints are not allowed

领域型回归测试矩阵：

- `spec/knowledge/reference/skill-defect-taxonomy.md`
- `spec/knowledge/reference/skill-regression-test-matrix.md`

后续如果要把长期稳定的规则逐步从 `AGENTS.md` 拆分出来，可以优先沉淀到本目录。

## 与 `spec-init` 规则模板的关系

PromptHub 使用 `spec-init` 的规则分类，但不逐字复制通用模板：

- 通用模板中的 `docs/*` 路由在 PromptHub 内改写为 `spec/*`。
- PromptHub 保留现有 active change 结构：`proposal.md`、`specs/<domain>/spec.md`、`design.md`、`tasks.md`、`implementation.md`。
- 已经更严格的规则，例如测试、架构质量、提交追踪，继续以 PromptHub 现有文件为准。
