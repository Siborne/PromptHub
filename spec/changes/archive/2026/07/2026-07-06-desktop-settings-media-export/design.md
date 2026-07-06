# Design

## Overview

这次改动拆成四条独立但轻量的链路：

1. `DataSettings` 内的升级快照列表改成“摘要 + 默认前几项 + 展开后的滚动容器”。
2. `AppearanceSettings` 基于现有 `window.electron` 图片存储能力保存背景图文件名，设置里只持久化引用与展示参数。
3. 图片模式主题层从“半透明覆写”提升为独立的 Liquid Glass 合同：先定义 blur / tint / stroke / specular / shadow 这组材质 token，再由 panel / surface / toolbar / chip / search 等语义层消费。
4. Skill 导出增加 `skill:exportZip`，由主进程直接读取 Skill 本地仓库并打 zip，前端只负责下载结果。

## Affected Areas

- Data model:
- `packages/shared/types/settings.ts` 增加桌面背景图相关字段
- `apps/desktop/src/renderer/stores/settings.store.ts` 增加默认值、setter、hydrate/migrate 与主题应用逻辑

- IPC / API:
- `packages/shared/constants/ipc-channels.ts` 增加 `skill:exportZip`
- `apps/desktop/src/preload/api/skill.ts` 与 `preload/index.ts` 暴露 zip 导出
- `apps/desktop/src/main/ipc/skill/crud-handlers.ts` 增加 zip 导出 handler

- Filesystem / sync:
- 背景图复用现有 `image:save` / `local-image://` 链路，把文件保存在应用图片目录
- Skill zip 导出通过主进程读取本地 repo 目录并使用 `fflate` 打包，确保导出整个文件夹
- 设置备份仍通过 `settings-snapshot.ts` 捕获背景图配置，图像文件本身由现有图片目录备份链路覆盖

- UI / UX:
- `DataSettings` 为升级回滚列表增加计数摘要、展开控制和独立滚动区域
- `SettingsPage` 保持独立 `Skill` 导航项，Skill 安装/扫描配置由 `SkillSettings` 独立承载，`DataSettings` 只负责数据路径、备份、恢复与同步
- Skill 平台排序沿用统一默认优先级，并在 `SkillSettings` 用原生 HTML5 drag-and-drop 直接改写 `skillPlatformOrder`；上下箭头保留为辅助操作
- GitHub issue 版本标签通过 Issue Forms + `issues` workflow 协作完成：Issue Form 继续收集必填版本字段，workflow 解析 issue body 里的 `Version` / `Target version` 段落并同步单个 `version: ...` 标签
- `AppearanceSettings` 增加桌面背景图预览、选择、清除、透明度和虚化滑杆
- `App.tsx` 在根布局下注入背景层，不大面积修改现有布局组件
- 背景图预览不再单独拼一张图片和蒙层，而是复用应用真实背景层（image + blanket）并在设置页内渲染缩略版 wallpaper shell，保证预览和实际走同一套材质链路
- `globals.css` 拆分图片模式的玻璃材质合同，并新增 search / chip / toolbar 等局部材质 token
- `TopBar`、`Sidebar`、`PromptListHeader`、`MainContent` 接入更明确的海拔梯度：搜索框最亮、toolbar 次之、pane / panel 更稳、card 最轻
- Skill 详情导出按钮改为 `SKILL.md` + `ZIP`

## Tradeoffs

- 背景图继续放在通用图片目录，而不是单独开 `backgrounds/` 目录。优点是复用现有读写链路；代价是目录里会混合 Prompt 图片和背景图，但对当前产品成本最低。
- Liquid Glass 优化优先走 CSS token + 少量 class 接入，而不是引入新的渲染层或 Canvas 特效。优点是风险小、容易和现有 Tailwind / 语义类兼容；代价是折射与液态流动感仍主要依赖渐变、描边和 backdrop filter，而不是更复杂的实时材质模拟。
- Skill zip 导出直接返回 base64 zip 内容给渲染层下载，而不是弹系统保存框。优点是保持现有下载交互一致；代价是大仓库会经过一次 renderer 桥接，但 Skill 仓库规模在当前场景下可接受。
- 回滚列表默认只展开前几项，牺牲了“全部立即可见”，换取设置页总体可读性和纵向稳定性。
- 平台默认顺序不直接改扫描/安装底层循环，而是通过统一排序 helper 作用在设置页、Skill 详情页和批量部署面板，降低对导入/检测逻辑的副作用。
- GitHub 不支持把 Issue Form 输入直接映射成动态 label，因此版本标签必须由 workflow 在 issue opened/edited 后补写；解析逻辑抽到独立脚本里以便单测。
