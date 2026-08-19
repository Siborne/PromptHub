# Design

## Overview

本变更建立桌面端 renderer 的"动画系统"——一组 token + 一组组件 + 一份契约，让"何时该动、动多久、由谁守护"从手感变为可查表。

不是一次大重构，而是一次**自下而上的固化**：

1. 先有 token；
2. 用 token 包出意图驱动的组件；
3. 用 token + 组件清理仓库现状；
4. 把没补的动画补上；
5. 顺手卸掉只在 1 个文件用的 `framer-motion`，让 bundle 也变干净。

## Affected Areas

- Data model:
  - `settings.store` 增加 `motionPreference: 'off' | 'reduced' | 'standard'`（持久化），`setMotionPreference(value)` action。
  - 不动主进程 schema、不动 IPC、不动 i18n key 增删（仅添加 3 个新 i18n key 用于 UI 选项标签）。
- IPC / API:
  - 不动。
- Filesystem / sync:
  - 不动；`motionPreference` 走现有 `prompthub-settings` localStorage 持久化与同步链路（这是 renderer-only 的偏好）。
- UI / UX:
  - **新增**：
    - `apps/desktop/src/renderer/styles/motion-tokens.ts`（token 单一来源）
    - `apps/desktop/src/renderer/components/ui/motion/{Reveal,Collapsible,ViewTransition,Pressable,index}.tsx`
    - `spec/knowledge/structure/desktop-frontend-animation.md`
  - **修改**：
    - `apps/desktop/tailwind.config.js`（同步 token）
    - `apps/desktop/src/renderer/styles/globals.css`（CSS 变量、`prefers-reduced-motion`、`[data-motion]` 选择器；删除 4 个死 `@keyframes`）
    - `apps/desktop/src/renderer/stores/settings.store.ts`（新 field 与 action）
    - `apps/desktop/src/renderer/components/settings/AppearanceSettings.tsx`（暴露选择器）
    - `apps/desktop/index.html` 或顶层组件：把 `motionPreference` 同步到 `<html data-motion>` 属性
    - 全仓 batch：`active:scale-90 → active:scale-pressIn`、`duration-XXX → duration-tokenName`、`transition-all duration-200 ease-out` 等手写语义统一
    - `apps/desktop/src/renderer/components/prompt/PromptKanbanView.tsx`（去掉 framer-motion）
    - `apps/desktop/src/renderer/components/ui/Modal.tsx`、`Toast.tsx`、`ContextMenu.tsx`、`Select.tsx` 等 overlay 类组件（统一到 token + 入场 / 出场曲线）
    - `apps/desktop/src/renderer/components/layout/MainContent.tsx`（detail pane `key`、view mode 切换、prompt 卡片选中过渡）
    - `apps/desktop/src/renderer/components/layout/Sidebar.tsx`（tag 区折叠用 `<Collapsible>`）
    - `apps/desktop/package.json`（卸 `framer-motion`）
    - `apps/desktop/vite.config.ts`（从 `ui-vendor` manualChunk 移除 `framer-motion`）
    - `apps/desktop/bundle-budget.json`（`ui-vendor` 阈值收紧）

## Token 设计

```ts
// apps/desktop/src/renderer/styles/motion-tokens.ts
export const MOTION = {
  duration: {
    instant:   80,   // 微反馈：按钮按下、checkbox toggle
    quick:    120,   // hover 变色、focus 边框
    base:     180,   // 元素 mount/unmount（modal、popover、toast）
    smooth:   280,   // 多段联动（progress、折叠面板）
    slow:     420,   // 强调性入场（empty state、欢迎页）
  },
  easing: {
    standard:   "cubic-bezier(0.4, 0.0, 0.2, 1)", // 通用 hover / state
    enter:      "cubic-bezier(0.0, 0.0, 0.2, 1)", // 入场：减速
    exit:       "cubic-bezier(0.4, 0.0, 1, 1)",   // 出场：加速
    emphasized: "cubic-bezier(0.2, 0.0, 0, 1)",   // iOS 风强调
    linear:     "linear",                          // 进度 / spinner
  },
  scale: {
    pressIn:   0.95, // 按钮按下统一 95（不再 90/95 混用）
    enterFrom: 0.96, // modal/popover 入场起点
    hoverLift: 1.02, // 卡片 hover
    mediaZoom: 1.08, // gallery 图片 hover
  },
  translate: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 16,
  },
  stagger: {
    tight:  16,
    normal: 32,
    loose:  60,
  },
} as const;
```

Tailwind 同步：

```js
theme.extend.transitionDuration = {
  instant: '80ms', quick: '120ms', base: '180ms', smooth: '280ms', slow: '420ms',
}
theme.extend.transitionTimingFunction = {
  standard:   'cubic-bezier(0.4, 0.0, 0.2, 1)',
  enter:      'cubic-bezier(0.0, 0.0, 0.2, 1)',
  exit:       'cubic-bezier(0.4, 0.0, 1, 1)',
  emphasized: 'cubic-bezier(0.2, 0.0, 0, 1)',
}
theme.extend.scale = {
  'press-in':  '0.95',
  'enter-from': '0.96',
  'hover-lift': '1.02',
  'media-zoom': '1.08',
}
```

## CSS 变量与 reduced-motion

```css
:root {
  --motion-duration-instant: 80ms;
  --motion-duration-quick:   120ms;
  --motion-duration-base:    180ms;
  --motion-duration-smooth:  280ms;
  --motion-duration-slow:    420ms;
  --motion-scale: 1; /* 用户偏好乘子 */
}

/* 系统级 a11y 默认 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* 应用内开关 */
html[data-motion="off"] *, html[data-motion="off"] *::before, html[data-motion="off"] *::after {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}
html[data-motion="reduced"] {
  --motion-scale: 0.6;
}
html[data-motion="standard"] {
  --motion-scale: 1;
}

/* 让用户的"standard"覆盖系统偏好 */
html[data-motion="standard"] *,
html[data-motion="standard"] *::before,
html[data-motion="standard"] *::after {
  animation-duration: revert !important;
  transition-duration: revert !important;
}
```

## 意图驱动组件

每个组件包装一个意图，对外只暴露语义化 prop。

```tsx
// <Reveal intent="enter">
//   入场：fade-in + zoom-in-96 + duration-base + ease-enter
// <Reveal intent="exit">
//   出场：fade-out + zoom-out-95 + duration-quick + ease-exit
<Reveal intent="enter">{content}</Reveal>

// <Collapsible open>
//   纯 CSS：grid-rows-[0fr] ↔ grid-rows-[1fr] 高度过渡，无需 JS 测高
<Collapsible open={isOpen}>{tagsPanel}</Collapsible>

// <ViewTransition activeKey={viewMode}>
//   activeKey 变化时，旧子树淡出、新子树淡入
<ViewTransition activeKey={viewMode}>
  {viewMode === 'list' ? <ListView /> : <GalleryView />}
</ViewTransition>

// <Pressable>
//   button 替代物：active:scale-pressIn + transition-transform duration-instant
<Pressable onClick={...}>{children}</Pressable>
```

实现细节：

- 不引入 framer-motion；全部基于 `tailwindcss-animate`（`animate-in / animate-out`）+ 原生 CSS。
- `<Reveal>` 用 `data-state="open|closed"` 触发 in/out 动画。
- `<ViewTransition>` 用 React `key` + `tailwindcss-animate` 的 `animate-in fade-in`；不依赖 View Transition API（兼容性更好、可控）。

## 仓库迁移策略

按风险递增，分阶段提交：

1. **零风险**：删除 `globals.css` 死 keyframes；引入 token 但还没人用。
2. **低风险**：把 `duration-200 / duration-150 / duration-100 / duration-300 / duration-500` 全量替换成 token 名。这是机械性替换；用 `grep -rE "\bduration-(80|100|120|150|180|200|280|300|420|500)\b"` 定位。
3. **低风险**：`active:scale-90` 全部改 `active:scale-press-in`，`active:scale-95` 也统一到 `active:scale-press-in`。
4. **低风险**：手写 spinner（`PromptEditor` 那一处）改 `Loader2Icon`。
5. **中风险**：补缺失动画（prompt 卡片选中、view mode 切换、sidebar 折叠、toast 退出、modal `key`）。逐组件验收。
6. **中风险**：去 `framer-motion`。`PromptKanbanView` pinned section 改用 `<Reveal>` + `tailwindcss-animate`；卸依赖；改 `vite.config.ts`、`bundle-budget.json`。

## Tradeoffs

- **不引入 ESLint 规则**：先靠 review checklist + 文档，等出现回归再加规则。规则成本（写、维护、绕开）大于当下收益。
- **不实现 `expressive` 档**：3 档 (`off / reduced / standard`) 已覆盖核心场景；高速档没有强需求。
- **不依赖 View Transition API**：Electron 33 / Chromium 已支持，但跨视图状态保留与生命周期与 React 协作不完美；用 `tailwindcss-animate` + `key` 更可预测。
- **去 framer-motion**：失去 layout 动画的高级能力；本仓库没用到，留着只占体积。pinned kanban 的 layout 动画退化为 fade-scale，可接受。
- **`prefers-reduced-motion` 在 jsdom 中始终 `matches: false`**：现有 `tests/setup.ts` mock 已固定为 false，行为可预测，无需特殊处理。

## Open Questions

- **测试覆盖**：是否给 `<Reveal> <Collapsible> <ViewTransition> <Pressable>` 写单测？答：写最小烟测（mount + 切 prop + 断言 className），不要测帧动画。
- **`AppearanceSettings` 的 i18n key**：`settings.motion.title / off / reduced / standard / desc`，5 个 key 在 7 个 locale 文件中加。

## Implementation Order

按一个 PR 内部的 commit 顺序（每 commit 独立可回滚）：

1. `feat(motion): introduce motion tokens and reduced-motion defaults`（token + globals.css 改造 + 死 keyframes 清理 + Tailwind 同步）
2. `feat(motion): add motion component primitives and user preference`（`<Reveal>` 等 + `motionPreference` 到 settings store + AppearanceSettings 选项 + i18n keys + `<html data-motion>` 同步）
3. `refactor(motion): migrate desktop renderer to motion tokens`（裸 duration / scale 全量替换；spinner 统一）
4. `feat(motion): fill animation gaps across desktop renderer`（prompt 卡片选中、view mode、sidebar 折叠、toast 退出、modal key）
5. `refactor(motion): drop framer-motion in favor of tailwindcss-animate`（kanban pinned 改造 + 卸依赖 + vite manualChunk 改 + bundle-budget 收紧）
6. `docs(motion): sync stable structure and behavior spec`（`spec/knowledge/structure/desktop-frontend-animation.md` + `spec/knowledge/behavior/desktop.md` 增章节）
