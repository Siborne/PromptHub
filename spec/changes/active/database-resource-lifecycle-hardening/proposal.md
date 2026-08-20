# Database Resource Lifecycle Hardening

## Status

- Phase: verify
- Status: release-pending
- Audited: 2026-08-20

## Why

The Windows canonical second-launch investigation exposed a broader resource
lifecycle pattern. PromptHub opens SQLite through `node-sqlite3-wasm`, whose
writer lock is an adjacent `<database>.lock` directory. Several task-owned
temporary database cleanup paths remove SQLite files and common sidecars but do
not remove that lock directory after a failed close. Separate Agent session
adapters can also open an external SQLite store and leak the connection when
schema validation, or a second related store open, fails.

These failures are not database schema defects, but they can leave stale locks,
file descriptors, retry failures, or task-owned artifacts after an error. The
release must not fix only one catalog path while retaining the same lifecycle
weakness elsewhere.

## Scope

- Add one database-layer primitive for bounded task-owned temporary database
  names and complete artifact cleanup.
- Apply complete cleanup to canonical catalog/checkpoint/rebuild, safety-point,
  and file-authoritative recovery temporaries.
- Close Cherry Studio, Hermes, and NanoClaw database handles on every validation
  and multi-open failure path.
- Add failure, lock-artifact, path-boundary, and integration regressions.
- Record the repository-wide SQLite open/transaction audit.

## Non-Goals

- No database schema, migration history, canonical data format, user-data root,
  or sync contract change.
- No deletion of operational `.lock` directories owned by live or unknown
  clients. The cleanup primitive is only for paths already proven task-owned.
- No change to external Agent database contents or supported schemas.
- No replacement of `node-sqlite3-wasm` and no broad Windows long-path opt-in.

## Risk And Rollback

- Incorrect cleanup ownership could remove another process's lock. Call sites
  must use the helper only for unique temporary paths or candidate roots owned
  by the current operation, after attempting to close the database.
- Connection-close changes are failure-path only; successful reads and deletes
  retain their current behavior.
- Rollback restores known stale-lock/file-descriptor leaks and is therefore not
  suitable for the replacement beta.

## Related Records

- `spec/changes/active/windows-canonical-authority-second-launch/`
- `spec/knowledge/behavior/database-concurrency.md`
- `spec/knowledge/behavior/data-recovery.md`
