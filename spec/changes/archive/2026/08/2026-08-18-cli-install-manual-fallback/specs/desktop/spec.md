# Desktop CLI Install Fallback Spec

## Requirements

- `FR-CLI-001`: PromptHub must detect CLI package managers from the app environment and, on non-Windows platforms, from the user's login shell when the app environment is incomplete.
- `FR-CLI-002`: PromptHub must show copyable manual install commands for both `pnpm` and `npm` even when one-click install is unavailable.
- `FR-CLI-003`: On Windows, PromptHub must detect an installed `prompthub` CLI when it is available from `where.exe` or from the user's npm global prefix, even if the Electron process `PATH` cannot run `prompthub` directly.

## Acceptance Criteria

- `AC-CLI-001`: When `pnpm` is missing from the app `PATH` but resolvable from the login shell, CLI status reports `pnpm` as available and one-click install can use it.
- `AC-CLI-002`: When neither `pnpm` nor `npm` is detected, the CLI settings page still shows terminal commands the user can copy.
- `AC-CLI-003`: One-click install remains disabled when PromptHub cannot detect a package manager.
- `AC-CLI-004`: When Windows reports a custom npm prefix such as `D:\npm-global`, and `D:\npm-global\prompthub.cmd --version` succeeds, CLI status reports `installed: true` with the detected version.

## Verification

- `TEST-CLI-001`: Main-process unit tests for login-shell detection and manual commands.
- `TEST-CLI-002`: Renderer component tests for copyable manual commands and disabled one-click install.
- `TEST-CLI-003`: Main-process regression test for Windows custom npm prefix CLI detection.
