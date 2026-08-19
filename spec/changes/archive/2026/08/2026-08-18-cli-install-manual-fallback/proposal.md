# CLI Install Manual Fallback

## Purpose

macOS apps launched from Finder do not reliably inherit the user's terminal `PATH`. PromptHub's CLI settings page can therefore fail to detect `pnpm` or `npm` even when they are available in the user's shell.

Windows users can hit the same class of failure when `@prompthub/cli` is installed under a custom npm global prefix such as `D:\npm-global`: terminal commands like `prompthub --version` and `where prompthub` can work, while the Electron main process still reports the CLI as missing because it only sees its launch-time `PATH`.

## Scope

- Detect package managers through the app environment first, then through a login shell on Unix-like platforms.
- Detect the PromptHub CLI on Windows through `where.exe` and npm global prefix fallbacks when the app environment does not resolve `prompthub`.
- Always expose copyable manual install commands for `pnpm` and `npm`.
- Keep one-click install disabled when no package manager is actually detected by PromptHub.

## Impact

Users can recover by running the displayed command in their own terminal, while one-click install becomes more reliable for macOS Finder launches.
