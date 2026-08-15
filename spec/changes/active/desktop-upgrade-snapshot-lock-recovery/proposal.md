# Desktop Upgrade Snapshot Lock Recovery

## Phase And Status

- Phase: converge
- Status: review-pending
- Primary requirement: `FR-UPLOCK-001`
- Exit condition: a Desktop upgrade cold start recovers a provably orphaned
  `node-sqlite3-wasm` lock before the mandatory snapshot, while live or unsafe
  owners still block startup without mutating the database.

## Why

The Desktop startup gate creates an upgrade safety snapshot before normal
database initialization. Normal initialization already performs guarded orphan
lock recovery after the Electron single-instance gate, but the earlier snapshot
opens SQLite first and therefore fails with `database is locked` when a previous
PromptHub process left a dead lease and ordinary lock directory behind.

## Scope

- In scope:
  - recover a provably orphaned canonical or legacy database lock immediately
    before an upgrade snapshot;
  - preserve live-client, unknown-client, and unsafe-lock failures;
  - cover the real SQLite snapshot path with regression tests.
- Out of scope:
  - deleting locks without lease inspection;
  - allowing two PromptHub processes to share one writer database;
  - changing snapshot format, retention, or database schema.

## Risks

- Over-broad recovery could remove a live writer lock. The implementation must
  reuse `recoverDatabaseClientLock()` and its fail-closed lease/path checks.
- Retrying or skipping a failed snapshot would weaken the upgrade safety gate;
  startup remains blocked when ownership cannot be proven stale.

## Rollback Thinking

Reverting the startup preparation restores the current fail-closed behavior but
also restores the reproducible stale-lock startup failure. No data migration or
new persistent format is introduced.

## Related Records

- Stable knowledge: `spec/knowledge/behavior/database-concurrency.md`
- Runtime owner: `apps/desktop/src/main/services/upgrade-backup-startup.ts`
