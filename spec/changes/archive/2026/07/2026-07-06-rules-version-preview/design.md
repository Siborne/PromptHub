# Design

## Overview

保持现有 `rules:read` 返回的 `versions` 数据结构不变，仅在 renderer 侧新增“选中快照”状态。右侧主编辑区在选中快照时切换到只读预览模式；用户点击“恢复到草稿”后，把该快照内容写回 `draftContent`，再由显式保存决定是否落盘。

## Affected Areas

- Data model:
- 无新增持久化字段，继续使用 `RuleVersionSnapshot[]`
- IPC / API:
- 无新增 IPC；继续复用 `rules:read` 与 `rules:save`
- Filesystem / sync:
- 无新增文件系统写入路径；恢复历史只回填 renderer 草稿态，不直接写盘
- UI / UX:
- 版本列表由静态卡片改为可点击按钮
- 右侧编辑区支持历史预览模式
- 历史预览模式显示只读状态、返回草稿和恢复到草稿操作

## Tradeoffs

- 选择“恢复到草稿而非直接保存”会多一步确认，但能避免误覆盖当前未保存编辑
- 不新增独立历史详情面板，保持布局最小改动，降低页面复杂度
