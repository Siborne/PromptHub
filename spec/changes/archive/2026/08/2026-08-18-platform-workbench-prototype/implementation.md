# Implementation

## Status

In progress.

## Goal

在不替换当前主界面的前提下，提供一版可在应用内直接预览的“平台工作台” UI 原型，用于评估 PromptHub 从 `Prompt + Skill` 工具演进为多资源管理平台时的信息架构与视觉方向。

## Shipped In This Iteration

- 新增 `platform-workbench-prototype` 变更目录与 proposal / design / spec / tasks / implementation 记录
- 新增 `apps/desktop/src/renderer/components/settings/PlatformWorkbenchPrototype.tsx`
  - 提供多资源平台工作台原型页
  - 包含左侧能力域导航、中部资源列表、右侧上下文详情联动
  - 使用静态 mock 数据表达未来 `Prompt / Skill / Agent / MCP / Operations` 结构
- 更新 `apps/desktop/src/renderer/components/settings/SettingsPage.tsx`
  - 在桌面端设置导航新增 `Platform Preview` 入口
  - 可直接在应用内预览该原型页
- 更新 locale
  - `en` / `zh` 新增完整原型页文案
  - 其余 locale 先补齐 `settings.platformPreview`，保证设置页导航结构完整
- 更新 `apps/desktop/tests/unit/components/settings-page.test.tsx`
  - 覆盖 `Platform Preview` 入口显示与切换渲染

## Lifecycle Disposition (2026-08-18)

Status: completed. The implementation record, source component, and focused
component coverage confirm the prototype shipped; the unchecked task list was
stale bookkeeping rather than remaining work.
