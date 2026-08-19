# Design

## Summary

项目级 Skill 管理将引入“项目”这一新的 Skill 组织维度，但不取代现有 `my-skills / distribution / store` 三段式结构。

本轮建议采用：

- 左侧 Skill 导航新增一级入口：`Projects`
- 在 `Projects` 入口内管理“项目列表 -> 项目详情 -> 项目 Skill 列表`
- 项目 Skill 默认不自动进入 PromptHub Skill 库
- 用户显式选择“纳入库”后，才转换为现有库内 Skill 生命周期

## Why Left Nav Is The Right Entry

现有 Skill 左侧栏已经是一级工作区导航：

- My Skills
- Favorites
- Distribution
- Pending
- Store

“项目级 Skill”在语义上并不是 Skill 列表里的一个普通过滤条件，而是一个新的工作空间：

- 它有自己的容器（项目）
- 有自己的发现方式（扫描项目目录）
- 有自己的生命周期（直接管理 vs 纳入库）

因此更适合作为左侧 Skill 区的一级入口，而不是 `my-skills` 下的一个标签筛选。

## UI Information Architecture

### Left Sidebar (Skill mode)

当前：

- My Skills
- Favorites
- Distribution
- Pending
- Store

建议改为：

- My Skills
- Projects
- Favorites
- Distribution
- Pending
- Store

其中：

- `Projects` 进入一个新的项目级 Skill 页面
- `My Skills` 仍只代表 PromptHub 库内 Skill
- `Projects` 与 `My Skills` 明确分开，避免把“项目直接管理”与“库内分发”混淆

### Projects Page Layout

推荐双栏布局：

- 左栏：项目列表
  - 项目名
  - 根目录
  - Skill 数量
  - 最近扫描时间
- 右栏：选中项目详情
  - 项目基础信息
  - 扫描目录列表
  - 项目 Skill 列表
  - 顶部操作：重新扫描 / 添加扫描目录 / 打开项目目录

### Project Skill Card Actions

每个项目 Skill 提供两组动作：

- 直接管理
  - 查看详情
  - 编辑文件
  - 翻译
  - 版本快照
  - 安全扫描
- 转入库内
  - 纳入库
  - 纳入库并分发

## Data Model

建议新增轻量模型，而不是直接把项目 Skill 混进 `skills` 表。

### New Entity: SkillProject

- `id`
- `name`
- `root_path`
- `scan_paths` (JSON array)
- `created_at`
- `updated_at`
- `last_scanned_at`

### New Entity: ProjectSkillIndex (optional)

如果需要持久化扫描结果，可新增：

- `id`
- `project_id`
- `name`
- `description`
- `version`
- `author`
- `local_path`
- `skill_md_path`
- `last_seen_at`
- `imported_skill_id` (nullable)

但第一版也可以不持久化索引，只持久化项目目录，扫描结果在进入项目页时实时生成。

## Reuse Existing Capabilities

可直接复用：

- `scanLocalPreview(customPaths)`
- `SkillScanPreview`
- 本地 repo 文件读写与版本快照
- Skill 翻译 sidecar
- Skill 安全扫描

需要补的新能力：

- 项目目录注册/删除/重命名
- 项目页与项目 Skill 详情页
- “项目 Skill 直接管理”不经过库内 Skill 的 UI 路由
- 从项目 Skill 显式纳入库的动作

## Recommended Delivery Phases

### Phase 1

- 新增 Projects 左侧入口
- 支持登记项目目录
- 支持配置项目扫描目录
- 支持扫描并列出项目 Skill
- 支持从项目 Skill 执行“纳入库”

### Phase 2

- 项目 Skill 直接详情页
- 项目 Skill 直接编辑/翻译/版本化/安全扫描

### Phase 3

- 项目 Skill 与库内 Skill 的双向状态关联
- 批量纳入库 / 批量分发

## Tradeoffs

### 方案 A：Projects 作为左侧一级入口

优点：

- 用户心智最清晰
- 容易扩展项目列表和项目详情
- 不污染现有 `my-skills`

缺点：

- 左侧导航会增加一个入口

### 方案 B：Projects 作为 My Skills 内筛选

优点：

- 改动更小

缺点：

- 用户会误以为项目 Skill 已经是库内 Skill
- 不利于表达“直接管理 / 纳入库”两条不同生命周期

结论：优先方案 A。

## Regression Hardening

项目级 Skill 第一版接通后，回归审查发现需要立刻补强三条约束，避免错误状态被 UI 放大：

- 项目扫描结果与库内 Skill 的关联只能基于稳定来源，不应退化为按名称模糊关联。
- 项目内“再次部署”必须阻止把一个 Skill 重新复制回其自身所在的目标目录树。
- 设置迁移必须优先保全旧的 `customSkillScanPaths` / `customAgentRootPaths` 数据，不能因为新字段为空数组而提前短路。

### Project Skill Identity

项目扫描出的 Skill 与库内 Skill 可以共享名称，因此不能使用 `skill.name` 作为“已在我的技能中”的兜底判断。

本轮修复采用：

- 仅在项目扫描路径与库内 `local_repo_path` / `source_url` 明确一致时，才认为该项目 Skill 已存在于 My Skills。
- 项目页面中的 `In My Skills`、`Open in My Skills`、`Distribute` 等动作全部依赖路径级匹配结果。
- 如果未来需要跨路径识别“逻辑上同一个 Skill”，应新增显式关联字段，而不是继续扩大名称匹配规则。

### Project Deploy Guardrails

项目内 Skill 直接部署到项目目录时，目标目录默认是 `<project>/.agents/skills`。当源 Skill 本身已经位于这个根目录下时，继续部署会形成 `<target>/<skill>/<skill>` 递归嵌套。

本轮修复采用双重约束：

- Renderer 在展示项目部署动作时，对已经位于目标根目录中的源 Skill 禁止继续向该根目录部署。
- Main process 的目录复制能力补充“源目录与目标目录相同”以及“目标目录位于源目录内部”的保护，避免其他入口绕过前端保护。

### Settings Migration Safety

`loadSettingsFromMainProcess()` 需要兼容主进程返回的新旧设置结构。由于空数组也会结束空值合并链，不能把 `.map()` 结果直接置于 `??` 前。

本轮修复采用：

- 先标准化 `customAgents`。
- 若标准化后为空，再显式回退到 `customAgentRootPaths`、`customSkillScanPaths`。
- `customSkillScanPaths` 继续作为兼容字段镜像，但不再主导配置来源。

## Unified Agent Config Direction

当前 PromptHub 已经把 custom agents 建模成“根目录 + 相对路径资产”的完整配置对象，但 built-in platforms 仍主要停留在“固定协议 + 仅 root override”的半统一状态。

这会造成两个问题：

- UI 上“Agent 顺序管理”和“Agent 配置管理”被拆成两套不同心智：上半部分像管理 agent，下半部分却只对 built-in 暴露 root path 覆写。
- 运行时上 `skills / rules / commands / agents / config files` 的派生来源不统一：custom agent 走完整配置，built-in 走平台常量 + root override。

本轮收敛方向：

- 将 built-in platforms 也提升为完整 agent config 的一种，只是其 `name/icon/id` 来自内置元数据。
- 设置层允许 built-in agent 覆写以下字段，而不仅是 root path：
  - `rootPath`
  - `skillsRelativePath`
  - `rulesRelativePath`
  - `agentsRelativePath`
  - `commandsRelativePath`
  - `configRelativePaths`
- `customAgents` 继续代表用户新增 agent；built-in agent 的覆写单独存入 keyed overrides，避免与内置平台生命周期混淆。

### Runtime Consumption Contract

运行时需要统一从“effective agent config”消费，而不是一部分读平台常量，一部分读 custom agent：

- Skills 平台列表：built-in platform metadata + built-in overrides + custom agents
- Rules 全局规则：built-in canonical templates + effective built-in rule path overrides + custom agent rules
- Agent/command/config 预览：统一通过 agent asset preview 派生

### Compatibility Strategy

为避免一次性打破现有设置快照，本轮采用兼容迁移：

- 现有 `customPlatformRootPaths` 继续读取，并迁移进 built-in agent overrides 的 `rootPath`
- `customSkillPlatformPaths` 继续作为 legacy fallback 读取
- 新增 built-in overrides 后，主进程优先读取新结构；若不存在，再回退旧字段

### Project Rules Scope

项目规则继续保持为用户手动管理的 workspace-level `AGENTS.md`，不自动跟随某个 agent 配置派生。

也就是说：

- global rules 跟 agent config 走
- project rules 仍是用户显式选择的项目规则文件约定
