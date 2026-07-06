# Proposal

## Why

standalone CLI 已具备 prompt、folder、workspace、skill 的基础管理能力，但 rules 仍被锁在 desktop main 的 `rules-workspace.ts` 中，CLI 无法直接复用。

如果继续在 CLI 内部单独实现一套 rules 逻辑，会带来以下问题：

- desktop 与 CLI 的 rules 行为漂移
- platform 路径解析、版本索引、project rule 目录结构重复实现
- 后续 workspace export/import 扩展到 rules 时重复维护两套导入导出逻辑

因此需要先把 rules workspace service 抽离到 shared 层，再由 desktop IPC 与 CLI 共用。

## Scope

本变更聚焦非 AI 的 rules 基础能力：

- `list / scan / read / save`
- `add-project / remove-project`
- `version-delete`
- `export / import`

不包含：

- AI rewrite 抽离
- 复杂权限/远程同步
- GUI 行为改造

## Risks

- rules service 当前依赖 desktop main 中的 platform 路径解析逻辑
- 抽离后需要保证 desktop IPC 行为保持一致
- rule version 索引和 managed/target 路径写入不能回归

## Rollback

如果 shared 抽离验证失败，可以保留 desktop 现有 `rules-workspace.ts`，暂缓 CLI 接入，而不影响当前已交付的 prompt/folder/workspace CLI 能力。
