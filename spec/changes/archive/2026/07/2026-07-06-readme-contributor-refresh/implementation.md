# Implementation

## Status

Completed.

## Goal

重构仓库入口 README 和贡献者入口文档，使 PromptHub 的使用形态、安装路径和贡献流程更清晰，并同步当前 monorepo 与 SSD 约束。

## Shipped

- 新增根级 `CONTRIBUTING.md`，作为 GitHub 可发现的贡献入口，并明确把详细规则指向 `docs/contributing.md`。
- 重构 `README.md` 的前半部分信息架构：
  - 新增“你可以怎么用 PromptHub”，先区分桌面版、自部署 Web 和 CLI。
  - 将桌面版下载与安装前移为主入口，避免原先先讲自部署 Web、后讲桌面下载的逆序体验。
  - 重写快速开始、CLI 与自部署 Web 段落，去掉已经过期的开发命令和旧输出路径。
  - 将技术栈、仓库结构、常用开发命令和 SSD 说明收敛到“贡献与开发”章节，减少对普通用户的干扰。
  - 删除手写维护的“特别感谢”贡献者名单，只保留 GitHub Contributors 图，降低后续过期风险。
- 更新 `docs/contributing.md`，使其与当前 monorepo 结构、根级脚本、desktop / web 边界和 SSD 工作流保持一致。
- 更新 `docs/README.md`，补充根级 `CONTRIBUTING.md` 与 `docs/contributing.md` 的职责关系。
- 更新 `spec/releases/release-rules.md`，把仓库入口 README 与贡献入口文件的稳定约束写回 stable spec。
- 将 `docs/README.en.md`、`docs/README.zh-TW.md`、`docs/README.ja.md`、`docs/README.de.md`、`docs/README.es.md`、`docs/README.fr.md` 同步到新的 README 骨架：
  - 统一把“使用形态 -> 截图 -> 功能 -> 桌面下载 -> 快速开始 -> CLI -> 自部署 Web -> Roadmap / Changelog -> Contribution & Development”作为主线。
  - 将截图区上移到功能说明之前，保持与根 `README.md` 一致的浏览顺序。
  - 清理旧版多语言 README 中遗留的旧截图组、旧命令、旧 CLI 输出路径和过期仓库结构。
  - 保留各语言既有的版本说明、赞助信息与 changelog 摘要，但对齐相对链接和入口说明。
  - 统一将多语言 README 内部引用显示为 `web-self-hosted.md` / `contributing.md`，避免显示多余的 `docs/` 前缀。
- 追加清理多语言 README 命令表中的最后一批旧 desktop CLI 残留，将 `pnpm --filter @prompthub/desktop cli:dev -- --help` 统一改为 `pnpm --filter @prompthub/cli dev -- --help`。

## Verification

- 通过：检查 `README.md` 中更新后的关键跳转、CLI bundle 路径和文档链接引用
- 通过：检查 `docs/contributing.md` 与 `docs/README.md` 中的关键相对路径引用
- 通过：检查 `docs/README.{en,zh-TW,ja,de,es,fr}.md` 的章节骨架已统一，不再残留旧截图章节或旧 CLI 路径
- 通过：仓库级搜索确认 `pnpm --filter @prompthub/desktop cli:dev` 已无匹配，仅保留 active change 中对已删除 desktop CLI 的历史说明
- 通过：`git diff --check -- docs/README.en.md docs/README.zh-TW.md docs/README.ja.md docs/README.de.md docs/README.es.md docs/README.fr.md spec/changes/archive/2026/07/2026-07-06-readme-contributor-refresh/tasks.md spec/changes/archive/2026/07/2026-07-06-readme-contributor-refresh/implementation.md`
- 通过：`pnpm --filter @prompthub/desktop lint`

## Remaining

- 当前 scope 内无剩余必做项；后续只需按需要继续做术语润色或官网文案同步。
