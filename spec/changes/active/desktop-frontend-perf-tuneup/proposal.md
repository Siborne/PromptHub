# Proposal

## Why

桌面端 renderer 当前有几个明确的性能与可维护性问题，已经从用户层面（首屏加载、长列表卡顿）和工程层面（巨型单文件）能感知到：

- 主入口 chunk `index-*.js` 在生产构建后达到 1.20 MB / gzip 368 KB，一次性进入首屏；CI 的 vite 构建提示 `Some chunks are larger than 500 kB`。
- 长列表（`SkillListView`、`PromptGalleryView`、`PromptKanbanView`、`Sidebar` 文件夹树）没有任何虚拟化；`MainContent.tsx` 内已经存在手写的 `INITIAL_PROMPT_RENDER_COUNT = 160` + `setTimeout` 分批渲染补丁，说明原始性能已经撞过墙。
- 单文件臃肿：`DataSettings.tsx` 2774 行、`AISettings.tsx` 2717 行、`MainContent.tsx` 2490 行、`Sidebar.tsx` 1603 行、`skill.store.ts` 1695 行、`settings.store.ts` 1776 行。这些文件既拖累构建拆分，也让任何小改动的 review / typecheck / HMR 全量受牵连。
- `manualChunks` 已经把 `markdown-vendor` (322 KB) 当作一个 vendor chunk 显式聚合，导致只要任意首屏代码碰到 markdown，就会强制把整个 vendor 拉进首屏。
- 没有 bundle 可视化或体积预算，每次性能回归只能靠人眼盯 vite 输出。
- Prompt 工作区会同时挂载当前视图、隐藏的表格视图和隐藏的卡片详情；当持久化视图为关系图时，每次进入 Prompt 还会重新启动 200 tick 的力导向计算，造成进入页面和切换模块时的明显卡顿。

收益对象是桌面端日常用户（首屏冷启动、几百条 prompts/skills 的列表滚动）以及未来的贡献者（更小的单文件、更可预测的分包）。这次变更是一次**有边界的性能调优**，不引入新功能。

## Scope

- In scope:
  - 引入 bundle 分析工具与体积预算检查脚本，在 CI / 本地建立可量化基线。
  - 拆 `DataSettings.tsx` / `AISettings.tsx` 两个超长文件为按面板划分的子组件，并按设置页二级路由懒加载。
  - 给 4 个长列表场景接入 `@tanstack/react-virtual`：`SkillListView`、`PromptGalleryView`、`PromptKanbanView`、`Sidebar` 文件夹树。
  - 移除 `MainContent.tsx` 内的手写分批渲染（`INITIAL_PROMPT_RENDER_COUNT` / `PROMPT_RENDER_CHUNK_SIZE` / `setTimeout`），改由虚拟化承接。
  - 把 `MainContent.tsx` 中的 modal 状态（AI test、prompt detail、image preview、variable input、version history、confirm dialog）抽到独立 store / context，避免 modal 开关导致整页 rerender。
  - 把 `skill.store.ts` 中冷路径（platform 同步、scan、export）拆出独立 module 并按需 import。
  - 复核 `vite.config.ts` 的 `manualChunks` 策略，让 `markdown-vendor` 不在首屏关键路径中。
  - 审计 `lucide-react` 命名导入与 Tailwind `content` 配置，确保 tree-shaking / purge 没有遗漏。
  - Prompt 工作区只挂载当前激活的重量级视图，并为关系图模拟设置有界、较短的收敛预算。
  - Agent 概览只读取 renderer 已有资源快照，不在模块切换时隐式扫描 Skills 或加载 MCP、Rules、Plugins；深度读取由对应标签页或显式刷新触发。
- Out of scope:
  - 不替换 Zustand / 不更换 React 主版本 / 不接入 RSC 或 server components。
  - 不改 IPC 契约、不改主进程业务逻辑、不改数据库 schema。
  - 不改样式视觉、不调整色板、不改动暗黑模式 token。
  - Web 端（`apps/web`）和 CLI 不在本变更内。
  - 不引入 framer-motion 替代或动画重构（保留为后续 follow-up）。

## Risks

- 列表虚拟化常见踩坑：高度估算偏差会导致滚动跳变；拖拽排序（`@dnd-kit`）与虚拟化协作时需保持稳定 keys；这两类回归需要 e2e 与单测一起兜。
- 设置页拆分时若没把 i18n key、zustand selector、副作用搬全，会出现 panel 打开后空白或丢失保存事件的回归。
- modal 状态抽离若搬动 ref（如 textarea ref / scroll ref），可能引入聚焦与未保存提示的丢失。
- `manualChunks` 调整可能让 SSR / Electron renderer 启动顺序变化；首次冷启动需要回归。
- 性能预算（如主入口 ≤ 1 MB）若设得过紧，会让无关 PR 频繁红 CI；初版需要保守阈值。

## Rollback Thinking

每个子任务都对应一个独立 commit，可以单独 revert：

- 虚拟化与设置页拆分各自落在独立 commit；如果某一项触发回归，只回滚该 commit。
- bundle visualizer 与 budget 脚本默认只生成报告，不在主流程中阻塞；初期可通过开关临时禁用而无需回滚代码。
- 如果 `manualChunks` 调整带来启动期问题，可以回到当前 vendor 分组，仅保留组件级 lazy 拆分。
- modal 状态抽离与 `MainContent` 解耦如果引入新 bug，可保留虚拟化 / 设置页拆分，单独回退该 slice。

## Verification Strategy

- `pnpm lint` + `pnpm typecheck` + `pnpm test:unit` + `pnpm test:integration` 全绿。
- e2e 冒烟（`pnpm test:e2e:smoke`）通过；列表场景额外加针对虚拟滚动的回归点。
- bundle 报告上传到 `apps/desktop/dist-stats/` 或类似目录，PR 中需附前后对比数字。
- 大数据预算脚本（`pnpm test:perf`）继续通过。
