# Proposal

## Why

`apps/web-cloudflare` 当前已经包含一套 Cloudflare Workers + D1 + R2 的自部署实现，但在仓库内并未形成稳定的工程闭环：

- 包未被 lockfile 正式纳入，导致依赖安装和 typecheck 不可重复
- 上游同步脚本引用不存在的构建命令
- 运行时类型声明与实际使用的 Cloudflare API 形状不一致
- 500 错误会直接把内部错误信息回给客户端
- 当前没有最基本的 Cloudflare 端单元测试

这会让 Cloudflare 版本处于“代码存在，但难以安全验证和持续维护”的状态。

## Scope

- In scope:
  - 修复 `apps/web-cloudflare` 的 workspace / 安装 / typecheck 闭环
  - 修复 Cloudflare worker 相关脚本断链问题
  - 修复 Cloudflare 运行时类型和代码中的主要类型/安全问题
  - 补最小测试覆盖，至少覆盖 auth / sync / media 的关键路径
- Out of scope:
  - 完整实现当前所有 `501 not implemented` 的 Skills / Rules 本地能力
  - 接入新的 Cloudflare 产品或重做部署模型
  - 对外文档的大规模改写

## Risks

- Cloudflare worker 的手写 runtime declaration 可能与真实平台 API 继续漂移
- `apps/web-cloudflare` 的依赖接入可能暴露更多现有问题，需要逐步收口
- 测试补齐后可能发现当前数据结构与桌面端协议仍有更多细节不一致

## Rollback Thinking

- 如果某个修复影响过大，优先保留 workspace / typecheck / script 闭环和错误响应收敛
- 若 Cloudflare 类型接入方式出现兼容问题，可先保留最小可用的本地 declaration，再迭代切换到自动生成类型
