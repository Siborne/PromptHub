# Implementation

## Implemented

- `apps/web/src/client/pages/Login.tsx` 不再复用 `auth.setupDescription`，改为独立的 `auth.loginDescription`。
- 为 Web 端 7 个 locale 新增 `auth.loginDescription`，避免已初始化实例的登录页继续显示“创建第一个管理员账户”。
- `apps/web/src/client/pages/Login.test.tsx` 增加断言：登录页显示登录说明，且不显示 setup 说明。

## Verification

- `pnpm --filter @prompthub/web exec vitest run src/client/pages/Login.test.tsx src/client/pages/Setup.test.tsx src/client/App.test.tsx`
- `pnpm lint:web`
