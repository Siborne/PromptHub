# PromptHub Workflow Tasks

`spec/workflow/05-tasks/README.md` 是 PromptHub 当前项目级 tasks 主入口，对齐锁定的 `spec-init` 基线（`f83def1`）中的 workflow/tasks 边界，回答“现在具体做什么动作”。

## 当前任务组织方式

PromptHub 当前默认把可执行任务写在每个 active change 中：

- `spec/changes/active/<change-key>/tasks.md`

## 当前项目级任务规则

- 非 trivial 工作优先通过 active change 建立任务清单
- 每个实施任务必须关联需求、设计和验证链路；孤立任务不能进入 implement
- 任务清单必须包含 analyze、converge、稳定文档同步和 change 归档动作
- 项目级总任务或跨 change 长线任务可逐步沉淀到这里
