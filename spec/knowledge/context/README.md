# PromptHub Knowledge Context

`spec/knowledge/context/` 对齐最新 `spec-init` 的 knowledge/context 边界，用于沉淀 PromptHub 长期稳定的业务背景、术语、角色和产品边界。

## 项目定位

PromptHub 是一个本地优先的 Prompt、Skill、Rules 与项目级 AI 资产工作台。

它的核心目标不是单独做好某一个编辑器，而是把多个 AI 工具分散的本地资产统一纳入一个可管理、可同步、可版本化、可恢复的工作区。

## 主要用户角色

### 1. 个人开发者 / 独立创作者

- 需要管理自己的 Prompt、Skill 与规则文件
- 同时使用多个 AI 工具
- 希望尽量以本地文件和本地数据为主

### 2. AI 编程重度用户

- 同时使用 Claude Code、Codex、Gemini CLI、OpenCode、Windsurf、Cursor 等工具
- 需要在这些平台之间复用 Skill、Rules 和项目级上下文

### 3. 自部署用户

- 希望通过自部署 Web 版在浏览器中访问 PromptHub 数据
- 希望把 Web 版作为桌面端的同步或恢复目标

## 核心术语

### Prompt

PromptHub 中最基础的文本资产，支持变量、版本历史、多模型测试、标签、文件夹与媒体引用。

### Skill

基于 `SKILL.md` 与 frontmatter 的可复用 AI 能力资产，可来自本地目录、GitHub 仓库、商店源或项目工作区。

### Rules

PromptHub 用于集中管理的 AI 编程规则文件资产，包括全局规则与项目规则。它强调的是规则工作区，而不是单纯的平台检测视图。

### Project-Local Assets

存在于单个项目目录中的 AI 资产，例如：

- `.agents/skills/`
- 项目 `AGENTS.md`
- 平台特定规则目录或上下文文件

### Managed Local Repo

PromptHub 在本地工作区中维护的托管副本，用于保存 Skill 正文、sidecar、翻译、版本快照与平台分发来源。

## 长期产品边界

- PromptHub 以本地优先为基础，不把官方云服务作为默认前提
- `docs/` 只承载对外文档；内部真相源在 `spec/`
- Web 版是自部署工作区和独立备份/恢复目标，不是多租户 SaaS 平台；旧 live-sync 路由只保留兼容用途
- `spec/` 是内部 SSD / knowledge / change 的唯一归属

## 主要交付面

PromptHub 当前长期稳定的交付面主要包括：

- Prompt 管理与版本历史
- Skill 商店、导入、翻译、版本管理与多平台分发
- Rules 工作区与项目级规则文件管理
- 项目级 AI 资产工作区
- 本地优先同步、备份与恢复

这些交付面会在各 domain spec 中展开，但这里保留项目级上下文，避免项目定位只散落在多个领域文档中。

## 主要映射来源

- `spec/knowledge/context/system.md`
- `spec/knowledge/behavior/desktop.md`
- `spec/knowledge/behavior/web.md`
- `spec/knowledge/behavior/skills.md`
- `spec/workflow/00-intake/README.md`
