# Delta Spec

## Added

- 增加统一同步编排层规范：
- `SyncOrchestrator` 负责计划生成、执行、冲突决议、结果汇总。
- `SyncProvider` 仅负责远端能力适配（连接、读写、列目录、元数据）。
- `SyncRepository` 负责本地快照导出/导入（DB、工作区、媒体）。

- 增加 provider 能力协商：
- `capabilities.incremental`
- `capabilities.bidirectional`
- `capabilities.media`
- `capabilities.encryption`
- `capabilities.manifest`

- 增加统一错误模型：
- `SYNC_AUTH_FAILED`
- `SYNC_CONNECTIVITY_FAILED`
- `SYNC_REMOTE_NOT_FOUND`
- `SYNC_CONFLICT_DETECTED`
- `SYNC_PAYLOAD_INVALID`
- `SYNC_PROVIDER_UNSUPPORTED`

- 增加统一结果模型：
- `SyncResult` 必须包含 `direction`、`mode`、`provider`、`summary`、`warnings`、`events`。

## Modified

- 同步配置模型从“端内字段集合”升级为“共享标准模型 + 端特定扩展”：
- 标准字段：`enabled`, `provider`, `endpoint`, `credentialsRef`, `remotePath`, `autoSync`, `lastSyncAt`。
- 扩展字段使用 `providerOptions` 承载。

- Web 路由与 Desktop 服务需要改为调用统一 orchestrator 接口，而非直接编排具体 provider。

## Removed

- 禁止新增“来源直连业务流程”的同步实现（即在路由或页面逻辑中直接写 WebDAV/self-hosted 操作流程）。

## Scenarios

- Scenario: 新增 provider 不改编排
- Given 已存在 `SyncOrchestrator` 和 `SyncProvider` 契约
- When 增加 `self-hosted` provider
- Then 只新增 provider 适配实现与配置映射，不修改冲突决议与结果汇总逻辑

- Scenario: 统一错误返回
- Given provider 在认证阶段返回 401
- When orchestrator 执行 `push` 或 `pull`
- Then 返回统一错误码 `SYNC_AUTH_FAILED` 且附带 provider 上下文

- Scenario: 能力降级
- Given provider 不支持双向同步
- When 请求 `mode=bidirectional`
- Then orchestrator 按策略降级为 `push` 或 `pull`，并在 `warnings` 中记录降级原因

- Scenario: 配置兼容
- Given 旧配置仅包含 `manual | webdav` 字段
- When 启动配置迁移
- Then 系统生成标准 `SyncConfig` 并保留旧字段可回退
