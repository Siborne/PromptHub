# Delta Spec

## Added

### Requirement: Desktop prompt selection should survive window re-activation

当用户仍停留在同一个文件夹和同一批可见 prompt 上时，桌面端在窗口最小化后重新激活，不应丢失最近一次显式选中的 prompt。

#### Scenario: restore last selected prompt after window re-activation

- Given 用户在某个文件夹中已经选中了一个 prompt
- And 窗口被最小化或暂时失去焦点
- When 窗口重新激活且当前可见 prompt 列表仍包含该条目
- Then 应恢复该 prompt 的选中态，而不是退回到第一条附近
