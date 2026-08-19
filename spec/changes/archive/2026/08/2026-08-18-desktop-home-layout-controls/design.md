# Design

## Overview

把桌面首页模块偏好放在 renderer `settings.store` 中持久化，而不是升级主进程 `Settings` 契约。这样这些设置会自然进入现有 localStorage 快照、导出与恢复流程，同时不会影响主进程只关心的启动/同步配置。

`App` 固定使用 `rail + panel` 两段式 `Sidebar` 组合。`Sidebar` 负责根据 `desktopHomeModules` 决定左侧模块导航是否显示某个模块，并在当前模块被禁用时自动切到首个可见模块。`AppearanceSettings` 复用现有 `dnd-kit` 能力，把已启用模块的顺序调整改成直接拖拽。

## Affected Areas

- Data model:
- `apps/desktop/src/renderer/stores/settings.store.ts`
- IPC / API:
- 无新增 IPC
- Filesystem / sync:
- 复用既有 `prompthub-settings` 持久化与 settings snapshot 备份/恢复链路
- UI / UX:
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
- `apps/desktop/src/renderer/components/settings/AppearanceSettings.tsx`
- `apps/desktop/tests/e2e/local-store-source.spec.ts`

## Tradeoffs

- 把模块偏好留在 renderer store，避免主进程 schema 扩张，但这也意味着这些偏好不会出现在主进程设置数据库中。
- 固定新版双栏减少了壳层分支，代价是放弃了旧版单栏作为可选项。
