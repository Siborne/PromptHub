# Proposal

## Why

当前同步能力已经覆盖 WebDAV、自托管 Web、DB 与工作区文件树，但实现呈现“来源即流程”的分叉形态：

- Web 侧由路由直接编排 provider 逻辑，provider 枚举仅覆盖 `manual | webdav`。
- Desktop 侧存在独立的 WebDAV 与 self-hosted 同步服务，行为语义不一致（增量、双向、加密、冲突策略）。
- 共享设置类型与实际能力不一致，导致配置模型分裂。

这会带来三类成本：

- 功能扩展成本高：新增一个同步源需要复制流程而不是实现适配器。
- 行为一致性差：不同端/不同源的冲突处理与错误语义不统一。
- 验证难度高：测试矩阵按来源爆炸，难以建立通用回归保障。

本变更目标是定义统一同步抽象：一套编排逻辑，多源适配实现。

## Scope

- In scope:
- 定义跨端统一同步领域模型：`SyncProvider`、`SyncOrchestrator`、`SyncPlan`、`SyncResult`。
- 定义 provider 能力协商机制（增量、双向、媒体、加密、远端 manifest）。
- 定义统一配置模型与迁移策略（向后兼容 `manual | webdav`，引入 self-hosted）。
- 明确 Web 与 Desktop 的接入边界与阶段性迁移路线。
- 定义统一错误模型、冲突处理策略和可观测性事件。
- 定义测试策略与验收标准。

- Out of scope:
- 本变更不直接重写现有所有同步实现。
- 本变更不引入新的远端存储源（例如完整 S3 provider 实现）。
- 本变更不修改业务数据结构（Prompt/Skill/Rule 的核心 schema）。

## Risks

- 迁移期间双轨并存，若缺少适配层契约测试，可能引入行为回归。
- 配置模型升级若处理不当，可能导致旧用户同步设置失效。
- 统一错误码后，旧 UI 依赖字符串提示可能出现兼容问题。

## Rollback Thinking

- 采用 feature flag：`sync.unifiedOrchestrator`。
- 保留旧路径入口（Web 路由直连 WebDAV、Desktop 直连现有服务）作为回退通道。
- 配置迁移采用非破坏式：保留原字段，新增标准字段，回滚时可直接读取旧字段。
