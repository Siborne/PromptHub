# Design

## Overview

本设计采用“三层分离”统一同步：

1. Domain Orchestrator（统一流程）
- 输入：`SyncRequest`（方向、模式、provider、策略）
- 输出：`SyncResult`（统一摘要、错误、事件）
- 责任：
- 读取 provider 能力
- 生成执行计划（plan）
- 执行步骤并收敛错误
- 统一冲突处理与可观测事件

2. Provider Adapter（来源差异）
- WebDAV、SelfHosted、未来 S3 都实现同一 `SyncProvider` 接口。
- 只关注“如何与远端通信”，不包含业务冲突逻辑。

3. Local Repository Adapter（本地差异）
- `LocalSnapshotRepository`：导出/导入 Prompt/Folder/Skill/Rule/Media。
- `WorkspaceSyncAdapter`：处理 DB 与文件树对齐（desktop 与 web 可有不同策略，但通过统一接口暴露能力）。

---

统一接口草案（TypeScript）：

```ts
export type SyncProviderKind = "manual" | "webdav" | "self-hosted" | "s3";

export type SyncDirection = "push" | "pull";
export type SyncMode = "replace" | "merge" | "bidirectional";

export interface SyncCapabilities {
  incremental: boolean;
  bidirectional: boolean;
  media: boolean;
  encryption: boolean;
  manifest: boolean;
}

export interface SyncProvider {
  kind: SyncProviderKind;
  getCapabilities(): SyncCapabilities;
  testConnection(): Promise<{ ok: boolean; status?: number; message?: string }>;
  readRemoteState(): Promise<RemoteState>;
  writeRemoteState(state: RemoteState): Promise<RemoteWriteResult>;
}

export interface SyncOrchestrator {
  execute(request: SyncRequest): Promise<SyncResult>;
}
```

## Affected Areas

- Data model:
- 新增共享 `SyncProviderKind`，共享配置从二元 provider 扩展到可拓展枚举。
- 新增 `SyncRequest` / `SyncPlan` / `SyncResult` / `SyncEvent` 结构。

- IPC / API:
- Desktop：新增统一 IPC 入口（例如 `sync:execute`, `sync:testConnection`）。
- Web：`/api/sync/push`、`/api/sync/pull` 内部改为 orchestrator 调用。

- Filesystem / sync:
- 保留 desktop 的安全策略（回收站/冲突保留）能力标签。
- Web 端推土机策略暂保留，但通过 `WorkspaceSyncAdapter` 暴露为 `supportsTrash=false`。

- UI / UX:
- 设置页改为展示 provider 能力矩阵（支持项与降级策略提示）。
- 同步结果提示统一来源于 `SyncResult`，不再拼接 provider 专属文案。

## Migration Plan

- Phase 1: 契约落地（不改行为）
- 引入共享类型与 orchestrator 壳层。
- WebDAV/self-hosted 通过 adapter 包裹现有逻辑。

- Phase 2: 路径切换（可回滚）
- Web `/api/sync/*` 与 Desktop 同步入口切到 orchestrator。
- 旧实现保留 behind flag。

- Phase 3: 行为收敛
- 统一错误码与 summary。
- 对齐 merge/replace 语义。

- Phase 4: 清理旧路径
- 移除直连编排代码与重复 DTO。

## Tradeoffs

- 优点：新增 provider 成本低、测试矩阵可复用、跨端行为一致。
- 代价：短期需要适配层和双轨维护，迁移复杂度上升。
- 取舍：先统一编排与契约，再逐步收敛细节行为，不做一次性大重写。
