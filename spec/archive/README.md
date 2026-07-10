# PromptHub Archive

`spec/archive/` 对齐 `spec-init` 的 archive 边界，用来承接已经废弃但仍需保留的项目级文档。

在锁定的 `spec-init` 基线（`f83def1`）中，这一层属于 `records.archive`。

PromptHub 当前已有的归档层分别是：

- `spec/changes/archive/`
- `spec/changes/legacy/`
- `spec/issues/archive/`

因此这里作为项目级入口说明，不替代现有归档目录。

## Routing Rule

- 被替代、废弃但仍需保留历史的项目级文档 -> `spec/archive/`
- 已完成 change -> `spec/changes/archive/`
- 旧平铺内部文档 -> `spec/changes/legacy/`
- 历史 issue -> `spec/issues/archive/`

## Project-Level Archive Index

| ID/Date | Title | Status | Path | Replacement | Updated |
| ------- | ----- | ------ | ---- | ----------- | ------- |

当前没有直接归档在 `spec/archive/` 下的项目级文档；change、legacy change
和 issue 历史继续由各自目录索引承载。
