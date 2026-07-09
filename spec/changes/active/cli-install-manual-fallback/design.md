# Design

## DES-CLI-001 Login Shell Detection

`apps/desktop/src/main/services/cli-installer.ts` must resolve `pnpm`, `npm`, and `prompthub` through the current process `PATH`. On non-Windows platforms, if direct lookup fails, it must also query the user's login shell with `command -v <command>`.

## DES-CLI-004 Windows CLI Prefix Detection

On Windows, `apps/desktop/src/main/services/cli-installer.ts` must not stop after `prompthub --version` fails against the Electron process environment. It should try `where.exe prompthub`, then query npm's global prefix with `npm config get prefix` and `npm root -g`, and then probe `prompthub.cmd`, `prompthub.exe`, and `prompthub` under the resolved prefix.

This fallback is scoped to CLI installation detection. It must not introduce registry lookups, hardcoded user directories, or `npx`/public-registry checks.

## DES-CLI-002 Manual Command Escape Hatch

`CliStatus` must include manual install commands for `pnpm` and `npm` regardless of package-manager detection. The renderer may still disable one-click install when no manager is detected, but users must be able to copy a command and run it in their own terminal.

## DES-CLI-003 UI Boundary

The CLI settings UI must not expose raw environment variables or PATH internals. It should show concise guidance and copyable commands only.
