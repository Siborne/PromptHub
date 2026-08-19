# Proposal

## Why

PromptHub 当前的应用壳主要围绕 `Prompt` 与 `Skill` 两个一级模式展开，这在早期阶段足够简洁，但随着后续计划引入 `Agent`、`MCP`、`Runs`、`Resources`、`Rules` 等更多对象，现有双模式结构会在以下方面快速失衡：

- 一级切换无法继续承载更多核心模块
- 不同对象被迫共享同一层级语义，认知边界变模糊
- 新模块增加时需要不断扩展条件分支，增加维护成本
- 用户无法稳定地建立“这个功能属于哪里”的心智模型

用户已明确倾向采用“最左侧一级功能栏”作为应用壳，将 `Prompt / Skill / Agent / MCP` 等核心模块放入同一可扩展结构中。

## Goals

- 将 PromptHub 的顶层信息架构从“双模式切换”升级为“最左侧一级功能栏 + 第二列模块导航 + 主内容区”三段结构。
- 为未来模块扩展预留稳定的一级入口位。
- 支持后续对一级功能进行排序、显隐和个性化定制。
- 保留现有 `Skill -> Projects` 等模块内结构，不把所有对象重新打平。

## Non-Goals

- 本轮不一次性实现 Agent、MCP 的完整业务功能。
- 本轮不强制改动所有列表页和详情页的业务逻辑。
- 本轮不追求把整个桌面端一次性重写为全新 UI。

## User Flow

1. 用户在最左侧看到全局功能栏，而不是只看到 Prompt / Skill 双切换。
2. 用户点击 `Prompt` / `Skill` / `Rules` / `Agent` / `MCP` 等一级功能。
3. 第二列显示该模块下的导航项与过滤入口。
4. 主内容区继续承载该模块当前的列表、详情、编辑和运行视图。

## Product Direction

建议一级功能栏初版包括：

- Prompt
- Skill
- Rules
- Agent
- MCP
- Store / Discover
- Settings

其中：

- `Prompt`、`Skill`、`Rules`、`Agent`、`MCP` 是产品主功能
- `Store` 是外部资源获取入口
- `Settings` 固定放在底部

## This Iteration Scope

本轮真正落地的新功能模块只有一个：`Rules`。

`Rules` 用于管理 PromptHub 工作流里常见的规则文件，分为“全局规则”和“项目规则”两个区域，例如：

- 当前项目或手动添加项目目录下的 `AGENTS.md`
- 用户全局 `~/.claude/CLAUDE.md`
- 用户全局 `~/.config/opencode/AGENTS.md`

第一版仍不开放任意本地文件浏览器，但允许用户手动添加项目目录作为受管规则目录。

## Follow-up Direction

用户已经明确指出，设置页中的“额外扫描目录”只以 Skill 发现为中心，产品语义过窄，不符合 PromptHub 正在演进为 Agent 管理助手的方向。

后续应将这类能力从“额外 Skill 扫描目录”升级为“Agent 根目录管理”：

- 用户首先管理的是某个 agent / tool 的根目录地址，而不是零散的 `skills/` 子目录。
- PromptHub 再从该根目录派生并预览该平台的 `skills / rules / commands / agents / config` 等已知资产路径。
- 当平台协议允许时，用户还应能把当前项目目录登记为一个 agent workspace，而不仅仅是附加几个扫描路径。

这项能力在当前迭代先记录为产品需求，不在本轮直接实现。
