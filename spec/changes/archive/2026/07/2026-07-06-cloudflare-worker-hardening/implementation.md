# Implementation

## Shipped

- 根仓新增 `build:web:cf`，让 Cloudflare 同步脚本不再调用不存在的构建命令。
- 通过 `pnpm install` 把 `apps/web-cloudflare` 正式纳入 workspace 安装结果与 lockfile，恢复可重复安装与 typecheck。
- `apps/web-cloudflare` 现在具备独立的 `lint` / `test` / `typecheck` 脚本。
- `apps/web-cloudflare` 新增最小测试配置：
  - `vitest.config.ts`
  - `eslint.config.mjs`
- `apps/web-cloudflare/tests/` 新增基础回归测试：
  - `auth.test.ts`：captcha 返回 SVG 且不再包含 legacy `prompt`
  - `sync.test.ts`：空快照与版本字段归一化
  - `media.test.ts`：上传媒体时写入正确的 MIME metadata
  - `worker.test.ts`：鉴权失败路径与错误消息边界
- `apps/web-cloudflare/src/worker.ts` 的 `onError` 不再把内部异常 message 直接返回给客户端。
- `apps/web-cloudflare/scripts/register-admin.ps1` 去掉旧数学验证码协议分支，只保留当前 SVG captcha 协议。
- `apps/web-cloudflare/src/media.ts` 现在按文件名写入真实 `contentType`。
- `wrangler types` 已生成 `apps/web-cloudflare/worker-configuration.d.ts`，并替换掉手写 `src/cloudflare.d.ts`。
- `packages/shared/package.json` 新增 `./utils/*` export 和 `utils` files，修复 `build:web:cf` 时 Vite 无法解析 `@prompthub/shared/utils/skill-identity` 的问题。
- 已把 Cloudflare 工程闭环与验证要求同步回长期文档：
  - `spec/knowledge/behavior/web.md`
  - `spec/workflow/04-verification/README.md`
  - `docs/cloudflare-workers.md`

## Verification

- `pnpm --filter @prompthub/web-cloudflare typecheck`
- `pnpm --filter @prompthub/web-cloudflare lint`
- `pnpm --filter @prompthub/web-cloudflare test`
- `pnpm --filter @prompthub/web-cloudflare test`（补 `worker.test.ts` 后复跑）
- `pnpm --filter @prompthub/web-cloudflare lint`（补文档/测试后复跑）
- `pnpm --filter @prompthub/web-cloudflare typecheck`（切换官方 Cloudflare 类型后复跑）
- `pnpm build:web:cf`

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-cloudflare-worker-hardening/*`
- `spec/knowledge/behavior/web.md`
- `spec/workflow/04-verification/README.md`
- `docs/cloudflare-workers.md`

## Follow-ups

- 需要决定是否把 `@prompthub/web-cloudflare` 纳入仓库级 CI / verify 流程。
- 可继续补 auth refresh / requireAuth / media download / error response 的更细回归测试。
