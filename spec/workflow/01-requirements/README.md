# PromptHub Workflow Requirements

`spec/workflow/01-requirements/README.md` 是 PromptHub 当前项目级 requirements 主入口，对齐锁定的 `spec-init` 基线（`f83def1`）中的 workflow/requirements 边界，回答“PromptHub 要交付什么”。

## 项目级需求轮廓

### FR-001 统一管理 AI 工作流资产

PromptHub 必须让用户在同一工作区中管理 Prompt、Skill、Rules 与项目级 AI 资产，而不是依赖多个工具目录分散维护。

### FR-002 本地优先 + 可恢复

PromptHub 必须默认以本地优先方式保存用户数据，并提供同步、备份、恢复、迁移与版本历史能力。

### FR-003 支持多平台 Skill 分发

PromptHub 必须支持把同一份 Skill 分发到多个 AI 工具平台，并允许用户控制平台目录、分发模式和项目级目标。

### FR-004 支持桌面端与自部署 Web 协同

PromptHub 必须支持桌面端作为主工作区，同时允许 Web 作为浏览器访问入口和同步目标。

### FR-005 文档与实现必须可追踪

PromptHub 的非 trivial 变更必须留下可追踪的内部 spec / design / tasks / implementation 记录，而不是只留在聊天记录或代码 diff 中。

## 非功能需求轮廓

### NFR-001 本地数据安全

本地数据能力必须覆盖加密、主密码、迁移安全、升级恢复与备份边界。

### NFR-002 跨平台可用性

桌面端必须持续支持 macOS / Windows / Linux。

### NFR-003 文档体系可演进

内部 `spec/` 体系必须允许长期演进，并能兼容 `spec-init` 文档边界与现有 PromptHub change workflow。

## 当前稳定需求真相源

- `spec/workflow/00-intake/README.md`
- `spec/knowledge/context/system.md`
- `spec/knowledge/behavior/desktop.md`
- `spec/knowledge/behavior/web.md`
- `spec/knowledge/behavior/skills.md`
- `spec/knowledge/behavior/sync.md`
- `spec/releases/release-rules.md`

## 使用规则

- 跨领域、跨版本的长期需求先沉淀到 `spec/workflow/01-requirements/README.md`，需要稳定行为细化时再同步到相关 `spec/knowledge/*`
- 单次变更引入的增量需求先写到 `spec/changes/active/<change-key>/specs/<domain>/spec.md`
- 进入实现前，每条变更需求必须能在 analyze 中回链到 `DES-*`、`TEST-*` 和 `T-*`
