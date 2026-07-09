# Implementation

## Shipped

- Added shell-aware command discovery in `apps/desktop/src/main/services/cli-installer.ts`.
  - Direct app `PATH` detection remains first.
  - Non-Windows builds now query the user's login shell with `command -v` when direct detection fails.
  - The detected executable path is reused for one-click install.
- Extended `CliStatus` with the detected package manager path/source and always-available manual install commands.
- Added a CLI settings manual install panel with copyable `pnpm` and `npm` commands.
- Updated all 7 desktop locales for the manual fallback copy.
- Added Windows CLI detection fallbacks for issue #181.
  - `where.exe prompthub` is tried after direct `prompthub --version` fails.
  - `npm config get prefix` and `npm root -g` are used to derive custom npm global prefixes such as `D:\npm-global`.
  - `prompthub.cmd`, `prompthub.exe`, and `prompthub` are probed under each resolved prefix.

## Verification

- `pnpm --dir apps/desktop exec vitest run tests/unit/main/cli-installer.test.ts tests/unit/components/cli-settings.test.tsx`
- `pnpm --filter @prompthub/desktop typecheck`
- Locale JSON parse check for `en`, `zh`, `zh-TW`, `ja`, `fr`, `de`, and `es`.
- `pnpm --filter @prompthub/desktop test -- tests/unit/main/cli-installer.test.ts --run`

## Synced Docs

- `spec/changes/active/cli-install-manual-fallback/proposal.md`
- `spec/changes/active/cli-install-manual-fallback/design.md`
- `spec/changes/active/cli-install-manual-fallback/specs/desktop/spec.md`
- `spec/changes/active/cli-install-manual-fallback/tasks.md`

## Follow-ups

- Consider surfacing the detected package manager path/source in the CLI settings diagnostics if users still report missing shell-managed tools.
- Consider exposing a user-selected CLI executable path if Windows environments hide both npm and the CLI from the Electron process.
