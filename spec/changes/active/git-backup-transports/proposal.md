# Git Backup Transports Proposal

## Phase And Status

- Phase: analyze
- Status: design-ready
- Primary requirements: `FR-GITBACKUP-001`, `FR-GITBACKUP-002`
- Related issue: #27
- Exit condition: users can explicitly back up and restore an encrypted portable
  snapshot through GitHub or Gitee without presenting Git as live sync.

## Why

The requested GitHub/Gitee support is a remote backup transport, not a second
database, collaborative sync protocol, or per-record version system. Keeping
that distinction prevents merge conflicts and misleading recovery promises.

## Scope

- Private GitHub and Gitee repository transports for encrypted snapshots.
- Manual and scheduled backup, inventory, validation, and restore preview.
- Existing portable snapshot and encryption semantics remain canonical.
- Bidirectional record sync, plaintext repositories, and Git conflict editing
  are out of scope.

## Risks And Rollback

- Remote credentials and repositories can be unavailable or revoked; local
  snapshots remain usable.
- Git history is not guaranteed secure deletion; plaintext is never committed.
- Restore uses existing staging and rollback instead of replacing the active DB
  directly.

## Related Records

- `spec/knowledge/behavior/sync.md`
- `spec/knowledge/behavior/data-recovery.md`
