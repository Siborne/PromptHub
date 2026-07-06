# Design

## Summary

本次调整把仓库入口文档拆成两层：

- 根 `README.md`：面向用户、访客和潜在采用者，遵循“产品概览 -> 选择使用形态 -> 安装/上手 -> 深入入口 -> 贡献开发”的顺序。
- `CONTRIBUTING.md` / `docs/contributing.md`：面向贡献者，明确当前 monorepo 结构、常用命令和 SSD 约束。

## README Information Architecture

根 README 改为优先回答以下问题：

1. PromptHub 是什么。
2. 我应该用桌面版、自部署 Web，还是 CLI。
3. 我如何开始使用。
4. 如果我要参与开发，入口在哪里。

因此章节顺序调整为：

- 产品概览
- 使用形态
- 核心能力
- 桌面版下载
- 快速开始
- CLI
- 自部署 Web
- 截图
- 贡献开发

原先过长的内部 SSD 说明不再作为 README 主体章节展开，而是在“贡献开发”中给出简版约束和明确跳转。

## Contributor Entry Strategy

GitHub 对根级 `CONTRIBUTING.md` 有天然识别能力，因此采用以下分工：

- 根 `CONTRIBUTING.md`：轻量入口文件，只负责把贡献者带到 canonical 指南。
- `docs/contributing.md`：仓库内的 canonical 贡献指南，维护完整内容。
- `docs/README.md`：补充说明 `docs/` 与根级约定文件的关系。

## Command Accuracy Rules

文档中所有开发命令必须与当前脚本保持一致：

- 桌面完整开发入口：`pnpm electron:dev`
- Web 开发入口：`pnpm dev:web`
- 根 `pnpm build` 仅构建桌面版；Web 需显式使用 `pnpm build:web`
- 源码方式运行 CLI：`pnpm --filter @prompthub/cli dev -- --help`
- 构建后的 CLI bundle 路径：`apps/cli/out/prompthub.cjs`

## Stable Spec Sync

`spec/releases/release-rules.md` 补充仓库入口文档规则：

- 根 README 应清晰区分桌面版、自部署 Web 与 CLI 的入口。
- GitHub 可发现的贡献入口必须存在，并指向当前有效的 canonical 贡献指南。
