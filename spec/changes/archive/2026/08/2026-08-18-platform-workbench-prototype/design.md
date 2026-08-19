# Design

## Summary

该原型采用“设置页挂载预览”的交付方式，避免直接替换当前 PromptHub 主工作区。

## IA Direction

原型页体现以下信息架构：

- 一级结构按能力域划分，而不是只按 Prompt / Skill 划分
- 左侧导航分为：
  - Library
  - Build
  - Integrations
  - Operations
- 中部为当前域下的资源列表与分组摘要
- 右侧为当前选中资源的详情与关联动作

## Component Strategy

- 新增独立组件：`PlatformWorkbenchPrototype`
- 放在 `apps/desktop/src/renderer/components/settings/`
- 通过设置页新增一个 `platformPreview` section 暴露入口
- 使用本地静态 mock 数据驱动交互，不接真实 store

## Visual Strategy

- 复用现有桌面端 glass / wallpaper / card 样式体系
- 保留 PromptHub 当前深色玻璃感，但降低“功能页感”，增强“工作台”气质
- 通过更强的层级、状态卡与分栏布局，展示平台化潜力

## Verification

- 设置页可看到 `Platform Preview` 入口
- 点击后可渲染工作台原型页
- 原型页至少支持：
  - 左侧导航切换
  - 中部卡片选择
  - 右侧详情联动
