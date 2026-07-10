# Database Concurrency Spec Delta

## FR-DBCON-001 Preserve active writers

When a PromptHub process opens the shared SQLite database, initialization MUST
preserve a `.lock` owned by another live PromptHub database client. It MUST NOT
classify every existing lock as stale.

Completed prepared-statement operations MUST release their underlying WASM
statement and writer lock without requiring Desktop to exit.

## FR-DBCON-002 Recover orphan locks

When all registered owners of an existing database lock are dead,
initialization MAY remove the orphan lock and MUST prune stale lease metadata.
An existing lock without a verifiable registered owner MUST be preserved.

## FR-DBCON-003 Actionable CLI conflicts

When the CLI exhausts the bounded lock wait, it MUST return a conflict exit code
and an actionable `DATABASE_BUSY` error instead of a generic internal error.

## FR-DBCON-004 Desktop refresh on resume

When Desktop regains focus or visibility, it MUST refresh prompts, prompt
relations, output formats, and folders without requiring an application restart.

## NFR-DBCON-001 Data safety

The fix MUST keep SQLite as the sole durable source of truth and MUST NOT allow
two writers by deleting a lock whose owner is still alive.

## Acceptance Criteria

- `AC-DBCON-001`: an active registered owner keeps the `.lock` directory intact.
- `AC-DBCON-002`: a dead registered owner is pruned and its orphan lock recovers.
- `AC-DBCON-003`: lock exhaustion returns exit code 4 and `DATABASE_BUSY`.
- `AC-DBCON-004`: repeated resume events coalesce and refresh local data.
- `AC-DBCON-005`: failed initialization leaves no lease or exit-listener leak.
- `AC-DBCON-006`: sequential CLI writes and reusable prepared statements leave
  no writer lock after the operation completes.
