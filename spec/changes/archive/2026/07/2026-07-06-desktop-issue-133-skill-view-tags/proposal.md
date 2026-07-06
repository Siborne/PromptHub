# Proposal

## Why

GitHub issue `#133` 指出：用户给 skill 打了标签后，主 Skill 视图面板里看不到这些标签，必须进入详情页或依赖筛选才能确认某个 skill 关联了哪些 tags。

当前 `SkillListView` 与 `SkillGalleryCard` 都只展示图标、标题、描述和平台/操作状态，没有把 `skill.tags` 渲染到主浏览面板，因此用户反馈是成立的。

## Scope

- In scope:
- 在桌面端 Skill 列表视图直接展示标签。
- 在桌面端 Skill 画廊卡片直接展示标签。
- 控制标签数量，避免破坏现有列表/卡片密度。
- 为 list/gallery 标签展示补回归测试。

- Out of scope:
- 重新设计 Skill 详情页。
- 修改 Skill 标签存储结构或筛选逻辑。

## Risks

- 标签过多会抬高卡片和列表行高，因此需要限制默认展示数量。

## Rollback Thinking

- 如果画廊卡片密度下降过多，可只保留列表视图展示，或把画廊标签收紧到更少数量。
