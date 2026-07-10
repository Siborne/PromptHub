# PromptHub Workflow Design

`spec/workflow/02-design/README.md` 是 PromptHub 当前项目级 design 主入口，对齐锁定的 `spec-init` 基线（`f83def1`）中的 workflow/design 边界，回答“PromptHub 怎么交付这些能力”。

## 当前系统级设计轮廓

### 1. 多端结构

PromptHub 当前由三类主要运行面组成：

- `apps/desktop`：Electron 本地优先桌面应用
- `apps/web`：自部署 Web 版本
- `apps/cli`：命令行入口

### 2. 长期稳定真相源分层

PromptHub 当前把长期设计事实拆成以下几层：

- `spec/workflow/*`：项目级目标、需求、设计、验证与任务入口
- `spec/knowledge/context/`：稳定业务背景与产品边界
- `spec/knowledge/structure/`：长期架构约束与模块设计说明
- `spec/knowledge/behavior/`：长期业务行为与规则语义
- `spec/knowledge/reference/`：平台矩阵、固定资源、canonical 约定
- `spec/releases/`：发布规则与交付摘要

### 3. 变更设计层

非 trivial 变更不直接改稳定真相源，而是先进入：

- `spec/changes/active/<change-key>/proposal.md`
- `spec/changes/active/<change-key>/specs/<domain>/spec.md`
- `spec/changes/active/<change-key>/design.md`
- `spec/changes/active/<change-key>/tasks.md`
- `spec/changes/active/<change-key>/implementation.md`

### 4. spec-init 在 PromptHub 中的角色

`spec-init` 在 PromptHub 中负责稳定项目级文档边界，而 change 体系继续承载单次改动：

- intake：为什么值得做
- requirements：要交付什么
- design：当前阶段怎么交付
- implementation：先做什么
- verification：怎么验证
- tasks：现在做什么

## 当前设计入口建议

- 桌面端长期设计事实：`spec/knowledge/behavior/desktop.md` 与 `spec/knowledge/structure/`
- Skill 体系：`spec/knowledge/behavior/skills.md` 与 `spec/knowledge/structure/skill-system-design.md`
- Web 边界：`spec/knowledge/behavior/web.md`
- Rules 逻辑：`spec/knowledge/behavior/rules-workspace.md`
- Agent 平台矩阵：`spec/knowledge/reference/agent-platforms.md`

## 使用规则

- 项目级设计入口写在这里
- 单次变更的具体实现设计继续写到 `spec/changes/active/<change-key>/design.md`
- `plan` 阶段必须写清方案、权衡、失败边界和回滚；`analyze` 阶段发现设计与需求、稳定文档或实现冲突时必须暂停确认
