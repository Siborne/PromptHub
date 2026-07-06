# Proposal

## Why

当前 Web 登录和初始化表单仅依赖用户名密码与速率限制，没有任何人机验证，容易被脚本化撞库或批量尝试。需要增加一个轻量但真实生效的验证码机制。

## Scope

- 为 Web 认证增加简单验证码 challenge 接口
- 登录与首次初始化注册都必须提交有效验证码
- 前端支持刷新验证码并在失败后重新获取 challenge
- 补充前后端测试

## Risks

- 会改变 `/api/auth/login` 和 `/api/auth/register` 请求契约
- 需要同步更新现有测试辅助方法

## Rollback

- 删除 captcha challenge 接口、登录/注册字段校验与前端验证码表单
