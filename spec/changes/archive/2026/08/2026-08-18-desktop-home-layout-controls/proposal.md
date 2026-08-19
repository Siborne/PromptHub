# Proposal

## Why

桌面端首页已经演进到新版双栏侧边栏，用户希望保留这一结构，同时按自己的工作流控制首页模块是否显示以及显示顺序，并用直接拖拽而不是上下移动按钮完成排序。

## Scope

- In scope:
- 固定桌面端首页为新版双栏壳层。
- 为桌面端首页增加模块显隐与拖拽排序设置，覆盖 `Prompts`、`Skills`、`Rules`。
- 让 `App`、`Sidebar` 与设置页联动这些偏好，并保持本地持久化、导出/恢复一致性。
- 修正本地 Skill Source e2e 中已过期的导入成功断言。
- Out of scope:
- 改动主进程 `Settings` schema。
- 改动 `MainContent` 内部的 prompt / skill / rules 业务逻辑。

## Risks

- 如果模块显隐逻辑不完整，用户可能把首页切到一个不可达模块。
- 拖拽排序如果未和持久化顺序保持一致，重启后会出现显示顺序回退。

## Rollback Thinking

- 删除新增的桌面首页模块偏好字段，恢复固定双栏结构和固定模块顺序。
