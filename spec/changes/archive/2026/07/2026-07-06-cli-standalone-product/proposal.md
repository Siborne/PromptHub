# Proposal

## Why

PromptHub 仓库当前已经存在一个挂在 `apps/desktop` 包内的 CLI，但它仍直接依赖 desktop main 代码与打包链路，不是独立产品。目标是将 CLI 升级为 `apps/cli` 下的独立产品，允许用户单独安装，同时与桌面版共享同一套工作区目录结构与业务核心，而不影响桌面版现有行为。

## Scope

- In scope:
- 新增 `apps/cli` 独立产品骨架。
- 新增共享核心包，先抽离运行时路径协议与数据库 bootstrap。
- 迁移现有 desktop CLI 能力到共享实现，并让 `apps/cli` 成为唯一 CLI 产品入口。
- 删除 desktop 内嵌 CLI 入口与打包物，仅在设置页保留安装说明。
- 继续补齐 standalone CLI v1 缺口，优先覆盖 `prompt` / `rules` / `skill` 资源中已存在底层能力但尚未暴露成命令的部分。

- Out of scope:
- 一次性抽离所有 desktop main 服务。
- 完成 CLI 对全部 GUI 功能的等价覆盖。
- 一次性把 skill store、远程 marketplace、所有桌面恢复/导入导出工作流完整搬到 CLI。

## Risks

- 运行时路径与数据库初始化是 desktop / web / cli 的交汇点，若抽离不当会影响现有桌面数据目录与启动逻辑。
- CLI 现有测试直接依赖 desktop 路径，需要在迁移时保持兼容。
- `prompt` 的 `visibility/scope` 类型已经存在，但 DB 层与 CLI 参数未完全走通；若只补命令不补持久化，会形成伪能力。
- `skill` 命令面扩展涉及本地 repo、版本、平台安装状态与导出格式，若不先复用 shared/core 能力，容易和 desktop 行为漂移。

## Rollback Thinking

- 如果共享核心抽离影响 desktop 启动，优先回退 shared helper 的接入点，但不恢复 desktop 内嵌 CLI 产品形态。
- 如果某一组新 CLI 子命令在本轮验证中暴露出底层契约不稳定，优先保留已验证的命令面并回退未稳定的增量子命令，而不是停掉整个 standalone CLI。
