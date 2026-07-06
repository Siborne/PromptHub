# Proposal

## Why

桌面端当前的 `Quick Add` 只支持“粘贴已有内容后由 AI 分析和归类”，还不支持“用户先描述需求，再由 AI 生成一份可直接保存的 Prompt 草稿”。

这导致用户在快速创作新 Prompt 时，仍然需要先去别处写草稿，或者手动打开新建弹窗逐项填写，不能直接利用 AI 完成第一版 Prompt。

## Scope

- In scope:
  - 在 `QuickAddModal` 中新增 `AI Generate` 模式。
  - 允许用户输入需求描述，由 AI 生成 `title`、`systemPrompt`、`userPrompt`、`description`、`tags` 与建议文件夹。
  - 复用现有 `quickAdd` 场景模型配置，不新增新的 AI 场景枚举或后端协议。
  - 同步更新顶部创建入口文案，使 `Quick Add` 能表达“分析已有内容 / 生成新 Prompt”两种能力。
  - 补充聚焦单测与 spec 记录。
- Out of scope:
  - 新增独立的 Prompt 生成工作台页面。
  - 引入新的主进程 IPC 或数据库 schema 变更。
  - 支持视频 / 音频 Prompt 的 AI 生成。

## Risks

- `Quick Add` 现有链路是“先创建占位 Prompt，再后台分析回填”，而 AI 生成更适合“先拿到生成结果，再一次性创建”，两种流需要共存但不能互相污染。
- AI 返回 JSON 结构不稳定时，必须保证失败路径可回退，不能创建出半残缺 Prompt。
- 新增文案键需要同步 7 个 locale，避免引入 i18n 回归。

## Rollback Thinking

如需回滚，可撤销：

- `QuickAddModal` 的模式切换 UI 与 AI 生成分支。
- `quick-add-utils.ts` 中新增的生成模板 / JSON 解析辅助函数。
- 顶部入口文案与相关测试。

本次不涉及数据迁移，回滚不会影响已有 Prompt 数据。
