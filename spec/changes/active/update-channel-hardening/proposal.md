# Proposal

## Why

桌面端稳定版 / 预览版更新链路目前存在一组相关联的问题：

- 安装 `0.5.5` 预览包后，检查更新可能错误显示 `0.5.4` 可用。
- 预览通道检查更新时会报 `Cannot find channel preview.yml`。
- 用户已经安装预览包时，默认更新通道仍然是稳定版，行为与用户预期不一致。
- 稳定版在检查到更新后，顶部提示与更新弹窗的状态会互相打断，出现持续闪烁，影响实际更新。

这些问题不是单个实现细节失误，而是更新通道设计没有闭环：

- 运行时通道语义、manifest 命名、GitHub release 选择规则没有统一。
- 当前安装版本是否属于 preview 没有被建模。
- 用户显式选择的通道与系统默认推断没有分层。
- 后台自动检查与手动检查没有共享单一状态机。

## Scope

- In scope:
- 统一桌面端更新通道模型（stable / preview）
- 收敛 `updater.ts` 中 GitHub provider、generic provider、manifest 命名的职责边界
- 修复预览包默认通道、降级误报、preview manifest 缺失、UI 闪烁问题
- Signed and notarized direct-install macOS builds use the native `electron-updater`
  download and restart path instead of a manually opened DMG.
- 明确 preview release 与 stable release 的发布策略，并同步到 release 规则
- 补充主进程 updater、renderer 更新状态流、发布约束测试

- Out of scope:
- Web 自部署版本发布策略
- Homebrew 发布逻辑重构
- 网站下载页视觉改版

## Risks

- `electron-updater` 的 channel / allowDowngrade / allowPrerelease 语义较隐蔽，若修复不完整，可能引入新的误升级或误降级行为。
- 若继续让 preview 与 stable 共用同一个纯版本号（例如都叫 `0.5.5`），客户端将无法可靠区分当前安装包来源，默认通道推断仍会脆弱。
- macOS automatic replacement depends on the released ZIP artifact remaining
  Developer ID signed and notarized; Homebrew-managed installations must retain
  Homebrew as their owner.

## Rollback Thinking

- 保留稳定版优先的保守回退路径：即使 preview 通道逻辑出现异常，也必须保证 stable 通道继续从 `latest` 正常更新。
- 若新的 preview 产物命名方案上线后仍有客户端兼容风险，可暂时保留旧 manifest 别名文件作为过渡层。
