# Proposal

## Why

PromptHub 当前在 macOS 上对所有安装来源统一暴露应用内更新入口，但实际存在两条不同的升级路径：

- 通过 DMG 手动安装的用户，应继续走应用内检查更新 -> 下载 DMG -> 手动覆盖安装。
- 通过 Homebrew Cask 安装的用户，应优先走 `brew upgrade --cask prompthub`，不应混用应用内 DMG 更新。

现状带来的问题：

- Homebrew 用户在应用内看到与 DMG 用户相同的更新动作，容易下载并手动安装 DMG，导致 Homebrew 记录版本与实际应用状态脱节。
- README 虽然已经提醒不要混用，但应用内逻辑没有识别安装来源，也没有给出清晰分流。
- 当 Homebrew tap 未及时更新时，用户更容易把 Homebrew 发布滞后误判为应用内更新逻辑坏掉。

## Scope

- In scope:
- 明确文档中的 macOS 更新路径分流
- 在桌面端增加 macOS Homebrew 安装识别
- 对 Homebrew 安装的 macOS 用户禁用应用内下载 / 安装更新路径
- 在更新弹窗中为 Homebrew 用户提供明确指引
- 补充主进程 updater 与更新弹窗相关测试

- Out of scope:
- Homebrew tap 自动发布流程重构
- GitHub release workflow 的 promote 机制调整
- Windows / Linux 更新逻辑变更

## Risks

- Homebrew 安装识别如果过于宽松，可能误伤普通 DMG 安装用户。
- Homebrew 安装识别如果过于保守，部分 brew 用户仍会继续看到应用内 DMG 更新入口。

## Rollback Thinking

- 若 Homebrew 安装识别在部分环境下不稳定，应优先回退到“文档和 UI 文案增强”而不是保留错误的自动下载路径。
- 即使检测失败，也必须保证 DMG 安装用户的现有 macOS 更新流程不被破坏。
