# Implementation

## Status

In progress.

项目级 Skill 第一版核心链路已接通，剩余未完成项主要是版本号更新，以及仓库内与本轮改动无关的既有 `typecheck` 问题清理。

## Shipped In This Iteration

- 共享类型与设置持久化
  - 在 `packages/shared/types/skill.ts` 新增 `SkillProject`
  - 在 `packages/shared/types/settings.ts` 增加 `skillProjects`
  - 在 `apps/desktop/src/renderer/stores/settings.store.ts` 增加项目的新增、更新、删除与持久化逻辑
- Skill 视图状态扩展
  - 在 `apps/desktop/src/renderer/stores/skill.store.ts` 增加 `projects` 视图、`selectedProjectId`、`projectScanState`
  - 新增 `selectProject()`、`scanProjectSkills()`、`setProjectScanState()`、`getVisibleProjectScannedSkills()`
- Projects 一级入口与页面接入
  - 在 `apps/desktop/src/renderer/components/layout/Sidebar.tsx` 新增 `Projects` 一级导航入口
  - 在 `apps/desktop/src/renderer/components/skill/SkillManager.tsx` 接入 `SkillProjectsView`
  - 在 `apps/desktop/src/renderer/components/skill/SkillProjectsView.tsx` 实现项目列表、项目内 Skill 卡片列表、导入与分发入口
  - 将 `Projects` 页面结构收敛为“左侧项目卡片 + 右侧项目内 Skill 卡片列表 / 全宽 Skill 详情”两态布局，不再保留中间项目运营信息栏
  - 项目内不再自动默认打开首个 Skill；用户点击某个 Skill 卡片后，右侧整块切换为 `SkillFullDetailPage`
  - 在项目详情返回后恢复到该项目的 Skill 卡片列表，保持项目上下文不丢失
  - 当进入项目内某个 Skill 详情时，整块内容区切为全宽详情页并隐藏项目列表栏，避免项目名、统计、路径、扫描目录等信息继续占据主视线
  - 项目列表态头部进一步减噪，仅保留项目名、Skill 数量与必要操作，不再常驻展示根路径、导入统计、扫描目录清单与打开项目入口
- 顶栏项目模式联动
  - 在 `apps/desktop/src/renderer/components/layout/TopBar.tsx` 中接入项目视图搜索、结果计数与 “Add Project” 主按钮行为
  - 项目模式下隐藏结果上下导航，避免将项目扫描结果误当作库内 Skill 结果导航
- 项目扫描与导入链路
  - 继续复用 `scanLocalPreview(customPaths)` 与 `importScannedSkills()`
  - `importScannedSkills()` 返回 `importedSkills`，并为项目导入 Skill 写入本地路径型 `source_url` 与 `local_repo_path`
  - `scanProjectSkills()` 在扫描失败时保留项目扫描状态并向调用方抛错，避免 UI 将失败误显示为 “扫描到 0 个”
  - `scanProjectSkills()` 现在会自动扩展项目默认技能目录：`.claude/skills`、`.agents/skills`、`skills`、`.gemini`，而不再只扫描用户手填路径
  - 项目默认扫描路径不再包含整个项目根目录，避免刷新时遍历 `node_modules`、`packages` 等大型项目目录导致长时间转圈；如果用户确实要扫描项目根目录，可将根目录显式加入额外扫描路径
  - 项目扫描不再复用全局 `scanLocalPreview()` 的 `isLoading/error` 状态流，而是直接调用 IPC 并只更新 `projectScanState`，避免项目刷新与全局导入预览互相污染
  - 项目刷新不再传入 AI 安全扫描配置，避免把 40+ 个项目技能的刷新变成串行模型调用导致界面长时间转圈；安全扫描仍保留在显式详情操作中
  - 修复项目 Skill 文件页读取失败：`*ByPath` 本地仓库 API 不再错误要求路径必须位于 PromptHub 自有 `skills` 目录内；项目模式现在以传入的 Skill 根目录为边界，并继续阻止相对路径逃逸根目录
- 项目内目录级分发链路
  - 在项目 Skill 详情右侧新增“Project Deployment”面板，不再只提供“Import to My Skills”单一路径
  - 项目分发目标持久化到 `skillProjects[].deployTargets`，默认预置当前项目的 `.agents/skills`
  - 用户可继续添加多个项目内目标目录，并在详情页多选后执行一次分发
  - 主进程新增按绝对路径复制整个 Skill 目录到任意目标目录的能力，目标结构为 `<target>/<skill-name>/...`
  - 分发后自动触发当前项目重扫，使新目录下的 Skill 立即出现在项目扫描结果里
  - 项目页头部现已增加“从我的技能导入”按钮，用户可直接从库内 Skill 多选并导入到当前项目
  - 导入弹窗改为卡片网格布局并支持搜索
  - 导入弹窗支持高级目录设置：默认 `.agents/skills`，也可多选 `.claude/skills`、`.gemini/skills` 或自定义目录
  - 库内 Skill 导入现在先调用 `getRepoPath(skill.id)` 确保存在完整本地 repo，再复制整个 Skill 目录，避免只复制 `SKILL.md` 或因缺少 repo 而卡住
  - 从“我的技能”导入到项目时，按目标目录检测 `<target>/<skill-name>` 是否已经存在；已存在的目标会在 UI 中显示 `Already Imported` 并禁止重复选择
  - 项目扫描卡片现在只按稳定路径识别是否已存在于“我的技能”库，不再按同名兜底，避免把不同来源的项目 Skill 误判为库内 Skill
  - 批量导入项目目录使用 `ifExists: "skip"` 作为主进程复制兜底，避免 stale UI 或并发点击把同名项目 Skill 直接覆盖
  - 项目 Skill 重新部署到项目目录前，会先过滤与源 Skill 相同或位于源 Skill 内部的目标，避免生成 `<target>/<skill>/<skill>` 形式的嵌套副本
  - 主进程 `copyRepoByPathToDirectory()` 额外阻止“目标技能目录与源技能目录相同”的危险复制，即使其他入口绕过前端保护也不会落盘
- 设置迁移与平台排序回归修复
  - `loadSettingsFromMainProcess()` 现在会先标准化 `customAgents`，当主进程未返回新结构时再显式回退到 `customAgentRootPaths` / `customSkillScanPaths`，避免旧配置在 renderer 加载时被空数组短路
  - Skill Settings 中平台顺序列表的上下移动边界现在基于完整的 `managedAgentEntries`，custom agent 出现在末尾时不再错误允许继续下移
  - Rules workspace 的 cached global descriptors 现在会按当前 `customAgents` 重新过滤；custom agent 被删除或禁用后，旧的 custom rule 不会继续残留在 Rules 页面
  - Settings 中修改 `customAgents`、`disabledPlatformIds`、`setRulePlatformTracked()` 后会主动触发 Rules workspace 强制重扫，确保“上面改顺序/启用状态，下面规则配置立即生效”
  - `rules.store` 内部的 section title 不再写死英文，避免其他调用点误用未本地化标题
  - built-in platforms 现在新增 `builtinAgentOverrides` 持久化结构，支持 `rootPath / skillsRelativePath / rulesRelativePath / agentsRelativePath / commandsRelativePath / configRelativePaths` 完整覆写，不再只支持 root override
  - renderer 与 main process 现在都优先从 `builtinAgentOverrides` 计算 effective built-in agent config；旧 `customPlatformRootPaths` / `customSkillPlatformPaths` 仅作为兼容迁移来源，并继续镜像输出 `rootPath`
  - `SkillSettings` 中原先分离的“Platform Root Directories”已升级为统一的 `Agent Configurations` 区块，built-in agents 和 custom agents 都按同样的“root + relative paths + derived assets”心智管理
  - `self-hosted-sync` 已同步备份/恢复 `builtinAgentOverrides`，避免跨端同步时只保留 legacy root override 而丢失 built-in relative path 配置
  - 在全量测试收口阶段，顺手修复了两个既有 UI 回归：`SkillListView.tsx` 补回 `useSettingsStore` 导入；`SkillProjectDeployPanel.tsx` 对 `projects` 做空数组防御，避免 integration mock 未给 `skillProjects` 时 `.map()` 崩溃
- 搜索与标签语义修正
  - 在 `apps/desktop/src/renderer/services/skill-filter.ts` 新增 `filterVisibleScannedSkills()`，专用于项目扫描结果过滤
  - 在 `apps/desktop/src/renderer/services/skill-stats.ts` 与 `apps/desktop/src/renderer/components/skill/skill-modal-utils.ts` 中，仅将 `http(s)` 型 `source_url` 识别为远程来源，避免本地路径型 `source_url` 污染原始标签/来源判定
- i18n 补齐
  - 为 `en`、`zh`、`zh-TW`、`ja`、`fr`、`de`、`es` 补齐 `Projects` 导航、项目页、顶栏项目搜索所需键

## Verification

- 通过：`pnpm lint`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/top-bar.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/components/skill-detail-utils.test.ts tests/unit/components/skill-i18n-smoke.test.tsx tests/unit/stores/skill.store.test.ts`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-projects-view.test.tsx tests/unit/components/top-bar.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/components/skill-i18n-smoke.test.tsx`
- 通过：`pnpm --filter @prompthub/desktop test:run tests/unit/stores/skill.store.test.ts`
- 通过：`pnpm --filter @prompthub/desktop test:run tests/unit/components/skill-projects-view.test.tsx`
- 通过：`pnpm --filter @prompthub/desktop test:run tests/unit/main/skill-installer.test.ts`
- 通过：`pnpm --filter @prompthub/desktop exec eslint src/renderer/components/skill/SkillProjectsView.tsx src/renderer/stores/skill.store.ts src/main/services/skill-installer-repo.ts src/preload/api/skill.ts src/main/ipc/skill/local-repo-handlers.ts tests/unit/components/skill-projects-view.test.tsx tests/unit/stores/skill.store.test.ts tests/unit/main/skill-installer.test.ts`
- 通过：`pnpm --filter @prompthub/desktop exec eslint src/renderer/components/skill/SkillProjectsView.tsx tests/unit/components/skill-projects-view.test.tsx`
- 通过：`pnpm --filter @prompthub/desktop exec eslint src/renderer/components/skill/SkillProjectsView.tsx src/renderer/components/settings/SkillSettings.tsx src/renderer/stores/settings.store.ts src/renderer/services/project-skill-targets.ts src/main/services/skill-installer-repo.ts tests/unit/components/skill-projects-view.test.tsx tests/unit/components/skill-settings.test.tsx tests/unit/stores/settings-agent-roots.test.ts tests/unit/main/skill-installer.test.ts`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-projects-view.test.tsx tests/unit/components/skill-settings.test.tsx tests/unit/stores/settings-agent-roots.test.ts tests/unit/main/skill-installer.test.ts`
- 通过：`pnpm exec vitest run tests/unit/stores/settings-agent-roots.test.ts tests/unit/components/skill-settings.test.tsx tests/unit/stores/settings-rules-sync.test.ts tests/unit/main/skill-installer-utils.test.ts tests/unit/services/self-hosted-sync.test.ts`（在 `apps/desktop/` 下执行）
- 通过：`pnpm exec vitest run`（在 `apps/desktop/` 下执行）
- 通过：`pnpm build`（在 `apps/desktop/` 下执行）
- 通过：`pnpm --filter @prompthub/desktop exec eslint src/renderer/services/agent-root-paths.ts src/renderer/stores/settings.store.ts src/renderer/components/settings/SkillSettings.tsx src/renderer/services/self-hosted-sync.ts src/main/services/skill-installer-utils.ts src/main/ipc/settings.ipc.ts tests/unit/stores/settings-agent-roots.test.ts tests/unit/components/skill-settings.test.tsx tests/unit/stores/settings-rules-sync.test.ts tests/unit/main/skill-installer-utils.test.ts tests/unit/services/self-hosted-sync.test.ts`
- 通过：`node -e "for (const f of ['en','zh','zh-TW','ja','fr','de','es']) JSON.parse(require('fs').readFileSync('apps/desktop/src/renderer/i18n/locales/'+f+'.json','utf8'));"`
- 通过：`pnpm --filter @prompthub/desktop build`
- 未通过：`pnpm --filter @prompthub/desktop typecheck`
  - 现存仓库问题：`src/main/services/skill-installer.ts(295,35)`、`SkillSettings.tsx` 的 `enabled` 字段类型、`SkillListView.tsx` 缺少 `useSettingsStore`、`rule-platform-order.ts` 的 `RulePlatformId` 类型、`settings.store.ts` 的既有设置字段类型
- 部分通过但未最终绿灯：`pnpm --filter @prompthub/desktop test:run`
  - 大部分测试已执行通过，但在接近结束时因 Node/Vitest worker OOM 退出，属于仓库级测试资源问题，不是本轮变更的明确功能回归
- 项目 Skill 扫描结果现在会保留安装方式元数据：
  - `installMode` 区分复制安装和软链接安装
  - `symlinkTargetPath` 记录软链接源头目录
  - `isPromptHubManagedLink=false` 时在列表中显示 `External install`
- 项目 Skill 安装来源标签现在按管理边界显示：
  - 与 My Skills 稳定匹配的 copy 分发显示 `Copy install`。
  - 未匹配到 My Skills 的项目本地 copy 文件夹显示 `External install`。
  - PromptHub 管理的 symlink 显示 `Symlink install`。
  - 非 PromptHub 管理的 symlink 显示 `External install`。
- 项目 Skill 与 My Skills 的关联识别现在按稳定来源判断：
  - 优先匹配项目路径与库内 `local_repo_path` / `source_url`。
  - 对 symlink 还会匹配 `symlinkTargetPath`。
  - 对 copy 分发会使用 `directory_fingerprint` 精确匹配库内 Skill。
  - 不按名称兜底，避免同名不同来源的项目 Skill 被误认。
- 项目 Skill 状态判断现在使用与 Agent Skills 相同的共享 Skill scan status helper，避免项目页和 Agent 页各维护一套标签/关联逻辑。
- 项目 Skill 详情的来源区域现在会在软链接安装时分别显示当前项目快捷方式路径和源 Skill 路径，两个卡片都可以单独打开。
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/skill-installer.test.ts --testNamePattern "discovers project skills installed as symlink directories"`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-projects-view.test.tsx --testNamePattern "external symlink project|source-target"`
- 通过：`pnpm --filter @prompthub/desktop typecheck`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-projects-view.test.tsx`
- 通过：`pnpm --filter @prompthub/desktop typecheck`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-projects-view.test.tsx --testNamePattern "same directory fingerprint|same-name project skills"`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-projects-view.test.tsx`
- 通过：`pnpm --filter @prompthub/desktop typecheck`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/components/skill-agents-view.test.tsx tests/unit/components/skill-projects-view.test.tsx`
  - 2 files passed
  - 34 tests passed
  - Existing React `act(...)` warnings still appear in the Agent detail test path, but all assertions pass.
- 通过：`pnpm --filter @prompthub/desktop typecheck`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/services/skill-scan-status.test.ts tests/unit/components/skill-agents-view.test.tsx tests/unit/components/skill-projects-view.test.tsx`
  - 3 files passed
  - 46 tests passed
  - Covers shared Project/Agent lifecycle status rows, including unmanaged copied folders as external installs.

## Tests Added / Updated

- `apps/desktop/tests/unit/components/sidebar.test.tsx`
  - 覆盖桌面端显示 `Projects` 一级入口
  - 覆盖 Web runtime 隐藏 `Projects`
- `apps/desktop/tests/unit/components/top-bar.test.tsx`
  - 覆盖项目模式搜索 placeholder、结果计数与 “Add Project” 事件触发
- `apps/desktop/tests/unit/stores/skill.store.test.ts`
  - 覆盖 `scanProjectSkills()` 失败时保留扫描状态并抛错
  - 覆盖项目扫描会自动补齐默认技能目录
  - 覆盖项目默认扫描不再包含项目根目录，根目录只有显式配置时才参与扫描
- `apps/desktop/tests/unit/components/skill-detail-utils.test.ts`
  - 覆盖本地路径型 `source_url` 仍被判定为本地来源
- `apps/desktop/tests/unit/components/skill-i18n-smoke.test.tsx`
  - 补充 `nav.projects`、`header.searchProjectSkills`、`header.resultsCount` 键存在性校验
- `apps/desktop/tests/unit/components/skill-projects-view.test.tsx`
  - 覆盖默认展示项目内 Skill 卡片列表
  - 覆盖点击 Skill 卡片后切换到全宽详情页
  - 覆盖从项目详情返回到项目内 Skill 卡片列表
  - 覆盖进入详情后不再显示项目侧栏与其他 Skill 卡片内容
  - 覆盖项目内 Skill 直接分发到默认 `.agents/skills` 目标目录
  - 覆盖从“我的技能”导入到项目时，对已存在于目标目录的同名 Skill 展示 `Already Imported` 并禁止重复导入
  - 覆盖同名但不同路径的项目 Skill 不再误判为 `In My Skills`
  - 覆盖项目 Skill 已位于选中目标目录树内时阻止重复部署并提示 warning
- `apps/desktop/tests/unit/main/skill-installer.test.ts`
  - 覆盖外部项目 Skill 根目录上的 `list/read/write/create/rename/delete` by-path 文件操作
  - 覆盖外部项目 Skill 根目录仍会拒绝 `../` 相对路径逃逸
  - 覆盖将整个 Skill 目录复制到项目目标目录，以及拒绝复制到源目录内部
  - 覆盖项目目标目录已存在时可按 `ifExists: "skip"` 保留原文件并跳过覆盖
  - 覆盖当目标技能目录与源目录相同时拒绝复制
- `apps/desktop/tests/unit/stores/settings-agent-roots.test.ts`
  - 覆盖主进程仅返回 legacy `customAgentRootPaths` 时，renderer 仍正确加载兼容字段
  - 覆盖 legacy `customPlatformRootPaths` 会在 renderer migrate 时提升为 `builtinAgentOverrides`
- `apps/desktop/tests/unit/components/skill-settings.test.tsx`
  - 覆盖 custom agent 存在时最后一个托管条目的“下移”按钮禁用边界
  - 覆盖 built-in agent 在统一配置区中修改 root override 时会写回 built-in override 配置
- `apps/desktop/tests/unit/stores/settings-rules-sync.test.ts`
  - 覆盖修改 built-in root override 后会同步写回 `builtinAgentOverrides` 并强制刷新 Rules
- `apps/desktop/tests/unit/main/skill-installer-utils.test.ts`
  - 覆盖主进程从 `builtinAgentOverrides` 读取 built-in root / skills / rules relative path 覆写
- `apps/desktop/tests/unit/services/self-hosted-sync.test.ts`
  - 覆盖 self-hosted sync push 时包含 `builtinAgentOverrides` 备份字段
- `apps/desktop/tests/unit/stores/rules.store.test.ts`
  - 覆盖 custom rule 在 settings 中被禁用后，重新加载会从可见列表中消失
- `apps/desktop/tests/unit/main/rules-workspace.test.ts`
  - 覆盖 custom agent 已从当前配置移除时，`listCachedRuleDescriptors()` 不再返回旧的 cached custom rule descriptor

## Remaining

- 更新版本号到 `0.5.6`
- 视需要继续把 built-in agent overrides 扩展到更多运行时消费面（如 config/commands/agents 的主进程写入链路）
- 视需要扩展项目分发目标预设（如 `.claude/skills`、`.gemini/skills`）与更明确的目标模板 UI
- 视需要修复仓库内既有 `typecheck` 阻塞：`AISettingsPrototype.tsx`

## Lifecycle Disposition (2026-08-18)

Status: completed. The remaining `0.5.6` version-bump checkbox is obsolete now
that the repository version is `0.6.0-beta.1`; unrelated legacy typecheck debt
is not an exit gate for this delivered feature.
