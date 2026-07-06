# Design

## Approach

- 在 `apps/web/src/services/` 中新增内存型验证码服务，生成短时有效、一次性使用的 SVG 图形验证码 challenge。
- 在 `apps/web/src/routes/auth.ts` 增加 `GET /api/auth/captcha`，返回 `{ captchaId, imageData, expiresInSeconds }`。
- 登录和注册请求体扩展为 `username/password/captchaId/captchaAnswer`，后端先验证验证码，再进入原有鉴权或注册逻辑。
- 前端登录页和初始化页加载 challenge，提交时带上验证码字段；失败后刷新 challenge。
- Web server 的 SSR 构建必须把 `svg-captcha` 保持为 external runtime dependency，避免将其打包进 bundle 后破坏字体资源的相对路径读取。
- API 客户端类型与测试同步更新。

## Tradeoffs

- 采用内存型 challenge，简单直接，适合当前单进程 self-hosted 开发/部署模型。
- 不引入外部验证码供应商，避免增加部署成本。
- 继续使用 `svg-captcha` 的运行时字体资源，而不是复制一套自管字体逻辑，修改更小，但要求 SSR 构建不能错误内联该依赖。
