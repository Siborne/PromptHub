# Proposal

## Why

`spec/issues/` 当前只有 `active/quality.md`，可以记录内部质量问题，但还没有把 GitHub 仓库 issue 的当前状态同步进 SSD。

这导致两个问题：

- 仓库 open issues 和 closed issues 只能去 GitHub 临时查看，`spec/` 内没有稳定入口。
- `spec/issues/` 缺少 active / archive 双层结构，无法区分当前活跃问题与已关闭归档。

## Scope

- In scope:
- 为 `spec/issues/` 增加 `README.md` 作为导航入口。
- 为 `spec/issues/` 增加 `archive/` 层。
- 记录当前仓库的 open issues 快照到 `spec/issues/active/`。
- 记录当前仓库的 closed issues 快照到 `spec/issues/archive/`。
- 同步更新 `spec/README.md` 与 `spec/knowledge/context/system.md` 的稳定结构说明。

- Out of scope:
- 自动化定时同步 GitHub issues。
- 采集 issue 正文、评论、关联 PR、里程碑等全部细节。
- 重新整理历史 issue 的主题分类或优先级体系。

## Risks

- 手工同步的 issue 快照会随着 GitHub 状态变化而过期。
- closed issue 列表较长，归档文档会明显变大。

## Rollback Thinking

- 如果这套记录方式过重，可以保留 `spec/issues/README.md`，但把 open/closed 清单收缩为摘要视图。
- 如果后续引入自动同步脚本，可以用脚本生成的产物替换当前手工快照文档。
