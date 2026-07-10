# Design: CLI/Desktop Database Concurrency

## Root Cause

The adapter returned WASM prepared statements without finalizing them after
`run`, `get`, or `all`, so completed Desktop/CLI operations could retain the VFS
writer lock. `packages/db/src/init.ts` then deleted `${dbPath}.lock` before every
open. Because `node-sqlite3-wasm` uses that directory as its cross-process
writer lock, the combination both blocked ordinary subsequent commands and
could remove a live Desktop transaction lock to admit a second writer.

## Decisions

- `DES-DBCON-001`: `packages/db` owns a sibling `${dbPath}.clients` lease
  directory. Each initialized PromptHub process registers its PID before lock
  recovery and removes the lease on close or normal process exit.
- `DES-DBCON-002`: lock recovery preserves the lock when another registered PID
  is alive. Dead and malformed leases are pruned; an orphan lock is removed only
  when a stale registered owner was found, no other live client remains, and no
  ownership metadata is unknown. Locks with no registry entry are preserved for
  mixed-version safety.
- `DES-DBCON-003`: initialization sets a five-second SQLite `busy_timeout` so
  short Desktop/CLI write overlaps serialize instead of failing immediately.
- `DES-DBCON-004`: CLI error mapping recognizes SQLite busy/locked errors and
  returns a typed conflict without treating corruption messages as lock errors.
- `DES-DBCON-005`: renderer refresh uses a small coalescing controller invoked
  by existing focus/visibility resume events. Durable state remains in SQLite.
- `DES-DBCON-006`: all leases in one process share one exit listener. Failed
  initialization removes its new lease so tests, servers, and retries do not
  accumulate listeners or false owners.
- `DES-DBCON-007`: the adapter finalizes the underlying WASM statement after
  every `run`, `get`, or `all`. A reusable wrapper transparently prepares the
  SQL again on its next operation, preserving the existing call contract while
  releasing VFS locks and native/WASM resources promptly.

## Rejected Alternatives

- WAL was not enabled as the primary fix. The current `node-sqlite3-wasm` VFS
  coordinates writes through an exclusive directory lock and does not provide
  the native shared-memory locking contract that PromptHub could safely assume
  for multi-process WAL behavior.
- Continuous `fs.watch` refresh was not added. Focus/visibility refresh covers
  the user-visible return path without platform-specific duplicate events,
  partial-write notifications, or background polling.

## Failure And Recovery

- A crashed client leaves a lease; the next initializer checks PID liveness,
  prunes the dead lease, and may remove the orphan lock.
- A PID reused by an unrelated live process causes a conservative busy failure,
  not unsafe lock deletion.
- An ownerless lock from a pre-lease PromptHub version is preserved rather than
  guessed stale; closing the older process or restarting on a clean lock resolves
  the mixed-version transition without admitting concurrent writers.
- Lease cleanup failure does not hide database close errors and is retried by a
  later initializer.

## Traceability

| Requirement                     | Design                                            | Verification                       | Task          |
| ------------------------------- | ------------------------------------------------- | ---------------------------------- | ------------- |
| `FR-DBCON-001`, `NFR-DBCON-001` | `DES-DBCON-001`, `DES-DBCON-002`, `DES-DBCON-007` | `TEST-DBCON-001`, `TEST-DBCON-005` | `T-DBCON-001` |
| `FR-DBCON-002`                  | `DES-DBCON-002`                                   | `TEST-DBCON-002`                   | `T-DBCON-002` |
| `FR-DBCON-003`                  | `DES-DBCON-003`, `DES-DBCON-004`                  | `TEST-DBCON-003`                   | `T-DBCON-003` |
| `FR-DBCON-004`                  | `DES-DBCON-005`                                   | `TEST-DBCON-004`                   | `T-DBCON-004` |
