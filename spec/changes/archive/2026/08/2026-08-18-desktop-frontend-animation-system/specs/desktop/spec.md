# Delta Spec

本 delta 把"桌面端动画系统"作为可观察契约写进 `spec/knowledge/behavior/desktop.md`。本变更不是新增功能，而是把"如何动、动多久、谁负责守护"的判定标准从隐式经验固化为可验证规则。

## Added

- 桌面端 renderer 必须有一份 motion tokens（`apps/desktop/src/renderer/styles/motion-tokens.ts`），覆盖 duration / easing / scale / translate / stagger 五个维度，并同步暴露到：
  - Tailwind theme（`transitionDuration`、`transitionTimingFunction`）
  - CSS 变量（`--motion-duration-*`、`--motion-easing-*`）
- 桌面端 renderer 必须提供"意图驱动"的 motion 组件包装（位于 `apps/desktop/src/renderer/components/ui/motion/`），至少包含：
  - `<Reveal intent="enter" | "exit">`：元素入场 / 出场
  - `<Collapsible open>`：折叠 / 展开
  - `<ViewTransition activeKey>`：视图切换的 cross-fade
  - `<Pressable>`：按钮按下微反馈
- 桌面端必须支持用户级 motion 偏好（`settings.store` 中的 `motionPreference: 'off' | 'reduced' | 'standard'`），通过 `AppearanceSettings` 暴露选择器；偏好通过 `<html data-motion="...">` 数据属性生效，CSS 一处兜底。
- 桌面端 `globals.css` 必须包含 `@media (prefers-reduced-motion: reduce)` 全局降级（动画时长降到 0.01 ms、`scroll-behavior: auto`），保障 a11y 合规；用户在应用内显式设置 `motionPreference = 'standard'` 时可覆盖系统偏好。
- 桌面端 `spec/knowledge/structure/desktop-frontend-animation.md` 必须存在，作为长期动画工程契约（token 取值、意图分类表、禁用清单、缺失补齐清单）。

## Modified

- 桌面端 renderer 的 duration / easing / scale 写法必须使用 token 名（如 `duration-base`、`ease-enter`、`active:scale-pressIn`），不应再使用裸毫秒（`duration-200`）或裸值（`scale-95`、`scale-90` 同时存在）。
- 桌面端 spinner 写法应统一为 `Loader2Icon className="animate-spin"`；不应再出现手写 `<span className="border-2 ... animate-spin">` 等等价物。
- 桌面端 Modal、Toast、ContextMenu、Select、Popover 等 overlay 类组件的入场 / 出场曲线应使用同一组 token：入场 `easing.enter`、出场 `easing.exit`；时长统一到 `duration.base`（入场）/ `duration.quick`（出场）。
- 桌面端 Prompt 卡片选中态切换、Sidebar 折叠区展开 / 收起、view mode 切换（list ↔ gallery ↔ kanban）应使用过渡动画而非瞬切。
- 桌面端 Toast 关闭时应使用 `animate-out`，不应直接消失。
- 桌面端 detail pane 的入场动画应通过对 `<div key={selectedPromptId}>` 而非组件常驻 `animate-in`，让"重选同一条 prompt"不再重播入场动画。

## Removed

- 移除 `apps/desktop/src/renderer/styles/globals.css` 中未被使用的 `@keyframes fadeIn / slideUp / scaleIn / floatSoft` 与对应的 `.animate-fadeIn / .animate-slideUp / .animate-scaleIn / .animate-floatSoft` 工具类。
- 移除桌面端对 `framer-motion` 的依赖：`PromptKanbanView` 中 pinned section 的 layout 动画用 CSS（或 View Transition API）替代；从 `apps/desktop/package.json` `devDependencies` 卸载；从 `vite.config.ts` 的 `ui-vendor` manualChunk 中移除。

## Scenarios

- 新组件作者写"hover 变色"时，只用 `transition-colors duration-quick`，不再写 `duration-150` / `duration-200` 等裸值。
- 用户启用 macOS "减少动态效果" 后打开桌面端，所有 transition / animation 时长降到 0.01 ms，无任何动画卡顿；用户也可以在应用内 `Settings → Appearance → Motion` 显式设置 `standard` 来在该机器上覆盖系统偏好。
- 用户切换 prompt 视图（list → gallery）时，旧视图淡出、新视图淡入；不再瞬切。
- 用户在 prompt 列表中点击同一条 prompt 不会触发任何动画（`key` 未变）；点击另一条会让 detail pane 触发入场动画。
- 桌面端 build 产物中 `ui-vendor` chunk 体积下降可见（移除 `framer-motion` 后）；`bundle-budget.json` 中 `ui-vendor` 阈值收紧并锁住成果。
