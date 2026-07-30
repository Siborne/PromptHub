# Harden Data Safety Boundaries

## Why

PromptHub currently has several individually useful safeguards, but destructive
restore, online sync, migration backup, and SQLite integrity recovery do not yet
form one fail-safe data lifecycle. A remote download can replace local data
without a rollback snapshot, unencrypted provider payloads can contain local
credentials, migration can continue after its backup fails, and recoverable
index-only SQLite damage stops the application without an in-product repair.

## Scope

- Remove credentials and secret-bearing settings from portable and remote data
  snapshots, regardless of optional transport encryption.
- Require a local safety snapshot immediately before every destructive remote or
  file restore, and roll it back when restore reports partial mutation.
- Replace the Prompt/Folder/Version/Relation/Output Format graph in one SQLite
  transaction instead of a sequence of independent IPC writes.
- Make required pre-migration backups fail closed.
- Repair verified index-only SQLite integrity failures through bounded `REINDEX`
  after preserving the original database and rechecking integrity.
- Make the stable documentation consistently identify SQLite as the current
  durable source of truth for database-owned records.

## Non-goals

- This change does not implement multi-device field-level merging, delete
  tombstones, or a CRDT protocol. WebDAV/S3 remain whole-snapshot providers.
- This change does not put credentials into backup payloads under a new format.
- This change does not attempt table salvage for broad SQLite corruption.

## Risks and rollback

- Removing secrets from portable snapshots means restored devices retain their
  local credentials rather than receiving credentials from a backup.
- Automatic rollback restores the pre-operation filesystem snapshot and may
  restart Desktop. A rollback failure is surfaced as a distinct fatal error.
- Index repair is limited to diagnostics that name existing SQLite indexes; all
  other diagnostics keep the existing fail-closed behavior.

## Traceability

| Requirement | Design | Verification | Task |
| --- | --- | --- | --- |
| `FR-DSH-001` | `DES-DSH-001` | `TEST-DSH-001` | `T-DSH-001` |
| `FR-DSH-002` | `DES-DSH-002` | `TEST-DSH-002` | `T-DSH-002` |
| `FR-DSH-003` | `DES-DSH-003` | `TEST-DSH-003` | `T-DSH-003` |
| `FR-DSH-004` | `DES-DSH-004` | `TEST-DSH-004` | `T-DSH-004` |
| `FR-DSH-005` | `DES-DSH-005` | `TEST-DSH-005` | `T-DSH-005` |
| `FR-DSH-006` | `DES-DSH-006` | `TEST-DSH-006` | `T-DSH-006` |
