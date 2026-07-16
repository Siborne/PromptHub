# Self-Hosted Backup-Only Delta

## Requirements

### `FR-SHB-001` Backup and sync separation

Self-hosted automatic operations MUST only create remote backup snapshots. They
MUST NOT call live Web sync import, pull remote workspace data, merge records,
or replace local data. Startup and interval triggers share the same upload-only
behavior.

### `FR-SHB-002` Exact release compatibility

Before exporting or uploading a snapshot, desktop MUST obtain its installed
version and the authenticated Web backup capability version. If either version
is unavailable or the strings are not exactly equal, the operation MUST stop
before remote backup data is written. The Web route MUST repeat the comparison
server-side and reject a mismatched client version.

### `FR-SHB-003` Immutable and recoverable remote snapshots

Web MUST store each accepted backup as a new per-user snapshot using an atomic
write. Each snapshot MUST contain a checksum and MUST be verified before it is
returned for restore. Retention cleanup MUST run only after the new snapshot is
durable and MUST never mutate the live Web database or workspace.

### `FR-SHB-004` Complete non-secret content boundary

The snapshot MUST carry all currently portable PromptHub user content,
including prompt graph data, Rules, Skill files and versions, MCP/Plugin assets,
store sources, agent asset files, and media. Plaintext AI/API credentials MUST
NOT be uploaded by this unencrypted backup channel.

### `FR-SHB-005` Explicit restore safety

Remote restore MUST be user initiated. It MUST select a verified stored
snapshot, create a local safety snapshot first, and only then run the existing
replace restore. No startup or interval path may invoke restore.

## Acceptance scenarios

1. Run startup and interval automation; both create remote snapshot files and
   neither calls `/api/sync/data` nor changes local records.
2. Report Web `0.5.8` to desktop `0.5.9`; no export or upload occurs and the
   automatic history records a skipped compatibility result.
3. Submit a matching snapshot while the Web workspace contains different data;
   the live workspace remains unchanged and a new backup file is listed.
4. Interrupt an atomic write; no partial snapshot is listed and the previous
   latest backup remains readable.
5. Restore the latest snapshot; a local safety snapshot is attempted before the
   replace restore.
