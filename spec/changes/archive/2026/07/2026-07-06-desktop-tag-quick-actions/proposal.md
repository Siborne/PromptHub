# Proposal

## Why

Issue #144 反馈当前桌面端标签的添加和删除路径过长。用户在浏览 prompt 详情时，如果想调整标签，往往需要进入编辑弹窗或标签管理器，打断当前浏览流。

## Scope

- In scope:
- 在主内容区当前选中 prompt 的详情头部提供直接添加标签能力
- 在主内容区当前选中 prompt 的标签 chips 上提供直接删除能力
- 复用现有标签目录与 prompt 更新链路，避免新增数据模型
- Out of scope:
- 不实现“拖拽 prompt 到 sidebar 标签上添加标签”
- 不改造 sidebar 标签区为完整标签编辑器

## Risks

- 详情区直接写标签需要保证不会破坏现有筛选点击行为
- 新增标签若未同步到 tag catalog，后续在其他地方可能不易再次发现

## Rollback Thinking

- 回退到仅支持通过编辑弹窗或标签管理器维护标签
