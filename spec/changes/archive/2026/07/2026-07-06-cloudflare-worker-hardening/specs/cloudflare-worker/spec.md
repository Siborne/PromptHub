# Delta Spec

## Added

- `apps/web-cloudflare` 必须作为仓库内可重复安装、可重复 typecheck 的 workspace package 存在。
- Cloudflare worker 的辅助脚本必须只引用仓库内真实存在的构建命令。
- Cloudflare worker 的 500 错误响应不得把内部错误消息直接返回给客户端。
- Cloudflare worker 必须至少具备 auth / sync / media 关键路径的基础测试覆盖。

## Modified

- Cloudflare worker 的本地类型声明或类型接入方式必须能覆盖当前代码实际使用的 D1 / R2 API 形状。
- `register-admin.ps1` 必须与当前 captcha 接口协议保持一致，不再保留已废弃协议分支。

## Removed

- 移除 Cloudflare 管理脚本对不存在构建脚本的依赖。
- 移除 500 错误响应对内部异常 message 的直接透传。

## Scenarios

- 场景：开发者在 monorepo 根目录执行 `pnpm --filter @prompthub/web-cloudflare typecheck`
  - Given `apps/web-cloudflare` 已被正式纳入 workspace 安装结果
  - When 开发者执行 Cloudflare package 的类型检查
  - Then 不应因为缺失 lockfile importer / 缺失 node_modules / 缺失包解析而失败

- 场景：开发者执行 `prepare-upstream-contribution.ps1 -RunBuild`
  - Given 仓库提供了 Cloudflare 版公开同步脚本
  - When 脚本触发构建验证
  - Then 只能调用真实存在的仓库脚本或包脚本

- 场景：Cloudflare worker 内部抛出未处理异常
  - Given 某个 API handler 抛出内部错误
  - When `app.onError` 生成 500 响应
  - Then 客户端只能收到通用错误消息，详细错误仅进入日志
