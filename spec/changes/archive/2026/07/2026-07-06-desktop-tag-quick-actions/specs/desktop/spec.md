# Delta Spec

## Added

### Requirement: Desktop prompt detail supports direct tag editing

用户在桌面端查看当前 prompt 详情时，应能直接完成常见标签维护动作，而不必先打开编辑弹窗。

#### Scenario: remove a tag directly from prompt detail

- Given 用户当前正在查看一个带标签的 prompt
- When 用户在详情头部点击某个标签的删除动作
- Then 该标签应立即从当前 prompt 上移除

#### Scenario: add a tag to prompt by dragging from sidebar

- Given 用户当前正在查看一个 prompt
- And 左侧 sidebar 中存在一个标签 chip
- When 用户将该标签从左侧拖拽到当前 prompt 的详情标签区
- Then 该标签应立即添加到当前 prompt
