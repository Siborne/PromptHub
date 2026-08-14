# Implementation

## Status

In progress.

## Implemented

- Kept signed and timestamped macOS packaging mandatory.
- Added one delayed retry only for Apple's timestamp-service-unavailable error.
- Preserved the original exit status for every non-transient packaging error.

## Verification

- The workflow contract was written first and failed before implementation.
- Focused Windows startup and release workflow contracts passed: 19 tests.
- Desktop typecheck and the production build passed.
- The first quick release run refreshed the generated change index and exposed
  an unrelated dirty-worktree `deepseek-harness` adapter mismatch.
- The task-only isolated staged tree passed `pnpm verify:release:quick` across
  all 29 checks after restoring the locally cached Electron binary that the
  temporary worktree installation had not downloaded.
- Real signed packaging remains pending in GitHub Actions.
