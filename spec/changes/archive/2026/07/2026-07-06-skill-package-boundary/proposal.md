# Skill Package Boundary

## Problem

用户报告自定义 Git/Gitea 商店安装 Skill 后，托管仓库里只剩 `SKILL.md`，原始 Skill 目录中的 `scripts/`、`docs/`、`assets/` 等文件丢失。

这不是一个普通安装细节 bug，而是 Skill 领域边界被实现稀释：代码把 “Skill 的入口文件是 `SKILL.md`” 误当成 “Skill 本身就是一个 `SKILL.md` 文件”。

## Scope

- 明确 Skill 的稳定定义：Skill 是一个目录级 package，`SKILL.md` 是必需入口文件。
- 明确哪些路径允许只写 `SKILL.md`：仅限用户从 UI/AI 新建一个没有额外资源的新 Skill，此时也必须落在一个 Skill 目录内。
- 明确所有导入、商店安装、仓库同步、项目分发、平台分发路径必须保留完整 Skill 目录树，除非命中显式 ignore 规则。
- 为后续修复定义先失败的测试项。

## Non-Goals

- 不改变 `SKILL.md` frontmatter 作为元数据/说明入口的格式约定。
- 不要求每个 Skill 都必须有额外文件；只有一个 `SKILL.md` 的目录仍是合法 Skill package。
- 不改变外部平台可能只消费 `SKILL.md` 的兼容输出；PromptHub 内部存储仍以目录 package 为准。

## Risk

如果不把该边界写死，后续 AI 或开发者会继续在“读取入口内容”和“导入整个包”之间混用 API，导致数据保真、文件浏览、安全扫描和平台分发反复出现同类问题。

## Rollback

这是边界与测试约束记录；若后续发现某些生态确实只支持单文件 Skill，也应作为兼容输出格式处理，不应回滚 Skill package 的内部定义。
