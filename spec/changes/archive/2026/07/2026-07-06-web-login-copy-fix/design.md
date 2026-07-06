# Design

## Approach

- 在 `apps/web/src/client/pages/Login.tsx` 将副标题从 `auth.setupDescription` 改为新的 `auth.loginDescription`
- 在 7 个 Web locale 中新增 `auth.loginDescription`
- 在 `Login.test.tsx` 断言登录页显示登录说明且不显示 setup 说明

## Tradeoffs

- 采用最小改动，不调整认证状态流或路由逻辑，因为问题根因是误用文案而非 bootstrap 判断错误
