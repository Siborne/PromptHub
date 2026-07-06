# Proposal

## Why

GitHub issue `#134` 提到：用户自定义添加的 Skill 商店一旦创建后，只能启用、刷新、删除，不能修改名称。当前 UI 和 store action 也确实缺少 rename/update 能力。

由于自定义商店名称会直接出现在左侧入口和详情标题中，无法重命名会迫使用户删除后重建，体验较差，也容易丢失已缓存的选中状态与远程条目状态。

## Scope

- In scope:
- 为桌面端自定义 Skill 商店补充重命名能力。
- 保持现有自定义商店数据结构和 persist 机制不变。
- 补充一个最小组件回归测试。

- Out of scope:
- 修改自定义商店 URL / 类型。
- 引入新的编辑弹窗或数据库层持久化。

## Risks

- 详情态与列表态都能进入编辑时，要避免状态不同步或删除时残留编辑态。

## Rollback Thinking

- 如果 inline rename 交互过于拥挤，可以回退成只在详情面板支持重命名。
