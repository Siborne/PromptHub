# Proposal

## Why

当前 Web 登录页直接复用了 `auth.setupDescription`，导致实例已经初始化且存在用户时，登录页仍显示“请先创建第一个管理员账户”，误导用户以为后端状态异常。

## Scope

- 为登录页提供独立的登录说明文案
- 保持 Setup 页继续使用初始化说明文案
- 补充回归测试，防止登录页再次误用 setup copy

## Risks

- 仅涉及 Web 登录页 copy 和测试，风险低

## Rollback

- 回退登录页文案 key 引用和新增 locale 键
