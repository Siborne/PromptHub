# Database Resource Lifecycle Design

<!-- traceability: enforced -->

## `DES-DBLIFE-001`: Database-Owned Temporary Primitive

`packages/db` owns a small primitive that:

- creates `.<validated-label>-<full-uuid>.db` below a caller-selected parent;
- enforces a maximum 64-character basename and rejects unsafe labels;
- removes a task-owned database plus `-journal`, `-shm`, `-wal`, and `.lock`;
- uses recursive removal only for the adjacent lock directory, after the caller
  has established task ownership and attempted connection closure.

Path creation is `O(1)` time/space. Cleanup touches at most five known paths and
does not scan a directory. The helper does not inspect or recover operational
client leases; that remains owned by `database-client-lock.ts`.

## `DES-DBLIFE-002`: Canonical And Recovery Adoption

Canonical catalog, full-storage catalog, checkpoint verification/snapshot,
catalog self-heal, file-authoritative recovery, and consistent-image failure
paths use the database primitive. Checkpoint directory staging remains a
separate bounded same-parent directory because it contains a complete tree, not
only SQLite artifacts. Both automatic startup and selected-database recovery
use the same `.canonical-checkpoint-<uuid>` target form; a recovery label or PID
does not add another unbounded ancestor segment.

No success-path data, schema, hash, quick-check, rename, or publication order
changes.

## `DES-DBLIFE-003`: External Store Close Boundaries

Cherry Studio and Hermes separate connection construction, schema validation,
and user operation so validation is inside a close-owning `try/finally`.
Cherry Skill closes the database if capability-table probing throws. NanoClaw
nests the paired outbound open inside the inbound connection's `try/finally`,
so failure of the second constructor still closes the first handle.

## Audit Boundary

- 44 production `Database` / `DatabaseAdapter` construction sites were traced.
  Long-lived main database instances are closed by `closeDatabase()`; returned
  Agent handles transfer ownership explicitly; other inspected opens use
  `try/finally` after this change.
- 53 production SQLite transaction call sites were scanned. None passes an async callback
  to the synchronous adapter.
- Existing database client leases, migration intent, busy timeout, integrity
  repair, and guarded orphan-lock recovery remain unchanged.
- The upstream Windows VFS limit still constrains a user-selected data root that
  is itself excessively long. This change removes PromptHub's avoidable path
  amplification; it does not claim OS-level support for arbitrary roots.

## Verification

- `TEST-DBLIFE-001`: helper boundary, sidecar/lock cleanup, unrelated sibling,
  and symlink-target preservation tests.
- `TEST-DBLIFE-002`: canonical/checkpoint/recovery failures leave no owned
  SQLite artifacts and retain successful publication semantics.
- `TEST-DBLIFE-003`: external store invalid-schema and paired-open failures close
  every opened connection while retaining existing error codes.

## Traceability

| Requirement      | Design           | Verification                         | Task                                           |
| ---------------- | ---------------- | ------------------------------------ | ---------------------------------------------- |
| `NFR-DBLIFE-001` | `DES-DBLIFE-001` | `TEST-DBLIFE-001`, `TEST-DBLIFE-002` | `T-DBLIFE-001`, `T-DBLIFE-003`, `T-DBLIFE-004` |
| `NFR-DBLIFE-002` | `DES-DBLIFE-001` | `TEST-DBLIFE-001`, `TEST-DBLIFE-002` | `T-DBLIFE-001`, `T-DBLIFE-003`, `T-DBLIFE-004` |
| `FR-DBLIFE-001`  | `DES-DBLIFE-003` | `TEST-DBLIFE-003`                    | `T-DBLIFE-002`, `T-DBLIFE-003`, `T-DBLIFE-004` |
