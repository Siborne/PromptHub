# Git Backup Transports Design

<!-- traceability: enforced -->

## `DES-GITBACKUP-001`: Transport, Not Sync

Introduce `BackupTransportKind` and a Core backup transport interface separate
from `SyncProviderKind`. The payload is the existing canonical encrypted
portable snapshot. The remote repository stores opaque snapshot artifacts plus
a small non-secret manifest; it never stores an unpacked SQLite database,
media tree, token, or mergeable application state.

Use provider HTTPS APIs rather than invoking an ambient user Git executable.
Each upload creates an immutable snapshot object, then atomically advances a
dedicated latest manifest/ref with compare-and-set semantics. Retention is
explicit and bounded. Deleting a ref does not promise immediate provider-side
object erasure, which is why artifacts are encrypted before upload.

## `DES-GITBACKUP-002`: Job And Restore Lifecycle

A persisted backup job owns one bounded stream, one temporary file at most,
and an abort signal. Only one job per destination can mutate state at a time;
additional triggers coalesce or return busy. Provider calls have timeouts and a
small retry budget for idempotent operations only.

Restore downloads to a task-owned temporary path, authenticates/decrypts,
validates manifest/schema/media limits, produces an inventory preview, and then
delegates to the existing staged restore transaction. The active database is
not closed or replaced until the established restore commit point.

## `DES-GITBACKUP-003`: Credentials And Configuration

Store provider, repository owner/name, branch, retention, and schedule in
settings; store access tokens through the OS credential service referenced by
an opaque credential ID. Validate repository privacy and write permission at
setup. Logs and user-visible errors contain provider request IDs but redact
authorization headers, signed URLs, repository secrets, and snapshot keys.

## Capacity And Complexity

Snapshot creation, upload, download, and validation are `O(B)` time for artifact
bytes `B` and use bounded buffers. Remote inventory is paginated. Temporary
disk demand is bounded by one encrypted artifact plus the existing staged
restore budget; quota checks run before writing.

## Traceability

| Requirement         | Design                                   | Verification         | Task              |
| ------------------- | ---------------------------------------- | -------------------- | ----------------- |
| `FR-GITBACKUP-001`  | `DES-GITBACKUP-001`, `DES-GITBACKUP-002` | `TEST-GITBACKUP-001` | `T-GITBACKUP-002` |
| `FR-GITBACKUP-002`  | `DES-GITBACKUP-002`                      | `TEST-GITBACKUP-002` | `T-GITBACKUP-003` |
| `NFR-GITBACKUP-001` | `DES-GITBACKUP-002`, `DES-GITBACKUP-003` | `TEST-GITBACKUP-003` | `T-GITBACKUP-004` |
