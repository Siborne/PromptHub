# Delta Spec

## Added

- Desktop 卡片详情面板中的用户提示词展示区域 MUST 支持双击进入现有的 inline edit 流程，不要求用户必须先双击标题。

## Modified

- Desktop 画廊 `small` / `medium` 模式下的 prompt 标题展示 MUST 允许自动换行，而不是固定两行截断。

## Removed

- 无。

## Scenarios

- 当用户在桌面卡片详情面板中双击用户提示词正文时，界面进入当前已有的 inline edit 模式，并允许保存或取消。
- 当用户在桌面画廊 `small` / `medium` 模式下查看超长标题时，标题会自然换行显示，而不是在两行后被强制截断。
