# Proposal

## Why

`apps/web` 当前通过 `installDesktopBridge()` 复用 desktop renderer，但最近几轮桌面新增的 API 能力没有完整同步到 web bridge。结果是 Web runtime 虽然能打开同一套界面，却会在 Rules、Tag 管理、Skill 文件编辑、项目级 Skill、版本操作和部分设置/同步入口上出现空实现、行为退化或直接报错。

这不是单点 UI bug，而是 Web runtime 与 desktop preload contract 脱节。需要把 Web bridge、缺失的 Web 路由，以及 Web 领域稳定规范一起补齐。

## Scope

- 对齐 Web bridge 与 desktop preload 的关键 API 能力
- 为 bridge 缺失但桌面 renderer 已依赖的能力补 Web 路由
- 优先恢复 Rules、Prompt Tag 管理、Skill 文件/版本关键链路
- 补充 Web 端回归测试并同步稳定 spec

## Risks

- bridge contract 变大后，Web 端更容易受到 desktop renderer 新增 API 的影响
- 某些 desktop-only 行为在 Web 端只能提供受限语义，需要明确降级边界

## Rollback

- 回退 `installDesktopBridge()` 与新增 Web 路由
- 恢复之前的 Web runtime 降级行为
