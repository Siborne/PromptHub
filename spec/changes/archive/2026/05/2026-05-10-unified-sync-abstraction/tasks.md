# Tasks

- [x] 明确变更边界
- [x] 完成 delta spec
- [x] 完成设计方案（统一抽象、接口草案、迁移路线）
- [x] 实施共享类型改造（Sync provider union 先行：manual/webdav/self-hosted/s3）
- [x] 实施 orchestrator 壳层并接入 WebDAV adapter
- [x] 实施 self-hosted adapter 接入统一 orchestrator
- [x] Web 路由切换到 orchestrator（sync push/pull 已切换，保留 legacy fallback）
- [x] Desktop 入口切换到 orchestrator（手动导出/手动同步/自动同步执行）
- [x] Desktop 手动备份入口接入 orchestrator（`DataSettings` + `UpdateDialog`）
- [x] 统一错误码与返回摘要结构（sync data/push/pull 返回 summary，push/pull 错误映射统一）
- [x] 消除 sync 路由重复设置写回逻辑（lastSyncAt 三处分支收敛为 helper）
- [x] 对齐 push/pull 返回结构可读性（push 增加显式导出计数字段）
- [x] 增补测试：契约测试、provider 适配测试（Web sync route）
- [x] 端到端回归（Web smoke）
- [x] 更新 implementation.md
- [x] 同步稳定 specs / architecture / docs
