# Design

## `DES-SHB-001` Separate service boundary

Add a dedicated Web backup route and desktop backup client. The current
`/api/sync/data` routes remain legacy live-workspace sync APIs, while current
desktop manual/automatic backup uses `/api/backups/desktop`. The scheduler no
longer treats self-hosted Web as the selected bidirectional `syncProvider`.

## `DES-SHB-002` Two-sided compatibility gate

The protected backup capability response exposes the server release version and
backup protocol. Desktop reads its installed version through the updater bridge
and compares exact strings before export. The create route receives the client
version and repeats the exact comparison before parsing or writing the payload.
There is no fallback from backup to legacy sync.

## `DES-SHB-003` Filesystem snapshot store

Store snapshots below:

```text
<DATA_ROOT>/backups/desktop/<sha256-user-id>/<timestamp>-<uuid>.json
```

The hashed user directory prevents path injection and avoids exposing user IDs
in filenames. The envelope records ID, creation time, client/server versions,
protocol version, payload checksum, summary, and the validated snapshot. Writes
use an exclusive same-directory temp file, file `fsync`, non-replacing hard
link, and directory `fsync` on POSIX. A generated ID collision fails instead of
overwriting an immutable snapshot. The configured backup base, `desktop/`, and
per-user directory are checked with `lstat` before any child path is created;
symbolic links are rejected. The default retention is ten snapshots; pruning
happens only after the new final link is durable.

## `DES-SHB-004` Portable backup payload

Reuse the validated sync snapshot contract for portable content, but include
media inline instead of first writing it into the Web live media library.
Desktop includes a sanitized desktop settings/AI configuration snapshot so
portable preferences and provider/model definitions can be recovered while
recursively removing credential-like fields. Restore merges retained local
credentials into the remote non-secret configuration. Skill source
normalization remains the current portable sanitization boundary.

The Web route rejects request bodies above 50 MiB before JSON parsing and
filesystem write. Desktop requests use a 15-second timeout. Safe reads retry
once after a bounded delay; login, heartbeat, backup creation, and other writes
do not automatically retry because doing so could create duplicate snapshots.

## `DES-SHB-005` Restore orchestration

The desktop reads the latest verified backup, converts it to the existing
desktop backup shape, creates a local upgrade/recovery snapshot, and then calls
the current explicit replace restore. Failure before restore leaves local data
untouched; restore failures retain the local safety snapshot for recovery.

## Failure behavior

- Missing route/capability: fail as an incompatible Web deployment.
- Version mismatch or unknown version: skip automatic backup; block manual
  backup and restore with an actionable message.
- Invalid payload: reject before filesystem write.
- Credential-like fields in desktop settings/AI extras: reject server-side
  even if a custom client bypasses desktop sanitization.
- Checksum mismatch/corrupt latest snapshot: do not restore or silently choose
  an older snapshot.
- Temp/link/durability failure: remove the new final path and leave the previous
  latest snapshot readable. Old snapshot pruning never starts before this gate.

## Analyze result

- The requested behavior intentionally changes the stable self-hosted automatic
  source-of-truth from sync to backup-only.
- Existing WebDAV/S3 merge/pull policy is outside this change.
- Encrypted credential backup remains a separate decision because silently
  uploading plaintext secrets would violate the current security boundary.
- `FR-SHB-* -> DES-SHB-* -> TEST-SHB-* -> T-SHB-*` is complete and has no
  unresolved product decision for this tranche.
