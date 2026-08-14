# Implementation

## Status

In progress. `v0.6.0-beta.1` was withdrawn to a draft on 2026-08-14 after a
Windows startup failure was confirmed.

## Implemented

- Replaced read-only durability handles with write-capable handles for SQLite
  safety images, raw recovery evidence, and newly staged canonical JSON files.
- Added Windows-handle regression tests for all three startup paths.
- Added `startup:window_ready` after the main window has loaded.
- Added a bounded packaged Windows x64 smoke that seeds a `0.5.9` profile,
  launches `win-unpacked/PromptHub.exe`, and requires both the upgrade snapshot
  and loaded-window startup events.
- Added the packaged smoke as a blocking Windows x64 release workflow step.
- Updated the stable release gate and withdrew the affected beta record.

## Verification

- Focused core regression: 16 tests passed.
- Focused desktop regressions and workflow contract: 40 tests passed.
- Core and desktop typechecks passed.
- Lint, file-size, spec traceability, and specification governance passed.
- CLI full suite passed: 123 tests.
- A staged-only isolated worktree passed every non-E2E check in the full local
  release harness. The self-hosted restore E2E exposed a pre-existing race where
  its one-second success toast could disappear before the post-click assertion
  started under load.
- The restore E2E now arms its success-state listener before clicking restore;
  the focused flow passed three consecutive runs and the complete built-artifact
  smoke passed all seven tests.
- Manual GitHub Actions run `31774646606` passed the full Linux verification job
  and reached the Windows x64 packaged smoke. The smoke failed before launching
  PromptHub because Node strip-types could not transform a parameter property in
  an imported package TypeScript source file.
- The smoke now seeds SQLite through the installed `node-sqlite3-wasm` runtime
  dependency instead of importing `packages/db/src/adapter.ts`. A regression
  test executes the script with Node strip-types and requires it to reach the
  non-Windows platform guard without syntax errors.
- Manual GitHub Actions run `31775706140` again passed the full Linux
  verification job and completed Windows x64 packaging. Its packaged process
  stayed alive, but the smoke timed out because changing the child `APPDATA`
  environment variable did not reliably change Electron's Windows Known Folder
  `appData` path; the script therefore seeded and watched a profile the app did
  not select.
- The packaged main process now accepts a release-smoke-only AppData override
  when, and only when, it is a packaged Windows CI process and the requested
  directory is strictly below `RUNNER_TEMP`. Electron receives that path before
  the unchanged normal data-path resolver runs. Invalid contexts and
  out-of-root paths fail closed.
- Failure output now includes a bounded isolated-profile inventory, any startup
  logs found there, and bounded child output before cleanup.
- The AppData profile policy and release workflow wiring regressions passed 13
  focused tests; the wider data-path set passed 38 tests total, and desktop
  typecheck passed.
- The production desktop build, specification traceability validation, and the
  29-check quick release verification profile passed on the converged local
  code state.
- Manual GitHub Actions run `31778706137` reached the isolated Windows profile,
  completed the upgrade snapshot and layout migration, then exposed a second
  Windows-only startup failure: the desktop skill reconciliation marker was
  committed successfully, but an uncaught directory `fsync` returned `EPERM`.
- The marker publisher now keeps file durability mandatory while treating
  unsupported directory `fsync` as best effort, matching the repository's other
  atomic marker publishers. A regression reproduces the Windows error after
  rename and requires the committed marker to remain usable.
- The real Windows GitHub Actions runner remains required before release
  approval.

## Remaining Release Blockers

- Windows packaged `0.5.9` upgrade cold start must pass in GitHub Actions.
- The complete release workflow must pass before a replacement prerelease is
  published.
