# Proposal

## Why

PromptHub 现有 `spec/` 体系已经形成了稳定的 change workflow，但项目内长期真相源仍散落在旧根目录结构里，尚未完整收敛到最新 `spec-init` 的 `workflow + knowledge + records` 文档边界。结果是：

- agent 和贡献者会在 `spec/domains/`、`spec/architecture/`、`spec/logic/`、`spec/assets/` 与 `spec/workflow/*`、`spec/knowledge/*` 之间来回跳转
- README、`spec/README.md`、`AGENTS.md` 对文档工作流的描述仍混有旧根目录表述
- 项目虽然已经引入 `spec-init` skill，但仓库内稳定文档层级还没有真正收口

## Scope

- 将 `spec-init` skill 接入到项目内 `.agents/skills/`
- 在 README 中公开 `spec-init` skill 的本地入口与上游仓库
- 为 `spec/` 增加 `spec-init` 文档边界入口目录
- 更新 `spec/README.md` 与 `AGENTS.md`，明确 PromptHub 采用 `spec-init` 文档边界 + 现有 change flow 的混合体系
- 把旧的稳定真相源迁移到 `spec/workflow/*`、`spec/knowledge/*`、`spec/releases/`
- 删除旧的 `spec/domains/`、`spec/architecture/`、`spec/logic/`、`spec/assets/` 根目录

## Non-Goals

- 不推翻现有 `spec/changes/active/<change-key>/` 工作流
- 不在本次内重写所有历史 change 文档内容

## Risks

- 如果迁移后仍保留旧根目录引用，团队会继续沿用失效路径
- 如果 `AGENTS.md` 仍保留旧描述，agent 执行时会出现两套稳定层并存的歧义
- 如果 README 只声明 skill 而不解释当前目录真相源，外部贡献者仍难以理解这次改造的意义

## Impacted Flows

- agent / contributor 为 PromptHub 写或更新内部文档
- 非 trivial 改动的 spec 建立与变更同步流程
- 使用内置 `spec-init` skill 梳理项目文档边界
