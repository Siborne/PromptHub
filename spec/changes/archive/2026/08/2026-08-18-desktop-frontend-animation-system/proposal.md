# Proposal

## Why

桌面端 renderer 的动画现状是"三种症状,一个根因"：

- **不统一**：`active:scale-95` 与 `active:scale-90` 混用；duration 散落 5 个值（70 处 `duration-200`、17 处 `duration-300`、13 处 `duration-150`、4 处 `duration-100`、3 处 `duration-500`）；Modal 200 ms ease-in-out / ContextMenu 100 ms / Select 150 ms / Toast 300 ms 各自为政；spinner 同时存在 `Loader2Icon.animate-spin`（11 处）和手写 `<span class="border-2 ... animate-spin">`（1 处）。
- **瞎写**：`globals.css` 中 `fadeIn / slideUp / scaleIn / floatSoft` 4 个 `@keyframes` 几乎无人使用；Modal 同时混用 `ease-in-out` 和 `ease-out`；Detail pane 的 `animate-in slide-in-from-right` 没有 `key`，重选同一条都会重播。
- **缺失**：Prompt 卡片选中是色彩硬切；View mode（list ↔ gallery ↔ kanban）切换瞬切；Sidebar 折叠瞬切；Toast 入场有动画但删除瞬间消失；不尊重 `prefers-reduced-motion`。

根因只有一个——**仓库里没有"动画契约"**：没有 design token、没有"何时该动 / 不该动"的判断标准、没有可复用的 motion 组件、没有可访问性默认。新组件只能凭手感，老组件互相不一致，任何治理一段时间又会回到原点。

收益对象：

- **桌面端用户**：体感更连贯、不再被硬切打断；可访问性合规（`prefers-reduced-motion`）。
- **贡献者**：`<Reveal> <Collapsible> <ViewTransition> <Pressable>` 替代散乱的 `animate-in / duration-XXX / active:scale-XX` 写法；改 1 处比改 70 处便宜得多。
- **bundle 体积**：去掉只在一个文件用的 `framer-motion`，`ui-vendor` chunk 预计 -100 KB raw / -30 KB gzip。

## Scope

- In scope:
  - 引入桌面端 motion tokens（duration / easing / scale / translate / stagger）作为单一来源，同步到 Tailwind theme、CSS 变量、可被 framer-motion / 手写 CSS 复用。
  - 删除 `globals.css` 中无用的 `@keyframes`（`fadeIn / slideUp / scaleIn / floatSoft`）。
  - 新建 `apps/desktop/src/renderer/components/ui/motion/` 目录，提供 `<Reveal> <Collapsible> <ViewTransition> <Pressable>` 4 个意图驱动的组件包装。
  - 在 `globals.css` 顶层加 `prefers-reduced-motion` 全局降级。
  - 在 `settings.store` 与 `AppearanceSettings` 加用户级 `motionPreference` 选项（`off / reduced / standard` 3 档），落到 `<html data-motion="...">` 数据属性，由 CSS 一处兜住。
  - 全仓清理：把 `active:scale-90` 与 `active:scale-95` 统一；把裸 `duration-XXX` 迁移到 token 名；把手写 spinner 改用 `Loader2Icon`。
  - 补齐缺失动画：Prompt 卡片选中过渡、View mode 切换、Sidebar 折叠、Toast 退出、Modal 入场曲线统一。
  - 去掉 `framer-motion` 依赖：`PromptKanbanView` 中 pinned section 的 layout 动画用 CSS / View Transition 替代；从 `apps/desktop/package.json` 卸载、从 `vite.config.ts` 的 `ui-vendor` manualChunk 中移除；`bundle-budget.json` 收紧 `ui-vendor` 阈值锁住成果。
  - 新增 `spec/knowledge/structure/desktop-frontend-animation.md` 作为长期工程契约；在 `spec/knowledge/behavior/desktop.md` 加 1 条稳定要求。
- Out of scope:
  - 不改任何业务逻辑、不动 IPC、不动数据 schema、不动 i18n key。
  - 不引入 ESLint 自定义规则禁裸 duration（先靠 review checklist + 文档约束，等真的有回归再加规则）。
  - 不做 4 档 motion 偏好（off/reduced/standard/expressive）的最高档"expressive"——3 档已够，且更省实现成本。
  - 不动 web 端、不动 CLI；本变更只覆盖 `apps/desktop`。
  - 不改 Tailwind 主题色板、不改组件视觉密度。
  - 不引入 Radix / Headless UI 等 UI 库（`<Reveal>` 等仅是动画包装，不是新 UI 库）。

## Risks

- **视觉回归**：duration 与 easing 统一后，部分组件感觉"快了"或"慢了"。通过 token 选值贴近现状、视觉 diff 验收来缓解。
- **`framer-motion` 退场**：pinned kanban 的 layout 动画本来是项目里唯一展现 framer-motion 价值的地方，移除后 pinned 卡片的"飞入"会退化为简单 fade-scale。判断：可接受，且与简约风格更一致。
- **`prefers-reduced-motion` 全局降级**：会让一些用户突然失去动画。这是 a11y 合规的正确表现，提供应用内 `motionPreference` 让仍想要动画的用户可以覆盖到 `standard`。
- **裸 duration 迁移**：70+13+17+4+3 = 107 处需要替换。批量 sed 风险点是匹配到测试 fixture 或非 Tailwind 上下文；通过精准的"`duration-XXX` 紧跟 `transition-` 类名"模式匹配可控。

## Rollback Thinking

每个阶段一个独立 commit，可以按层回滚：

- Token 引入（PR 1 等价 commit）：纯添加，无破坏；revert 即可恢复，且不影响任何视觉。
- Motion 组件 + 用户开关：revert 后 `<Reveal>` 等组件不可用，但还没人用，无连锁。
- 仓库迁移：revert 还原全部裸 duration / scale 写法。
- 补齐与 framer-motion 退场：单独 commit，最坏情况是回滚到"裸 duration 已统一但缺失依旧"，仍比 baseline 好。

## Verification Strategy

- `pnpm --filter @prompthub/desktop typecheck` / `lint` / `test:unit` / `test:integration` / `build` / `bundle:budget` 全绿。
- 手动逐一验收：modal 入场出场、toast 出入、view mode 切换、prompt 卡片选中、sidebar 折叠、`prefers-reduced-motion` 开关下的行为、应用内 `motionPreference` 3 档行为差异。
- bundle 报告：`ui-vendor` 体积下降可见（去 framer-motion 后）；主入口不增。
