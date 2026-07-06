# Implementation

## Shipped

- `DataSettings` 的升级快照区域改成“摘要 + 默认展示最新 3 条 + 展开后固定高度滚动区”，避免历史快照把整个设置页无限撑高。
- 收口桌面设置信息架构回归：`SettingsPage` 恢复独立 `Skill` 导航页，`SkillSettings` 重新承载 Skill 安装方式、平台顺序、目标目录和额外扫描目录，`DataSettings` 不再混入这些配置。
- Skill 平台顺序改成可直接拖拽排序，并把默认优先级统一收敛为 `Claude Code -> Codex CLI -> OpenCode -> OpenClaw -> Hermes Agent -> Cursor`；统一排序 helper 同时覆盖 `SkillSettings` 和 Skill 详情/批量部署使用的顺序逻辑。
- GitHub issue 提交流程增加自动版本标签：`bug-report.yml` 和 `feature-request.yml` 都把版本字段设为必填说明，`.github/workflows/issue-version-label.yml` 在 issue 打开或编辑后解析 issue form 正文，并同步单个 `version: ...` 标签。
- `AppearanceSettings` 增加桌面背景图设置：支持选择/更换/清除本地背景图，支持透明度与虚化调节，并在 `App.tsx` 根布局渲染背景层。
- 将全局背景控制权完全交还给用户：彻底移除了 `settings.store.ts` 中的透明度下限与模糊值强制映射逻辑，并将 UI 层面的滑块上限从 60% 放开到 100%（0-100 全区间调节），解决了背景图强制发白/发灰的 washed out 现象。
- 取消强加的底色与硬编码：
  1. 此前为了保证最极端情况下的文字可读性，强制在 UI 面板上叠加了 45% ~ 60% 的白/黑底色。现已将 `.app-background-mode-image` 中的底色透明度大幅降低（如 `shell` 降至 `transparent`，`panel` 降至 `0.15` ~ `0.2`）。
  2. 修复了 `settings.store.ts` 中 `clampBackgroundImageBlur` 错误地将最大虚化值锁死在 40 的问题，现在已完全开放为 0-100。
  3. 修改了默认行为：将默认图片虚化（`DEFAULT_BACKGROUND_IMAGE_BLUR`）从 6 降至 0，并将默认背景可见度（`DEFAULT_BACKGROUND_IMAGE_OPACITY`）从 0.22 提升至 1.0。
  4. 完全移除了图片模式下的 UI 面板（如 `.app-wallpaper-panel`）自带的 `backdrop-filter: blur(...)` 毛玻璃滤镜。现在整个应用的虚化和透明度 **完全且仅由** 用户在设置界面的两个滑块中控制。把真正的显示效果和取舍权（图片清晰度 vs 文字对比度）完全交还给用户。
- 全局清理破坏沉浸感的纯色卡片：移除了所有基础 UI 组件（如 `Button`, `Modal`）及业务页面（Sidebar, MainContent, 各设置页与技能库页）中硬编码的 `bg-card`、`bg-background`，统一接入 `app-wallpaper-surface`、`app-wallpaper-panel-strong` 等语义化玻璃层类，确保各种层级均能正确透出壁纸，且在亮/暗模式下均保持文字高可读性。
- 修复了图片模式下亮色模式文字不可读的问题：修复了 `.app-background-mode-image` 中对亮色模式变量的错误反转，将亮色模式下主文本加深至 15% 亮度、次要文本加深至 35% 亮度，边框改回浅灰，大幅提升了亮色模式对比度。
- 优化了虚化设置滑块体验：将虚化的调节范围设定为 0 到 50px，并且步长 (step) 设置为 0.5，以便于进行微调。
- 修复了“无背景图时 UI 也被透明化”的回归：将 `app-wallpaper-*` 的默认样式恢复为普通实心层级，只在 `.app-background-mode-image` 作用域下才启用透明/通透覆写；同时把 `App.tsx` 中背景图启用条件收紧为“存在非空白文件名”才切换图片模式。
- 修复了 Prompt 列表卡片的默认外观回归：将 `MainContent` 中卡片列表的未选中项和左侧列表容器恢复为提交前的 `bg-card` / `bg-card/50` 默认样式，并新增 `.prompt-list-card`、`.prompt-list-pane` 仅在图片模式下启用透明覆写，确保无图时与原始 UI 一致。
- 修正背景图选择逻辑，移除了首次进入图片模式时偷偷注入的 `opacity=0.88` / `blur=16` 默认档；现在无论首次选图还是换图，都严格沿用设置中的当前透明度与模糊值。
- 将图片模式从零散覆写收束为独立的 light/dark glass token 层：`globals.css` 新增一组语义化 surface / settings / prompt-list token，默认 UI 继续走基础 token，进入 `app-background-mode-image` 后再整体切换到图片模式主题，降低与默认 UI 的耦合，便于后续主题市场扩展。
- 加深了亮色图片模式的文本、次级文本、边框与玻璃面板层级，不再依赖 `text-shadow` 一类兜底手段；暗色图片模式也同步切到了同一套 token 体系，保持风格一致。
- 把设置页中的背景图预览改成了实际应用界面的缩略版：抽出了共享的背景层组件，复用真实的 image + blanket + wallpaper shell 结构，避免出现“预览一套、实际一套”的效果偏差。
- 修正了图片模式玻璃材质职责：背景图透明度与模糊仍只由设置滑块控制，但侧边栏、toolbar、surface、prompt list pane 与排序菜单恢复为独立的默认 glass blur / tint token，避免 UI 壳层退化为纯透明薄片。
- 将默认玻璃材质进一步收口到主左侧菜单栏：设置页左导航不再接入 `.app-left-rail-glass`，避免设置区也吃到默认 blur；同时把 `Sidebar` 底部 `标签` 区从 `panel-strong` 降回普通 `panel` 材质，避免该区域在有背景图时显得过白。预览缩略图仍保留左栏玻璃层级，用来对应实际主菜单栏效果。
- `AboutSettings` 底部版权文案更新为 `AGPL-3.0 License © 2026 PromptHub`，与当前发布年份一致。
- `settings.store` 新增背景图文件名、透明度、虚化状态，补齐 `persist` version `5` migration、rehydrate 和 CSS 变量同步。
- Skill 导出主入口从详情视图收敛为 `SKILL.md` + `ZIP`，`ZIP` 通过新的 `skill:exportZip` 主进程 handler 直接从本地仓库打包整个目录。
- Skill ZIP 导出修正为按原始字节读取本地仓库文件，避免图片或其他二进制资源在导出时被文本占位符破坏。
- 补齐背景图与升级快照摘要相关 locale 文案到 `en`、`zh`、`zh-TW`、`ja`、`de`、`es`、`fr`。
- 新增/更新回归测试，覆盖背景图 store、升级快照默认折叠、ZIP 下载工具和 Skill 导出 UI。
- 收口后续回归修复：修正 `skill-installer.ts` 中 `scanLocal` / `scanLocalPreview` 的花括号结构，恢复语法可解析状态，避免桌面端 lint 被扫描逻辑的 parse error 阻塞。
- 收口 `TopBar` 新建方式下拉：移除组件内中文 fallback，完全依赖现有 i18n key，并补充 portal 菜单 outside-click 关闭与切换 `creationMode` 的回归测试。
- 收口主题/背景图片链路白盒扫描结果：
  1. `LocalImage` 在 `src` 变化时会重置失败状态，避免用户从坏图切换到新图后仍一直停留在占位态。
  2. `settings.store` 对背景图引用增加本地文件名归一化和来源限制，拒绝 `http(s):` / `data:` / `blob:` / 路径穿越类输入，并为透明度/模糊同值更新增加短路，减少无意义持久化写入。
  3. `image.ipc.ts` 收紧桌面端图片保存与下载边界：`image:save` 仅接受主进程图片选择器刚返回的路径；远程下载改为手动跟随重定向并逐跳重新校验 SSRF 约束，同时校验图片类型与体积上限。
  4. `video:save` 现在也与 `image:save` 对齐：仅接受主进程视频选择器刚返回的路径，并额外限制到受支持的视频扩展名，避免 renderer 直接提交任意本地路径混入应用数据目录。
  5. `App.tsx` 在 `themeMode=system` 时补上运行时系统深浅色变化监听，避免只在启动时读取一次系统主题。
  6. 图片模式下额外修复侧边栏底部标签区材质过白的问题，只对 `.app-background-mode-image .sidebar-tag-section` 做局部覆写，不影响其他玻璃层合同。

## Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test -- --run tests/unit/main/skill-installer.test.ts tests/unit/components/skill-detail-utils.test.ts tests/unit/components/skill-i18n-smoke.test.tsx tests/unit/components/data-settings.test.tsx tests/unit/stores/settings-background-image.test.ts`
- `pnpm build`
- 本轮增量验证：`pnpm lint`
- 本轮增量验证：`pnpm --filter @prompthub/desktop test -- --run tests/unit/stores/settings-background-image.test.ts`
- 本轮增量验证：`pnpm exec eslint src/main/services/skill-installer.ts`
- 本轮增量验证：`pnpm exec eslint src/renderer/components/layout/TopBar.tsx tests/unit/components/top-bar.test.tsx`
- 本轮增量验证：`pnpm test -- tests/unit/components/top-bar.test.tsx --run`
- 本轮增量验证：`pnpm test -- --run tests/unit/stores/settings-background-image.test.ts tests/unit/components/local-image.test.tsx tests/unit/components/appearance-settings.test.tsx tests/unit/main/image-ipc.test.ts`
- 本轮增量验证：`pnpm --filter @prompthub/desktop test -- --run tests/unit/components/settings-page.test.tsx tests/unit/components/data-settings.test.tsx tests/unit/components/about-settings.test.tsx`
- 本轮增量验证：`pnpm --filter @prompthub/desktop test -- --run tests/unit/components/skill-settings.test.tsx tests/unit/components/use-skill-platform.test.ts`
- 本轮增量验证：`pnpm --filter @prompthub/desktop test -- --run tests/unit/services/issue-version-label.test.ts`
- 本轮增量验证：`pnpm typecheck`
- 本轮增量验证：`pnpm test -- --run`
- 本轮增量验证：`pnpm build`

## Synced Docs

- active change 已同步：`tasks.md`、`implementation.md`
- 稳定 specs / architecture / docs 尚未同步

## Follow-ups

- 如果这组改动准备正式交付，再决定是否把稳定文档同步到 `spec/workflow/*`、`spec/knowledge/*`、`spec/rules/`、`spec/releases/` 或 `spec/adr/`。
- PR #110 仍不建议直接合并；`ScannedSkill` 可空字段契约与 Hermes / nested 扫描测试缺口仍需单独处理。

### Liquid Glass Refinement
- Removed harsh `linear-gradient` specular highlights from `.app-wallpaper-chip`.
- Shifted to authentic iOS materials using:
  - Strong, consistent `backdrop-filter: blur(24px) saturate(160%)`.
  - Subtle `rgba` tint layers instead of stark overlays.
  - Rim lighting via crisp 0.5px/1px inner `box-shadow` instead of opaque `border`.
  - Minimal drop shadow to avoid the "cheap capsule" floating look.
- Refactored `Sidebar.tsx`:
  - Cleaned up excessive use of `.app-wallpaper-chip` on unselected items. Unselected items now properly sit flush with the `.app-wallpaper-panel` layer (using pure text colors + hover transitions) rather than creating dozens of glass cutouts.
  - Removed `border-border` from UI containers (`TopBar`, `MainContent`, etc.) utilizing `.app-wallpaper-*` to let the transparent glass rims shine through accurately.
