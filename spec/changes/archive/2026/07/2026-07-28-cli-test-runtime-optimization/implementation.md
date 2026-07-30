# Implementation

## Status

Completed and converged on 2026-07-28.

## Baseline

- Serial isolated suite: 85.32 seconds, 114 tests.
- Four isolated forks: 73.62 seconds wall time and 269.78 seconds aggregate
  test time; rejected because the small wall-time gain costs excessive CPU.
- Serial without module isolation: 82.15 seconds; rejected because it does not
  address repeated fresh database initialization.

## Delivered

- Added one global empty, migrated, closed SQLite template per CLI test run.
- Updated ordinary CLI test roots to copy the template while preserving their
  own database files and filesystem isolation.
- Preserved an explicit unseeded mode for the fresh unified database test.
- Reused the shared harness in three test files that previously duplicated
  temporary-root creation.
- Added seeded/unseeded regression coverage and a configurable 75-second suite
  budget.

## Result

The complete suite now passes 115 tests in 22.69 seconds on the same machine,
down from 85.32 seconds for 114 tests. That is a 73.4% wall-time reduction
while keeping file execution serial and adding one test.

## Verification

- `pnpm --filter @prompthub/cli test`: passed, 13 files and 115 tests in
  22.69 seconds on the confirmation run.
- `PROMPTHUB_CLI_TEST_MAX_MS=1 ... test-harness-performance.test.ts`: failed
  as expected in global teardown, proving the budget is enforced.
- `pnpm --filter @prompthub/cli lint`: passed.
- `pnpm --filter @prompthub/cli typecheck`: passed.
- `pnpm --filter @prompthub/cli build`: passed.
- `pnpm spec:test`: passed.
- `pnpm lint:file-size`: passed.
- `git diff --check`: passed.

## Resource Cleanup

Global teardown removes the database template directory and restores any
pre-existing template environment variable. Existing per-test hooks continue
to remove copied roots, and all benchmark/test processes exited.
