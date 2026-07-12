# Account Spec Delta

## FR-CLOUD-ACC-001 桌面登录与会话状态

桌面端必须能使用 Cloud 账号登录、读取当前账号和注销。

### Scenario: 登录成功且 token 不进入 renderer

- **WHEN** 用户在桌面端提交合法 Cloud 地址、邮箱和密码
- **THEN** main process 通过桌面登录 API 创建 desktop session，并使用 Electron `safeStorage` 保存会话凭证。
- **AND** renderer 只收到脱敏用户资料和认证状态，不收到 session token。

### Scenario: 账号被禁用或进入删除流程

- **WHEN** Cloud 返回 `user_disabled`、`account_deletion_pending` 或未授权
- **THEN** 桌面端清除失效凭证，显示可理解的账号状态，并禁止继续调用需要登录的 Cloud 操作。

## FR-CLOUD-ACC-002 会话安全边界

- token 只能由 main process 读取并附加到 Cloud 请求。
- token 不得进入 renderer state、IPC 返回值、持久化日志、错误正文或测试 fixture 的真实秘密。
- safeStorage 不可用时登录必须失败并给出明确错误，不得静默写入明文 token。

## FR-CLOUD-ACC-003 套餐与权益

桌面端登录后必须能够读取并展示当前账号的有效套餐、云备份、同步设备数、云存储和官方 AI 权益；响应不得把 Stripe customer、支付对象或内部 billing 字段带入 renderer。
