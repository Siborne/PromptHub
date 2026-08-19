# Design

## Overview

本变更不是单点优化，而是一组按 ROI 排序的小手术：先把"看不见的东西可视化"（基线 + 预算），再做能直接降低首屏体积与列表延迟的两件事（设置页拆分 + 列表虚拟化），最后做能让前两件事在未来不被回退的结构性清理（modal 状态解耦 + 巨型 store 拆分 + manualChunks 复核）。

每个阶段单独可 ship、可回滚，互不强依赖。

## Affected Areas

- Data model:
  - 不变更主进程 schema 与 IPC 契约。
  - renderer `skill.store.ts` 拆分后保持对外的 hook 接口稳定，以便消费方零改动。
- IPC / API:
  - 不动。
- Filesystem / sync:
  - 不动业务逻辑；`bundle-budget` 与 `build:analyze` 输出物落在 `apps/desktop/dist-stats/`，写入 `.gitignore`。
- UI / UX:
  - `apps/desktop/vite.config.ts`：调整 `manualChunks`，加入 `rollup-plugin-visualizer` 的 analyze 模式。
  - `apps/desktop/src/renderer/components/layout/MainContent.tsx`：移除手写分批渲染、抽 modal 状态。
  - `apps/desktop/src/renderer/components/skill/SkillListView.tsx`、`prompt/PromptGalleryView.tsx`、`prompt/PromptKanbanView.tsx`、`layout/Sidebar.tsx`：改为虚拟化容器。
  - `apps/desktop/src/renderer/components/settings/DataSettings.tsx`、`AISettings.tsx`：拆分为子目录 + 二级 lazy。
  - `apps/desktop/src/renderer/stores/skill.store.ts`：拆出 `skill-platform-sync.slice`、`skill-scan.slice` 等。
  - 新增 `apps/desktop/scripts/check-bundle-budget.mts` 与 `apps/desktop/bundle-budget.json`。

## Phases

变更被切成 6 个独立阶段。每阶段一个或多个 atomic commit、PR 维度可单独评审与回滚。

### P1 — Bundle 可观测性（基础工程）

目标：在动手任何代码优化前，建立"前后对比"的客观依据。

- 装 `rollup-plugin-visualizer` 作为 `apps/desktop` 的 devDependency。
- 在 `vite.config.ts` 增加 `BUILD_ANALYZE` 环境变量分支：
  - 普通构建：行为不变。
  - `BUILD_ANALYZE=1 pnpm build`：额外输出 treemap 报告到 `apps/desktop/dist-stats/index.html`。
- 在 `apps/desktop/package.json` 增加 `build:analyze` 脚本。
- 写 `apps/desktop/scripts/check-bundle-budget.mts`，读取 `out/renderer/assets/*.js` 的 `gzipSize`，与 `bundle-budget.json` 比对，超阈值时以非 0 退出并打印 diff。
- `bundle-budget.json` 初版给出宽松基线（按当前实测值 + 5% 缓冲），后续阶段每完成一项再收紧。
- `.gitignore` 增加 `apps/desktop/dist-stats/`。
- CI 暂不强制运行预算脚本；先以本地工具形式存在，避免初版阈值过紧导致无关 PR 阻塞。

退出条件：开发者能在本地 `pnpm --filter @prompthub/desktop build:analyze` 看到 treemap，且 `pnpm exec tsx scripts/check-bundle-budget.mts` 在当前产物上通过。

### P2 — 设置页拆分（直接的首屏 / 设置页交互收益）

目标：把 `DataSettings.tsx` (2774 行) 与 `AISettings.tsx` (2717 行) 拆出二级面板并按需加载。

- 新建目录 `apps/desktop/src/renderer/components/settings/data/` 与 `.../ai/`：
  - `DataSettings.tsx` 仅保留二级面板 router / 切换骨架。
  - 子文件按现有 section 边界拆分（如 `WebdavPanel.tsx`、`SelfHostedPanel.tsx`、`S3Panel.tsx`、`BackupPanel.tsx`、`ImportExportPanel.tsx` 等；AI 类似）。
- 在 `DataSettings.tsx` / `AISettings.tsx` 内通过 `lazy()` + `<Suspense>` 加载子面板。
- `useSettingsStore` 选择器只取该面板需要的字段，避免子面板重渲染牵动父面板。
- i18n key 全量保持原值，不做改名。
- 测试：保留现有 `data-settings.test.tsx` 与 `ai-test-workbench.test.tsx`，必要时给每个新面板加最小渲染 + 关键交互断言。

退出条件：所有子面板单文件 ≤ 600 行；切换面板能命中独立 chunk（在 P1 的 treemap 上可见）。

### P3 — 长列表虚拟化

目标：去除"列表越长越卡"的现象与 `MainContent.tsx` 中的手写分批渲染补丁。

- 装 `@tanstack/react-virtual`。
- 改造 4 个组件：
  - `SkillListView.tsx`：当前直接 `.map()`，改为 `useVirtualizer({ count: skills.length, getScrollElement, estimateSize })`，行高用估算 + measureElement 兜底。
  - `PromptGalleryView.tsx`：grid 模式，使用 `useVirtualizer({ horizontal: false })` 计算行，每行渲染 N 张卡片（N = 容器宽度 / 卡片宽度）。
  - `PromptKanbanView.tsx`：每列内部独立虚拟化；列容器自身仍是横向 flex。
  - `Sidebar.tsx` 文件夹树：仅当文件夹数量超阈值（如 200）才走虚拟化，避免少量文件夹时引入抖动；嵌套结构展平为线性数组（带 depth 字段）后再虚拟化。
- 同步移除 `MainContent.tsx` 中的：
  - `LARGE_PROMPT_LIST_THRESHOLD`、`INITIAL_PROMPT_RENDER_COUNT`、`PROMPT_RENDER_CHUNK_SIZE`、`PROMPT_RENDER_CHUNK_DELAY_MS`、`PROMPT_CARD_INTRINSIC_SIZE`。
  - 对应 `useEffect` 内 `setTimeout` 分批 setState 逻辑。
- 与 `@dnd-kit` 协作：
  - 拖拽时禁用虚拟化的滚动重测；
  - drop 后重新计算高度；
  - 拖拽 ghost / placeholder 用绝对定位浮于虚拟容器之上。
- e2e：在 `tests/e2e/` 增加 `prompt-large-list.spec.ts`，准备一组 ≥ 1000 条 prompts 的 fixture，验证滚动 + 拖拽 + 选中态。

退出条件：`MainContent.tsx` 行数明显下降；`pnpm test:perf` 通过；e2e 通过。

### P4 — Modal 状态解耦

目标：让 modal 开关不再让整列 prompts rerender。

- 新建 `apps/desktop/src/renderer/stores/prompt-modal.store.ts`（zustand），用于承载：
  - 当前活跃 modal 类型与 payload（AI test、detail、image preview、variable input、version history、confirm）。
  - actions：`openAiTest(prompt)`、`closeModal()` 等。
- `MainContent.tsx`：
  - 不再以 `useState` 持有 modal 状态。
  - 把 modal 渲染挪到一个独立 `<PromptModalsHost />` 组件，订阅 `prompt-modal.store`。
- `PromptCard`（如果当前不是独立组件，则在本阶段抽出来）：
  - `memo` 包裹；
  - 通过 zustand selector 直接订阅"自己这条 prompt"对应的字段（`useShallow` 或自带浅比较）。
- 单测：用 RTL + `vi.spyOn(React, 'createElement')` 或 react-test-renderer 的渲染计数验证 modal 开关不再触发卡片层 rerender。

退出条件：modal 开关时 prompt 卡片 rerender 次数为 0（仅 modal host 与对应 modal 自身 rerender）。

### P5 — `skill.store` 拆分

目标：把 `skill.store.ts` (1695 行) 中的冷路径拆出，让其不再被 main bundle 强制吃进。

- 在 `apps/desktop/src/renderer/stores/skill/` 下拆出：
  - `core.ts`：CRUD、列表、过滤、当前选中。
  - `platform-sync.ts`：与各 AI 平台同步逻辑。
  - `scan.ts`：安全扫描 / 导入前检查。
  - `export.ts`：导出 / 备份相关动作。
- 主入口 `skill.store.ts` 仅 re-export `core.ts`。
- 平台同步 / scan / export 在调用点（设置页 / store 详情页 / 导出对话框）使用动态 `import()` 加载。
- 保持现有 `useSkillStore()` API 不变，调用方零改动。

退出条件：`skill.store` chunk 在 P1 的 treemap 上明显瘦身；冷路径只在对应页面打开时载入。

### P6 — manualChunks 复核 + 收紧体积预算

目标：让首屏不再被 markdown 全量拖进，并把基线落到更紧的预算里。

- 在 `vite.config.ts` 中：
  - 移除 `markdown-vendor` manual chunk（让 vite 按动态 import 自动拆）。
  - 把 `markdown` 渲染相关依赖（`react-markdown`、`remark-gfm`、`rehype-*`、`hast-util-sanitize`、`highlight.js`）的入口集中在一个 `<MarkdownViewer>` 组件，并让该组件本身 lazy。
  - 重新审视 `ui-vendor`（`framer-motion` + `dnd-kit`）：dnd-kit 仅在拖拽场景使用，可在使用面单独 lazy。
- 复核 `lucide-react` 调用方式，确保所有调用点都是命名 import（不依赖默认 import）。
- 复核 `tailwind.config.js` `content` 字段，确保覆盖到 `packages/core` 等新加的源路径。
- 收紧 `bundle-budget.json` 阈值，把主入口 gzip 目标设到 ≤ 250 KB（如可达）；超出即 fail。
- 把预算脚本接入 `quality.yml` 工作流（在 `pnpm build` 之后执行）。

退出条件：`pnpm build` 不再打印 "chunks larger than 500 kB" 警告；CI 中 budget 检查通过。

### P14 — Prompt 激活视图隔离（2026-08-15 follow-up）

`DES-PERF-14`：Prompt 工作区的 `viewMode` 是视图挂载的唯一来源。Card route 与 list/gallery/kanban/graph/generation route 互斥挂载；非激活视图不保留 DOM、Markdown renderer、virtualizer 或 canvas simulation。Dialog layer 独立于视图 route，切换视图时继续保留。

关系图保持现有数据与交互契约，但缩短三种 motion preference 的模拟预算。标准模式最多 30 个 cooldown ticks，减少模式最多 12 个，关闭动画模式只执行 24 个同步 warmup ticks；所有模式共享 750 ms 硬时间上限和较高的 alpha 停止阈值。节点在进入 force engine 前按确定性 sunflower 分布写入初始坐标，避免随机重叠导致首帧碰撞解算。Canvas 指针命中检测只在指针位于图区域内时启用，避免 graph 可见但用户操作侧栏时仍逐帧读取 shadow canvas。`ResizeObserver` 只有在宽高真实变化时才更新 React state。

复杂度由“激活视图成本 + 隐藏表格成本 + 隐藏卡片详情成本”收敛为 `O(active view)`；初始坐标生成是 `O(n)` 时间和 `O(n)` 节点存储，force 模拟受 750 ms 与 tick 双重上限约束；非激活视图的 DOM、内存与动画成本为 `O(0)`。不变更 SQLite、IPC、持久化视图偏好或 Prompt 数据契约。

### P15 — Agent 概览被动资源快照（2026-08-15 follow-up）

`DES-PERF-15`：`useAgentAssetInventoryMap` 接受明确的 eager domain 与 validation 策略。资源管理页保持默认按需加载能力；`AgentOverviewPanel` 传入空 eager domain 且关闭全域 validation，只投影 Zustand 中已经存在的 Skills、MCP、Rules 和 Plugins 快照。

概览不再拥有资源发现生命周期。冷缓存时数量使用现有未知占位；用户进入具体资源页或点击该页刷新后，由该领域自己的 store / panel 执行真实读取。这样不会复制数据源，也不新增持久缓存或 IPC 契约。

优化前每次概览挂载会触发最多一次 My Skills 读取、一次 Agent Skills 目录扫描、三套领域库加载以及一次随 store 更新反复执行的全域聚合校验，文件 I/O 为 `O(skill files + MCP config + rule files + plugin inventory)`。优化后概览资源投影只遍历 renderer 已缓存条目，为 `O(cached inventory)` 内存读取；冷缓存 I/O 为 `O(0)`。资源页的真实扫描复杂度不变，但只在用户明确进入相应领域时发生。

### P16 — Skill 远程目录按需加载（2026-08-17 follow-up）

`DES-PERF-16`：`SkillManager` 的 My Skills 页面是本地库 surface，只负责加载本地 Skill 数据与动态导入的内置注册表。商店更新提示可以投影 Zustand 已持久化的 `remoteStoreEntries`，但不得在挂载时复用远程同步 hook，也不得读取自动同步设置或预取全部远程源。

`SkillStore` 继续拥有远程目录生命周期：用户进入商店后只加载当前选择的来源，明确刷新时强制更新；设置中的自动同步 cadence 只在商店同步 owner 存活时生效。这样启动和模块切换的网络成本从 `O(remote sources * page entries)` 收敛为 `O(0)`，本地缓存投影保持 `O(cached store entries)`，不会新增数据库、IPC 或持久化契约。

### P17 — 主进程数据库初始化边界（2026-08-17 follow-up）

`DES-PERF-17`：数据库初始化与普通设置读取必须分离。Electron 启动入口继续唯一负责 `initDatabase()`、schema/migration 检查以及 canonical workspace reconciliation；Agent/Skill 平台路径读取只通过 `getDatabase()` 复用当前连接。数据库尚未初始化时维持现有容错返回，不允许为一个 selector 隐式初始化数据库。

Canonical Skill reconciliation 仍在真实启动和恢复重开时执行，持久化、migration 与恢复契约不变。热路径从每次平台枚举触发 `O(skills * package files)` 的删除、复制与校验，收敛为一次 SQLite settings 查询 `O(1)`；启动期 reconciliation 保持一次有界 `O(skills * package files)`。

## Implementation Order

P1 → P2 → P3 → (P4 与 P5 可并行) → P6；P7-P17 为后续独立补强。

P1 是基础观测，必须最先；P6 必须最后，因为它会"封盘"前面所有阶段拿到的收益作为新基线。

## Tradeoffs

- **复杂度**：引入虚拟化与额外 store 会让代码层级增加；通过把 hook 包成 `usePromptListVirtualizer` 之类的小封装可缓解，但额外抽象本身也是成本。
- **测试维护**：虚拟化让 RTL 中"找节点"更难（DOM 中只有可视区域）；测试需要扩展滚动到目标项的辅助 helper。
- **Bundle 预算**：阈值过紧会卡住和性能无关的 PR；初版预算保守，再阶段性收紧。
- **设置页拆分**：拆得越细，懒加载收益越大，但开发者体验上调试一个面板要切多个文件；按面板划分（不按行数硬切）保留可读性。
- **markdown lazy**：`PromptDetailModal` / `SkillFullDetailPage` 首次打开会有一次额外 chunk 加载延迟；对桌面端来说这是可接受代价。
- **保留 framer-motion**：本变更不动它，避免视觉动画风险；体积压力放到 follow-up。

## Open Questions

- bundle 预算脚本是否进 `quality.yml`？P6 阶段会决定；倾向于"进，但只在主分支与 release 分支强制"。
- 虚拟化容器与现有 `ColumnResizer` / 自定义 scroll 的协作是否会破坏；P3 阶段需要在 desktop 实机上验证。
- `skill.store` 拆分后，零改动迁移是否真的能做到，要等 P5 阶段读完所有调用点才能确认。
