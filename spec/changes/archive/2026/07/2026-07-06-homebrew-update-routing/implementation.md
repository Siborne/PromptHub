# Implementation

## Status

Completed.

## Shipped In This Iteration

- 文档分流说明
  - 更新 `README.md`，明确 macOS 的 DMG 用户与 Homebrew 用户必须走不同升级路径
  - 更新 `docs/README.en.md`，补充 Homebrew 升级段落与“不要混用应用内 DMG 更新”的说明
- 主进程 Homebrew 安装识别
  - 在 `apps/desktop/src/main/updater.ts` 新增 `MacInstallSource` 与 `detectMacInstallSource()`
  - 通过 `process.execPath` / Caskroom 路径判断 macOS 当前安装是否来自 Homebrew
  - 新增 `updater:installSource` IPC，供 renderer 获取安装来源
- 应用内更新分流
  - macOS + Homebrew 时，`updater:download` 不再进入 `macDownloadDmg()`
  - macOS + Homebrew 时，`updater:install` 不再尝试打开已下载 DMG 或下载目录
  - 主进程直接返回 `brew upgrade --cask prompthub` 指引，避免 Homebrew 用户继续走错误的 DMG 升级链路
- 更新弹窗行为修正
  - `apps/desktop/src/renderer/components/UpdateDialog.tsx` 读取安装来源
  - Homebrew 用户在 macOS 更新弹窗中改为看到明确提示与升级命令，不再触发应用内下载 / 安装路径
  - 新增 `settings.homebrewUpdateHint`、`settings.homebrewUpdateRequired`、`settings.openReleasesPage` 多语言文案

## Verification

- 通过：`pnpm lint`
- 通过：`pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/updater.test.ts tests/unit/main/updater-install.test.ts tests/unit/components/skill-i18n-smoke.test.tsx`
- 通过：`pnpm --filter @prompthub/desktop build`

## Tests Added / Updated

- `apps/desktop/tests/unit/main/updater.test.ts`
  - 覆盖 Homebrew Caskroom 路径识别
  - 覆盖普通 `/Applications/...` 路径仍被识别为 direct install
- `apps/desktop/tests/unit/main/updater-install.test.ts`
  - 覆盖 macOS + Homebrew 安装时，应用内安装会被阻止并返回 brew 升级提示
- `apps/desktop/tests/unit/components/skill-i18n-smoke.test.tsx`
  - 覆盖 Homebrew 更新提示相关 i18n key 在所有 locale 中存在

## Remaining

- 如后续需要，可继续把同样的 Homebrew 分流说明同步到其他本地化 README
- 如后续需要，可在 UI 中增加“复制 brew 升级命令”之类的便捷动作
