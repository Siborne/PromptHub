# PromptHub Workflow Implementation

`spec/workflow/03-implementation/README.md` 是 PromptHub 当前项目级 implementation 主入口，对齐锁定的 `spec-init` 基线（`f83def1`）中的 workflow/implementation 边界，回答“先做什么、后做什么”。

## 当前实施方式

PromptHub 当前不把项目级实施节奏集中写在一个总计划文件里，而是按 change 维护执行节奏：

- `spec/changes/active/<change-key>/tasks.md`
- `spec/changes/active/<change-key>/implementation.md`

## 当前默认顺序

1. 先明确 intake / requirements / design
2. 对非 trivial 改动建立 active change
3. 在 change 中拆任务和验证，完成 analyze
4. 实施并记录实际结果、失败和偏差
5. 完成 converge，回写稳定真相源并更新 change 生命周期

## 当前阶段建议

- 跨 change 的长期实施规划可以逐步沉淀到这里
- 单次变更的实施顺序与落地记录仍以 active change 为主
- 没有 analyze 结论的 change 不进入实现；没有 converge 结论的 change 不标记完成
