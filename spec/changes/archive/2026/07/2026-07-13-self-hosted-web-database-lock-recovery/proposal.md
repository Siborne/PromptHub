# Proposal: Recover Legacy Locks In Self-Hosted Web

## Why

The published self-hosted Web image can fail during startup with `SQLite3Error:
database is locked` when a data volume contains a legacy `.lock` directory left
by a crashed or pre-lease server process. The shared database package already
supports guarded recovery, but the Web entry point does not opt in.

## Scope

- Enable guarded legacy-lock recovery for the single-process self-hosted Web
  server.
- Add a startup regression test that reproduces a stale lock in a temporary
  `DATA_ROOT`.
- Document the single-process-per-data-root boundary for self-hosted Web.

## Non-goals

- Do not delete active locks owned by a live registered process.
- Do not add multi-replica SQLite support.
- Do not change Desktop or CLI lock policy.

## Rollback

Revert the Web initialization option and its regression test. Existing data is
not migrated or rewritten by this change.
