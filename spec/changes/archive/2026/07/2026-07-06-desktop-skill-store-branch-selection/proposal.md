# Proposal

## Why

当前桌面端 Skill 商店的 `git-repo` source 只接受一个 URL 字符串，远程加载逻辑会优先读取仓库 `default_branch`，并在失败时回退到 `main`。这带来两个问题：

1. 用户无法在添加自定义商店时显式选择非默认分支。
2. 即使用户手动输入了 `/tree/<branch>/<path>` 形式的 GitHub URL，现有商店扫描主链路也不会稳定尊重该 branch，而是继续按默认分支加载。

这会让预发布技能、维护分支技能集合、社区 curated 分支、以及按分支组织目录的商店源难以稳定使用。

## Scope

- In scope:
- 为桌面端 `git-repo` 类型的自定义 Skill 商店源增加显式 branch 配置。
- 允许 `git-repo` source 同时配置可选 `directory`，用于指向仓库子目录。
- 在添加/编辑商店源 UI 中提供 branch 与 directory 输入。
- 调整 GitHub source 解析与远程加载逻辑，优先使用显式 branch，其次兼容 URL 中的 `/tree/<branch>/<path>`。
- 在商店列表/详情中展示已生效的 branch / directory。
- 为旧数据提供向后兼容的读取与归一化策略。

- Out of scope:
- GitHub 分支下拉、自动列出远程分支。
- 支持 tag / commit SHA 固定版本。
- 修改 `marketplace-json` 与 `local-dir` source 的数据结构。
- 桌面端以外的平台或 CLI 技能商店能力同步。

## Risks

- GitHub 的 `/tree/<branch>/<path>` URL 中 branch/path 语义目前被塞在 `url` 里，改为结构化字段后需要避免旧 source 在读取、展示、刷新时行为变化。
- branch 与 directory 同时存在时，错误提示必须能明确指出是分支不存在、目录不存在，还是目录下没有 `SKILL.md`。
- 现有内置商店源也混用了 URL 内嵌 branch/path，改造时需要统一数据模型，避免 UI 与加载逻辑各自解析一套。

## Rollback Thinking

- 如果本轮结构化字段改造范围超出预期，最低回退方案是：仅在 UI 上增加 branch 输入，并先将 branch 拼接回 URL；但这会保留 URL 语义混杂的问题，只建议作为临时降级方案。
