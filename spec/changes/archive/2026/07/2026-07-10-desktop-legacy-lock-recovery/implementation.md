# Implementation

## Status

Complete locally; pending release.

## Verification Plan

- `TEST-LEGLOCK-001`: Desktop wrapper opens a current database with an
  ownerless legacy lock and removes the lock.
- `TEST-LEGLOCK-002`: shared default keeps ownerless and registered live locks.
- Run focused database/Desktop tests, relevant typechecks, and the quick release harness.

## Results

- The failing regression reproduced Desktop startup timing out on an ownerless
  pre-lease `.lock` directory with `SQLite3Error: database is locked`.
- Shared database initialization now exposes an explicit
  `recoverUnregisteredLock` option that remains disabled by default.
- Desktop enables recovery after Electron's existing single-instance gate;
  registered live clients, unknown lease entries, symbolic links, and
  non-directory lock paths remain protected.
- Stable database-concurrency knowledge and the local GitHub #184 delivery
  overlay were converged with the implemented boundary.

## Verification

- `pnpm --filter @prompthub/desktop exec vitest run tests/unit/main/database-migration-locks.test.ts`:
  5/5 passed.
- `pnpm --filter @prompthub/cli exec vitest run tests/database-concurrency.test.ts`:
  16/16 passed.
- `pnpm --filter @prompthub/db typecheck`: passed.
- `pnpm --filter @prompthub/desktop typecheck`: passed.
- `pnpm verify:release:quick`: passed all 18 stages in 289.0 seconds,
  including the CLI full test suite at 83/83.
