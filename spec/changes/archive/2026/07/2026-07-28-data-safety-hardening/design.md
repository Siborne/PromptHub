# Design

## `DES-DSH-001` Secret-free snapshot builder

`database-backup.ts` remains the single Desktop snapshot builder, but it always
uses the shared sensitive-field allow-out policy. AI provider/model API keys,
root API keys, sync credentials, and encryption passwords are omitted. Restore
merges non-secret settings while preserving local sensitive fields.

## `DES-DSH-002` Lazy restore safety guard

Provider orchestration injects a lazy `beforeRestore` hook into WebDAV/S3 sync.
The hook creates one upgrade snapshot only after the remote payload and manifest
have been downloaded and validated, immediately before local mutation. A paired
failure hook restores that snapshot when the restore path reports a partial
mutation. Manual import and self-hosted restore use the same snapshot/rollback
contract.

Restore guards explicitly allow a manifest-only empty baseline. This keeps
first-run restores recoverable too: a failed restore can remove partial new
state and return to the original empty data directory.

This avoids a full filesystem copy for upload-only auto-sync. Snapshot creation
is O(total durable files and bytes); it runs only on a destructive restore path.

## `DES-DSH-003` Transaction-level graph IPC

A single typed IPC operation accepts the validated graph snapshot. The main
process validates collection shapes, then deletes and reinserts the complete
graph inside one SQLite transaction. Workspace projection runs only after
commit. Renderer fallback remains only for web/legacy runtimes without SQLite;
Desktop no longer sequences independent direct-write IPC calls.

## `DES-DSH-004` Fail-closed migration backup

`packages/db` determines whether migration is required before opening the write
connection. If copying the existing database fails, initialization throws and
releases the client lease. Upgrade bootstrap snapshot failure likewise stops
startup rather than allowing layout/database mutation to proceed.

## `DES-DSH-005` Narrow transactional index repair

The integrity classifier accepts only `wrong # of entries in index <name>`
diagnostics. Every name must resolve to an existing SQLite index. The database is
copied once, all named indexes are quoted and rebuilt inside one transaction,
and `quick_check` runs before commit and again through a fresh connection. Any
unexpected diagnostic rolls back and stops startup.

## `DES-DSH-006` Stable ownership convergence

The legacy data-layout document is corrected to match the implemented ownership
boundary: SQLite owns relational records; `data/` owns package files and media;
workspace Markdown is a projection, not a complete database replacement.

## Failure boundaries

- Safety snapshot failure: no restore starts.
- Restore failure before mutation: no rollback is needed.
- Restore failure after mutation: rollback snapshot is applied; incomplete
  rollback is surfaced separately.
- Migration backup failure: no migration starts.
- Unsupported SQLite damage: database is untouched and startup remains blocked.
