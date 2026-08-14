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
- The real Windows GitHub Actions runner remains required before release
  approval.

## Remaining Release Blockers

- Windows packaged `0.5.9` upgrade cold start must pass in GitHub Actions.
- The complete release workflow must pass before a replacement prerelease is
  published.
