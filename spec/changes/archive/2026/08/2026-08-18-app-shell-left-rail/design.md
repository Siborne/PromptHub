# Design

## Summary

将 PromptHub 的应用壳调整为三段式：

1. 最左侧一级功能栏（global left rail）
2. 第二列模块侧边栏（module sidebar）
3. 主内容区（workspace content）

## Information Architecture

### Level 1: Global Left Rail

这是新的应用壳，用于切换一级功能域。

建议初版：

- `prompt`
- `skill`
- `rules`
- `agent`
- `mcp`
- `store`
- `settings`

后续可扩展：

- `resources`
- `runs`
- `release`

### Level 2: Module Sidebar

一级功能选中后，在第二列显示对应模块导航。

示例：

#### Prompt

- All Prompts
- Favorites
- Folders
- Tags

#### Skill

- My Skills
- Projects
- Favorites
- Distribution
- Pending
- Store Sources

#### Rules

- Global Rules
- Workspace Rules
- Tool Rules

#### Agent

- My Agents
- Templates
- Runs
- Favorites

#### MCP

- Connected
- Available
- Health
- Logs

### Level 3: Workspace Content

主内容区继续承载：

- 列表
- 详情
- 编辑器
- 文件页
- 运行结果
- 版本历史

## Routing Model

当前 `viewMode: "prompt" | "skill"` 已不足以表达后续结构。

建议改为：

```ts
type AppModule =
  | "prompt"
  | "skill"
  | "rules"
  | "agent"
  | "mcp"
  | "store"
  | "settings";
```

并在各模块内部继续保留自己的二级视图：

```ts
type SkillSection =
  | "my-skills"
  | "projects"
  | "distribution"
  | "store";
```

## Personalization Strategy

用户提出希望支持功能自由选择与排序。建议分阶段交付：

### Phase A

- 固定核心顺序
- 支持少量可选功能的显隐

### Phase B

- 支持一级功能栏排序
- 支持“更多功能”收纳区

### Phase C

- 支持完整个性化布局与导出/同步偏好

原因：

- 新用户仍然需要稳定的默认布局
- 文档、教程、截图和支持沟通需要可预测结构
- 完全自由拖拽过早引入会增加认知成本

## Migration Strategy

### Phase 1: Shell Introduction

- 引入新的最左侧一级功能栏
- 保留现有模块内页面实现
- Prompt / Skill / Rules 先挂到新的壳下

### Phase 2: Internal Rewiring

- 重构全局导航状态与路由表达
- 减少 `if viewMode === ...` 的散落判断

### Phase 3: New Modules

- 引入 Agent 模块壳
- 引入 MCP 模块壳
- 再逐步接入真实业务能力

## UI Principles

- 保留 PromptHub 当前桌面端视觉语言，不直接复制外部产品界面
- 采用“最左侧一级图标栏”的导航结构，而不是照搬界面样式
- 最左栏强调稳定、低噪音、可扩展
- 第二列承担模块内部复杂度
- 主内容区保持足够宽，优先服务编辑、详情和运行场景

## Rules Module

`Rules` 是本轮唯一新增的真实模块。

### Product Role

它承载“规则工作台”，用于集中查看和编辑 PromptHub 工作流里的规则文件，而不是把这些文件分散在外部编辑器里管理。

### Initial Managed Files

第一版管理以下两类规则文件：

- 当前项目：`<repo>/AGENTS.md`
- 用户手动添加项目目录下的 `AGENTS.md`
- Claude 全局：`~/.claude/CLAUDE.md`
- Codex 全局：`~/.codex/AGENTS.md`
- Gemini CLI 全局：`~/.gemini/GEMINI.md`
- OpenCode 全局：`~/.config/opencode/AGENTS.md`

### Interaction Model

- 左侧二级列表分为“全局规则”和“项目规则”两组
- 项目规则支持手动添加目录，空态使用虚线卡片提示
- 主内容区展示规则说明与文本编辑器
- 支持保存、打开所在位置、刷新读取

### Security Model

- 不开放任意文件级路径输入
- 只允许 main 进程访问一组由共享平台注册表派生的全局规则文件，以及用户显式添加目录下的 canonical 项目规则文件
- renderer 不直接拿磁盘路径做任意读写
