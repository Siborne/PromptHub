# Implementation

## Status

Complete and converged on 2026-07-10. GitHub issue #184 remains open until a
release containing this change is published.

## Verification Plan

- `TEST-DBCON-001`: filesystem test preserves a live registered writer lock.
- `TEST-DBCON-002`: filesystem tests recover dead-owner locks and prune invalid leases.
- `TEST-DBCON-003`: CLI black-box test returns `DATABASE_BUSY` with conflict exit code.
- `TEST-DBCON-004`: renderer service tests refresh/coalesce resume events.
- `TEST-DBCON-005`: real prepared-statement writes, repeated reuse, and
  sequential reopen tests prove completed operations do not retain the lock.
- Typecheck `@prompthub/db`, `@prompthub/core`, CLI, and Desktop.
- Run focused suites, CLI suite, and the quick release harness.

## Results

- Finalized underlying WASM statements after every prepared `run`, `get`, and
  `all`, while preserving reusable statement wrappers. This removed the
  long-lived writer lock that originally made sequential CLI commands fail.
- Replaced unconditional lock deletion with PID leases, conservative unknown
  owner handling, orphan recovery, one shared exit listener, and failed-init
  cleanup.
- Added a five-second busy timeout and typed `DATABASE_BUSY` CLI conflicts.
- Added coalesced Desktop refresh on focus/visibility resume.
- Corrected the split CLI prompt command's stale imports for
  `requirePositional` and `resolvePromptIdentifier`; the new regression test
  exposed this independent refactor defect before it could mask lock results.
- Updated the data-layout superseded-database test to match its existing
  production and stable-doc contract: a target that contains every legacy row
  is not a conflict backup case.

## Verification Results

- Database concurrency regression: 15/15 passed, including real overlapping
  child processes, 500 prepared writes in one transaction, lock cleanup,
  orphan/unknown owners, init rollback, and CLI error classification.
- Desktop local refresh: 4/4 passed.
- Data-layout migration regression: 14/14 passed.
- Full CLI suite: 82/82 passed.
- `@prompthub/db`, `@prompthub/core`, CLI, and Desktop typechecks passed.
- `pnpm verify:release:quick`: all 18 stages passed in 301.3 seconds.

## Converge

- Stable concurrency behavior is recorded in
  `spec/knowledge/behavior/database-concurrency.md`.
- Local issue #184 is `local_done`; the remote issue remains open until release.
- No unresolved design decision or follow-up blocks archiving this change.
