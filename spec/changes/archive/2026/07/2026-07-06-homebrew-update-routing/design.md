# Design

## Summary

本次修复不改发布资产格式，也不改 GitHub feed 结构，只在桌面端运行时增加“安装来源感知”，将 macOS 更新路径显式分为：

- DMG 安装：允许应用内检查、下载 DMG、打开安装包。
- Homebrew 安装：允许检查更新，但不提供应用内下载 / 安装；改为提示用户执行 `brew upgrade --cask prompthub`。

## Detection Strategy

主进程在 macOS 上增加一个轻量安装来源检测函数，优先基于当前可执行文件与应用包路径判断：

- 如果 `process.execPath` 或其真实路径位于 Homebrew Cask 常见安装位置（如 `/opt/homebrew/Caskroom/...`、`/usr/local/Caskroom/...`），则判定为 `homebrew`。
- 其他已打包 macOS 场景默认视为 `direct`。

第一版不尝试覆盖所有第三方包管理器，只处理 Homebrew 与非 Homebrew 的核心分流。

## Main Process Changes

- 在 `apps/desktop/src/main/updater.ts` 中新增安装来源类型定义与检测函数
- 新增 IPC：返回 macOS 安装来源信息给 renderer
- `updater:download`
  - macOS + Homebrew：直接返回失败结果与可展示的引导文案，不进入 DMG 下载逻辑
  - macOS + direct：维持现有 `macDownloadDmg()` 路径
- `updater:install`
  - macOS + Homebrew：不再尝试打开 DMG / Downloads，直接返回 `manual: true` + brew 指引
  - macOS + direct：维持现有逻辑

## Renderer Changes

- `UpdateDialog.tsx`
  - 读取安装来源信息
  - 若平台为 macOS 且来源为 Homebrew：
    - `available` 状态下主按钮改为“查看 Homebrew 升级命令”或直接复制 / 展示命令提示
    - 不触发应用内下载
    - `downloaded` 状态不应再出现于 Homebrew 分支
  - DMG 用户继续使用原有下载 / 打开下载目录路径

## Docs Changes

- `README.md` 明确增加：
  - DMG 用户使用应用内更新
  - Homebrew 用户使用 `brew upgrade --cask prompthub`
  - 应用内更新不会再作为 Homebrew 用户的默认升级入口

## Test Strategy

- 单元测试覆盖：
  - Homebrew 路径识别
  - macOS Homebrew 分支下 `updater:download` 不进入 DMG 下载
  - 更新弹窗在 Homebrew 场景下显示正确动作文案
