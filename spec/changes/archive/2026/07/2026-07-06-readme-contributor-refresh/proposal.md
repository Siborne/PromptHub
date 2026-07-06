# Proposal

## Why

当前仓库入口文档存在两类问题：

- 根 `README.md` 把桌面版下载、自部署 Web、CLI、内部 SSD 工作流混在一起，阅读顺序不够清晰，且夹杂了已经过期的命令和旧目录结构。
- 仓库根目录缺少 GitHub 约定的 `CONTRIBUTING.md` 入口，详细贡献指南虽然存在于 `docs/contributing.md`，但对仓库访客和潜在贡献者并不够显眼。

具体表现包括：

- `README.md` 里先讲 Web 自部署，再讲桌面下载，和大多数用户的实际进入路径相反。
- README 中的项目结构仍是旧的 `src/` 平铺视图，没有反映当前 monorepo 的 `apps/`、`packages/`、`docs/`、`spec/` 分层。
- README 中的开发命令和 CLI 运行路径已经落后于当前根级脚本与 `apps/desktop` 输出路径。
- `docs/contributing.md` 仍然偏向旧结构，没有清晰说明 desktop / web / packages 的边界，以及当前 SSD 工作流对贡献者的影响。

## Scope

- 重构根 `README.md` 的章节顺序和信息架构，使其优先服务仓库访客与潜在用户。
- 新增根级 `CONTRIBUTING.md`，作为 GitHub 可发现的贡献入口。
- 更新 `docs/contributing.md`，同步当前 monorepo 脚本、开发入口和 SSD 流程。
- 更新 `docs/README.md`，说明根级 `CONTRIBUTING.md` 与 `docs/contributing.md` 的职责关系。
- 把新的仓库入口文档约束同步回稳定的 release spec。

## Non-Goals

- 本轮不重写所有多语言 README 的整体结构。
- 本轮不改产品功能、发布资产或安装包内容。
- 本轮不引入新的文档工具链。

## Risks

- README 章节重排后，旧的锚点链接可能失效。
- 如果重构过于激进，可能导致部分细节从根 README 消失而又没有给出清晰跳转入口。

## Rollback Thinking

- 如新结构验证后反馈不佳，可恢复旧 README 排版，但保留根级 `CONTRIBUTING.md` 作为 GitHub 入口。
- 为降低回滚概率，README 会尽量保留旧锚点兼容别名，并把深度内容改为清晰跳转，而不是直接删除。
